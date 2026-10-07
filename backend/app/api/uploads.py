"""Resumable chunked upload for existing audio files (large files never travel in one request).

1. POST /api/uploads                     -> upload id, part size, parts already received
2. PUT  /api/uploads/{id}/parts/{n}      -> each part (any order, retry-safe)
3. POST /api/uploads/{id}/complete       -> parts are joined, a meeting is created and queued
"""

import math
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal, get_db
from ..models import Meeting, MeetingStatus, Upload
from ..schemas import MeetingOut, UploadCreate, UploadOut
from ..services import storage
from ..services.pipeline import batch_worker
from .meetings import to_out

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
settings = get_settings()

MB = 1024 * 1024


def _get_upload(db: Session, upload_id: str) -> Upload:
    try:
        upload = db.get(Upload, storage.parse_id(upload_id))
    except ValueError:
        upload = None
    if upload is None:
        raise HTTPException(404, "Upload not found")
    return upload


def _received_parts(upload: Upload) -> list[int]:
    folder = storage.upload_dir(upload.id)
    if not folder.exists():
        return []
    return sorted(int(p.stem) for p in folder.glob("*.part") if p.stem.isdigit())


def _out(upload: Upload) -> UploadOut:
    return UploadOut(
        id=upload.id,
        meeting_id=upload.meeting_id,
        part_size=upload.part_size,
        total_parts=upload.total_parts,
        received_parts=_received_parts(upload),
        status=upload.status,
    )


@router.post("", response_model=UploadOut, status_code=201)
def create_upload(body: UploadCreate, db: Session = Depends(get_db)):
    extension = Path(body.filename).suffix.lower()
    if extension not in settings.allowed_extensions:
        allowed = ", ".join(e.lstrip(".") for e in settings.allowed_extensions)
        raise HTTPException(415, f"Unsupported file type '{extension or 'none'}'. Allowed: {allowed}")
    if body.size_bytes > settings.max_upload_mb * MB:
        raise HTTPException(413, f"File is too large (max {settings.max_upload_mb} MB)")

    part_size = settings.upload_part_mb * MB
    meeting = Meeting(
        id=str(uuid.uuid4()),
        title=(body.title or Path(body.filename).stem or "Uploaded audio")[:200],
        source="upload",
        status=MeetingStatus.UPLOADING,
        language=body.language,
        original_filename=body.filename,
        mime_type=body.mime_type,
        size_bytes=body.size_bytes,
    )
    upload = Upload(
        id=str(uuid.uuid4()),
        meeting_id=meeting.id,
        filename=body.filename,
        extension=extension,
        size_bytes=body.size_bytes,
        part_size=part_size,
        total_parts=math.ceil(body.size_bytes / part_size),
    )
    db.add_all([meeting, upload])
    db.commit()
    return _out(upload)


@router.get("/{upload_id}", response_model=UploadOut)
def read_upload(upload_id: str, db: Session = Depends(get_db)):
    return _out(_get_upload(db, upload_id))


@router.put("/{upload_id}/parts/{n}")
async def upload_part(upload_id: str, n: int, request: Request):
    data = await request.body()
    return await run_in_threadpool(_store_part, upload_id, n, data)


def _store_part(upload_id: str, n: int, data: bytes) -> dict:
    with SessionLocal() as db:
        upload = _get_upload(db, upload_id)
        if upload.status != "uploading":
            raise HTTPException(409, "Upload already completed")
        if not 0 <= n < upload.total_parts:
            raise HTTPException(422, "Invalid part number")
        expected = upload.part_size if n < upload.total_parts - 1 else upload.size_bytes - upload.part_size * n
        if len(data) != expected:
            raise HTTPException(422, f"Part {n} must be {expected} bytes, got {len(data)}")
        storage.write_atomic(storage.part_path(upload.id, n), data)
        return {"n": n}


@router.post("/{upload_id}/complete", response_model=MeetingOut)
def complete_upload(upload_id: str, db: Session = Depends(get_db)):
    upload = _get_upload(db, upload_id)
    meeting = db.get(Meeting, upload.meeting_id)
    if upload.status == "completed":
        return to_out(db, meeting)

    received = set(_received_parts(upload))
    missing = [n for n in range(upload.total_parts) if n not in received]
    if missing:
        raise HTTPException(409, {"message": "Some parts are missing", "missing": missing[:200]})

    destination = storage.original_path(meeting.id, upload.extension)
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_name(f"{destination.name}.{uuid.uuid4().hex}.tmp")
    with open(tmp, "wb") as out:
        for n in range(upload.total_parts):
            with open(storage.part_path(upload.id, n), "rb") as part:
                shutil.copyfileobj(part, out, 1024 * 1024)
    if tmp.stat().st_size != upload.size_bytes:
        tmp.unlink(missing_ok=True)
        raise HTTPException(422, "Assembled file size does not match")
    os.replace(tmp, destination)
    storage.delete_upload_files(upload.id)

    upload.status = "completed"
    meeting.status, meeting.progress = MeetingStatus.QUEUED, 0.0
    db.commit()
    batch_worker.submit("upload", meeting.id)
    return to_out(db, meeting)


@router.delete("/{upload_id}", status_code=204)
def cancel_upload(upload_id: str, db: Session = Depends(get_db)):
    upload = _get_upload(db, upload_id)
    if upload.status == "completed":
        raise HTTPException(409, "Upload already completed - delete the meeting instead")
    meeting = db.get(Meeting, upload.meeting_id)
    storage.delete_upload_files(upload.id)
    if meeting is not None:
        storage.delete_meeting_files(meeting.id)
        db.delete(meeting)  # the upload row goes with it (ON DELETE CASCADE)
    db.commit()
    return Response(status_code=204)
