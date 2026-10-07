from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops tzinfo; store naive UTC and hand back aware UTC datetimes."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class MeetingStatus:
    RECORDING = "recording"  # browser is still sending audio chunks
    UPLOADING = "uploading"  # a file upload is in progress
    QUEUED = "queued"  # all audio received, waiting for the worker
    PROCESSING = "processing"  # assembling / converting audio
    TRANSCRIBING = "transcribing"
    DONE = "done"
    FAILED = "failed"

    ACTIVE = (QUEUED, PROCESSING, TRANSCRIBING)


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(16))  # recording | upload
    status: Mapped[str] = mapped_column(String(16), index=True)
    capture_mode: Mapped[str | None] = mapped_column(String(16))  # mic | mic+system
    language: Mapped[str | None] = mapped_column(String(8))  # requested language, None = auto-detect
    detected_language: Mapped[str | None] = mapped_column(String(8))
    language_probability: Mapped[float | None] = mapped_column(Float)
    duration_sec: Mapped[float] = mapped_column(Float, default=0.0)
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text)

    original_filename: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(100))
    size_bytes: Mapped[int | None] = mapped_column(Integer)

    received_chunks: Mapped[int] = mapped_column(Integer, default=0)
    total_chunks: Mapped[int | None] = mapped_column(Integer)
    live_offset: Mapped[int] = mapped_column(Integer, default=0)  # samples already handled by live transcription

    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    segments: Mapped[list["Segment"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True
    )


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(8))  # live | final
    idx: Mapped[int] = mapped_column(Integer)
    start: Mapped[float] = mapped_column(Float)
    end: Mapped[float] = mapped_column(Float)
    text: Mapped[str] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(String(8))

    meeting: Mapped[Meeting] = relationship(back_populates="segments")


class Upload(Base):
    """A resumable, chunked file upload that becomes a meeting once complete."""

    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    extension: Mapped[str] = mapped_column(String(10))
    size_bytes: Mapped[int] = mapped_column(Integer)
    part_size: Mapped[int] = mapped_column(Integer)
    total_parts: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="uploading")  # uploading | completed
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
