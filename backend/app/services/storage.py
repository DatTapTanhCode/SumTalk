"""File storage for audio. Local disk for the POC; the same layout maps 1:1 onto an object store (S3/MinIO).

data/
  meetings/<meeting_id>/chunks/000000.pcm   raw PCM chunks sent by the recorder
  meetings/<meeting_id>/original.<ext>       uploaded file, as received
  meetings/<meeting_id>/audio.wav            normalized audio (16 kHz mono PCM WAV) used for playback + STT
  uploads/<upload_id>/000000.part            parts of an upload in progress

STORAGE_BACKEND=s3: the working files above stay on the local disk while a meeting is processed; once it is
transcribed, audio.wav and original.<ext> move to s3://<S3_BUCKET>/<S3_PREFIX>meetings/<meeting_id>/ and a
small marker file (audio.s3) remembers it. Playback and downloads get presigned URLs.
"""

import logging
import os
import shutil
import sqlite3
import tempfile
import time
import uuid
from functools import lru_cache
from pathlib import Path

from ..config import get_settings

log = logging.getLogger(__name__)
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


def chunk_index(meeting_id: str) -> list[tuple[Path, int]]:
    """contiguous_chunks() with each chunk's size in bytes, from one directory scan.
    Live transcription calls this after every chunk, so an hour (3600 chunks) must stay cheap."""
    folder = meeting_dir(meeting_id) / "chunks"
    if not folder.exists():
        return []
    found: dict[int, tuple[Path, int]] = {}
    with os.scandir(folder) as entries:
        for entry in entries:
            stem, _, ext = entry.name.partition(".")
            if ext == "pcm" and stem.isdigit():
                found[int(stem)] = (Path(entry.path), entry.stat().st_size)
    result: list[tuple[Path, int]] = []
    seq = 0
    while seq in found:
        result.append(found[seq])
        seq += 1
    return result


def chunk_stats(meeting_id: str) -> tuple[int, int]:
    """(number of chunks received, total bytes), from one directory scan."""
    folder = meeting_dir(meeting_id) / "chunks"
    if not folder.exists():
        return 0, 0
    count = size = 0
    with os.scandir(folder) as entries:
        for entry in entries:
            stem, _, ext = entry.name.partition(".")
            if ext == "pcm" and stem.isdigit():
                count += 1
                size += entry.stat().st_size
    return count, size


def remove_chunks(meeting_id: str) -> None:
    shutil.rmtree(meeting_dir(meeting_id) / "chunks", ignore_errors=True)


def delete_meeting_files(meeting_id: str) -> None:
    if s3_enabled():
        try:
            prefix = _key(meeting_id, "")
            listed = _s3().list_objects_v2(Bucket=settings.s3_bucket, Prefix=prefix).get("Contents", [])
            for item in listed:
                _s3().delete_object(Bucket=settings.s3_bucket, Key=item["Key"])
        except Exception:
            log.exception("Could not delete the S3 files of meeting %s", meeting_id)
    shutil.rmtree(meeting_dir(meeting_id), ignore_errors=True)


# ----------------------------------------------------------------------------- S3 (STORAGE_BACKEND=s3)


def s3_enabled() -> bool:
    return settings.storage_backend.lower() == "s3"


@lru_cache
def _s3():
    import boto3  # only needed on servers that use S3 (requirements-server.txt)

    return boto3.client(
        "s3", region_name=settings.s3_region or None, endpoint_url=settings.s3_endpoint_url or None
    )


def _key(meeting_id: str, name: str) -> str:
    return f"{settings.s3_prefix}meetings/{meeting_id}/{name}"


def _marker(meeting_id: str) -> Path:
    return meeting_dir(meeting_id) / "audio.s3"


def has_audio(meeting_id: str) -> bool:
    return audio_path(meeting_id).exists() or _marker(meeting_id).exists()


def archive_audio(meeting_id: str) -> bool:
    """Move a transcribed meeting's audio to S3. Returns False (local copy kept) when S3 is off or fails."""
    if not s3_enabled() or not audio_path(meeting_id).exists():
        return False
    files = [audio_path(meeting_id)]
    if original := find_original(meeting_id):
        files.append(original)
    try:
        for path in files:
            content_type = "audio/wav" if path.suffix == ".wav" else "application/octet-stream"
            _s3().upload_file(
                str(path), settings.s3_bucket, _key(meeting_id, path.name), ExtraArgs={"ContentType": content_type}
            )
    except Exception:
        log.exception("Could not copy meeting %s to S3 - keeping it on the local disk", meeting_id)
        return False
    write_atomic(_marker(meeting_id), _key(meeting_id, "audio.wav").encode())
    if not settings.s3_keep_local_copy:
        for path in files:
            path.unlink(missing_ok=True)
    return True


def audio_url(meeting_id: str, filename: str, download: bool) -> str | None:
    """Presigned S3 URL of the archived audio, or None when the audio is on the local disk."""
    if audio_path(meeting_id).exists() or not (s3_enabled() and _marker(meeting_id).exists()):
        return None
    disposition = "attachment" if download else "inline"
    return _s3().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": _key(meeting_id, "audio.wav"),
            "ResponseContentType": "audio/wav",
            "ResponseContentDisposition": f'{disposition}; filename="{filename}"',
        },
        ExpiresIn=settings.s3_url_expiry_sec,
    )


def ensure_local_audio(meeting_id: str) -> Path:
    """audio.wav on the local disk, fetched back from S3 if it was archived (e.g. to re-transcribe)."""
    path = audio_path(meeting_id)
    if not path.exists() and s3_enabled() and _marker(meeting_id).exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f"audio.{uuid.uuid4().hex}.tmp")
        _s3().download_file(settings.s3_bucket, _key(meeting_id, "audio.wav"), str(tmp))
        os.replace(tmp, path)
    return path


def backup_database(db_path: Path) -> str | None:
    """Consistent copy of the SQLite database (online backup API) uploaded to S3. Returns the key."""
    if not s3_enabled() or not db_path.exists():
        return None
    key = f"{settings.s3_prefix}backups/app-{time.strftime('%Y%m%d-%H%M%S', time.gmtime())}.db"
    with tempfile.TemporaryDirectory(prefix="sumtalk-backup-") as tmp:
        copy = Path(tmp) / "app.db"
        source, target = sqlite3.connect(db_path), sqlite3.connect(copy)
        try:
            source.backup(target)
        finally:
            target.close()
            source.close()
        _s3().upload_file(str(copy), settings.s3_bucket, key)
    return key


def delete_upload_files(upload_id: str) -> None:
    shutil.rmtree(upload_dir(upload_id), ignore_errors=True)
