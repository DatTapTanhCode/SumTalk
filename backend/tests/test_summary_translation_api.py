"""#70 summary step + API, #62/#63 translation storage + job, #65 export. Fake STT + mock LLM."""

import re
import time
import uuid

import pytest
import srt
from conftest import wait_for_status
from test_api import upload, wav_file

from app.ai import llm_client
from app.ai.llm_client import LLMError, MockLLMClient
from app.db import SessionLocal, init_db
from app.models import Meeting, Segment, SegmentTranslation, Summary, Translation
from app.services import ai_jobs


def wait_for(fetch, statuses=("done", "failed"), timeout=20.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = fetch()
        if response.status_code == 200 and response.json()["status"] in statuses:
            return response.json()
        time.sleep(0.05)
    raise AssertionError(f"still {response.status_code} {response.text[:200]}")


def transcribed_meeting(client, seconds=8) -> str:
    meeting = wait_for_status(client, upload(client, "sync.wav", wav_file(seconds), title="Sprint sync")["id"])
    assert meeting["status"] == "done"
    return meeting["id"]


@pytest.fixture()
def mock_llm(monkeypatch):
    """A fresh mock model per test, so its calls can be counted."""
    mock = MockLLMClient()
    monkeypatch.setattr(llm_client, "get_llm_client", lambda: mock)
    return mock


# ----------------------------------------------------------------------------- summary (#70)


def test_summary_is_created_automatically_after_transcription(client, mock_llm):
    meeting_id = transcribed_meeting(client)
    summary = wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))
    assert summary["status"] == "done" and summary["language"] == "vi"  # DEFAULT_SUMMARY_LANGUAGE
    content = summary["content"]
    assert content["overview"].startswith("Bản tóm tắt")
    assert content["key_points"] and content["decisions"]
    assert set(content) == {"overview", "key_points", "decisions", "action_items", "open_questions"}
    assert content["action_items"][0]["segment_ids"] == [3]  # idx of the cited segment
    assert summary["mode"] == "single" and summary["calls"] == 1 and summary["input_tokens"] > 0


def test_regenerate_replaces_the_summary_in_another_language(client, mock_llm):
    meeting_id = transcribed_meeting(client)
    first = wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))

    response = client.post(f"/api/meetings/{meeting_id}/summary/regenerate", json={"language": "en"})
    assert response.status_code == 202 and response.json()["status"] == "pending"
    second = wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))
    assert second["language"] == "en" and second["content"]["overview"].startswith("Mock summary")
    assert second["content"] != first["content"]
    with SessionLocal() as db:  # replaced, not added
        assert db.query(Summary).filter(Summary.meeting_id == meeting_id).count() == 1

    # Without a body the language stays.
    assert client.post(f"/api/meetings/{meeting_id}/summary/regenerate").status_code == 202
    assert wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))["language"] == "en"


def test_regenerate_validation(client, mock_llm):
    meeting_id = transcribed_meeting(client)
    wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))
    assert client.post(f"/api/meetings/{meeting_id}/summary/regenerate", json={"language": "xx"}).status_code == 422

    with SessionLocal() as db:
        db.query(Summary).filter(Summary.meeting_id == meeting_id).update({"status": "running"})
        db.commit()
    response = client.post(f"/api/meetings/{meeting_id}/summary/regenerate", json={})
    assert response.status_code == 409


def test_no_summary_before_the_transcript(client, mock_llm):
    meeting_id = str(uuid.uuid4())
    client.put(f"/api/meetings/{meeting_id}", json={"title": "Still recording"})
    assert client.get(f"/api/meetings/{meeting_id}/summary").status_code == 404
    assert client.post(f"/api/meetings/{meeting_id}/summary/regenerate", json={}).status_code == 409
    assert client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "vi"}).status_code == 409


def test_failing_model_marks_the_summary_failed_after_retries(client, monkeypatch):
    def broken(system, user):
        raise LLMError("cannot reach the model server (ConnectError)")

    mock = MockLLMClient(responder=broken)
    monkeypatch.setattr(llm_client, "get_llm_client", lambda: mock)
    meeting_id = transcribed_meeting(client)
    summary = wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"), statuses=("failed",))
    assert summary["content"] is None
    assert "cannot reach the model server" in summary["error"]
    assert len(mock.calls) == 3  # first try + AI_JOB_RETRIES (2)

    # Retry works once the model is back.
    monkeypatch.setattr(llm_client, "get_llm_client", lambda: MockLLMClient())
    assert client.post(f"/api/meetings/{meeting_id}/summary/regenerate", json={}).status_code == 202
    assert wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))["status"] == "done"


def test_retranscribe_rebuilds_summary_and_drops_translations(client, mock_llm):
    meeting_id = transcribed_meeting(client)
    wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))
    client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "vi"})
    wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/translations/vi"))

    assert client.post(f"/api/meetings/{meeting_id}/retranscribe", json={"language": "en"}).status_code == 200
    wait_for_status(client, meeting_id)
    assert wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))["status"] == "done"
    assert client.get(f"/api/meetings/{meeting_id}/translations").json() == []


# ----------------------------------------------------------------------------- translation API (#62)


def test_translation_is_created_then_reused(client, mock_llm):
    meeting_id = transcribed_meeting(client)
    wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/summary"))
    calls_before = len(mock_llm.calls)

    response = client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "vi"})
    assert response.status_code == 202 and response.json()["status"] in ("pending", "running", "done")
    done = wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/translations/vi"))
    assert done["status"] == "done" and done["progress"] == 100
    segments = done["segments"]
    assert [s["segment_id"] for s in segments] == [0, 1, 2, 3]  # time order
    assert all(s["translation"] == f"[vi] {s['original']}" and not s["skipped"] for s in segments)
    assert segments[1]["start"] == 2.0 and segments[1]["speaker"] is None
    translation_calls = len(mock_llm.calls) - calls_before
    assert translation_calls == 1  # 4 segments < batch of 20

    again = client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "vi"})
    assert again.status_code == 200 and again.json()["segments"] == segments
    time.sleep(0.2)
    assert len(mock_llm.calls) - calls_before == translation_calls  # not translated again

    listing = client.get(f"/api/meetings/{meeting_id}/translations").json()
    assert [(t["target_lang"], t["status"]) for t in listing] == [("vi", "done")]


def test_lines_already_in_target_language_are_kept(client, mock_llm):
    meeting_id = transcribed_meeting(client)  # the fake transcript is English
    client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "en"})
    done = wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/translations/en"))
    assert all(s["skipped"] and s["translation"] == s["original"] for s in done["segments"])


def test_translation_errors(client, mock_llm):
    meeting_id = transcribed_meeting(client)
    assert client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "fr"}).status_code == 422
    assert client.get(f"/api/meetings/{meeting_id}/translations/vi").status_code == 404
    client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "vi"})
    wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/translations/vi"))
    assert client.post(f"/api/meetings/{meeting_id}/translations/vi/retry").status_code == 409  # not failed


def test_failed_translation_can_be_retried(client, monkeypatch):
    monkeypatch.setattr(llm_client, "get_llm_client", lambda: MockLLMClient(responder=lambda s, u: "not json"))
    meeting_id = transcribed_meeting(client)
    client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "vi"})
    failed = wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/translations/vi"), statuses=("failed",))
    assert "valid JSON" in failed["error"]
    assert client.get(f"/api/meetings/{meeting_id}/translations/vi/export").status_code == 409

    monkeypatch.setattr(llm_client, "get_llm_client", lambda: MockLLMClient())
    assert client.post(f"/api/meetings/{meeting_id}/translations/vi/retry").status_code == 202
    assert wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/translations/vi"))["status"] == "done"


# ----------------------------------------------------------------------------- export (#65)


def test_export_txt_and_srt_with_vietnamese(client, monkeypatch):
    def vietnamese(system, user):
        answer = MockLLMClient.default_answer(system, user)
        return answer.replace("[vi] Sentence", "Câu số")  # "Câu số 2." - Vietnamese with diacritics

    monkeypatch.setattr(llm_client, "get_llm_client", lambda: MockLLMClient(responder=vietnamese))
    meeting_id = transcribed_meeting(client)
    client.post(f"/api/meetings/{meeting_id}/translations", json={"target_lang": "vi"})
    wait_for(lambda: client.get(f"/api/meetings/{meeting_id}/translations/vi"))

    txt = client.get(f"/api/meetings/{meeting_id}/translations/vi/export", params={"format": "txt"})
    assert txt.status_code == 200 and txt.headers["content-type"].startswith("text/plain; charset=utf-8")
    assert txt.content.startswith(b"\xef\xbb\xbf")  # BOM for Windows Notepad
    assert "Sprint%20sync_vi.txt" in txt.headers["content-disposition"]
    body = txt.content.decode("utf-8-sig")
    assert "[00:00:02] Câu số 2." in body and "Sentence" not in body.split("\n\n", 1)[1]

    bilingual = client.get(f"/api/meetings/{meeting_id}/translations/vi/export", params={"mode": "bilingual"})
    lines = bilingual.content.decode("utf-8-sig").splitlines()
    i = lines.index("[00:00:02] Sentence 2.")
    assert lines[i + 1].strip() == "Câu số 2."  # original above the translation

    response = client.get(f"/api/meetings/{meeting_id}/translations/vi/export", params={"format": "srt"})
    assert response.status_code == 200 and "_vi.srt" in response.headers["content-disposition"]
    assert not response.content.startswith(b"\xef\xbb\xbf")
    cues = list(srt.parse(response.content.decode("utf-8")))
    assert [c.index for c in cues] == [1, 2, 3, 4]
    assert cues[1].content == "Câu số 2."
    assert srt.timedelta_to_srt_timestamp(cues[1].start) == "00:00:02,000"
    assert "00:00:02,000 --> 00:00:03,800" in response.text

    both = client.get(f"/api/meetings/{meeting_id}/translations/vi/export", params={"format": "srt", "mode": "bilingual"})
    assert list(srt.parse(both.text))[1].content == "Sentence 2.\nCâu số 2."


# ----------------------------------------------------------------------------- translation job (#63)


def _meeting_with_segments(n: int, target: str = "vi") -> tuple[str, int]:
    init_db()
    meeting_id = str(uuid.uuid4())
    with SessionLocal() as db:
        db.add(Meeting(id=meeting_id, title="Long meeting", source="upload", status="done"))
        for i in range(n):
            db.add(
                Segment(
                    meeting_id=meeting_id, kind="final", idx=i, start=i * 4.0, end=i * 4.0 + 3,
                    text=f"English sentence {i}.", language="en",
                )
            )  # fmt: skip
        translation = Translation(meeting_id=meeting_id, target_lang=target, status="pending", progress=0)
        db.add(translation)
        db.commit()
        return meeting_id, translation.id


def _progress(tid: int) -> int:
    with SessionLocal() as db:
        return db.get(Translation, tid).progress


def test_translation_job_batches_and_reports_progress():
    _, tid = _meeting_with_segments(45)
    progress_seen = []

    def responder(system, user):
        progress_seen.append(_progress(tid))
        return MockLLMClient.default_answer(system, user)

    mock = MockLLMClient(responder=responder)
    ai_jobs.run_translation_job(str(tid), client=mock)
    assert len(mock.calls) == 3  # 45 segments, batches of 20
    assert progress_seen == [0, 44, 88]
    with SessionLocal() as db:
        translation = db.get(Translation, tid)
        assert (translation.status, translation.progress, translation.calls) == ("done", 100, 3)
        assert translation.input_tokens > 0
        assert db.query(SegmentTranslation).filter(SegmentTranslation.translation_id == tid).count() == 45
    # The second batch had the 2 previous lines as context.
    assert "English sentence 18." in mock.calls[1]["user"] and "English sentence 19." in mock.calls[1]["user"]


def test_retry_after_a_failed_batch_does_not_translate_earlier_batches_again():
    _, tid = _meeting_with_segments(45)
    failed_once = []

    def responder(system, user):
        if len(mock.calls) == 2 and not failed_once:
            failed_once.append(True)
            raise LLMError("HTTP 503: model overloaded")
        return MockLLMClient.default_answer(system, user)

    mock = MockLLMClient(responder=responder)
    ai_jobs.run_translation_job(str(tid), client=mock)

    batches = [
        [int(x) for x in re.findall(r'"id": (\d+)', c["user"].split("SEGMENTS:")[1])] for c in mock.calls
    ]
    assert len(batches) == 4  # batch 1, batch 2 (fails), batch 2 again, batch 3
    assert batches[1] == batches[2]
    first_batch = set(batches[0])
    assert all(not first_batch & set(b) for b in batches[1:])  # batch 1 was never sent again
    with SessionLocal() as db:
        assert db.get(Translation, tid).status == "done"
        assert db.query(SegmentTranslation).filter(SegmentTranslation.translation_id == tid).count() == 45
