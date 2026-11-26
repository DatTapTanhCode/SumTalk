import uuid

import bcrypt
import pytest

from app.api import auth
from app.config import get_settings

PASSWORD = "correct horse"


@pytest.fixture()
def login_on(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "login_user", "sumtalk")
    # Caddy's hash-password output starts with $2a$; bcrypt accepts both prefixes.
    hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode().replace("$2b$", "$2a$", 1)
    monkeypatch.setattr(settings, "login_password_hash", hashed)
    auth._failures.clear()
    yield settings
    auth._failures.clear()


def test_off_by_default(client):
    assert client.get("/api/auth/session").json() == {"enabled": False, "signed_in": True, "username": None}
    assert client.get("/api/meetings").status_code == 200


def test_api_needs_sign_in(client, login_on):
    assert client.get("/api/auth/session").json()["signed_in"] is False
    assert client.get("/api/meetings").status_code == 401
    assert client.put(f"/api/meetings/{uuid.uuid4()}", json={"title": "x"}).status_code == 401
    # Guests keep the share links and the health check.
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/shared/not-a-token").status_code == 404


def test_login_logout(client, login_on):
    bad = client.post("/api/auth/login", json={"username": "sumtalk", "password": "nope"})
    assert bad.status_code == 401 and bad.json()["detail"] == "Wrong username or password"
    assert client.post("/api/auth/login", json={"username": "other", "password": PASSWORD}).status_code == 401

    ok = client.post("/api/auth/login", json={"username": " sumtalk ", "password": PASSWORD})
    assert ok.json() == {"enabled": True, "signed_in": True, "username": "sumtalk"}
    cookie = ok.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/meetings").status_code == 200

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/meetings").status_code == 401


def _use(client, token):
    client.cookies.clear()
    client.cookies.set(auth.COOKIE, token)


def test_tampered_or_stale_cookie(client, login_on, monkeypatch):
    client.post("/api/auth/login", json={"username": "sumtalk", "password": PASSWORD}).raise_for_status()
    token = client.cookies.get(auth.COOKIE)
    payload, _, signature = token.partition(".")
    _use(client, payload + "x." + signature)
    assert client.get("/api/meetings").status_code == 401

    _use(client, auth.make_token("sumtalk", now=0))  # expired long ago
    assert client.get("/api/meetings").status_code == 401

    _use(client, token)
    assert client.get("/api/meetings").status_code == 200
    # A new password signs every browser out.
    monkeypatch.setattr(login_on, "login_password_hash", bcrypt.hashpw(b"new", bcrypt.gensalt(rounds=4)).decode())
    assert client.get("/api/meetings").status_code == 401


def test_too_many_attempts(client, login_on):
    for _ in range(auth.MAX_FAILURES):
        assert client.post("/api/auth/login", json={"username": "sumtalk", "password": "x"}).status_code == 401
    blocked = client.post("/api/auth/login", json={"username": "sumtalk", "password": PASSWORD})
    assert blocked.status_code == 429
    # Another address is not blocked.
    other = client.post("/api/auth/login", json={"username": "sumtalk", "password": PASSWORD}, headers={"X-Forwarded-For": "10.0.0.9"})
    assert other.status_code == 200
