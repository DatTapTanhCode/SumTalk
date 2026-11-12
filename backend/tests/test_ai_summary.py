"""#68 summary model + prompt, #69 long transcripts (map-reduce). Mock LLM only."""

import json

import httpx
import pytest

from app.ai.jsonutil import complete_json, extract_json
from app.ai.llm_client import LLMError, LLMOutputError, MockLLMClient, OpenAICompatClient
from app.ai.summary import Line, Minutes, SummaryTimeout, chunk_lines, format_transcript, summarize

VALID = json.dumps(
    {
        "overview": "Nhóm chốt kế hoạch release.",
        "key_points": ["Demo vào thứ Sáu"],
        "decisions": ["Dùng PostgreSQL"],
        "action_items": [{"task": "Viết test", "owner": "Đạt", "due": None, "segment_ids": [3]}],
        "open_questions": [],
    },
    ensure_ascii=False,
)


def lines(n: int, text: str = "We should deploy the API to staging before the sprint review on Friday afternoon.") -> list[Line]:
    return [Line(i, i * 5.0, f"{text} ({i})") for i in range(n)]


# ----------------------------------------------------------------------------- formatting + JSON


def test_format_transcript_has_segment_id_and_clock():
    text = format_transcript([Line(0, 0, "Hello"), Line(7, 3725.4, "Xin chào", speaker="Nhật"), Line(8, 3726, "  ")])
    assert text.splitlines() == ["[0] [00:00:00] Hello", "[7] [01:02:05] Nhật: Xin chào"]


@pytest.mark.parametrize(
    "answer",
    [VALID, f"```json\n{VALID}\n```", f"```\n{VALID}\n```", f"Here are the minutes:\n{VALID}\nHope this helps!"],
)
def test_extract_json_accepts_fences_and_chatter(answer):
    assert extract_json(answer)["decisions"] == ["Dùng PostgreSQL"]


def test_extract_json_rejects_garbage():
    with pytest.raises(ValueError):
        extract_json('{"overview": "cut off')


def test_bad_json_is_retried_once_with_a_reminder():
    answers = iter(['{"overview": "cut off', VALID])
    client = MockLLMClient(responder=lambda s, u: next(answers))
    minutes = complete_json(client, "sys", "user", model="m", parse=Minutes.model_validate)
    assert minutes.decisions == ["Dùng PostgreSQL"]
    assert len(client.calls) == 2
    assert "Return only valid JSON" in client.calls[1]["user"]


def test_bad_json_twice_raises_a_clear_error():
    client = MockLLMClient(responder=lambda s, u: "Sorry, I cannot do that.")
    with pytest.raises(LLMOutputError, match="valid JSON"):
        complete_json(client, "sys", "user", model="m", parse=Minutes.model_validate)
    assert len(client.calls) == 2


def test_wrong_shape_counts_as_bad_json():
    answers = iter(['{"summary": "no overview key"}', VALID])
    client = MockLLMClient(responder=lambda s, u: next(answers))
    assert complete_json(client, "s", "u", model="m", parse=Minutes.model_validate).overview
    assert len(client.calls) == 2


def test_minutes_schema_is_lenient_with_common_model_mistakes():
    minutes = Minutes.model_validate(
        {
            "overview": "x",
            "key_points": "only one point",
            "decisions": None,
            "action_items": ["Send the report", {"task": "Fix bug", "owner": "", "due": "N/A", "segment_ids": ["4", 5]}],
        }
    )
    assert minutes.key_points == ["only one point"] and minutes.decisions == [] and minutes.open_questions == []
    assert minutes.action_items[0].task == "Send the report"
    assert minutes.action_items[1].owner is None and minutes.action_items[1].due is None
    assert minutes.action_items[1].segment_ids == [4, 5]


# ----------------------------------------------------------------------------- single pass


def test_short_transcript_is_one_call_in_the_chosen_language():
    client = MockLLMClient()
    run = summarize(client, lines(10), language="vi", title="Weekly sync", chunk_chars=12_000)
    assert run.mode == "single" and run.usage.calls == 1
    prompt = client.calls[0]
    assert "Vietnamese" in prompt["system"] and "Keep English technical terms" in prompt["system"]
    assert "Never invent" in prompt["system"]
    assert "[3] [00:00:15]" in prompt["user"] and prompt["json_mode"] is True
    assert run.minutes.overview.startswith("Bản tóm tắt")
    assert run.minutes.key_points and run.minutes.decisions


def test_empty_transcript_needs_no_model_call():
    client = MockLLMClient()
    run = summarize(client, [], language="en", title="Silent")
    assert run.mode == "empty" and client.calls == [] and "nothing to summarize" in run.minutes.overview


def test_deadline_stops_the_summary():
    with pytest.raises(SummaryTimeout):
        summarize(MockLLMClient(), lines(5), language="en", title="t", deadline=0)


# ----------------------------------------------------------------------------- long transcripts (#69)


def test_chunks_split_on_line_boundaries_with_overlap():
    text = [f"[{i}] [00:00:00] " + "word " * 20 for i in range(50)]
    chunks = chunk_lines(text, 1000, overlap=2)
    assert len(chunks) > 1
    assert all(sum(len(x) + 1 for x in c) <= 1000 for c in chunks)
    for previous, current in zip(chunks, chunks[1:]):
        assert current[:2] == previous[-2:]  # overlap of 2 segments
    covered = [line for c in chunks for line in c]
    assert set(covered) == set(text)  # nothing lost, lines never cut


def test_oversized_line_gets_its_own_chunk():
    chunks = chunk_lines(["a" * 50, "b" * 500, "c" * 50], 100, overlap=1)
    assert ["b" * 500] in chunks or any("b" * 500 in c for c in chunks)
    assert sum(1 for c in chunks if "c" * 50 in c) >= 1


def test_one_hour_meeting_uses_map_reduce():
    """~60 min, ~80k characters: N map calls + 1 reduce, valid schema."""
    transcript = lines(780)  # one line every 5 s = 65 min
    total_chars = len(format_transcript(transcript))
    assert 75_000 < total_chars < 100_000

    client = MockLLMClient()
    run = summarize(client, transcript, language="en", title="All hands", chunk_chars=12_000)
    expected_chunks = len(chunk_lines(format_transcript(transcript).splitlines(), 12_000, overlap=2))
    assert run.mode == "map_reduce" and run.chunks == expected_chunks >= 7
    users = [c["user"] for c in client.calls]
    assert sum("Transcript part" in u for u in users) == expected_chunks
    assert sum("PARTIAL SUMMARIES:" in u for u in users) == 1
    assert "PARTIAL SUMMARIES:" in users[-1]  # reduce runs last
    assert run.usage.calls == expected_chunks + 1 and run.usage.input_tokens > 0
    Minutes.model_validate(run.minutes.model_dump())
    assert run.minutes.overview.startswith("Mock summary") and run.minutes.decisions


def test_very_long_meeting_reduces_in_groups():
    client = MockLLMClient()
    run = summarize(client, lines(400), language="en", title="Offsite", chunk_chars=2_000)
    reduces = [c for c in client.calls if "PARTIAL SUMMARIES:" in c["user"]]
    assert len(reduces) > 1  # partial summaries did not fit in one prompt
    assert run.minutes.overview


# ----------------------------------------------------------------------------- HTTP client


def _client(handler):
    return OpenAICompatClient("http://llm/v1", "key", max_retries=2, transport=httpx.MockTransport(handler), sleep=lambda s: None)


def test_openai_client_retries_server_errors_and_reads_usage():
    calls = []

    def handler(request: httpx.Request):
        calls.append(json.loads(request.content))
        if len(calls) == 1:
            return httpx.Response(503, text="busy")
        return httpx.Response(
            200, json={"choices": [{"message": {"content": "{}"}}], "usage": {"prompt_tokens": 12, "completion_tokens": 3}}
        )

    result = _client(handler).complete("sys", "hi", model="gemma", json_mode=True)
    assert (result.text, result.input_tokens, result.output_tokens) == ("{}", 12, 3)
    assert len(calls) == 2
    assert calls[0]["model"] == "gemma" and calls[0]["response_format"] == {"type": "json_object"}
    assert calls[0]["messages"][0] == {"role": "system", "content": "sys"}


def test_openai_client_gives_up_after_retries():
    client = _client(lambda request: httpx.Response(429, text="rate limited"))
    with pytest.raises(LLMError, match="after 3 attempts"):
        client.complete("s", "u", model="m")


def test_openai_client_does_not_retry_bad_requests():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(400, text="unknown model")

    with pytest.raises(LLMError, match="HTTP 400"):
        _client(handler).complete("s", "u", model="m")
    assert len(calls) == 1
