import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from ..db import get_db
from ..models import AIStatus, Meeting, MeetingShare, Translation
from ..schemas import SharedMeetingOut, SharedTranslation, ShareOut, ShareSettings
from ..services import ai_jobs, storage
from .ai import _translation_out
from .meetings import _active_segments, transcript_kind
from .ownership import owned_meeting

router = APIRouter(prefix="/api", tags=["sharing"])


@router.get("/meetings/{meeting_id}/share", response_model=ShareOut | None)
def read_share(meeting: Meeting = Depends(owned_meeting), db: Session = Depends(get_db)):
    return db.get(MeetingShare, meeting.id)


@router.put("/meetings/{meeting_id}/share", response_model=ShareOut)
def set_share(body: ShareSettings, meeting: Meeting = Depends(owned_meeting), db: Session = Depends(get_db)):
    # Concurrent creates and audio changes keep one stable link until explicitly revoked.
    stmt = insert(MeetingShare).values(meeting_id=meeting.id, token=secrets.token_urlsafe(32), include_audio=body.include_audio)
    db.execute(stmt.on_conflict_do_update(index_elements=["meeting_id"], set_={"include_audio": body.include_audio}))
    share = db.get(MeetingShare, meeting.id)
    db.commit()
    return share


@router.delete("/meetings/{meeting_id}/share", status_code=204)
def revoke_share(meeting: Meeting = Depends(owned_meeting), db: Session = Depends(get_db)):
    db.execute(delete(MeetingShare).where(MeetingShare.meeting_id == meeting.id))
    db.commit()
    return Response(status_code=204)


def active_share(token: str, db: Session = Depends(get_db)) -> MeetingShare:
    share = db.scalar(select(MeetingShare).where(MeetingShare.token == token))
    if share is None:
        raise HTTPException(404, "Share link is unavailable")
    return share


@router.get("/shared/{token}", response_model=SharedMeetingOut)
def shared_meeting(share: MeetingShare = Depends(active_share), db: Session = Depends(get_db)):
    meeting = db.get(Meeting, share.meeting_id)
    summary = ai_jobs.get_summary(db, meeting.id)
    translations = db.scalars(
        select(Translation)
        .where(Translation.meeting_id == meeting.id, Translation.status == AIStatus.DONE)
        .order_by(Translation.target_lang)
    )
    return SharedMeetingOut(
        summary=summary.content if summary and summary.status == AIStatus.DONE else None,
        segments=_active_segments(db, meeting, transcript_kind(db, meeting)),
        translations=[SharedTranslation(target_lang=t.target_lang, segments=_translation_out(db, t).segments) for t in translations],
        has_audio=share.include_audio and storage.has_audio(meeting.id),
    )


@router.get("/shared/{token}/audio")
def shared_audio(request: Request, share: MeetingShare = Depends(active_share)):
    if not share.include_audio:
        raise HTTPException(404, "Audio unavailable")
    # Keep every range request behind the revocable link, including archived recordings.
    path = storage.audio_path(share.meeting_id)
    if path.is_file():
        return FileResponse(path, media_type="audio/wav")
    try:
        obj = storage.open_archived_audio(share.meeting_id, request.headers.get("range"))
    except FileNotFoundError:
        raise HTTPException(404, "Audio unavailable")
    except ValueError:
        raise HTTPException(416, "Invalid audio range")
    headers = {"Content-Length": str(obj["ContentLength"]), "Accept-Ranges": "bytes"}
    if "ContentRange" in obj:
        headers["Content-Range"] = obj["ContentRange"]
    body = obj["Body"]
    return StreamingResponse(
        body.iter_chunks(chunk_size=65536),
        status_code=206 if "ContentRange" in obj else 200,
        media_type="audio/wav",
        headers=headers,
        background=BackgroundTask(body.close),
    )
