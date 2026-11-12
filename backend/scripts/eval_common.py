"""Shared helpers for the quality evaluation scripts (QC tasks #66 and #72)."""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.ai.llm_client import LLMClient, MockLLMClient, get_llm_client  # noqa: E402

_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


def tokens(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _lcs(a: list[str], b: list[str]) -> int:
    if not a or not b:
        return 0
    previous = [0] * (len(b) + 1)
    for x in a:
        current = [0]
        for j, y in enumerate(b, 1):
            current.append(previous[j - 1] + 1 if x == y else max(previous[j], current[j - 1]))
        previous = current
    return previous[-1]


def rouge_l(candidate: str, reference: str) -> tuple[float, float, float]:
    """ROUGE-L (precision, recall, F1) on lower-cased word tokens. Works for Vietnamese (syllable tokens)."""
    c, r = tokens(candidate), tokens(reference)
    lcs = _lcs(c, r)
    if not lcs:
        return 0.0, 0.0, 0.0
    precision, recall = lcs / len(c), lcs / len(r)
    return precision, recall, 2 * precision * recall / (precision + recall)


def load_samples(folder: Path) -> list[dict]:
    files = sorted(folder.glob("*.json"))
    if not files:
        raise SystemExit(f"No *.json samples in {folder}")
    samples = []
    for path in files:
        sample = json.loads(path.read_text(encoding="utf-8"))
        sample.setdefault("id", path.stem)
        samples.append(sample)
    return samples


def make_client(mock: bool) -> LLMClient:
    return MockLLMClient() if mock else get_llm_client()


def write_reports(rows: list[dict], out_dir: Path, name: str, title: str, notes: list[str]) -> tuple[Path, Path]:
    """CSV (for spreadsheets) + Markdown (for the sprint report), each with an empty 'QC notes' column."""
    out_dir.mkdir(parents=True, exist_ok=True)
    columns = list(rows[0]) + ["qc_notes"] if rows else ["qc_notes"]
    csv_path = out_dir / f"{name}.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({**row, "qc_notes": ""})

    def cell(value) -> str:
        if isinstance(value, float):
            return f"{value:.3f}"
        return str(value).replace("|", "\\|").replace("\n", " ")

    md = [f"# {title}", "", *notes, "", "| " + " | ".join(columns) + " |", "|" + "---|" * len(columns)]
    md += ["| " + " | ".join(cell(row.get(c, "")) for c in columns) + " |" for row in rows]
    md_path = out_dir / f"{name}.md"
    md_path.write_text("\n".join(md) + "\n", encoding="utf-8")
    return csv_path, md_path
