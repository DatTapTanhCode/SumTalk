"""Summary (#70) and translation (#62, #65) endpoints, under /api/meetings/{id}/..."""

from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai.languages import language_name
from ..config import get_settings
from ..db import get_db
from ..models import AIStatus, Meeting, MeetingStatus, SegmentTranslation, Summary, Translation
from ..schemas import (
    RegenerateSummaryIn,
    SummaryOut,
    TranslatedSegmentOut,
    TranslationCreate,
    TranslationInfo,
    TranslationOut,
)
from ..services import ai_jobs
from .meetings import _safe_name, _ts, get_meeting, transcript_kind

router = APIRouter(prefix="/api/meetings", tags=["summary & translation"])
settings = get_settings()


def _require_transcript(db: Session, meeting: Meeting) -> None:
    if meeting.status != MeetingStatus.DONE or transcript_kind(db, meeting) != "final":
        raise HTTPException(409, "The transcript is not ready yet")


def _check_language(code: str | None, allowed: list[str]) -> None:
    if code is not None and code not in allowed:
        raise HTTPException(422, f"Unsupported language '{code}'. Choose one of: {', '.join(allowed)}")


# ----------------------------------------------------------------------------- summary


def _summary_out(summary: Summary) -> SummaryOut:
    return SummaryOut(
        status=summary.status,
        language=summary.language,
        content=summary.content if summary.status == AIStatus.DONE else None,
        error=summary.error,
        model=summary.model,
        mode=summary.mode,
        calls=summary.calls,
        input_tokens=summary.input_tokens,
        output_tokens=summary.output_tokens,
        latency_sec=summary.latency_sec,
        cost_usd=summary.cost_usd,
        updated_at=summary.updated_at,
    )


@router.get("/{meeting_id}/summary", response_model=SummaryOut, responses={404: {"description": "No summary yet"}})
def read_summary(meeting_id: str, db: Session = Depends(get_db)):
    meeting = get_meeting(db, meeting_id)
    summary = ai_jobs.get_summary(db, meeting.id)
    if summary is None:
        raise HTTPException(404, "This meeting has no summary yet")
    return _summary_out(summary)


@router.post(
    "/{meeting_id}/summary/regenerate",
    response_model=SummaryOut,
    status_code=202,
    responses={409: {"description": "Already running, or the transcript is not ready"}},
)
def regenerate_summary(meeting_id: str, body: RegenerateSummaryIn | None = None, db: Session = Depends(get_db)):
    """Create the summary again (optionally in another language). It replaces the current one when done."""
    body = body or RegenerateSummaryIn()
    _check_language(body.language, settings.summary_languages)
    meeting = get_meeting(db, meeting_id)
    _require_transcript(db, meeting)
    summary = ai_jobs.get_summary(db, meeting.id)
    if summary is not None and summary.status == AIStatus.RUNNING:
        raise HTTPException(409, "The summary is being generated right now")
    summary = ai_jobs.request_summary(db, meeting.id, body.language)
    db.commit()
    ai_jobs.enqueue_summary(meeting.id)
    return _summary_out(summary)


# ----------------------------------------------------------------------------- translation


def _info(translation: Translation) -> TranslationInfo:
    return TranslationInfo(
        target_lang=translation.target_lang,
        status=translation.status,
        progress=translation.progress,
        error=translation.error,
        updated_at=translation.updated_at,
    )


def _translation_out(db: Session, translation: Translation) -> TranslationOut:
    saved = {
        row.segment_id: row
        for row in db.scalars(select(SegmentTranslation).where(SegmentTranslation.translation_id == translation.id))
    }
    segments = []
    for segment in ai_jobs.final_segments(db, translation.meeting_id):
        row = saved.get(segment.id)
        segments.append(
            TranslatedSegmentOut(
                segment_id=segment.idx,
                start=segment.start,
                end=segment.end,
                original=segment.text,
                translation=row.text if row else None,
                skipped=row.skipped if row else False,
            )
        )
    return TranslationOut(
        **_info(translation).model_dump(),
        model=translation.model,
        calls=translation.calls,
        input_tokens=translation.input_tokens,
        output_tokens=translation.output_tokens,
        cost_usd=translation.cost_usd,
        segments=segments,
    )


def _find_translation(db: Session, meeting: Meeting, lang: str) -> Translation:
    translation = ai_jobs.get_translation(db, meeting.id, lang.lower())
    if translation is None:
        raise HTTPException(404, f"No {language_name(lang)} translation for this meeting")
    return translation


@router.post(
    "/{meeting_id}/translations",
    response_model=TranslationOut,
    responses={
        200: {"description": "Already translated (or failed): the saved translation is returned, nothing is re-run"},
        202: {"description": "Translation started, or already running"},
        409: {"description": "The transcript is not ready"},
    },
)
def create_translation(meeting_id: str, body: TranslationCreate, response: Response, db: Session = Depends(get_db)):
    """Translate the final transcript. A finished translation is reused, never translated again."""
    _check_language(body.target_lang, settings.translation_languages)
    meeting = get_meeting(db, meeting_id)
    translation = ai_jobs.get_translation(db, meeting.id, body.target_lang)
    if translation is not None:
        response.status_code = 202 if translation.status in AIStatus.ACTIVE else 200
        return _translation_out(db, translation)
    _require_transcript(db, meeting)
    translation = Translation(meeting_id=meeting.id, target_lang=body.target_lang, status=AIStatus.PENDING, progress=0)
    db.add(translation)
    db.commit()
    ai_jobs.enqueue_translation(translation.id)
    response.status_code = 202
    return _translation_out(db, translation)


@router.get("/{meeting_id}/translations", response_model=list[TranslationInfo])
def list_translations(meeting_id: str, db: Session = Depends(get_db)):
    meeting = get_meeting(db, meeting_id)
    rows = db.scalars(select(Translation).where(Translation.meeting_id == meeting.id).order_by(Translation.created_at))
    return [_info(t) for t in rows]


@router.get("/{meeting_id}/translations/{lang}", response_model=TranslationOut)
def read_translation(meeting_id: str, lang: str, db: Session = Depends(get_db)):
    """Original and translated text of every final segment, in time order (translation is null until done)."""
    meeting = get_meeting(db, meeting_id)
    return _translation_out(db, _find_translation(db, meeting, lang))


@router.post("/{meeting_id}/translations/{lang}/retry", response_model=TranslationOut, status_code=202)
def retry_translation(meeting_id: str, lang: str, db: Session = Depends(get_db)):
    """Only for a failed translation. Segments already translated are kept; only the rest is translated."""
    meeting = get_meeting(db, meeting_id)
    translation = _find_translation(db, meeting, lang)
    if translation.status != AIStatus.FAILED:
        raise HTTPException(409, "Only a failed translation can be retried")
    _require_transcript(db, meeting)
    translation.status, translation.error = AIStatus.PENDING, None
    db.commit()
    ai_jobs.enqueue_translation(translation.id)
    return _translation_out(db, translation)


@router.get(
    "/{meeting_id}/translations/{lang}/export",
    responses={200: {"content": {"text/plain": {}, "application/x-subrip": {}}}, 409: {"description": "Not finished"}},
)
def export_translation(
    meeting_id: str,
    lang: str,
    format: Literal["txt", "srt"] = "txt",
    mode: Literal["translated", "bilingual"] = "translated",
    db: Session = Depends(get_db),
):
    """Download the translated transcript. UTF-8; the TXT file starts with a BOM so Windows Notepad
    shows Vietnamese correctly."""
    meeting = get_meeting(db, meeting_id)
    translation = _find_translation(db, meeting, lang)
    if translation.status != AIStatus.DONE:
        raise HTTPException(409, "The translation is not finished yet")
    out = _translation_out(db, translation)
    if format == "srt":
        body = render_srt(out.segments, bilingual=mode == "bilingual")
        data, media = body.encode("utf-8"), "application/x-subrip"
    else:
        header = f"{meeting.title}\nTranslation: {language_name(translation.target_lang)}\n\n"
        body = header + render_txt(out.segments, bilingual=mode == "bilingual")
        data, media = ("﻿" + body).encode("utf-8"), "text/plain"
    filename = f"{_safe_name(meeting.title)}_{translation.target_lang}.{format}"
    return Response(
        data,
        media_type=f"{media}; charset=utf-8",
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"translation_{translation.target_lang}.{format}\"; "
                f"filename*=UTF-8''{quote(filename)}"
            )
        },
    )


def _speaker(segment: TranslatedSegmentOut) -> str:
    return f"{segment.speaker}: " if segment.speaker else ""


def render_txt(segments: list[TranslatedSegmentOut], *, bilingual: bool = False) -> str:
    """`[hh:mm:ss] Speaker: translation`; bilingual puts the original line above it."""
    lines = []
    for s in segments:
        stamp = f"[{_ts(s.start)[:8]}] {_speaker(s)}"
        if bilingual:
            lines.append(f"{stamp}{s.original}")
            lines.append(f"{' ' * 11}{s.translation or s.original}")
        else:
            lines.append(f"{stamp}{s.translation or s.original}")
    return "\n".join(lines) + "\n"


def render_srt(segments: list[TranslatedSegmentOut], *, bilingual: bool = False) -> str:
    cues = []
    for i, s in enumerate(segments, 1):
        text = f"{_speaker(s)}{s.translation or s.original}"
        if bilingual:
            text = f"{_speaker(s)}{s.original}\n{s.translation or s.original}"
        end = max(s.end, s.start + 0.001)
        cues.append(f"{i}\n{_ts(s.start, ',')} --> {_ts(end, ',')}\n{text}\n")
    return "\n".join(cues)
