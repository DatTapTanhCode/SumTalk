"""AI stages after transcription: summary (#70) and translation (#63).

They run on their own worker thread, separate from speech-to-text, so a failed summary or translation
never makes the transcription run again. Every job:
  - is retried as a whole up to AI_JOB_RETRIES times (with backoff), then marked `failed` with the error;
  - stops at AI_JOB_TIME_LIMIT_SEC (checked between model calls; each call has its own HTTP timeout),
    so nothing stays `running` forever.
Translations are saved batch by batch, so a retry only translates the segments still missing.
"""

from __future__ import annotations

import logging
import time

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..ai import llm_client
from ..ai.llm_client import LLMClient, LLMError, MockLLMClient, Usage
from ..ai.summary import Line, SummaryTimeout, summarize
from ..ai.translation import SegmentText, needs_translation, translate_batch
from ..config import get_settings
from ..db import SessionLocal
from ..models import AIStatus, Meeting, MeetingStatus, Segment, SegmentTranslation, Summary, Translation
from .jobs import Worker

log = logging.getLogger(__name__)
settings = get_settings()


class TranslationTimeout(LLMError):
    pass


class _Gone(Exception):
    """The meeting / translation was deleted or reset while the job ran: stop quietly."""


def final_segments(db: Session, meeting_id: str) -> list[Segment]:
    return list(
        db.scalars(
            select(Segment)
            .where(Segment.meeting_id == meeting_id, Segment.kind == "final")
            .order_by(Segment.start, Segment.idx)
        )
    )


def _error_message(exc: Exception) -> str:
    if isinstance(exc, LLMError):
        return str(exc)
    return f"{exc.__class__.__name__}: {exc}"


def _model_name(client: LLMClient, configured: str) -> str:
    return "mock" if isinstance(client, MockLLMClient) else configured


def _backoff(attempt: int) -> None:
    if settings.ai_retry_backoff_sec > 0:
        time.sleep(settings.ai_retry_backoff_sec * (attempt + 1))


# --------------------------------------------------------------------------- summary (#70)


def get_summary(db: Session, meeting_id: str) -> Summary | None:
    return db.scalar(select(Summary).where(Summary.meeting_id == meeting_id))


def request_summary(db: Session, meeting_id: str, language: str | None = None) -> Summary:
    """Create the summary, or reset it to `pending` for a new run. The caller commits, then calls enqueue_summary."""
    summary = get_summary(db, meeting_id)
    if summary is None:
        summary = Summary(meeting_id=meeting_id, language=language or settings.default_summary_language, generation=0)
        db.add(summary)
    elif language:
        summary.language = language
    summary.status, summary.error = AIStatus.PENDING, None
    summary.generation = (summary.generation or 0) + 1
    return summary


def enqueue_summary(meeting_id: str) -> None:
    ai_worker.submit("summary", meeting_id)


def run_summary_job(meeting_id: str, client: LLMClient | None = None) -> None:
    client = client or llm_client.get_llm_client()
    generation: int | None = None
    for attempt in range(settings.ai_job_retries + 1):
        with SessionLocal() as db:
            summary = get_summary(db, meeting_id)
            meeting = db.get(Meeting, meeting_id)
            if summary is None or meeting is None or summary.status not in AIStatus.ACTIVE:
                return
            if meeting.status != MeetingStatus.DONE:
                return  # transcription is running again; it queues the summary when it finishes
            if generation is not None and summary.generation != generation:
                return  # a newer request is queued
            generation, language, title = summary.generation, summary.language, meeting.title
            summary.status, summary.model = AIStatus.RUNNING, _model_name(client, settings.summary_model)
            db.commit()
            lines = [Line(s.idx, s.start, s.text) for s in final_segments(db, meeting_id)]

        try:
            run = summarize(
                client,
                lines,
                language=language,
                title=title,
                deadline=time.monotonic() + settings.ai_job_time_limit_sec,
            )
        except Exception as exc:
            error = _error_message(exc)
            log.warning("Summary of %s failed (attempt %d): %s", meeting_id, attempt + 1, error)
            if attempt < settings.ai_job_retries and not isinstance(exc, SummaryTimeout):
                _backoff(attempt)
                continue
            _finish_summary(meeting_id, generation, status=AIStatus.FAILED, error=f"Summary failed: {error}")
            return

        usage = run.usage
        log.info(
            "Summary of %s: %s, %d chunk(s), %d call(s), %d+%d tokens, %.1f s, ~$%.4f",
            meeting_id, run.mode, run.chunks, usage.calls, usage.input_tokens, usage.output_tokens,
            usage.latency_sec, usage.cost_usd,
        )  # fmt: skip
        _finish_summary(
            meeting_id,
            generation,
            status=AIStatus.DONE,
            content=run.minutes.model_dump(),
            mode=run.mode,
            calls=usage.calls,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            latency_sec=round(usage.latency_sec, 3),
            cost_usd=usage.cost_usd,
            error=None,
        )
        return


def _finish_summary(meeting_id: str, generation: int, **fields) -> None:
    with SessionLocal() as db:
        summary = get_summary(db, meeting_id)
        if summary is None or summary.generation != generation:
            return  # deleted, or regenerated meanwhile: the newer run saves its own result
        for key, value in fields.items():
            setattr(summary, key, value)
        db.commit()


# --------------------------------------------------------------------------- translation (#62, #63)


def get_translation(db: Session, meeting_id: str, target_lang: str) -> Translation | None:
    return db.scalar(select(Translation).where(Translation.meeting_id == meeting_id, Translation.target_lang == target_lang))


def enqueue_translation(translation_id: int) -> None:
    ai_worker.submit("translate", str(translation_id))


def run_translation_job(translation_id: str, client: LLMClient | None = None) -> None:
    client = client or llm_client.get_llm_client()
    tid = int(translation_id)
    for attempt in range(settings.ai_job_retries + 1):
        with SessionLocal() as db:
            translation = db.get(Translation, tid)
            if translation is None or translation.status not in AIStatus.ACTIVE:
                return
            meeting = db.get(Meeting, translation.meeting_id)
            if meeting is None or meeting.status != MeetingStatus.DONE:
                return
            target = translation.target_lang
            translation.status, translation.error = AIStatus.RUNNING, None
            translation.model = _model_name(client, settings.translation_model)
            db.commit()

        try:
            _translate_missing(tid, translation.meeting_id, target, client, time.monotonic() + settings.ai_job_time_limit_sec)
        except _Gone:
            return
        except Exception as exc:
            error = _error_message(exc)
            log.warning("Translation %s failed (attempt %d): %s", tid, attempt + 1, error)
            if attempt < settings.ai_job_retries and not isinstance(exc, TranslationTimeout):
                _backoff(attempt)
                continue
            _update_translation(tid, status=AIStatus.FAILED, error=f"Translation failed: {error}")
            return
        _update_translation(tid, status=AIStatus.DONE, progress=100, error=None)
        return


def _translate_missing(tid: int, meeting_id: str, target: str, client: LLMClient, deadline: float) -> None:
    """Translate the final segments that have no saved translation yet, batch by batch, in time order."""
    with SessionLocal() as db:
        segments = final_segments(db, meeting_id)
        done = set(db.scalars(select(SegmentTranslation.segment_id).where(SegmentTranslation.translation_id == tid)))
    total = len(segments)
    todo = [s for s in segments if s.id not in done]
    if not todo:
        return

    # Already in the target language: kept unchanged, never sent to the model.
    keep = [s for s in todo if not needs_translation(s.text, s.language, target)]
    if keep:
        _save_batch(tid, {s.id: s.text for s in keep}, total, skipped=True)

    position = {s.id: i for i, s in enumerate(segments)}
    pending = [s for s in todo if needs_translation(s.text, s.language, target)]
    size = max(1, settings.translation_batch_segments)
    for start in range(0, len(pending), size):
        if time.monotonic() > deadline:
            raise TranslationTimeout("The translation took longer than the time limit.")
        batch = pending[start : start + size]
        first = position[batch[0].id]
        context = [s.text for s in segments[max(0, first - 2) : first]]
        usage = Usage()
        result = translate_batch(
            client,
            [SegmentText(s.id, s.text, s.language) for s in batch],
            target,
            context=context,
            usage=usage,
        )
        _save_batch(tid, result, total, usage=usage)


def _save_batch(tid: int, texts: dict[int, str], total: int, *, skipped: bool = False, usage: Usage | None = None) -> None:
    """Upsert segment translations and update progress, in one transaction."""
    with SessionLocal() as db:
        translation = db.get(Translation, tid)
        if translation is None or translation.status != AIStatus.RUNNING:
            raise _Gone()
        existing = {
            row.segment_id: row
            for row in db.scalars(
                select(SegmentTranslation).where(
                    SegmentTranslation.translation_id == tid, SegmentTranslation.segment_id.in_(list(texts))
                )
            )
        }
        for segment_id, text in texts.items():
            row = existing.get(segment_id)
            if row is None:
                db.add(SegmentTranslation(translation_id=tid, segment_id=segment_id, text=text, skipped=skipped))
            else:
                row.text, row.skipped = text, skipped
        db.flush()
        saved = db.query(SegmentTranslation).filter(SegmentTranslation.translation_id == tid).count()
        translation.progress = min(100, saved * 100 // total) if total else 100
        if usage is not None:
            translation.calls += usage.calls
            translation.input_tokens += usage.input_tokens
            translation.output_tokens += usage.output_tokens
            translation.cost_usd += usage.cost_usd
        db.commit()


def _update_translation(tid: int, **fields) -> None:
    with SessionLocal() as db:
        translation = db.get(Translation, tid)
        if translation is None:
            return
        for key, value in fields.items():
            setattr(translation, key, value)
        db.commit()


# --------------------------------------------------------------------------- pipeline hooks


def reset_for_transcription(meeting_id: str) -> None:
    """The transcript is being (re)built: translations refer to the old segments and the summary is stale."""
    with SessionLocal() as db:
        db.execute(delete(Translation).where(Translation.meeting_id == meeting_id))
        summary = get_summary(db, meeting_id)
        if summary is not None:
            summary.status, summary.content, summary.error = AIStatus.PENDING, None, None
            summary.generation = (summary.generation or 0) + 1
        db.commit()


def after_transcription(meeting_id: str) -> None:
    """Summary is created automatically once the final transcript is ready (AC #67-1), in the language
    chosen last time for this meeting, or DEFAULT_SUMMARY_LANGUAGE."""
    with SessionLocal() as db:
        if db.get(Meeting, meeting_id) is None:
            return
        request_summary(db, meeting_id)
        db.commit()
    enqueue_summary(meeting_id)


def resume_unfinished() -> None:
    """Queue again the AI jobs interrupted by a server restart."""
    with SessionLocal() as db:
        summaries = db.scalars(select(Summary.meeting_id).where(Summary.status.in_(AIStatus.ACTIVE))).all()
        translations = db.scalars(select(Translation.id).where(Translation.status.in_(AIStatus.ACTIVE))).all()
    for meeting_id in summaries:
        enqueue_summary(meeting_id)
    for tid in translations:
        enqueue_translation(tid)


ai_worker = Worker("ai", {"summary": run_summary_job, "translate": run_translation_job})
