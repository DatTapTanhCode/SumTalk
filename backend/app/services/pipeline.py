"""Processing pipeline.

Recording : PCM chunks --run_live (after every chunk)--> "live" segments
            finalize --> audio.wav --transcribe_meeting--> "final" segments (replace the live ones)
Upload    : original file --convert--> audio.wav --transcribe_meeting--> "final" segments
After transcribe_meeting: summary (automatic) and translation (on request) run in services/ai_jobs.py.
"""

import logging
import threading
import time
from dataclasses import dataclass, field

from sqlalchemy import delete, func, select

from ..config import SAMPLE_RATE, SAMPLE_WIDTH, get_settings
from ..db import SessionLocal
from ..models import Meeting, MeetingStatus, Segment, utcnow
from . import ai_jobs, audio, storage
from .jobs import Worker, meeting_lock
from .transcriber import TranscribedSegment, transcriber

log = logging.getLogger(__name__)
settings = get_settings()

TAIL_SEC = 1.0

# The sentence still being spoken (not committed yet): (stable start, whole text). The stable start is
# what the last two passes agreed on - it will not change; the rest may still be corrected.
live_partials: dict[str, tuple[str, str]] = {}


@dataclass
class LiveState:
    """The previous live pass of a meeting, to find the words two passes agree on (LocalAgreement-2)."""

    offset: int = 0  # window start (samples) of that pass
    words: list[tuple[float, float, str]] = field(default_factory=list)  # seconds from the recording start


live_state: dict[str, LiveState] = {}
_last_live_run: dict[str, float] = {}


def forget_live(meeting_id: str) -> None:
    live_partials.pop(meeting_id, None)
    live_state.pop(meeting_id, None)
    _last_live_run.pop(meeting_id, None)


def _update(meeting_id: str, **fields) -> Meeting | None:
    with SessionLocal() as db:
        meeting = db.get(Meeting, meeting_id)
        if meeting is None:
            return None
        for key, value in fields.items():
            setattr(meeting, key, value)
        db.commit()
        return meeting


def _fail(meeting_id: str, message: str) -> None:
    forget_live(meeting_id)
    _update(meeting_id, status=MeetingStatus.FAILED, error=message)


def _dominant_language(db, meeting_id: str, kind: str) -> str | None:
    return db.scalar(
        select(Segment.language)
        .where(Segment.meeting_id == meeting_id, Segment.kind == kind, Segment.language.is_not(None))
        .group_by(Segment.language)
        .order_by(func.sum(Segment.end - Segment.start).desc())
        .limit(1)
    )


# --------------------------------------------------------------------------- live transcription


SENTENCE_END = (".", "?", "!", "…", "。", "？", "！")


def _finished_sentences(
    segment: TranscribedSegment, limit: float
) -> tuple[TranscribedSegment, float, str] | None:
    """Whisper often returns one long segment for continuous speech. Using word timings, split it
    after the last finished sentence that ends before `limit`.
    Returns (finished part, time to resume from, text of the unfinished rest)."""
    words = segment.words or []
    for i in range(len(words) - 2, -1, -1):
        _, end, word = words[i]
        if end <= limit and word.strip().endswith(SENTENCE_END):
            done = "".join(w[2] for w in words[: i + 1]).strip()
            rest = "".join(w[2] for w in words[i + 1 :]).strip()
            return TranscribedSegment(segment.start, end, done, segment.language), words[i + 1][0], rest
    return None


def _norm(word: str) -> str:
    return "".join(ch for ch in word.lower() if ch.isalnum())


def agreed_prefix(previous: list[tuple[float, float, str]], current: list[tuple[float, float, str]]) -> int:
    """How many leading words of this pass the previous pass produced too. Whisper revises the end of a
    hypothesis as more audio arrives; words that survive a second pass are settled (LocalAgreement-2)."""
    count = 0
    for before, now in zip(previous, current):
        if _norm(before[2]) != _norm(now[2]):
            break
        count += 1
    return count


def _cut_at_word(
    segments: list[TranscribedSegment], count: int, limit: float
) -> tuple[list[TranscribedSegment], float, str] | None:
    """Commit the first `count` words (only those ending before `limit`) as one line, resume at the next word."""
    words = [w for s in segments for w in (s.words or [])]
    keep = 0
    while keep < min(count, len(words)) and words[keep][1] <= limit:
        keep += 1
    if keep == 0:
        return None
    text = "".join(w[2] for w in words[:keep]).strip()
    rest = "".join(w[2] for w in words[keep:]).strip()
    resume_at = words[keep][0] if keep < len(words) else words[keep - 1][1]
    line = TranscribedSegment(words[0][0], words[keep - 1][1], text, segments[0].language)
    return [line], resume_at, rest


def plan_commit(
    segments: list[TranscribedSegment],
    window: float,
    *,
    final: bool,
    full: bool,
    soft: bool = False,
    agreed: int = 0,
) -> tuple[list[TranscribedSegment], float, str]:
    """Split a live window into settled segments and the part still being spoken.

    Returns (segments to commit, seconds the window may advance, text still in progress).
    The unfinished sentence is transcribed again next time with more audio, so words are
    never cut in half at chunk boundaries. When nobody pauses, the window would keep growing (and
    every pass would take longer): past the soft limit the words two passes agree on (`agreed`) are
    committed as a line; at the hard limit, every word that ended is.
    """
    if final:
        return segments, window, ""
    if not segments:  # silence / noise: skip it, but keep the last second - speech may be starting
        return [], max(0.0, window - TAIL_SEC), ""
    last = segments[-1]
    if last.end <= window - TAIL_SEC:  # a pause after the last sentence: everything is complete
        return segments, last.end, ""

    commit, resume_at, pending = segments[:-1], last.start, last.text
    finished = _finished_sentences(last, window - TAIL_SEC)
    if finished:
        done, resume_at, pending = finished
        commit = [*commit, done]
    if commit and resume_at > 0:
        return commit, resume_at, pending
    if soft and agreed and (split := _cut_at_word(segments, agreed, window - TAIL_SEC)):
        return split
    if full:  # one sentence longer than the max window: cut at the last word that ended, else at the edge
        if split := _cut_at_word(segments, 1 << 30, window - TAIL_SEC):
            return split
        return segments, window, ""
    return [], 0.0, " ".join(s.text for s in segments)  # wait for more audio


def run_live(meeting_id: str, flush: bool = False) -> None:
    """Transcribe recording audio received since the last run. Queued after every uploaded chunk."""
    if not settings.live_transcription:
        return
    if not flush and settings.live_interval_sec > 0:  # rate limit for paid APIs: run again a bit later
        wait = settings.live_interval_sec - (time.monotonic() - _last_live_run.get(meeting_id, 0.0))
        if wait > 0:
            timer = threading.Timer(wait, live_worker.submit, ("live", meeting_id))
            timer.daemon = True
            timer.start()
            return
    _last_live_run[meeting_id] = time.monotonic()
    with meeting_lock(meeting_id):
        with SessionLocal() as db:
            meeting = db.get(Meeting, meeting_id)
            if meeting is None or (meeting.status != MeetingStatus.RECORDING and not flush):
                return
            offset, language = meeting.live_offset, meeting.language
            recent = db.scalars(
                select(Segment)
                .where(Segment.meeting_id == meeting_id, Segment.kind == "live")
                .order_by(Segment.idx.desc())
                .limit(2)
            ).all()
        next_idx = recent[0].idx + 1 if recent else 0
        prompt = " ".join(s.text for s in reversed(recent))[-200:] or None
        prompt_language = recent[0].language if recent else None

        chunks = storage.chunk_index(meeting_id)
        total = sum(size for _, size in chunks) // SAMPLE_WIDTH
        min_window = int(settings.live_min_window_sec * SAMPLE_RATE)
        soft_window = int(settings.live_soft_window_sec * SAMPLE_RATE)
        max_window = int(settings.live_max_window_sec * SAMPLE_RATE)
        state = live_state.setdefault(meeting_id, LiveState(offset=offset))

        while (available := total - offset) > 0 and (flush or available >= min_window):
            window = min(available, max_window)
            samples = audio.read_pcm_indexed(chunks, offset, offset + window)
            segments, _ = transcriber.transcribe(
                samples,
                language=language,
                beam_size=1,
                initial_prompt=prompt,
                prompt_language=prompt_language,
                word_timestamps=True,
            )
            segments = list(segments)
            base = offset / SAMPLE_RATE
            words = [(base + a, base + b, w) for s in segments for a, b, w in (s.words or [])]
            agreed = agreed_prefix(state.words, words) if state.offset == offset else 0
            commit, advance, pending = plan_commit(
                segments,
                window / SAMPLE_RATE,
                final=flush and offset + window >= total,
                full=window >= max_window,
                soft=window >= soft_window,
                agreed=agreed,
            )
            step = min(window, int(advance * SAMPLE_RATE))
            resume = base + step / SAMPLE_RATE
            rest = [w for w in words if w[0] >= resume - 0.01]
            settled = max(0, agreed - (len(words) - len(rest)))
            stable = "".join(w[2] for w in rest[:settled]).strip() if pending else ""
            live_partials[meeting_id] = (stable, pending)
            if step <= 0:
                state.offset, state.words = offset, words
                break  # wait for more audio
            if not _save_live(meeting_id, commit, offset, offset + step, next_idx, flush):
                return
            offset += step
            state.offset, state.words = offset, rest
            next_idx += len(commit)
            if commit:
                prompt, prompt_language = " ".join(s.text for s in commit)[-200:], commit[-1].language
        if flush:
            forget_live(meeting_id)


def _save_live(meeting_id: str, commit, offset: int, new_offset: int, next_idx: int, flush: bool) -> bool:
    base = offset / SAMPLE_RATE
    with SessionLocal() as db:
        meeting = db.get(Meeting, meeting_id)
        if meeting is None or (meeting.status != MeetingStatus.RECORDING and not flush):
            return False  # deleted or finalized meanwhile; the final pass covers the rest
        for i, s in enumerate(commit):
            db.add(
                Segment(
                    meeting_id=meeting_id,
                    kind="live",
                    idx=next_idx + i,
                    start=round(base + s.start, 2),
                    end=round(base + s.end, 2),
                    text=s.text,
                    language=s.language,
                )
            )
        meeting.live_offset = new_offset
        if commit and meeting.language is None:
            db.flush()
            meeting.detected_language = _dominant_language(db, meeting_id, "live")
        db.commit()
    return True


# --------------------------------------------------------------------------- batch jobs


def finalize_recording(meeting_id: str) -> None:
    """All chunks are on the server: build audio.wav, then produce the final transcript."""
    with meeting_lock(meeting_id):  # waits for a live run in progress
        meeting = _update(meeting_id, status=MeetingStatus.PROCESSING, progress=0.0, error=None)
    if meeting is None:
        return
    try:
        chunks = storage.list_chunks(meeting_id)
        total = meeting.total_chunks if meeting.total_chunks is not None else len(chunks)
        duration = audio.assemble_wav([chunks[i] for i in range(total)], storage.audio_path(meeting_id))
        _update(meeting_id, duration_sec=duration)
        if settings.live_transcription and not settings.final_pass:
            run_live(meeting_id, flush=True)  # the live transcript becomes the final one
        storage.remove_chunks(meeting_id)
    except Exception as exc:
        log.exception("Could not finalize recording %s", meeting_id)
        _fail(meeting_id, f"Could not assemble the recording: {exc}")
        return

    if settings.final_pass or not settings.live_transcription:
        transcribe_meeting(meeting_id)
    else:
        _update(meeting_id, status=MeetingStatus.DONE, progress=1.0, completed_at=utcnow())
        ai_jobs.after_transcription(meeting_id)


def process_upload(meeting_id: str) -> None:
    """Uploaded file -> standard WAV (16 kHz mono) -> transcript."""
    if _update(meeting_id, status=MeetingStatus.PROCESSING, progress=0.0, error=None) is None:
        return
    source = storage.find_original(meeting_id)
    if source is None:
        _fail(meeting_id, "The uploaded file is missing.")
        return
    try:
        duration = audio.convert_to_wav(source, storage.audio_path(meeting_id))
    except audio.AudioError as exc:
        _fail(meeting_id, str(exc))
        return
    except Exception as exc:
        log.exception("Could not convert upload %s", meeting_id)
        _fail(meeting_id, f"Could not convert the audio: {exc}")
        return
    _update(meeting_id, duration_sec=duration)
    transcribe_meeting(meeting_id)


def transcribe_meeting(meeting_id: str) -> None:
    """Accurate pass over the whole audio file. Segments are saved as they are produced (progress bar)."""
    meeting = _update(meeting_id, status=MeetingStatus.TRANSCRIBING, progress=0.0, error=None)
    if meeting is None:
        return
    path = storage.audio_path(meeting_id)
    if not path.exists():
        _fail(meeting_id, "The audio file is missing.")
        return
    with SessionLocal() as db:
        db.execute(delete(Segment).where(Segment.meeting_id == meeting_id, Segment.kind == "final"))
        db.commit()
    ai_jobs.reset_for_transcription(meeting_id)

    try:
        # Section by section (about LONG_SECTION_SEC each, cut at a quiet moment): an hour-long file shows
        # its first lines after seconds, progress is real, and only one section is in memory.
        sections = audio.section_bounds(path, settings.long_section_sec)
        total_sec = max(sections[-1][1] / SAMPLE_RATE, 0.1)
        batch: list[TranscribedSegment] = []
        idx, last_save = 0, time.monotonic()
        prompt, prompt_language = None, None
        for number, (start, end) in enumerate(sections):
            offset = start / SAMPLE_RATE
            segments, detected = transcriber.transcribe(
                audio.read_wav(path, start, end),
                language=meeting.language,
                beam_size=settings.beam_size,
                initial_prompt=prompt,
                prompt_language=prompt_language,
            )
            if number == 0 and meeting.language is None and detected.language:
                _update(
                    meeting_id,
                    detected_language=detected.language,
                    language_probability=round(detected.probability, 3),
                )
            section_text: list[TranscribedSegment] = []
            for segment in segments:
                segment = TranscribedSegment(offset + segment.start, offset + segment.end, segment.text, segment.language)
                batch.append(segment)
                section_text.append(segment)
                if time.monotonic() - last_save >= 1.0:
                    if not _save_final(meeting_id, batch, idx, progress=min(0.99, segment.end / total_sec)):
                        return
                    idx, batch, last_save = idx + len(batch), [], time.monotonic()
            if not _save_final(meeting_id, batch, idx, progress=min(0.99, end / SAMPLE_RATE / total_sec)):
                return
            idx, batch, last_save = idx + len(batch), [], time.monotonic()
            if section_text:  # context for the next section
                prompt = " ".join(s.text for s in section_text)[-200:]
                prompt_language = section_text[-1].language
    except Exception as exc:
        log.exception("Transcription failed for %s", meeting_id)
        _fail(meeting_id, f"Transcription failed: {exc}")
        return

    with meeting_lock(meeting_id), SessionLocal() as db:
        meeting = db.get(Meeting, meeting_id)
        if meeting is None:
            return
        db.execute(delete(Segment).where(Segment.meeting_id == meeting_id, Segment.kind == "live"))
        if meeting.language is None:
            meeting.detected_language = _dominant_language(db, meeting_id, "final") or meeting.detected_language
        meeting.status, meeting.progress, meeting.completed_at = MeetingStatus.DONE, 1.0, utcnow()
        db.commit()
    forget_live(meeting_id)
    ai_jobs.after_transcription(meeting_id)


def _save_final(meeting_id: str, batch: list[TranscribedSegment], first_idx: int, progress: float) -> bool:
    with SessionLocal() as db:
        meeting = db.get(Meeting, meeting_id)
        if meeting is None:
            return False  # deleted while transcribing
        for i, s in enumerate(batch):
            db.add(
                Segment(
                    meeting_id=meeting_id,
                    kind="final",
                    idx=first_idx + i,
                    start=round(s.start, 2),
                    end=round(s.end, 2),
                    text=s.text,
                    language=s.language,
                )
            )
        meeting.progress = progress
        db.commit()
    return True


# --------------------------------------------------------------------------- workers

live_worker = Worker("live", {"live": run_live})
batch_worker = Worker(
    "batch", {"finalize": finalize_recording, "upload": process_upload, "transcribe": transcribe_meeting}
)


def start_workers() -> None:
    live_worker.start()
    batch_worker.start()
    ai_jobs.ai_worker.start()
    _resume_unfinished()
    ai_jobs.resume_unfinished()
    if settings.preload_model:
        threading.Thread(target=_preload_model, name="model-preload", daemon=True).start()


def stop_workers() -> None:
    live_worker.stop()
    batch_worker.stop()
    ai_jobs.ai_worker.stop()


def _preload_model() -> None:
    try:
        transcriber.get_model()
    except Exception:
        log.exception("Could not load the speech model")


def _resume_unfinished() -> None:
    """Pick up work interrupted by a server restart."""
    with SessionLocal() as db:
        pending = db.scalars(
            select(Meeting).where(Meeting.status.in_([MeetingStatus.RECORDING, *MeetingStatus.ACTIVE]))
        ).all()
    for meeting in pending:
        if meeting.status == MeetingStatus.RECORDING:
            live_worker.submit("live", meeting.id)
        elif storage.audio_path(meeting.id).exists():
            batch_worker.submit("transcribe", meeting.id)
        elif meeting.source == "upload":
            batch_worker.submit("upload", meeting.id)
        else:
            batch_worker.submit("finalize", meeting.id)
