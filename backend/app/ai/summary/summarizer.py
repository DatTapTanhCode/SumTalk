"""Summarize a transcript (#68) - single pass for short meetings, map-reduce for long ones (#69)."""

from __future__ import annotations

import json
import time
from dataclasses import dataclass

from ...config import get_settings
from ..jsonutil import complete_json
from ..languages import language_name
from ..llm_client import LLMClient, LLMError, Usage
from . import prompts
from .schema import Minutes


class SummaryTimeout(LLMError):
    """The summary did not finish within the job time limit."""


@dataclass
class Line:
    """One transcript segment as the summarizer sees it."""

    seg_id: int
    start: float
    text: str
    speaker: str | None = None  # the transcript has no speaker labels yet (diarization is not built)


@dataclass
class SummaryRun:
    minutes: Minutes
    mode: str  # empty | single | map_reduce
    chunks: int
    usage: Usage


def _clock(seconds: float) -> str:
    total = max(0, int(seconds))
    return f"{total // 3600:02}:{total % 3600 // 60:02}:{total % 60:02}"


def format_line(line: Line) -> str:
    speaker = f"{line.speaker}: " if line.speaker else ""
    return f"[{line.seg_id}] [{_clock(line.start)}] {speaker}{line.text.strip()}"


def format_transcript(lines: list[Line]) -> str:
    """One line per segment: `[seg_id] [hh:mm:ss] Speaker: text` (speaker omitted when unknown)."""
    return "\n".join(format_line(line) for line in lines if line.text.strip())


def chunk_lines(lines: list[str], max_chars: int, overlap: int = 1) -> list[list[str]]:
    """Split transcript lines into chunks of at most `max_chars` characters, only at line (segment)
    boundaries, so no sentence is cut. Each chunk repeats the last `overlap` lines of the previous one
    for context. A single line longer than `max_chars` becomes its own chunk."""
    chunks: list[list[str]] = []
    current: list[str] = []
    size = 0
    fresh = 0  # lines in `current` that were not carried over from the previous chunk
    for line in lines:
        cost = len(line) + 1
        if current and fresh and size + cost > max_chars:
            chunks.append(current)
            current = current[-overlap:] if overlap else []
            size = sum(len(x) + 1 for x in current)
            fresh = 0
            while current and size + cost > max_chars:  # carried lines must not push the chunk over
                size -= len(current.pop(0)) + 1
        current.append(line)
        size += cost
        fresh += 1
    if fresh:
        chunks.append(current)
    return chunks


def summarize(
    client: LLMClient,
    lines: list[Line],
    *,
    language: str,
    title: str,
    model: str | None = None,
    chunk_chars: int | None = None,
    deadline: float | None = None,
) -> SummaryRun:
    """Minutes of the meeting in `language`. Up to `chunk_chars` of transcript: one call.
    Longer: one MAP call per chunk, then REDUCE call(s) merging the partial minutes."""
    settings = get_settings()
    model = model or settings.summary_model
    chunk_chars = chunk_chars or settings.summary_chunk_chars
    usage = Usage()
    names = {"title": title, "output_language": language, "output_language_name": language_name(language)}
    system = prompts.SYSTEM.replace("{output_language_name}", names["output_language_name"])

    def call(user: str) -> Minutes:
        if deadline is not None and time.monotonic() > deadline:
            raise SummaryTimeout("The summary took longer than the time limit.")
        return complete_json(client, system, user, model=model, parse=Minutes.model_validate, usage=usage)

    transcript_lines = [format_line(line) for line in lines if line.text.strip()]
    if not transcript_lines:
        overview = prompts.EMPTY_TRANSCRIPT.get(language, prompts.EMPTY_TRANSCRIPT["en"])
        return SummaryRun(Minutes(overview=overview), "empty", 0, usage)

    transcript = "\n".join(transcript_lines)
    if len(transcript) <= chunk_chars:
        return SummaryRun(call(prompts.USER.format(transcript=transcript, **names)), "single", 1, usage)

    chunks = chunk_lines(transcript_lines, chunk_chars, overlap=2)
    partials = [
        call(prompts.MAP_USER.format(part=i, total=len(chunks), transcript="\n".join(chunk), **names))
        for i, chunk in enumerate(chunks, 1)
    ]
    return SummaryRun(_reduce(call, partials, chunk_chars, names), "map_reduce", len(chunks), usage)


def _reduce(call, partials: list[Minutes], chunk_chars: int, names: dict) -> Minutes:
    """Merge partial minutes. If they do not fit in one prompt (very long meetings), merge in groups first."""
    if len(partials) == 1:  # one oversized line made a single chunk: nothing to merge
        return partials[0]

    def reduce(items: list[str]) -> Minutes:
        return call(prompts.REDUCE_USER.format(total=len(items), partials="[\n" + ",\n".join(items) + "\n]", **names))

    while True:
        serialized = [json.dumps(p.model_dump(), ensure_ascii=False) for p in partials]
        groups = chunk_lines(serialized, chunk_chars, overlap=0)
        if len(groups) == 1 or len(groups) >= len(partials):  # fits in one prompt, or cannot shrink further
            return reduce(serialized)
        partials = [reduce(group) for group in groups]
