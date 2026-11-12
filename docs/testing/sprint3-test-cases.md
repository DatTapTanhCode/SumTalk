# Sprint 3 – end-to-end test cases (#99 Summary, #100 Translation)

For QC (#99, #100). Each case maps to an acceptance criterion of story #67 or #60.
Bugs found: log a **Bug** on Azure Boards, link it to the story, retest after the fix.

## Setup

| Run | How |
|---|---|
| **Mock model** (predictable, no GPU) | `AI_MOCK=true` in `backend/.env`, then `start.bat`. Summary text starts with "Bản tóm tắt thử nghiệm (mock)" (vi) or "Mock summary" (en); a translated line is the original prefixed with `[vi]` / `[en]`. |
| **Real model** (quality) | `AI_MOCK=false`, `LLM_BASE_URL` + `SUMMARY_MODEL` / `TRANSLATION_MODEL` set, Ollama running (or cloud key). |
| **Simulate a model failure** | `AI_MOCK=false` and `LLM_BASE_URL=http://localhost:9/v1` (nothing listens there). |

Sample audio: `frontend/e2e/fixtures/speech_en.mp3` (English, 17 s), a Vietnamese recording, a mixed
EN/VI recording, and a recording of 60 minutes or more (any meeting recording; the content does not matter).

Automated coverage: `backend/tests/test_summary_translation_api.py`, `test_ai_summary.py`,
`test_ai_translation.py` (pytest, mock model) and `frontend/e2e/sprint3.spec.ts` (Playwright, server with
`AI_MOCK=true`): `npx playwright test e2e/sprint3.spec.ts`.

## #99 – Summary (story #67)

| ID | AC | Steps | Expected | Auto |
|---|---|---|---|---|
| S-01 | 1 | Upload `speech_en.mp3`. Wait for **Ready**. Open the **Summary** tab without clicking anything else. | "Summarizing…" with a spinner, then the summary appears by itself (page polls every 3 s). | e2e, pytest |
| S-02 | 2 | Look at a finished summary. | Sections **Overview, Key points, Decisions, Action items, Open questions**. Empty sections say so ("No decisions were recorded."). | e2e, pytest |
| S-03 | 3 | Regenerate ▾ → **English**, confirm. Then Regenerate ▾ → **Vietnamese**. Repeat on the mixed EN/VI meeting. | Text is in the chosen language each time, also for the mixed meeting. English technical terms (API, deploy, sprint…) stay in English in the Vietnamese summary. | e2e (lang), manual (terms) |
| S-04 | 3 | Real model: compare the summary with the transcript. | No people, numbers, dates or decisions that are not in the transcript. | manual / `eval_summary.py` |
| S-05 | 4 | Upload a recording of **≥ 60 min**. | Summary ends as **done** (no error). In `GET /api/meetings/{id}/summary`: `mode = "map_reduce"`, `calls` = number of parts + 1. | pytest (80k-char transcript) |
| S-06 | 5 | On a finished summary: Regenerate ▾ → a language. | A confirmation "The current summary will be replaced…" appears. After confirming, the old text disappears and the new one replaces it. Cancel keeps the old one. | e2e |
| S-07 | 5 | While a summary is being generated. | The Regenerate button is disabled. `POST …/summary/regenerate` returns **409**. | pytest |
| S-08 | 6 | Simulate a model failure, upload a file. | After the retries (about 30 s) the tab shows "The summary could not be generated" with the error and **Try again**. Nothing spins forever. | pytest |
| S-09 | 6 | Fix the model URL, click **Try again**. | The summary is generated. The transcript is **not** re-transcribed (meeting stays Ready). | pytest |
| S-10 | – | Re-transcribe a meeting that has a summary. | The summary is rebuilt after the new transcript. | pytest |
| S-11 | – | Phone width (≤ 400 px). | Sections stack in one column, buttons reachable, no horizontal scroll. | manual |

## #100 – Translation (story #60)

| ID | AC | Steps | Expected | Auto |
|---|---|---|---|---|
| T-01 | 1 | Open the **Translation** tab of a Ready meeting. Open "Translate to". | The list offers at least **Vietnamese** and **English**; choosing one starts the translation. | e2e |
| T-02 | 2 | Translate `speech_en.mp3` into Vietnamese; wait for the end. | A progress bar with % while running, lines filling in. When done, **every** line has a translation (`GET …/translations/vi`: no `translation: null`). | e2e, pytest |
| T-03 | 3 | Translate the English meeting into **English**, and the Vietnamese meeting into **Vietnamese**. | Lines are kept unchanged with the label "already English/Vietnamese" (`skipped: true`), and no model call is made for them. | pytest |
| T-04 | 3 | Real model: translate the mixed EN/VI meeting into Vietnamese and into English. | Natural translation; English technical terms and names kept. Vietnamese lines are kept when the target is Vietnamese. | manual / `eval_translation.py` |
| T-05 | 4 | Look at a finished translation on a desktop screen. | Two columns **Original | Translation**, one row per segment, time on the left, rows aligned. Clicking a time plays the audio from there. | e2e |
| T-06 | 4 | Same at phone width. | Each original line is directly above its translation. | manual |
| T-07 | 5 | Reload the page (F5), open the Translation tab. | The saved translation shows at once. No new job: `GET …/translations` still has one entry with the same `updated_at`; choosing the same language again returns **200** immediately. | e2e, pytest |
| T-08 | 6 | Export ▾ → **Text (.txt)**; open in Windows Notepad. | File `<title>_vi.txt`; Vietnamese accents display correctly; lines `[hh:mm:ss] translation`. | e2e (file), manual (Notepad) |
| T-09 | 6 | Export ▾ → **Subtitles (.srt)**; open in VLC with the audio, or in a subtitle editor. | File `<title>_vi.srt`; numbered cues `HH:MM:SS,mmm --> HH:MM:SS,mmm`; subtitles in sync. | e2e, pytest |
| T-10 | 6 | Export the bilingual variants. | Original line above each translation, in TXT and SRT. | pytest |
| T-11 | – | Simulate a model failure, pick a language. | "The translation stopped" with the error and **Try again**; Export disabled. After fixing the model, Try again translates only the missing lines. | pytest |
| T-12 | – | Before the transcript is Ready. | The tab says translation is available once the transcript is ready; the API returns 409. | pytest |

## Results

| Date | Build / commit | Tester | Model | Passed | Failed (bug IDs) |
|---|---|---|---|---|---|
| | | | | | |
