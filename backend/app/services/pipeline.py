"""Processing pipeline.

Recording : PCM chunks --run_live (after every chunk)--> "live" segments
            finalize --> audio.wav --transcribe_meeting--> "final" segments (replace the live ones)
Upload    : original file --convert--> audio.wav --transcribe_meeting--> "final" segments
v2 stages (translation, summary) will run after transcribe_meeting.
"""

import logging
import threading
import time

from sqlalchemy import delete, func, select

from ..config import SAMPLE_RATE, get_settings
from ..db import SessionLocal
from ..models import Meeting, MeetingStatus, Segment, utcnow
from . import audio, storage
from .jobs import Worker, meeting_lock
from .transcriber import TranscribedSegment, transcriber

log = logging.getLogger(__name__)
settings = get_settings()

TAIL_SEC = 1.0

# Text of the sentence still being spoken (not committed yet), shown greyed-out in the live view.
live_partials: dict[str, str] = {}


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
    live_partials.pop(meeting_id, None)
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


def plan_commit(
    segments: list[TranscribedSegment], window: float, *, final: bool, full: bool
) -> tuple[list[TranscribedSegment], float, str]:
    """Split a live window into settled segments and the part still being spoken.

    Returns (segments to commit, seconds the window may advance, text still in progress).
    The unfinished sentence is transcribed again next time with more audio, so words are
    never cut in half at chunk boundaries.
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
    if full:  # one sentence longer than the max window: cut at the edge
        return segments, window, ""
    return [], 0.0, " ".join(s.text for s in segments)  # wait for more audio


def run_live(meeting_id: str, flush: bool = False) -> None:
    """Transcribe recording audio received since the last run. Queued after every uploaded chunk."""
    if not settings.live_transcription:
        return
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

        chunks = storage.contiguous_chunks(meeting_id)
        total = audio.total_samples(chunks)
        min_window = int(settings.live_min_window_sec * SAMPLE_RATE)
        max_window = int(settings.live_max_window_sec * SAMPLE_RATE)

        while (available := total - offset) > 0 and (flush or available >= min_window):
            window = min(available, max_window)
            samples = audio.read_pcm(chunks, offset, offset + window)
            segments, _ = transcriber.transcribe(
                samples,
                language=language,
                beam_size=1,
                initial_prompt=prompt,
                prompt_language=prompt_language,
                word_timestamps=True,
            )
            commit, advance, pending = plan_commit(
                list(segments), window / SAMPLE_RATE, final=flush and offset + window >= total, full=window >= max_window
            )
            live_partials[meeting_id] = pending
            step = min(window, int(advance * SAMPLE_RATE))
            if step <= 0:
                break  # wait for more audio
            if not _save_live(meeting_id, commit, offset, offset + step, next_idx, flush):
                return
            offset += step
            next_idx += len(commit)
            if commit:
                prompt, prompt_language = " ".join(s.text for s in commit)[-200:], commit[-1].language
        if flush:
            live_partials.pop(meeting_id, None)


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

    try:
        samples = audio.load_wav(path)
        segments, detected = transcriber.transcribe(samples, language=meeting.language, beam_size=settings.beam_size)
        if meeting.language is None and detected.language:
            _update(meeting_id, detected_language=detected.language, language_probability=round(detected.probability, 3))
        duration = max(meeting.duration_sec, 0.1)
        batch: list[TranscribedSegment] = []
        idx, last_save = 0, time.monotonic()
        for segment in segments:
            batch.append(segment)
            if time.monotonic() - last_save >= 1.0:
                if not _save_final(meeting_id, batch, idx, progress=min(0.99, segment.end / duration)):
                    return
                idx, batch, last_save = idx + len(batch), [], time.monotonic()
        if not _save_final(meeting_id, batch, idx, progress=0.99):
            return
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
    live_partials.pop(meeting_id, None)


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
    _resume_unfinished()
    if settings.preload_model:
        threading.Thread(target=_preload_model, name="model-preload", daemon=True).start()


def stop_workers() -> None:
    live_worker.stop()
    batch_worker.stop()


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
