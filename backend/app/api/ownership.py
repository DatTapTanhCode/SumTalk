"""An accountless library belongs to the browser holding its random, persistent cookie."""

import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Meeting
from ..services.storage import parse_id

router = APIRouter()
COOKIE = "sumtalk_owner"


def owner_id(request: Request) -> str:
    token = request.cookies.get(COOKIE)
    # An empty string never identifies a library (legacy rows have NULL owners).
    return hashlib.sha256(token.encode()).hexdigest() if token else ""


def establish_owner(request: Request, response: Response) -> str:
    token = request.cookies.get(COOKIE) or secrets.token_urlsafe(32)
    response.set_cookie(
        COOKIE, token, max_age=400 * 86400, path="/api", httponly=True, samesite="strict", secure=request.url.scheme == "https"
    )
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/api/owner-session", status_code=204, dependencies=[Depends(establish_owner)])
def owner_session() -> None:
    """Set the cookie before a browser starts concurrent uploads or recordings."""


def owned_meeting(meeting_id: str, owner: str = Depends(owner_id), db: Session = Depends(get_db)) -> Meeting:
    try:
        meeting = db.get(Meeting, parse_id(meeting_id))
    except ValueError:
        meeting = None
    if meeting is None or meeting.owner_id != owner:
        raise HTTPException(404, "Meeting not found")
    return meeting
