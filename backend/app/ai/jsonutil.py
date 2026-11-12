"""Getting JSON out of a model answer: code fences, chatter around the JSON, one repair retry."""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from typing import Any, TypeVar

from pydantic import ValidationError

from .llm_client import LLMClient, LLMOutputError, Usage

T = TypeVar("T")

_FENCE_RE = re.compile(r"```(?:json|JSON)?\s*(.*?)```", re.DOTALL)

REPAIR_HINT = (
    "\n\nYour previous answer could not be used: {error}\n"
    "Return only valid JSON in exactly the requested shape. No explanations, no code fences."
)


def extract_json(text: str) -> Any:
    """Parse the JSON in a model answer. Accepts ```json fences and text before/after the JSON."""
    text = text.strip()
    candidates = [m.group(1).strip() for m in _FENCE_RE.finditer(text)] + [text]
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        # Outermost object / array inside surrounding prose.
        for open_char, close_char in (("{", "}"), ("[", "]")):
            start, end = candidate.find(open_char), candidate.rfind(close_char)
            if 0 <= start < end:
                try:
                    return json.loads(candidate[start : end + 1])
                except json.JSONDecodeError:
                    continue
    raise ValueError("no valid JSON found in the model answer")


def complete_json(
    client: LLMClient,
    system: str,
    user: str,
    *,
    model: str,
    parse: Callable[[Any], T],
    usage: Usage | None = None,
) -> T:
    """Call the model and parse its JSON with `parse`. On bad JSON or a wrong shape, ask once more
    ("Return only valid JSON"); if that fails too, raise LLMOutputError with a clear message."""
    prompt = user
    for attempt in range(2):
        result = client.complete(system, prompt, model=model, json_mode=True)
        if usage is not None:
            usage.add(result)
        try:
            return parse(extract_json(result.text))
        except (ValueError, TypeError, KeyError, ValidationError) as exc:
            error = _short_error(exc)
            if attempt == 0:
                prompt = user + REPAIR_HINT.format(error=error)
    raise LLMOutputError(f"The model did not return valid JSON after a retry ({error}).")


def _short_error(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        first = exc.errors()[0]
        location = ".".join(str(p) for p in first.get("loc", ()))
        return f"{location}: {first.get('msg')}" if location else str(first.get("msg"))
    return str(exc)[:200]
