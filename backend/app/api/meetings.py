import json
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from ..config import SAMPLE_RATE, SAMPLE_WIDTH, get_settings
from ..db import SessionLocal, get_db
from ..models import Meeting, MeetingStatus, Segment, Upload, utcnow
from ..schemas import (
    ChunkAck,
    FinalizeIn,
    MeetingCreate,
    MeetingOut,
    MeetingUpdate,
    RetranscribeIn,
    TranscriptOut,
)
from ..services import storage
from ..services.jobs import meeting_lock
from ..services.pipeline import batch_worker, live_partials, live_worker

router = APIRouter(prefix="/api/meetings", tags=["meetings"])
settings = get_settings()


def get_meeting(db: Session, meeting_id: str) -> Meeting:
    try:
        meeting = db.get(Meeting, storage.parse_id(meeting_id))
    except ValueError:
        meeting = None
    if meeting is None:
        raise HTTPException(404, "Meeting not found")
    return meeting


def transcript_kind(db: Session, meeting: Meeting) -> str:
    """Live segments exist until the final pass replaces them."""
    has_live = db.scalar(select(exists().where(Segment.meeting_id == meeting.id, Segment.kind == "live")))
    return "live" if has_live else "final"


def to_out(db: Session, meeting: Meeting) -> MeetingOut:
    out = MeetingOut.model_validate(meeting)
    out.has_audio = storage.audio_path(meeting.id).exists()
    out.transcript_kind = transcript_kind(db, meeting)
    return out


@router.get("", response_model=list[MeetingOut])
def list_meetings(db: Session = Depends(get_db)):
    meetings = db.scalars(select(Meeting).order_by(Meeting.created_at.desc())).all()
    return [to_out(db, m) for m in meetings]


@router.put("/{meeting_id}", response_model=MeetingOut)
def create_recording(meeting_id: str, body: MeetingCreate, db: Session = Depends(get_db)):
    """Idempotent create. The browser generates the id, so it can start recording offline and retry safely."""
    try:
        meeting_id = storage.parse_id(meeting_id)
    except ValueError:
        raise HTTPException(422, "Meeting id must be a UUID")
    meeting = db.get(Meeting, meeting_id)
    if meeting is None:
        meeting = Meeting(
            id=meeting_id,
            title=body.title or "Untitled meeting",
            source="recording",
            status=MeetingStatus.RECORDING,
            capture_mode=body.capture_mode,
            language=body.language,
            meeting_at=body.meeting_at or body.started_at or utcnow(),
            created_at=body.started_at or utcnow(),
        )
        db.add(meeting)
        db.commit()
    elif meeting.source != "recording":
        raise HTTPException(409, "This id belongs to another meeting")
    return to_out(db, meeting)


@router.get("/{meeting_id}", response_model=MeetingOut)
def read_meeting(meeting_id: str, db: Session = Depends(get_db)):
    return to_out(db, get_meeting(db, meeting_id))


@router.patch("/{meeting_id}", response_model=MeetingOut)
def update_meeting(meeting_id: str, body: MeetingUpdate, db: Session = Depends(get_db)):
    meeting = get_meeting(db, meeting_id)
    if body.title is not None:
        meeting.title = body.title.strip()
    if body.meeting_at is not None:
        meeting.meeting_at = body.meeting_at
    db.commit()
    return to_out(db, meeting)


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = get_meeting(db, meeting_id)
    with meeting_lock(meeting.id):
        upload_ids = db.scalars(select(Upload.id).where(Upload.meeting_id == meeting.id)).all()
        db.delete(meeting)
        db.commit()
        storage.delete_meeting_files(meeting.id)
        for upload_id in upload_ids:
            storage.delete_upload_files(upload_id)
    live_partials.pop(meeting.id, None)
    return Response(status_code=204)


# ----------------------------------------------------------------------------- recording


@router.put("/{meeting_id}/chunks/{seq}", response_model=ChunkAck)
async def upload_chunk(
    meeting_id: str, seq: int, request: Request, x_sample_rate: int | None = Header(default=None)
):
    """One piece of a recording: raw PCM, 16-bit little-endian, mono, 16 kHz. Re-sending a chunk is harmless."""
    if not 0 <= seq < 1_000_000:
        raise HTTPException(422, "Invalid chunk number")
    if x_sample_rate is not None and x_sample_rate != SAMPLE_RATE:
        raise HTTPException(422, f"Chunks must be {SAMPLE_RATE} Hz PCM")
    data = await request.body()
    if len(data) > settings.max_chunk_bytes:
        raise HTTPException(413, "Chunk too large")
    if len(data) % SAMPLE_WIDTH:
        raise HTTPException(422, "Chunk must contain whole 16-bit samples")
    return await run_in_threadpool(_store_chunk, meeting_id, seq, data)


def _store_chunk(meeting_id: str, seq: int, data: bytes) -> ChunkAck:
    with SessionLocal() as db:
        meeting = get_meeting(db, meeting_id)
        if meeting.status != MeetingStatus.RECORDING:
            # Already finalized: finalize checked every chunk, so this is a retry of one we have.
            return ChunkAck(seq=seq, received_chunks=meeting.received_chunks)
        path = storage.chunk_path(meeting.id, seq)
        if not (path.exists() and path.stat().st_size == len(data)):
            storage.write_atomic(path, data)
        chunks = storage.list_chunks(meeting.id)
        meeting.received_chunks = len(chunks)
        meeting.duration_sec = sum(p.stat().st_size for p in chunks.values()) / SAMPLE_WIDTH / SAMPLE_RATE
        db.commit()
        live_worker.submit("live", meeting.id)
        return ChunkAck(seq=seq, received_chunks=meeting.received_chunks)


@router.post("/{meeting_id}/finalize", response_model=MeetingOut)
def finalize_recording(meeting_id: str, body: FinalizeIn, db: Session = Depends(get_db)):
    """Recording stopped and every chunk is uploaded: save it as a meeting and run the final transcription.
    Without total_chunks it finishes with whatever arrived (e.g. the recording device went away)."""
    meeting = get_meeting(db, meeting_id)
    if meeting.source != "recording":
        raise HTTPException(409, "Only recordings can be finalized")
    if meeting.status != MeetingStatus.RECORDING:
        return to_out(db, meeting)  # already finalized - safe retry

    chunks = storage.list_chunks(meeting.id)
    total = body.total_chunks if body.total_chunks is not None else len(storage.contiguous_chunks(meeting.id))
    missing = [seq for seq in range(total) if seq not in chunks]
    if missing:
        raise HTTPException(409, {"message": "Some chunks have not been uploaded yet", "missing": missing[:200]})
    if total == 0:
        meeting.status, meeting.error = MeetingStatus.FAILED, "The recording is empty."
    else:
        meeting.total_chunks, meeting.status, meeting.progress = total, MeetingStatus.QUEUED, 0.0
    db.commit()
    if total:
        batch_worker.submit("finalize", meeting.id)
    return to_out(db, meeting)


# ----------------------------------------------------------------------------- transcript & audio


def _active_segments(db: Session, meeting: Meeting, kind: str, after: int = -1) -> list[Segment]:
    return db.scalars(
        select(Segment)
        .where(Segment.meeting_id == meeting.id, Segment.kind == kind, Segment.idx > after)
        .order_by(Segment.idx)
    ).all()


@router.get("/{meeting_id}/transcript", response_model=TranscriptOut)
def read_transcript(meeting_id: str, kind: str | None = None, after: int = -1, db: Session = Depends(get_db)):
    """Incremental: pass the kind and last idx you already have. If the kind changed
    (live -> final), everything is returned again."""
    meeting = get_meeting(db, meeting_id)
    active = transcript_kind(db, meeting)
    segments = _active_segments(db, meeting, active, after if kind == active else -1)
    partial = live_partials.get(meeting.id) if active == "live" and meeting.status == MeetingStatus.RECORDING else None
    return TranscriptOut(kind=active, segments=segments, partial=partial or None)


@router.get("/{meeting_id}/audio")
def read_audio(meeting_id: str, download: bool = False, db: Session = Depends(get_db)):
    meeting = get_meeting(db, meeting_id)
    path = storage.audio_path(meeting.id)
    if not path.exists():
        raise HTTPException(404, "Audio is not ready yet")
    return FileResponse(
        path,
        media_type="audio/wav",
        filename=f"{_safe_name(meeting.title)}.wav",
        content_disposition_type="attachment" if download else "inline",
    )


@router.post("/{meeting_id}/retranscribe", response_model=MeetingOut)
def retranscribe(meeting_id: str, body: RetranscribeIn, db: Session = Depends(get_db)):
    """Run the transcription again, e.g. with the language forced when auto-detection guessed wrong."""
    meeting = get_meeting(db, meeting_id)
    if meeting.status in (MeetingStatus.RECORDING, MeetingStatus.UPLOADING, *MeetingStatus.ACTIVE):
        raise HTTPException(409, "The meeting is still being processed")
    if not storage.audio_path(meeting.id).exists():
        raise HTTPException(409, "The meeting has no audio")
    if "language" in body.model_fields_set:
        meeting.language = body.language
    meeting.status, meeting.progress, meeting.error = MeetingStatus.QUEUED, 0.0, None
    db.commit()
    batch_worker.submit("transcribe", meeting.id)
    return to_out(db, meeting)


@router.get("/{meeting_id}/export")
def export_transcript(
    meeting_id: str, format: Literal["txt", "srt", "vtt", "json"] = "txt", db: Session = Depends(get_db)
):
    meeting = get_meeting(db, meeting_id)
    segments = _active_segments(db, meeting, transcript_kind(db, meeting))
    if format == "srt":
        body = "\n".join(
            f"{i}\n{_ts(s.start, ',')} --> {_ts(s.end, ',')}\n{s.text}\n" for i, s in enumerate(segments, 1)
        )
        media = "application/x-subrip"
    elif format == "vtt":
        body = "WEBVTT\n\n" + "\n".join(f"{_ts(s.start)} --> {_ts(s.end)}\n{s.text}\n" for s in segments)
        media = "text/vtt"
    elif format == "json":
        body = json.dumps(
            {
                "id": meeting.id,
                "title": meeting.title,
                "language": meeting.language or meeting.detected_language,
                "duration_sec": meeting.duration_sec,
                "segments": [
                    {"start": s.start, "end": s.end, "text": s.text, "language": s.language} for s in segments
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
        media = "application/json"
    else:
        header = f"{meeting.title}\n{meeting.created_at:%Y-%m-%d %H:%M} UTC\n\n"
        body = header + "\n".join(f"[{_ts(s.start)[:8]}] {s.text}" for s in segments) + "\n"
        media = "text/plain"
    filename = f"{_safe_name(meeting.title)}.{format}"
    return Response(
        body.encode("utf-8"),
        media_type=f"{media}; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=\"transcript.{format}\"; filename*=UTF-8''{quote(filename)}"},
    )


def _ts(seconds: float, sep: str = ".") -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02}{sep}{ms:03}"


def _safe_name(title: str) -> str:
    name = "".join(c for c in title if c not in '\\/:*?"<>|').strip()
    return name[:80] or "meeting"
