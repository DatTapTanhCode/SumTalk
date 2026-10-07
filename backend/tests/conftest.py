"""Tests run against a temporary data folder with a fake transcriber, so they need no model or GPU."""

import os
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import pytest

DATA_DIR = Path(tempfile.mkdtemp(prefix="sumtalk-test-"))
os.environ["DATA_DIR"] = str(DATA_DIR)
os.environ["PRELOAD_MODEL"] = "false"
os.environ["FRONTEND_DIST"] = str(DATA_DIR / "no-frontend")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.transcriber import TranscribedSegment, transcriber  # noqa: E402

SAMPLE_RATE = 16_000


class FakeDetection:
    language = "en"
    probability = 0.99


def fake_transcribe(audio, *, language=None, beam_size=5, initial_prompt=None, prompt_language=None, word_timestamps=False):
    """One 'sentence' per 2 s of non-silent audio."""
    segments = []
    t = 0.0
    while (t + 2.0) * SAMPLE_RATE <= len(audio):
        window = audio[int(t * SAMPLE_RATE) : int((t + 2.0) * SAMPLE_RATE)]
        if np.abs(window).mean() > 0.01:
            text = f"Sentence {t:.0f}."
            segments.append(TranscribedSegment(t, t + 1.8, text, language or "en", [(t, t + 1.8, f" {text}")]))
        t += 2.0
    return iter(segments), FakeDetection()


def tone(seconds: float, rate: int = SAMPLE_RATE, amplitude: float = 0.3) -> bytes:
    """Mono 16-bit PCM of a 440 Hz tone."""
    t = np.arange(int(seconds * rate)) / rate
    return (np.sin(2 * np.pi * 440 * t) * amplitude * 32767).astype("<i2").tobytes()


def wait_for_status(client, meeting_id: str, statuses=("done", "failed"), timeout: float = 20.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        meeting = client.get(f"/api/meetings/{meeting_id}").json()
        if meeting["status"] in statuses:
            return meeting
        time.sleep(0.1)
    raise AssertionError(f"meeting stayed {meeting['status']}")


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(transcriber, "transcribe", fake_transcribe)
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
