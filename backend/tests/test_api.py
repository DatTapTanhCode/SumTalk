import io
import time
import uuid
import wave

import numpy as np
from conftest import tone, wait_for_status

CHUNK = 3 * 16_000 * 2  # 3 s of 16 kHz 16-bit mono


def create_recording(client, **body):
    meeting_id = str(uuid.uuid4())
    response = client.put(f"/api/meetings/{meeting_id}", json={"title": "Weekly sync", "capture_mode": "mic", **body})
    assert response.status_code == 200
    return meeting_id


def send_chunks(client, meeting_id, pcm: bytes):
    chunks = [pcm[i : i + CHUNK] for i in range(0, len(pcm), CHUNK)]
    for seq, data in enumerate(chunks):
        response = client.put(f"/api/meetings/{meeting_id}/chunks/{seq}", content=data, headers={"X-Sample-Rate": "16000"})
        assert response.status_code == 200, response.text
    return len(chunks)


def test_recording_flow(client):
    meeting_id = create_recording(client)
    # Creating again (offline retry) returns the same meeting.
    again = client.put(f"/api/meetings/{meeting_id}", json={"title": "Other title"}).json()
    assert again["title"] == "Weekly sync" and again["status"] == "recording"

    total = send_chunks(client, meeting_id, tone(9))
    meeting = client.get(f"/api/meetings/{meeting_id}").json()
    assert meeting["received_chunks"] == total and meeting["duration_sec"] == 9.0

    # Missing chunk -> 409 with the list, nothing changes.
    response = client.post(f"/api/meetings/{meeting_id}/finalize", json={"total_chunks": total + 1})
    assert response.status_code == 409 and response.json()["detail"]["missing"] == [total]

    response = client.post(f"/api/meetings/{meeting_id}/finalize", json={"total_chunks": total})
    assert response.status_code == 200
    meeting = wait_for_status(client, meeting_id)
    assert meeting["status"] == "done" and meeting["has_audio"]

    transcript = client.get(f"/api/meetings/{meeting_id}/transcript").json()
    assert transcript["kind"] == "final"
    assert [s["text"] for s in transcript["segments"]] == ["Sentence 0.", "Sentence 2.", "Sentence 4.", "Sentence 6."]

    # Chunk re-sent after finalizing is acknowledged (idempotent), finalize twice is harmless.
    assert client.put(f"/api/meetings/{meeting_id}/chunks/0", content=tone(3)).status_code == 200
    assert client.post(f"/api/meetings/{meeting_id}/finalize", json={"total_chunks": total}).status_code == 200

    audio = client.get(f"/api/meetings/{meeting_id}/audio", headers={"Range": "bytes=0-43"})
    assert audio.status_code == 206 and audio.content[:4] == b"RIFF"
    with wave.open(io.BytesIO(client.get(f"/api/meetings/{meeting_id}/audio").content)) as w:
        assert (w.getframerate(), w.getnchannels(), w.getnframes()) == (16_000, 1, 9 * 16_000)

    srt = client.get(f"/api/meetings/{meeting_id}/export", params={"format": "srt"})
    assert srt.status_code == 200 and "00:00:02,000 --> 00:00:03,800" in srt.text


def test_live_transcript_while_recording(client):
    meeting_id = create_recording(client)
    send_chunks(client, meeting_id, tone(9))
    deadline = time.time() + 10
    while time.time() < deadline:
        transcript = client.get(f"/api/meetings/{meeting_id}/transcript").json()
        if len(transcript["segments"]) >= 3:
            break
        time.sleep(0.1)
    assert transcript["kind"] == "live"
    assert transcript["segments"][0]["text"] == "Sentence 0."


def test_force_finish_uses_received_chunks(client):
    meeting_id = create_recording(client)
    send_chunks(client, meeting_id, tone(6))
    assert client.post(f"/api/meetings/{meeting_id}/finalize", json={}).status_code == 200
    assert wait_for_status(client, meeting_id)["duration_sec"] == 6.0


def test_empty_recording_fails_cleanly(client):
    meeting_id = create_recording(client)
    meeting = client.post(f"/api/meetings/{meeting_id}/finalize", json={"total_chunks": 0}).json()
    assert meeting["status"] == "failed" and meeting["error"] == "The recording is empty."


def test_chunk_validation(client):
    meeting_id = create_recording(client)
    assert client.put(f"/api/meetings/{meeting_id}/chunks/0", content=b"\x00\x01\x02").status_code == 422  # odd bytes
    assert client.put(f"/api/meetings/{meeting_id}/chunks/0", content=tone(1), headers={"X-Sample-Rate": "44100"}).status_code == 422
    assert client.put("/api/meetings/not-a-uuid", json={}).status_code == 422
    assert client.get("/api/meetings/not-a-uuid").status_code == 404


def wav_file(seconds: float) -> bytes:
    """44.1 kHz stereo on purpose: the server must convert it to 16 kHz mono."""
    mono = np.frombuffer(tone(seconds, rate=44_100), dtype="<i2")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(44_100)
        w.writeframes(np.repeat(mono, 2).tobytes())
    return buffer.getvalue()


def upload(client, filename: str, data: bytes, **extra):
    response = client.post("/api/uploads", json={"filename": filename, "size_bytes": len(data), **extra})
    assert response.status_code == 201, response.text
    session = response.json()
    for n in range(session["total_parts"]):
        part = data[n * session["part_size"] : (n + 1) * session["part_size"]]
        assert client.put(f"/api/uploads/{session['id']}/parts/{n}", content=part).status_code == 200
    response = client.post(f"/api/uploads/{session['id']}/complete")
    assert response.status_code == 200, response.text
    return response.json()


def test_upload_flow_converts_to_standard_wav(client):
    meeting = upload(client, "standup.wav", wav_file(4), title="Stand-up", language="vi")
    assert meeting["source"] == "upload" and meeting["title"] == "Stand-up"
    meeting = wait_for_status(client, meeting["id"])
    assert meeting["status"] == "done" and meeting["language"] == "vi"
    assert abs(meeting["duration_sec"] - 4.0) < 0.1
    transcript = client.get(f"/api/meetings/{meeting['id']}/transcript").json()
    assert transcript["segments"][0]["language"] == "vi"


def test_upload_validation(client):
    response = client.post("/api/uploads", json={"filename": "notes.txt", "size_bytes": 10})
    assert response.status_code == 415
    response = client.post("/api/uploads", json={"filename": "big.mp3", "size_bytes": 10 * 1024**4})
    assert response.status_code == 413

    session = client.post("/api/uploads", json={"filename": "a.mp3", "size_bytes": 100}).json()
    assert client.put(f"/api/uploads/{session['id']}/parts/0", content=b"x" * 99).status_code == 422
    assert client.put(f"/api/uploads/{session['id']}/parts/5", content=b"x" * 100).status_code == 422
    missing = client.post(f"/api/uploads/{session['id']}/complete")
    assert missing.status_code == 409 and missing.json()["detail"]["missing"] == [0]
    assert client.delete(f"/api/uploads/{session['id']}").status_code == 204
    assert client.get(f"/api/meetings/{session['meeting_id']}").status_code == 404


def test_corrupt_file_fails_with_message(client):
    meeting = upload(client, "fake.mp3", b"definitely not audio")
    meeting = wait_for_status(client, meeting["id"])
    assert meeting["status"] == "failed"
    assert "could not be opened as audio" in meeting["error"]


def test_retranscribe_and_delete(client):
    meeting = wait_for_status(client, upload(client, "call.wav", wav_file(4))["id"])
    response = client.post(f"/api/meetings/{meeting['id']}/retranscribe", json={"language": "en"})
    assert response.status_code == 200 and response.json()["status"] == "queued"
    meeting = wait_for_status(client, meeting["id"])
    assert meeting["status"] == "done" and meeting["language"] == "en"

    assert client.patch(f"/api/meetings/{meeting['id']}", json={"title": "Renamed"}).json()["title"] == "Renamed"
    assert client.delete(f"/api/meetings/{meeting['id']}").status_code == 204
    assert client.get(f"/api/meetings/{meeting['id']}").status_code == 404
