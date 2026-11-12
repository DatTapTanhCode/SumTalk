"""Batch translation of transcript segments (#61).

`translate_batch` has no dependency on the job queue or the database, so Sprint 4 live translation (#84)
can call it for a single sentence.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

from ...config import get_settings
from ..jsonutil import complete_json
from ..languages import language_name
from ..llm_client import LLMClient, LLMOutputError, Usage
from . import prompts


@dataclass
class SegmentText:
    id: int
    text: str
    language: str | None = None  # per-segment label from Whisper language detection, when known


# Letters that only Vietnamese uses among vi/en: đ, ă, â, ê, ô, ơ, ư and the tone marks.
_VI_BASE = set("đăâêôơư")
_VI_TONES = {"̀", "́", "̃", "̉", "̣"}  # grave, acute, tilde, hook above, dot below
_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def _is_vietnamese_word(word: str) -> bool:
    lower = word.lower()
    if any(c in _VI_BASE for c in lower):
        return True
    return any(c in _VI_TONES for c in unicodedata.normalize("NFD", lower))


def vietnamese_ratio(text: str) -> float:
    words = _WORD_RE.findall(text)
    return sum(_is_vietnamese_word(w) for w in words) / len(words) if words else 0.0


def detect_language(text: str) -> str | None:
    """Light vi/en heuristic for segments without a language label: share of words with Vietnamese letters."""
    words = _WORD_RE.findall(text)
    if not words:
        return None
    if vietnamese_ratio(text) >= 0.2:
        return "vi"
    if all(w.isascii() for w in words):
        return "en"
    return None


def needs_translation(text: str, label: str | None, target: str) -> bool:
    """False when the segment is already in the target language (it is then kept as is, without an LLM call)."""
    if not _WORD_RE.search(text):
        return False  # punctuation / numbers only
    guess = detect_language(text)
    language = label or guess
    if language != target:
        return True
    ratio = vietnamese_ratio(text)
    if target == "en" and ratio > 0:  # English line with Vietnamese words in it: translate those
        return True
    if target == "vi" and ratio == 0 and guess == "en" and len(_WORD_RE.findall(text)) >= 4:
        return True  # labelled Vietnamese, but clearly an English sentence
    return False


def _parse_translations(data: Any) -> dict[int, str]:
    items = data.get("translations", data) if isinstance(data, dict) else data
    if not isinstance(items, list):
        raise ValueError('expected {"translations": [...]}')
    result: dict[int, str] = {}
    for item in items:
        if not isinstance(item, dict) or "id" not in item:
            continue
        text = item.get("translation", item.get("text"))
        if isinstance(text, str) and text.strip():
            result[int(item["id"])] = text.strip()
    return result


def _request(
    client: LLMClient, segments: list[SegmentText], target: str, model: str, context: list[str], usage: Usage | None
) -> dict[int, str]:
    names = {"target_language": target, "target_language_name": language_name(target)}
    system = prompts.SYSTEM.replace("{target_language_name}", names["target_language_name"])
    context_block = prompts.CONTEXT.format(lines="\n".join(f"- {line}" for line in context)) if context else ""
    payload = json.dumps([{"id": s.id, "text": s.text} for s in segments], ensure_ascii=False, indent=0)
    user = prompts.USER.format(context=context_block, segments=payload, **names)
    return complete_json(client, system, user, model=model, parse=_parse_translations, usage=usage)


def translate_batch(
    client: LLMClient,
    segments: list[SegmentText],
    target_lang: str,
    *,
    model: str | None = None,
    context: list[str] | None = None,
    usage: Usage | None = None,
) -> dict[int, str]:
    """Translation of every segment, keyed by id. Segments already in `target_lang` come back unchanged and
    are not sent to the model. Ids missing from the answer are requested once more on their own; if some
    are still missing, LLMOutputError is raised."""
    model = model or get_settings().translation_model
    result = {s.id: s.text for s in segments if not needs_translation(s.text, s.language, target_lang)}
    todo = [s for s in segments if s.id not in result]
    if not todo:
        return result

    wanted = {s.id for s in todo}
    translated = {k: v for k, v in _request(client, todo, target_lang, model, context or [], usage).items() if k in wanted}
    missing = [s for s in todo if s.id not in translated]
    if missing:
        again = _request(client, missing, target_lang, model, context or [], usage)
        translated.update({s.id: again[s.id] for s in missing if s.id in again})
        still = [s.id for s in missing if s.id not in translated]
        if still:
            raise LLMOutputError(f"The model did not translate segment(s) {still[:10]} after a retry.")
    result.update(translated)
    return result
