"""LLM access shared by summary and translation.

Every model is called through the OpenAI-compatible Chat Completions API, so the same code works with a
local Ollama server (Gemma, Qwen...) and with cloud providers. Tests and CI use `MockLLMClient`
(`AI_MOCK=true`), which never touches the network.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Protocol

import httpx

from ..config import get_settings
from .languages import language_name

log = logging.getLogger(__name__)


class LLMError(Exception):
    """The model could not be reached or did not produce a usable answer."""


class LLMOutputError(LLMError):
    """The model answered, but the answer is not valid JSON / does not match the expected shape."""


@dataclass
class LLMResult:
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_sec: float = 0.0
    cost_usd: float = 0.0


@dataclass
class Usage:
    """Running totals over several calls (reported per summary / translation, see finding R6)."""

    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    latency_sec: float = 0.0
    cost_usd: float = 0.0

    def add(self, result: LLMResult) -> None:
        self.calls += 1
        self.input_tokens += result.input_tokens
        self.output_tokens += result.output_tokens
        self.latency_sec += result.latency_sec
        self.cost_usd += result.cost_usd


class LLMClient(Protocol):
    def complete(self, system: str, user: str, *, model: str, json_mode: bool = False) -> LLMResult: ...


def estimate_cost(input_tokens: int, output_tokens: int) -> float:
    settings = get_settings()
    return (input_tokens * settings.llm_price_input_per_1m + output_tokens * settings.llm_price_output_per_1m) / 1e6


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


# --------------------------------------------------------------------------- real client


class OpenAICompatClient:
    """POST {base_url}/chat/completions with timeout, and retries with backoff on 429 / 5xx / network errors."""

    RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504}

    def __init__(
        self,
        base_url: str,
        api_key: str = "",
        *,
        timeout: float = 120.0,
        max_retries: int = 2,
        temperature: float = 0.2,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._http = httpx.Client(base_url=base_url.rstrip("/"), headers=headers, timeout=timeout, transport=transport)
        self.max_retries = max_retries
        self.temperature = temperature
        self._sleep = sleep

    def complete(self, system: str, user: str, *, model: str, json_mode: bool = False) -> LLMResult:
        payload: dict = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": self.temperature,
            "stream": False,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        started = time.monotonic()
        last_error = "unknown error"
        for attempt in range(self.max_retries + 1):
            if attempt:
                self._sleep(min(30.0, 2.0**attempt))
            try:
                response = self._http.post("/chat/completions", json=payload)
            except httpx.TimeoutException:
                last_error = f"the model did not answer within {self._http.timeout.read:.0f} s"
                continue
            except httpx.HTTPError as exc:
                last_error = f"cannot reach the model server ({exc.__class__.__name__}: {exc})"
                continue
            if response.status_code in self.RETRY_STATUS:
                last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                continue
            if response.status_code >= 400:
                raise LLMError(f"The model server refused the request (HTTP {response.status_code}): {response.text[:300]}")
            return self._parse(response, started)
        raise LLMError(f"LLM request failed after {self.max_retries + 1} attempts: {last_error}")

    @staticmethod
    def _parse(response: httpx.Response, started: float) -> LLMResult:
        try:
            data = response.json()
            text = data["choices"][0]["message"]["content"] or ""
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMError(f"Unexpected answer from the model server: {response.text[:300]}") from exc
        usage = data.get("usage") or {}
        input_tokens = int(usage.get("prompt_tokens") or 0)
        output_tokens = int(usage.get("completion_tokens") or 0)
        return LLMResult(
            text=text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_sec=round(time.monotonic() - started, 3),
            cost_usd=estimate_cost(input_tokens, output_tokens),
        )


# --------------------------------------------------------------------------- mock client

_LANG_RE = re.compile(r"(?:Output|Target) language: [^\n(]*\((\w+)\)")
_LINE_RE = re.compile(r"^\[(\d+)\] \[[\d:]+\] (.*)$", re.MULTILINE)

_MOCK_TEXT = {
    "vi": {
        "overview": "Bản tóm tắt thử nghiệm (mock) của cuộc họp, gồm {n} dòng transcript.",
        "decision": "Thống nhất: {text}",
        "action": "Theo dõi: {text}",
        "question": "Còn cần làm rõ: {text}",
    },
    "en": {
        "overview": "Mock summary of the meeting, based on {n} transcript lines.",
        "decision": "Agreed: {text}",
        "action": "Follow up: {text}",
        "question": "Still to clarify: {text}",
    },
}


@dataclass
class MockLLMClient:
    """Deterministic fake model. Understands the summary and translation prompts of this package.

    `responder(system, user)` can override the answer (tests: broken JSON, missing ids, failures).
    """

    responder: Callable[[str, str], str] | None = None
    calls: list[dict] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def complete(self, system: str, user: str, *, model: str, json_mode: bool = False) -> LLMResult:
        with self._lock:
            self.calls.append({"system": system, "user": user, "model": model, "json_mode": json_mode})
        text = self.responder(system, user) if self.responder else self.default_answer(system, user)
        input_tokens, output_tokens = _estimate_tokens(system + user), _estimate_tokens(text)
        return LLMResult(text, input_tokens, output_tokens, 0.0, estimate_cost(input_tokens, output_tokens))

    @staticmethod
    def default_answer(system: str, user: str) -> str:
        match = _LANG_RE.search(user)
        lang = match.group(1) if match else "en"
        if '"translations"' in system:
            return MockLLMClient._translate(user, lang)
        return MockLLMClient._minutes(user, lang)

    @staticmethod
    def _translate(user: str, lang: str) -> str:
        items = json.loads(user[user.rindex("SEGMENTS:") + len("SEGMENTS:") :].strip())
        return json.dumps(
            {"translations": [{"id": item["id"], "translation": f"[{lang}] {item['text']}"} for item in items]},
            ensure_ascii=False,
        )

    @staticmethod
    def _minutes(user: str, lang: str) -> str:
        texts = _MOCK_TEXT.get(lang, _MOCK_TEXT["en"])
        if "PARTIAL SUMMARIES:" in user:  # reduce step: merge the partial minutes
            partials = json.loads(user[user.index("PARTIAL SUMMARIES:") + len("PARTIAL SUMMARIES:") :].strip())
            merged: dict = {"key_points": [], "decisions": [], "action_items": [], "open_questions": []}
            for part in partials:
                for key in merged:
                    for item in part.get(key, []):
                        if item not in merged[key]:
                            merged[key].append(item)
            numbers = (re.search(r"\d+", str(p.get("overview", ""))) for p in partials)
            lines = sum(int(m.group()) for m in numbers if m)
            return json.dumps({"overview": texts["overview"].format(n=lines), **merged}, ensure_ascii=False)

        lines = _LINE_RE.findall(user)
        first = lines[0] if lines else ("0", "")
        last = lines[-1] if lines else ("0", "")
        return json.dumps(
            {
                "overview": texts["overview"].format(n=len(lines)),
                "key_points": [text for _, text in lines[:3]],
                "decisions": [texts["decision"].format(text=first[1])] if lines else [],
                "action_items": (
                    [{"task": texts["action"].format(text=last[1]), "owner": None, "due": None, "segment_ids": [int(last[0])]}]
                    if lines
                    else []
                ),
                "open_questions": [texts["question"].format(text=last[1])] if len(lines) > 1 else [],
            },
            ensure_ascii=False,
        )


# --------------------------------------------------------------------------- factory


@lru_cache
def _default_client() -> LLMClient:
    settings = get_settings()
    if settings.ai_mock:
        log.info("AI_MOCK=true: summaries and translations come from the mock model")
        return MockLLMClient()
    return OpenAICompatClient(
        settings.llm_base_url,
        settings.llm_api_key,
        timeout=settings.llm_timeout_sec,
        max_retries=settings.llm_max_retries,
        temperature=settings.llm_temperature,
    )


def get_llm_client() -> LLMClient:
    """The configured client (mock when AI_MOCK=true). Tests replace this function."""
    return _default_client()


__all__ = [
    "LLMClient",
    "LLMError",
    "LLMOutputError",
    "LLMResult",
    "MockLLMClient",
    "OpenAICompatClient",
    "Usage",
    "get_llm_client",
    "language_name",
]
