"""Sign-in for a hosted test server, in place of the browser's Basic Auth popup.

Off unless LOGIN_USER and LOGIN_PASSWORD_HASH are set (BASIC_AUTH_USER / BASIC_AUTH_HASH are read too, so an
existing deploy/.env keeps working). The hash is bcrypt, the same one `caddy hash-password` prints. A signed
cookie keeps the browser signed in; there is still one shared test account, not per-user libraries.
"""

import base64
import hashlib
import hmac
import json
import secrets
import time
from collections import defaultdict, deque

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from ..config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE = "sumtalk_session"
# API paths a guest may call: sign-in itself, read-only share links and the health check.
PUBLIC_API = ("/api/auth/", "/api/shared/", "/api/health")

MAX_FAILURES = 5
FAILURE_WINDOW_SEC = 300.0
_failures: dict[str, deque[float]] = defaultdict(deque)


class LoginIn(BaseModel):
    username: str = Field(max_length=200)
    password: str = Field(max_length=200)


class AuthState(BaseModel):
    enabled: bool
    signed_in: bool
    username: str | None = None


def enabled() -> bool:
    settings = get_settings()
    return bool(settings.login_user and settings.login_password_hash)


def _secret() -> bytes:
    """Signs session cookies. Kept in the data folder so a restart does not sign everyone out; changing the
    password also invalidates old cookies because the hash is part of the key."""
    settings = get_settings()
    if settings.session_secret:
        base = settings.session_secret.encode()
    else:
        path = settings.data_dir / "session.key"
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(secrets.token_hex(32), encoding="utf-8")
        base = path.read_text(encoding="utf-8").strip().encode()
    return hashlib.sha256(base + b"|" + settings.login_password_hash.encode()).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_token(username: str, now: float | None = None) -> str:
    expires = int((time.time() if now is None else now) + get_settings().login_session_hours * 3600)
    payload = _b64(json.dumps({"u": username, "exp": expires}, separators=(",", ":")).encode())
    signature = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{signature}"


def session_user(request: Request) -> str | None:
    token = request.cookies.get(COOKIE, "")
    payload, _, signature = token.partition(".")
    if not payload or not signature:
        return None
    expected = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        data = json.loads(_unb64(payload))
    except ValueError:
        return None
    if data.get("exp", 0) < time.time() or data.get("u") != get_settings().login_user:
        return None
    return data["u"]


def needs_login(request: Request) -> bool:
    """True for an API call that must be signed in but is not. The web app's pages and assets stay public:
    they hold no data, and the app shows the sign-in page itself."""
    path = request.url.path
    if not enabled() or not path.startswith("/api/") or path.startswith(PUBLIC_API):
        return False
    return session_user(request) is None


def _check_password(password: str) -> bool:
    import bcrypt  # only needed on a server with sign-in turned on (requirements-server.txt)

    try:
        return bcrypt.checkpw(password.encode(), get_settings().login_password_hash.encode())
    except ValueError:  # malformed hash in the settings
        return False


def _client_key(request: Request) -> str:
    # Behind Caddy every request comes from the proxy, so use the address it forwards.
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "?")


def _is_https(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "") == "https"


def _set_cookie(response: Response, request: Request, value: str, max_age: int) -> None:
    response.set_cookie(COOKIE, value, max_age=max_age, path="/", httponly=True, samesite="lax", secure=_is_https(request))


@router.get("/session", response_model=AuthState)
def read_session(request: Request):
    if not enabled():
        return AuthState(enabled=False, signed_in=True)
    user = session_user(request)
    return AuthState(enabled=True, signed_in=user is not None, username=user)


@router.post("/login", response_model=AuthState)
def login(body: LoginIn, request: Request, response: Response):
    if not enabled():
        return AuthState(enabled=False, signed_in=True)
    key = _client_key(request)
    now = time.time()
    recent = _failures[key]
    while recent and recent[0] < now - FAILURE_WINDOW_SEC:
        recent.popleft()
    if len(recent) >= MAX_FAILURES:
        wait = int(recent[0] + FAILURE_WINDOW_SEC - now) + 1
        raise HTTPException(429, f"Too many attempts. Try again in {max(1, round(wait / 60))} min.")

    user_ok = hmac.compare_digest(body.username.strip().encode(), get_settings().login_user.encode())
    password_ok = _check_password(body.password)  # always run, so a wrong name takes as long as a wrong password
    if not (user_ok and password_ok):
        recent.append(now)
        raise HTTPException(401, "Wrong username or password")

    recent.clear()
    username = get_settings().login_user
    _set_cookie(response, request, make_token(username), int(get_settings().login_session_hours * 3600))
    return AuthState(enabled=True, signed_in=True, username=username)


@router.post("/logout", status_code=204)
def logout(request: Request):
    response = Response(status_code=204)
    _set_cookie(response, request, "", 0)
    return response
