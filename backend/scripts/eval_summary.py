"""Evaluate summary quality on sample meetings (QC #72) against the reference summaries (BA #95).

    python scripts/eval_summary.py                       # model from backend/.env
    python scripts/eval_summary.py --mock                # dry run, no model needed
    python scripts/eval_summary.py --samples my_dir --bertscore

Sample file (one meeting per JSON file):
    {"id": "...", "title": "...", "language": "vi",          # output language to request
     "category": "en | vi | mixed",
     "segments": [{"start": 0.0, "text": "...", "language": "en"}, ...],
     "reference": {"overview": "...", "key_points": [...], "decisions": [...]}}

Metrics per meeting: ROUGE-L F1 vs the reference (overview + key points + decisions), decision coverage
(share of reference decisions matched by a generated decision, ROUGE-L recall >= --threshold), output
language check, optional BERTScore F1, and the cost of the run (calls, tokens, latency, mode).
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from eval_common import BACKEND_DIR, load_samples, make_client, rouge_l, write_reports

from app.ai.summary import Line, Minutes, summarize
from app.ai.translation.translator import vietnamese_ratio
from app.config import get_settings


def summary_text(minutes: dict) -> str:
    return "\n".join([minutes.get("overview", ""), *minutes.get("key_points", []), *minutes.get("decisions", [])])


def decision_coverage(generated: list[str], reference: list[str], threshold: float) -> float | str:
    if not reference:
        return "n/a"
    hits = sum(any(rouge_l(g, r)[1] >= threshold for g in generated) for r in reference)
    return hits / len(reference)


def language_ok(minutes: Minutes, language: str) -> bool:
    ratio = vietnamese_ratio(summary_text(minutes.model_dump()))
    return ratio >= 0.3 if language == "vi" else ratio < 0.1 if language == "en" else True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--samples", type=Path, default=BACKEND_DIR / "scripts" / "eval_samples" / "summary")
    parser.add_argument("--out", type=Path, default=BACKEND_DIR / "scripts" / "eval_out")
    parser.add_argument("--mock", action="store_true", help="use the mock model (checks the script, not quality)")
    parser.add_argument("--language", help="override the output language of every sample (vi / en)")
    parser.add_argument("--threshold", type=float, default=0.5, help="ROUGE-L recall for a decision to count as covered")
    parser.add_argument("--bertscore", action="store_true", help="also compute BERTScore (pip install bert-score)")
    args = parser.parse_args()

    settings = get_settings()
    client = make_client(args.mock)
    rows, candidates, references = [], [], []
    for sample in load_samples(args.samples):
        language = args.language or sample.get("language", settings.default_summary_language)
        lines = [Line(i, s.get("start", 0.0), s["text"]) for i, s in enumerate(sample["segments"])]
        started = time.monotonic()
        try:
            run = summarize(client, lines, language=language, title=sample.get("title", sample["id"]))
        except Exception as exc:  # report and continue with the other samples
            rows.append({"sample": sample["id"], "category": sample.get("category", ""), "language": language, "error": str(exc)})
            continue
        generated = run.minutes.model_dump()
        reference = sample.get("reference") or {}
        _, _, f1 = rouge_l(summary_text(generated), summary_text(reference)) if reference else (0, 0, 0)
        candidates.append(summary_text(generated))
        references.append(summary_text(reference))
        rows.append(
            {
                "sample": sample["id"],
                "category": sample.get("category", ""),
                "language": language,
                "mode": run.mode,
                "chars": sum(len(s["text"]) for s in sample["segments"]),
                "rouge_l_f1": round(f1, 4),
                "decision_coverage": decision_coverage(generated["decisions"], reference.get("decisions", []), args.threshold),
                "language_ok": language_ok(run.minutes, language),
                "key_points": len(generated["key_points"]),
                "decisions": len(generated["decisions"]),
                "action_items": len(generated["action_items"]),
                "calls": run.usage.calls,
                "input_tokens": run.usage.input_tokens,
                "output_tokens": run.usage.output_tokens,
                "latency_sec": round(time.monotonic() - started, 2),
                "cost_usd": round(run.usage.cost_usd, 5),
                "error": "",
                "overview": generated["overview"],
            }
        )

    if args.bertscore and candidates:
        try:
            from bert_score import score
        except ImportError:
            raise SystemExit("BERTScore needs: pip install bert-score") from None
        _, _, f1 = score(candidates, references, lang="en" if args.language == "en" else "vi")
        ok_rows = [r for r in rows if not r.get("error")]
        for row, value in zip(ok_rows, f1.tolist()):
            row["bertscore_f1"] = round(value, 4)

    model = "mock" if args.mock else settings.summary_model
    notes = [
        f"Model: `{model}` · samples: `{args.samples}` · decision threshold: {args.threshold}",
        "Fill in `qc_notes` (missing decisions, invented content, wrong language, English terms translated...).",
    ]
    csv_path, md_path = write_reports(rows, args.out, "summary_eval", "Summary quality evaluation (#72)", notes)
    print(f"{len(rows)} sample(s) -> {csv_path}\n{' ' * len(str(len(rows)))}             {md_path}")


if __name__ == "__main__":
    main()
