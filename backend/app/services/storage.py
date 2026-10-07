"""File storage for audio. Local disk for the POC; the same layout maps 1:1 onto an object store (S3/MinIO).

data/
  meetings/<meeting_id>/chunks/000000.pcm   raw PCM chunks sent by the recorder
  meetings/<meeting_id>/original.<ext>       uploaded file, as received
  meetings/<meeting_id>/audio.wav            normalized audio (16 kHz mono PCM WAV) used for playback + STT
  uploads/<upload_id>/000000.part            parts of an upload in progress
"""

import os
import shutil
import uuid
from pathlib import Path

from ..config import get_settings

settings = get_settings()


def parse_id(value: str) -> str:
    """Ids end up in file paths, so only accept canonical UUIDs."""
    return str(uuid.UUID(value))


def meeting_dir(meeting_id: str) -> Path:
    return settings.meetings_dir / meeting_id


def chunk_path(meeting_id: str, seq: int) -> Path:
    return meeting_dir(meeting_id) / "chunks" / f"{seq:06d}.pcm"


def audio_path(meeting_id: str) -> Path:
    return meeting_dir(meeting_id) / "audio.wav"


def original_path(meeting_id: str, extension: str) -> Path:
    return meeting_dir(meeting_id) / f"original{extension}"


def find_original(meeting_id: str) -> Path | None:
    return next(meeting_dir(meeting_id).glob("original.*"), None)


def upload_dir(upload_id: str) -> Path:
    return settings.uploads_dir / upload_id


def part_path(upload_id: str, n: int) -> Path:
    return upload_dir(upload_id) / f"{n:06d}.part"


def write_atomic(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def list_chunks(meeting_id: str) -> dict[int, Path]:
    folder = meeting_dir(meeting_id) / "chunks"
    if not folder.exists():
        return {}
    return {int(p.stem): p for p in folder.glob("*.pcm") if p.stem.isdigit()}


def contiguous_chunks(meeting_id: str) -> list[Path]:
    """Chunks 0..k with no gap - the part of the recording that can be processed in order."""
    chunks = list_chunks(meeting_id)
    result: list[Path] = []
    seq = 0
    while seq in chunks:
        result.append(chunks[seq])
        seq += 1
    return result


def remove_chunks(meeting_id: str) -> None:
    shutil.rmtree(meeting_dir(meeting_id) / "chunks", ignore_errors=True)


def delete_meeting_files(meeting_id: str) -> None:
    shutil.rmtree(meeting_dir(meeting_id), ignore_errors=True)


def delete_upload_files(upload_id: str) -> None:
    shutil.rmtree(upload_dir(upload_id), ignore_errors=True)
