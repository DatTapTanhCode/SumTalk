"""Remote speech-to-text (STT_PROVIDER=remote) and this server's OpenAI-compatible /v1 API."""

import io
import wave
from pathlib import Path

import httpx
import numpy as np
import pytest

from app.services import audio, stt_remote
from app.services.stt_remote import RemoteSttError, RemoteTranscriber, parse_response
from app.services.stt_types import language_code

FIXTURE = Path(__file__).resolve().parents[2] / "frontend" / "e2e" / "fixtures" / "speech_en.wav"
SR = 16_000


def speech_samples(tmp_path) -> np.ndarray:
    wav = tmp_path / "speech.wav"
    audio.convert_to_wav(FIXTURE, wav)
    return audio.load_wav(wav)


def tone_wav(seconds: float) -> bytes:
    t = np.arange(int(seconds * SR)) / SR
    pcm = (np.sin(2 * np.pi * 440 * t) * 0.3 * 32767).astype("<i2").tobytes()
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    return buffer.getvalue()


def test_language_names_become_codes():
    assert language_code("English") == "en"
    assert language_code("vietnamese") == "vi"
    assert language_code("vi") == "vi"
    assert language_code("klingon") is None


def test_parse_openai_answer_with_loose_words_and_offset():
    payload = {
        "language": "english",
        "segments": [
            {"start": 0.0, "end": 1.5, "text": " Good morning.", "no_speech_prob": 0.01, "avg_logprob": -0.2},
            {"start": 1.5, "end": 3.0, "text": " Thanks for watching, subscribe!", "no_speech_prob": 0.1, "avg_logprob": -0.3},
            {"start": 3.0, "end": 4.0, "text": " Let's start.", "no_speech_prob": 0.01, "avg_logprob": -0.2},
        ],
        "words": [
            {"word": "Good", "start": 0.0, "end": 0.5},
            {"word": "morning.", "start": 0.5, "end": 1.4},
            {"word": "Thanks", "start": 1.6, "end": 2.0},
            {"word": "Let's", "start": 3.0, "end": 3.4},
            {"word": "start.", "start": 3.4, "end": 3.9},
        ],
    }
    segments = parse_response(payload, offset=10.0, fallback_language=None, want_words=True)
    assert [s.text for s in segments] == ["Good morning.", "Let's start."]  # the YouTube outro is dropped
    assert segments[0].start == 10.0 and segments[1].end == 14.0
    assert segments[0].language == "en"
    assert "".join(w[2] for w in segments[1].words).strip() == "Let's start."  # words keep their own block


def test_remote_transcriber_sends_speech_blocks_in_parallel(tmp_path, monkeypatch):
    monkeypatch.setattr(stt_remote.settings, "stt_block_sec", 5.0)
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"data": []})
        assert request.headers["authorization"] == "Bearer test-key"
        seen.append(len(request.content))
        return httpx.Response(200, json={"language": "English", "segments": [{"start": 0.0, "end": 1.0, "text": "block"}]})

    client = httpx.Client(
        base_url="https://stt.example/v1/",
        transport=httpx.MockTransport(handler),
        headers={"Authorization": "Bearer test-key"},
    )
    engine = RemoteTranscriber(client=client)
    samples = speech_samples(tmp_path)
    segments, _ = engine.transcribe(samples)
    segments = list(segments)

    assert engine.status == "ready"
    assert len(seen) == len(segments) >= 2  # the 17 s fixture went out as several <= 5 s blocks
    starts = [s.start for s in segments]
    assert starts == sorted(starts) and all(s.language == "en" for s in segments)


def test_silence_is_never_sent(monkeypatch):
    calls = []
    client = httpx.Client(
        base_url="https://stt.example/v1/",
        transport=httpx.MockTransport(lambda r: calls.append(r) or httpx.Response(200, json={"data": []})),
    )
    segments, _ = RemoteTranscriber(client=client).transcribe(np.zeros(5 * SR, dtype=np.float32))
    assert list(segments) == []
    assert [c.url.path for c in calls] == ["/v1/models"]


def test_rate_limit_is_retried_then_succeeds(tmp_path, monkeypatch):
    monkeypatch.setattr(stt_remote.time, "sleep", lambda _s: None)
    answers = iter([httpx.Response(429, headers={"retry-after": "1"}), httpx.Response(200, json={"text": "ok", "duration": 1.0})])

    def handler(request):
        return httpx.Response(200, json={"data": []}) if request.url.path.endswith("/models") else next(answers)

    client = httpx.Client(base_url="https://stt.example/v1/", transport=httpx.MockTransport(handler))
    engine = RemoteTranscriber(client=client)
    payload = engine._request(np.zeros(SR, dtype=np.float32), language=None, prompt=None, words=False)
    assert payload["text"] == "ok"


def test_a_refused_key_is_reported_in_the_health_status():
    client = httpx.Client(base_url="https://stt.example/v1/", transport=httpx.MockTransport(lambda r: httpx.Response(401)))
    engine = RemoteTranscriber(client=client)
    with pytest.raises(RemoteSttError):
        engine.get_model()
    assert engine.status == "error" and "refused the key" in engine.error


# ----------------------------------------------------------------------------- this server's /v1 API


@pytest.fixture()
def v1_keys(monkeypatch):
    from app.api import stt_server

    monkeypatch.setattr(stt_server.settings, "stt_server_api_keys", "key-1, key-2")


def test_v1_api_is_off_without_keys(client):
    assert client.get("/v1/models").status_code == 404


def test_v1_api_needs_a_valid_key(client, v1_keys):
    assert client.get("/v1/models").status_code == 401
    assert client.get("/v1/models", headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.get("/v1/models", headers={"Authorization": "Bearer key-2"}).status_code == 200


def test_v1_transcription_verbose_json(client, v1_keys):
    response = client.post(
        "/v1/audio/transcriptions",
        headers={"Authorization": "Bearer key-1"},
        files={"file": ("tone.wav", tone_wav(4.0), "audio/wav")},
        data={"model": "whisper-1", "response_format": "verbose_json", "timestamp_granularities[]": ["segment", "word"]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["text"] == "Sentence 0. Sentence 2."
    assert [s["language"] for s in body["segments"]] == ["en", "en"]
    assert body["words"][0]["word"].strip() == "Sentence 0."
    assert abs(body["duration"] - 4.0) < 0.01

    plain = client.post(
        "/v1/audio/transcriptions",
        headers={"Authorization": "Bearer key-1"},
        files={"file": ("tone.wav", tone_wav(2.0), "audio/wav")},
        data={"response_format": "text"},
    )
    assert plain.text == "Sentence 0."


def test_remote_engine_against_this_servers_v1_api(client, v1_keys, tmp_path):
    """A desktop app (remote engine) talking to a SumTalk server (local engine), end to end."""
    client.headers["Authorization"] = "Bearer key-1"
    client.base_url = "http://testserver/v1/"
    engine = RemoteTranscriber(client=client)
    segments, _ = engine.transcribe(speech_samples(tmp_path), word_timestamps=True)
    segments = list(segments)
    assert segments and all(s.text.startswith("Sentence") for s in segments)
    assert all(s.language == "en" and s.words for s in segments)
