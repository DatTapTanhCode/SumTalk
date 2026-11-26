import uuid

from fastapi.testclient import TestClient
from test_summary_translation_api import transcribed_meeting, wait_for

from app.main import app


def _create(client, title: str, meeting_at: str) -> str:
    meeting_id = str(uuid.uuid4())
    client.put(f"/api/meetings/{meeting_id}", json={"title": title, "meeting_at": meeting_at}).raise_for_status()
    return meeting_id


def test_rename_and_tags(client):
    meeting_id = _create(client, "Tag test", "2025-04-01T11:34:00Z")
    url = f"/api/meetings/{meeting_id}"
    assert client.patch(url, json={"title": "   "}).status_code == 422
    assert client.patch(url, json={"title": " Planning "}).json()["title"] == "Planning"
    for name in [" Project Alpha ", "project alpha", "Client"]:
        client.post(f"{url}/tags", json={"name": name}).raise_for_status()
    assert client.get(url).json()["tags"] == ["Client", "Project Alpha"]
    assert client.delete(f"{url}/tags/CLIENT").json()["tags"] == ["Project Alpha"]
    assert client.delete(f"{url}/tags/{'Project Alpha'}").json()["tags"] == []
    assert client.post(f"{url}/tags", json={"name": "a/b"}).json()["tags"] == ["a/b"]
    assert client.delete(f"{url}/tags/a%2Fb").json()["tags"] == []
    assert client.post(f"{url}/tags", json={"name": " "}).status_code == 422
    assert client.post(f"/api/meetings/{uuid.uuid4()}/tags", json={"name": "x"}).status_code == 404
    client.delete(url).raise_for_status()


def test_list_filter_search_and_sort(client):
    marker = uuid.uuid4().hex[:8]
    alpha = _create(client, f"Họp kế hoạch {marker}", "2024-05-10T12:00:00Z")
    beta = _create(client, f"Weekly review {marker}", "2024-05-12T09:00:00Z")
    gamma = _create(client, f"Zeta retro {marker}", "2024-05-11T09:00:00Z")
    client.post(f"/api/meetings/{alpha}/tags", json={"name": f"Client {marker}"}).raise_for_status()
    client.post(f"/api/meetings/{gamma}/tags", json={"name": f"Client {marker}"}).raise_for_status()

    def ids(**params):
        response = client.get("/api/meetings", params={"q": marker, **params})
        response.raise_for_status()
        return [m["id"] for m in response.json()]

    assert ids() == [beta, gamma, alpha]  # newest first by meeting time
    assert ids(sort="oldest") == [alpha, gamma, beta]
    assert ids(sort="title") == [alpha, beta, gamma]
    assert ids(tag=f"CLIENT {marker}") == [gamma, alpha]
    assert ids(q=f"HỌP KẾ HOẠCH {marker}") == [alpha]  # Unicode case folding, not just ASCII
    assert ids(q=f"client {marker}") == [gamma, alpha]  # search also matches tags
    assert ids(start="2024-05-11T00:00:00Z", end="2024-05-12T00:00:00Z") == [gamma]
    assert ids(start="2024-05-11T00:00:00+07:00") == [beta, gamma]
    assert client.get("/api/meetings", params={"sort": "random"}).status_code == 422
    tags = client.get("/api/meetings/tags").json()
    assert tags.count(f"Client {marker}") == 1 and tags == sorted(tags, key=str.casefold)
    for meeting_id in (alpha, beta, gamma):
        client.delete(f"/api/meetings/{meeting_id}").raise_for_status()


def test_guest_view_and_immediate_revocation(client):
    meeting_id = transcribed_meeting(client)
    private = f"/api/meetings/{meeting_id}"
    client.patch(private, json={"title": "Confidential name"})
    client.post(private + "/tags", json={"name": "Secret tag"})
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
    assert all(value not in result.text for value in ("Secret tag", meeting_id, "sync.wav"))
    payload = result.json()
    assert payload["summary"] == summary["content"] and payload["summary"]["action_items"]
    assert payload["segments"][0]["text"] == "Sentence 0."
    assert payload["translations"][0]["segments"] == translation["segments"]
    assert not payload["has_audio"] and guest.get(shared + "/audio").status_code == 404
    assert guest.delete(shared).status_code == 405
    assert guest.get("/api/shared/not-a-real-token").status_code == 404

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


def test_upload_keeps_the_files_date(client):
    upload = client.post(
        "/api/uploads", json={"filename": "client.wav", "size_bytes": 2, "meeting_at": "2023-01-02T03:04:05Z"}
    ).json()
    meeting = client.get(f"/api/meetings/{upload['meeting_id']}").json()
    assert meeting["title"] == "client" and meeting["meeting_at"].startswith("2023-01-02T03:04:05")
    client.delete(f"/api/uploads/{upload['id']}").raise_for_status()
