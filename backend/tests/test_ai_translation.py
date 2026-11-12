"""#61 translation model: batching, id checks, skipping lines already in the target language."""

import json

import pytest

from app.ai.llm_client import LLMOutputError, MockLLMClient
from app.ai.translation import SegmentText, detect_language, needs_translation, translate_batch


def sent_ids(call: dict) -> list[int]:
    user = call["user"]
    return [item["id"] for item in json.loads(user[user.rindex("SEGMENTS:") + len("SEGMENTS:") :])]


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Chúng ta sẽ họp lại vào thứ Hai.", "vi"),
        ("Mình sẽ deploy lên staging trước khi review.", "vi"),
        ("Let's ship the release on Friday.", "en"),
        ("1, 2, 3...", None),
    ],
)
def test_detect_language(text, expected):
    assert detect_language(text) == expected


@pytest.mark.parametrize(
    "text, label, target, expected",
    [
        ("Let's ship it on Friday.", "en", "en", False),  # already English
        ("Chúng ta chốt phương án này.", "vi", "vi", False),  # already Vietnamese
        ("Chúng ta chốt phương án này.", None, "vi", False),  # no label: heuristic
        ("Let's ship it on Friday.", "en", "vi", True),
        ("Mình sẽ deploy lên staging nhé.", "vi", "en", True),  # mixed line, target English
        ("OK so the API trả về lỗi 500", "en", "en", True),  # labelled English but has Vietnamese words
        ("We need to refactor the payment module first.", "vi", "vi", True),  # mislabelled English sentence
        ("OK", "vi", "vi", False),
        ("...", None, "en", False),
    ],
)
def test_needs_translation(text, label, target, expected):
    assert needs_translation(text, label, target) is expected


def test_segments_already_in_target_language_are_not_sent():
    client = MockLLMClient()
    segments = [
        SegmentText(1, "Good morning everyone.", "en"),
        SegmentText(2, "Hôm nay mình review sprint.", "vi"),
        SegmentText(3, "The demo is on Friday.", "en"),
    ]
    result = translate_batch(client, segments, "vi", model="m")
    assert result == {1: "[vi] Good morning everyone.", 2: "Hôm nay mình review sprint.", 3: "[vi] The demo is on Friday."}
    assert len(client.calls) == 1 and sent_ids(client.calls[0]) == [1, 3]
    assert "Vietnamese" in client.calls[0]["system"] and "Keep technical terms" in client.calls[0]["system"]


def test_nothing_to_translate_means_no_call():
    client = MockLLMClient()
    assert translate_batch(client, [SegmentText(1, "Hello there.", "en")], "en") == {1: "Hello there."}
    assert client.calls == []


def test_missing_ids_are_requested_again_on_their_own():
    def responder(system, user):
        answer = json.loads(MockLLMClient.default_answer(system, user))
        if len(client.calls) == 1:  # first answer drops id 2
            answer["translations"] = [t for t in answer["translations"] if t["id"] != 2]
        return json.dumps(answer)

    client = MockLLMClient(responder=responder)
    segments = [SegmentText(i, f"Sentence number {i}.", "en") for i in (1, 2, 3)]
    result = translate_batch(client, segments, "vi")
    assert set(result) == {1, 2, 3}
    assert [sent_ids(c) for c in client.calls] == [[1, 2, 3], [2]]


def test_ids_still_missing_after_retry_raise():
    client = MockLLMClient(responder=lambda s, u: '{"translations": [{"id": 1, "translation": "Một"}]}')
    with pytest.raises(LLMOutputError, match=r"\[2\]"):
        translate_batch(client, [SegmentText(1, "One thing.", "en"), SegmentText(2, "Two things.", "en")], "vi")
    assert len(client.calls) == 2


def test_extra_ids_from_the_model_are_ignored():
    client = MockLLMClient(
        responder=lambda s, u: '```json\n[{"id": 1, "translation": "Một"}, {"id": 99, "translation": "bịa"}]\n```'
    )
    assert translate_batch(client, [SegmentText(1, "One thing.", "en")], "vi") == {1: "Một"}


def test_single_segment_with_context_for_live_use():
    """Sprint 4 live translation calls it for one sentence, with the previous lines as context."""
    client = MockLLMClient()
    result = translate_batch(client, [SegmentText(7, "Can you share your screen?")], "vi", context=["Let's start."])
    assert result == {7: "[vi] Can you share your screen?"}
    user = client.calls[0]["user"]
    assert "do not translate" in user and "- Let's start." in user and sent_ids(client.calls[0]) == [7]
