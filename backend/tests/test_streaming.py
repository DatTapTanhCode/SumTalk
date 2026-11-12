"""Live streaming (words two passes agree on) and long-file sections."""

import wave

import numpy as np

from app.services import audio
from app.services.pipeline import agreed_prefix, plan_commit
from app.services.transcriber import TranscribedSegment

SR = 16_000


def words_of(text: str, start: float = 0.0, step: float = 0.5):
    return [(start + i * step, start + i * step + 0.4, f" {w}") for i, w in enumerate(text.split())]


def test_agreed_prefix_ignores_case_and_punctuation():
    before = words_of("we need to finish the")
    now = words_of("We need to, finish testing on")
    assert agreed_prefix(before, now) == 4
    assert agreed_prefix([], now) == 0


def test_soft_window_commits_agreed_words_mid_sentence():
    words = words_of("we need to finish testing on the main browsers", step=1.0)  # runs into the window end
    segment = TranscribedSegment(0.0, 8.4, "we need to finish testing on the main browsers", "en", words)
    commit, advance, pending = plan_commit([segment], 9.0, final=False, full=False, soft=True, agreed=5)
    assert [s.text for s in commit] == ["we need to finish testing"]
    assert advance == words[5][0]  # resumes at the next word, never inside one
    assert pending == "on the main browsers"


def test_soft_window_without_agreement_waits():
    words = words_of("we need to finish testing")
    segment = TranscribedSegment(0.0, 8.5, "we need to finish testing", "en", words)
    commit, advance, _ = plan_commit([segment], 9.0, final=False, full=False, soft=True, agreed=0)
    assert commit == [] and advance == 0.0


def test_full_window_cuts_at_the_last_finished_word():
    words = words_of("one two three four five six", step=2.5)  # last word ends at 12.9 s
    segment = TranscribedSegment(0.0, 15.0, "one two three four five six", "en", words)
    commit, advance, pending = plan_commit([segment], 15.0, final=False, full=True)
    assert commit[0].text == "one two three four five six"
    assert advance == words[-1][1]
    assert pending == ""


def write_wav(path, samples: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((samples * 32767).astype("<i2").tobytes())


def test_long_audio_is_cut_in_the_quiet_parts(tmp_path):
    # 30 s of "speech" (noise) with 1 s of silence around 10 s and 20 s.
    rng = np.random.default_rng(0)
    samples = rng.uniform(-0.3, 0.3, 30 * SR).astype(np.float32)
    for quiet in (10.3, 19.6):
        samples[int(quiet * SR) : int((quiet + 1) * SR)] = 0.0
    path = tmp_path / "long.wav"
    write_wav(path, samples)

    bounds = audio.section_bounds(path, section_sec=10.0, search_sec=2.0)
    assert bounds[0][0] == 0 and bounds[-1][1] == 30 * SR
    assert len(bounds) == 3
    for _, end in bounds[:-1]:
        assert np.abs(samples[end - 400 : end + 400]).max() == 0.0  # the cut is inside a silence
    assert np.allclose(audio.read_wav(path, *bounds[1]), samples[bounds[1][0] : bounds[1][1]], atol=1e-4)


def test_short_audio_is_one_section(tmp_path):
    path = tmp_path / "short.wav"
    write_wav(path, np.zeros(5 * SR, dtype=np.float32))
    assert audio.section_bounds(path, section_sec=300.0) == [(0, 5 * SR)]


def test_live_transcript_reports_the_stable_part(client):
    from app.services import pipeline

    meeting_id = "8f3b0c2e-1111-4a5b-9c0d-1234567890ab"
    client.put(f"/api/meetings/{meeting_id}", json={"title": "Live", "capture_mode": "mic"})
    from app.db import SessionLocal
    from app.models import Meeting, MeetingStatus, Segment

    with SessionLocal() as db:  # a recording with one committed live line
        db.get(Meeting, meeting_id).status = MeetingStatus.RECORDING
        db.add(Segment(meeting_id=meeting_id, kind="live", idx=0, start=0.0, end=1.0, text="Hello.", language="en"))
        db.commit()
    pipeline.live_partials[meeting_id] = ("we need to", "we need to finish")
    body = client.get(f"/api/meetings/{meeting_id}/transcript").json()
    assert body["partial"] == "we need to finish"
    assert body["partial_stable"] == "we need to"
    client.delete(f"/api/meetings/{meeting_id}")
    assert meeting_id not in pipeline.live_partials
