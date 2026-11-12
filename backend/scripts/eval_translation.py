"""Evaluate translation quality on EN / VI / mixed samples (QC #66) against the reference translations (BA #96).

    pip install -r requirements-eval.txt
    python scripts/eval_translation.py                   # model from backend/.env
    python scripts/eval_translation.py --mock            # dry run, no model needed

Sample file (one set of segments per JSON file):
    {"id": "...", "category": "en | vi | mixed", "target_lang": "vi",
     "segments": [{"id": 1, "text": "...", "language": "en"}, ...],
     "references": {"1": "reference translation", ...},
     "terms": ["API", "staging", ...]}                      # terms that must stay untranslated

Metrics per sample: chrF++ and BLEU (sacrebleu, corpus level), English-term preservation (share of the
listed terms that appear in the source segment and are still in the translation), and whether segments
already in the target language were kept unchanged. The last rows give the totals per category.
"""

from __future__ import annotations

import argparse
import time
from collections import defaultdict
from pathlib import Path

from eval_common import BACKEND_DIR, load_samples, make_client, write_reports

from app.ai.llm_client import Usage
from app.ai.translation import SegmentText, needs_translation, translate_batch
from app.config import get_settings


def term_preservation(sources: dict[int, str], outputs: dict[int, str], terms: list[str]) -> tuple[int, int]:
    """(terms kept, terms expected) - a term is expected in every segment whose source contains it."""
    kept = expected = 0
    for sid, source in sources.items():
        for term in terms:
            if term.lower() in source.lower():
                expected += 1
                kept += term.lower() in outputs.get(sid, "").lower()
    return kept, expected


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--samples", type=Path, default=BACKEND_DIR / "scripts" / "eval_samples" / "translation")
    parser.add_argument("--out", type=Path, default=BACKEND_DIR / "scripts" / "eval_out")
    parser.add_argument("--mock", action="store_true", help="use the mock model (checks the script, not quality)")
    parser.add_argument("--batch", type=int, help="segments per model call (default TRANSLATION_BATCH_SEGMENTS)")
    args = parser.parse_args()

    try:
        from sacrebleu.metrics import BLEU, CHRF
    except ImportError:
        raise SystemExit("This script needs sacrebleu: pip install -r requirements-eval.txt") from None

    settings = get_settings()
    client = make_client(args.mock)
    batch_size = args.batch or settings.translation_batch_segments
    chrf, bleu = CHRF(word_order=2), BLEU(effective_order=True)
    rows = []
    by_category: dict[str, dict] = defaultdict(lambda: {"hyp": [], "ref": [], "kept": 0, "expected": 0})

    for sample in load_samples(args.samples):
        target = sample.get("target_lang", "vi")
        segments = [SegmentText(int(s["id"]), s["text"], s.get("language")) for s in sample["segments"]]
        usage, outputs = Usage(), {}
        started = time.monotonic()
        try:
            for i in range(0, len(segments), batch_size):
                batch = segments[i : i + batch_size]
                context = [s.text for s in segments[max(0, i - 2) : i]]
                outputs.update(translate_batch(client, batch, target, context=context, usage=usage))
        except Exception as exc:
            rows.append({"sample": sample["id"], "category": sample.get("category", ""), "target": target, "error": str(exc)})
            continue

        refs = {int(k): v for k, v in (sample.get("references") or {}).items()}
        ids = [s.id for s in segments if s.id in refs]
        hyp, ref = [outputs[i] for i in ids], [refs[i] for i in ids]
        kept, expected = term_preservation({s.id: s.text for s in segments}, outputs, sample.get("terms", []))
        unchanged = [s for s in segments if not needs_translation(s.text, s.language, target)]
        category = by_category[sample.get("category", "other")]
        category["hyp"] += hyp
        category["ref"] += ref
        category["kept"] += kept
        category["expected"] += expected
        rows.append(
            {
                "sample": sample["id"],
                "category": sample.get("category", ""),
                "target": target,
                "segments": len(segments),
                "sent_to_model": len(segments) - len(unchanged),
                "kept_unchanged_ok": all(outputs[s.id] == s.text for s in unchanged),
                "chrf_pp": round(chrf.corpus_score(hyp, [ref]).score, 2) if hyp else "n/a",
                "bleu": round(bleu.corpus_score(hyp, [ref]).score, 2) if hyp else "n/a",
                "term_preservation": round(kept / expected, 3) if expected else "n/a",
                "calls": usage.calls,
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "latency_sec": round(time.monotonic() - started, 2),
                "cost_usd": round(usage.cost_usd, 5),
                "error": "",
            }
        )

    for name, data in sorted(by_category.items()):
        if data["hyp"]:
            rows.append(
                {
                    "sample": f"TOTAL {name}",
                    "category": name,
                    "chrf_pp": round(chrf.corpus_score(data["hyp"], [data["ref"]]).score, 2),
                    "bleu": round(bleu.corpus_score(data["hyp"], [data["ref"]]).score, 2),
                    "term_preservation": round(data["kept"] / data["expected"], 3) if data["expected"] else "n/a",
                }
            )

    columns = {key for row in rows for key in row}
    ordered = [c for c in rows[0] if c in columns] if rows else []
    ordered += sorted(columns - set(ordered))
    rows = [{c: row.get(c, "") for c in ordered} for row in rows]
    model = "mock" if args.mock else settings.translation_model
    notes = [
        f"Model: `{model}` · samples: `{args.samples}` · batch: {batch_size} segments",
        "chrF++ / BLEU: 0-100, higher is better. term_preservation: share of listed English terms kept.",
        "Fill in `qc_notes` (meaning errors, unnatural Vietnamese, translated terms, merged/split lines...).",
    ]
    csv_path, md_path = write_reports(rows, args.out, "translation_eval", "Translation quality evaluation (#66)", notes)
    print(f"{len(rows)} row(s) -> {csv_path}\n{' ' * len(str(len(rows)))}          {md_path}")


if __name__ == "__main__":
    main()
