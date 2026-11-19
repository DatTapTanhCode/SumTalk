import uuid

from fastapi.testclient import TestClient
from test_summary_translation_api import transcribed_meeting, wait_for

from app.db import SessionLocal, assign_legacy_meetings
from app.main import app
from app.models import Meeting


def test_private_library_tags_and_legacy_ownership(client):
    meeting_id = str(uuid.uuid4())
    url = f"/api/meetings/{meeting_id}"
    created = client.put(url, json={"started_at": "2025-04-01T11:34:00Z"}).json()
    assert "2025-04-01 11:34" in created["title"]
    assert client.patch(url, json={"title": "   "}).status_code == 422
    assert client.patch(url, json={"title": " Planning "}).json()["title"] == "Planning"
    for name in [" Project Alpha ", "project alpha", "Client"]:
        client.put(f"{url}/tags", json={"name": name}).raise_for_status()
    assert client.get("/api/meetings").json()[0]["tags"] == ["Client", "Project Alpha"]
    assert client.request("DELETE", f"{url}/tags", json={"name": "CLIENT"}).json()["tags"] == ["Project Alpha"]

    legacy = str(uuid.uuid4())
    with SessionLocal.begin() as db:
        db.add(Meeting(id=legacy, title="Legacy", source="upload", status="done"))
    assert client.get(f"/api/meetings/{legacy}").status_code == 404
    assert assign_legacy_meetings(legacy, meeting_id) == 1
    assert client.get(f"/api/meetings/{legacy}").json()["tags"] == []
    assert assign_legacy_meetings(legacy, meeting_id) == 0


def test_guest_view_and_immediate_revocation(client):
    meeting_id = transcribed_meeting(client)
    private = f"/api/meetings/{meeting_id}"
    client.patch(private, json={"title": "Confidential name"})
    client.put(private + "/tags", json={"name": "Secret tag"})
    summary = wait_for(lambda: client.get(private + "/summary"))
    client.post(private + "/translations", json={"target_lang": "vi"}).raise_for_status()
    translation = wait_for(lambda: client.get(private + "/translations/vi"))
    assert client.get(private + "/share").json() is None
    token = client.put(private + "/share", json={}).json()["token"]
    shared = f"/api/shared/{token}"

    guest = TestClient(app)
    result = guest.get(shared)
    result.raise_for_status()
    assert "no-store" in result.headers["cache-control"]
    assert all(value not in result.text for value in ("Confidential name", "Secret tag", meeting_id, "sync.wav"))
    payload = result.json()
    assert payload["summary"] == summary["content"] and payload["summary"]["action_items"]
    assert payload["segments"][0]["text"] == "Sentence 0."
    assert payload["translations"][0]["segments"] == translation["segments"]
    assert not payload["has_audio"] and guest.get(shared + "/audio").status_code == 404
    assert guest.get("/api/meetings").json() == []

    guest.post("/api/owner-session").raise_for_status()
    for suffix in ["", "/audio", "/transcript", "/export", "/summary", "/translations", "/translations/vi/export", "/share"]:
        assert guest.get(private + suffix).status_code == 404
    for method, suffix, body in [
        ("PUT", "", {}), ("PATCH", "", {"title": "changed"}), ("DELETE", "", None),
        ("PUT", "/tags", {"name": "abc"}), ("DELETE", "/tags", {"name": "Secret tag"}),
        ("PUT", "/share", {"include_audio": True}), ("DELETE", "/share", None),
        ("POST", "/finalize", {}), ("POST", "/retranscribe", {}),
        ("POST", "/summary/regenerate", {}), ("POST", "/translations", {"target_lang": "en"}),
    ]:
        assert guest.request(method, private + suffix, json=body).status_code == 404
    assert guest.delete(shared).status_code == 405
    assert guest.put(private + "/chunks/0", content=b"").status_code == 404

    assert client.put(private + "/share", json={"include_audio": True}).json()["token"] == token
    assert guest.get(shared).json()["has_audio"]
    audio = guest.get(shared + "/audio", headers={"Range": "bytes=0-3"})
    assert audio.status_code == 206 and audio.content == b"RIFF"
    assert "no-store" in audio.headers["cache-control"]
    client.put(private + "/share", json={"include_audio": False}).raise_for_status()
    assert guest.get(shared + "/audio").status_code == 404
    client.put(private + "/share", json={"include_audio": True}).raise_for_status()
    client.delete(private + "/share").raise_for_status()
    assert guest.get(shared + "/audio").status_code == guest.get(shared).status_code == 404
    replacement = client.put(private + "/share", json={}).json()["token"]
    assert replacement != token and guest.get(shared).status_code == 404
    client.delete(private).raise_for_status()
    assert guest.get(f"/api/shared/{replacement}").status_code == 404
    guest.close()


def test_upload_parts_and_completion_are_owner_only(client):
    upload = client.post("/api/uploads", json={"filename": "client.wav", "size_bytes": 2}).json()
    url = f"/api/uploads/{upload['id']}"
    guest = TestClient(app)
    assert guest.get(url).status_code == guest.delete(url).status_code == 404
    assert guest.put(url + "/parts/0", content=b"xx").status_code == 404
    assert guest.post(url + "/complete").status_code == 404
    assert client.get(url).json()["received_parts"] == []
    guest.close()
