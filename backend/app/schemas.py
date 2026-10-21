from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _normalize_language(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    return None if value in ("", "auto") else value


class MeetingCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    language: str | None = None  # None / "auto" = detect automatically
    capture_mode: Literal["mic", "mic+system"] | None = None
    started_at: datetime | None = None  # when the browser started recording (it may have been offline)
    meeting_at: datetime | None = None  # when the meeting took place, defaults to started_at

    _lang = field_validator("language")(_normalize_language)


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    meeting_at: datetime | None = None


class RetranscribeIn(BaseModel):
    language: str | None = None

    _lang = field_validator("language")(_normalize_language)


class FinalizeIn(BaseModel):
    total_chunks: int | None = Field(default=None, ge=0)


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    source: str
    status: str
    capture_mode: str | None
    language: str | None
    detected_language: str | None
    language_probability: float | None
    duration_sec: float
    progress: float
    error: str | None
    original_filename: str | None
    size_bytes: int | None
    received_chunks: int
    total_chunks: int | None
    meeting_at: datetime | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    has_audio: bool = False
    transcript_kind: str = "final"


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    idx: int
    start: float
    end: float
    text: str
    language: str | None


class TranscriptOut(BaseModel):
    kind: str  # live | final
    segments: list[SegmentOut]
    partial: str | None = None  # text still being spoken (live only, not committed yet)


class ChunkAck(BaseModel):
    seq: int
    received_chunks: int


class UploadCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    size_bytes: int = Field(gt=0)
    mime_type: str | None = Field(default=None, max_length=100)
    title: str | None = Field(default=None, max_length=200)
    language: str | None = None

    _lang = field_validator("language")(_normalize_language)


class UploadOut(BaseModel):
    id: str
    meeting_id: str
    part_size: int
    total_parts: int
    received_parts: list[int]
    status: str


class ClientConfig(BaseModel):
    sample_rate: int
    chunk_seconds: int
    max_upload_mb: int
    allowed_extensions: list[str]
    live_transcription: bool


class SttStatus(BaseModel):
    status: str  # idle | loading | ready | error
    model: str | None
    device: str | None
    compute_type: str | None
    error: str | None


class HealthOut(BaseModel):
    ok: bool
    stt: SttStatus
