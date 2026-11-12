# SumTalk – Architecture (POC v1 + Sprint 3: summary & translation)

SumTalk records or imports a meeting and returns a transcript **in the language each person spoke**.
v1 covers epic **E1 – Capture meetings** plus transcription. Translation (e.g. English → Vietnamese)
and summaries are v2 and plug into the same pipeline (section 9).

## 1. System overview

```mermaid
flowchart LR
  subgraph Browser["Browser - React PWA (desktop & phone)"]
    REC["Recorder<br/>getUserMedia (+ getDisplayMedia)<br/>Web Audio mix → AudioWorklet<br/>16 kHz mono PCM, 3 s chunks"]
    IDB[("IndexedDB<br/>offline chunk queue")]
    SYNC["Sync engine<br/>uploads in order, retries,<br/>finalizes when done"]
    UP["Uploader<br/>8 MB parts, 3 in parallel,<br/>retry + resume"]
    UI["Pages: Meetings · Record ·<br/>Upload · Meeting"]
    REC --> IDB --> SYNC
  end

  subgraph Server["Backend - FastAPI (Python)"]
    API["REST API /api/*"]
    DB[("SQLite<br/>meetings, segments, uploads")]
    FS[("File storage<br/>chunks · original · audio.wav")]
    LW["Live worker"]
    BW["Batch worker"]
    STT["faster-whisper<br/>(Whisper on CTranslate2)<br/>GPU float16 / CPU int8"]
  end

  SYNC -- "PUT chunk / POST finalize" --> API
  UP -- "PUT part / POST complete" --> API
  UI -- "GET meeting + transcript (polling 1.5 s)" --> API
  API --> DB
  API --> FS
  API -- "queue" --> LW
  API -- "queue" --> BW
  LW --> STT
  BW --> STT
  LW --> DB
  BW --> DB
```

Everything runs locally: no cloud service, no API key. The first start downloads the Whisper model.

## 2. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Web app | React 19 + TypeScript + Vite, Tailwind CSS 4, react-router 7, `idb`, lucide icons | Most common stack, fast to build, one code base for desktop and phones (installable PWA) |
| Audio capture | `getUserMedia`, `getDisplayMedia` (tab/system audio), Web Audio API, AudioWorklet | Works in every modern browser; the worklet outputs exactly the format Whisper wants, so every chunk is independently usable (no codec, no gaps) |
| Offline | IndexedDB + Service Worker + Web Locks + Wake Lock | Audio is written to the device before it is sent; the app shell opens without a connection |
| API | Python 3.13, FastAPI, Uvicorn, SQLAlchemy 2 + SQLite | Python is where speech/AI libraries live; FastAPI gives typed endpoints + OpenAPI docs at `/docs` |
| Speech-to-text | **faster-whisper** (OpenAI Whisper re-implemented on CTranslate2), Silero VAD | Free, offline, 99 languages incl. Vietnamese, word timestamps; 4× faster than the reference implementation. `large-v3-turbo` on NVIDIA GPUs, `small` on CPU |
| Audio conversion | PyAV (FFmpeg libraries, installed with faster-whisper) | Any format → standard WAV without installing FFmpeg separately |
| Jobs | In-process worker threads | Enough for one machine; same interface as Celery/RQ |

## 3. Recording flow (US1.1, US1.2)

The browser chooses the meeting id (UUID), so a recording can start **without a connection** and every
request can be retried safely (all writes are idempotent).

```mermaid
sequenceDiagram
  participant U as User
  participant R as Recorder (browser)
  participant I as IndexedDB
  participant S as Sync engine
  participant A as API
  participant L as Live worker
  participant B as Batch worker
  U->>R: Start (mic, or mic + meeting tab audio)
  R->>I: save recording {id, title, language}
  S->>A: PUT /api/meetings/{id}  (create, idempotent)
  loop every 3 s
    R->>I: save chunk n (16 kHz PCM)
    S->>A: PUT /api/meetings/{id}/chunks/{n}
    S->>I: delete chunk n once acknowledged
    A->>L: queue live job
    L-->>A: live segments + partial sentence
  end
  Note over S,A: Offline: chunks stay in IndexedDB.<br/>Sync retries on "online", tab visible, every 15 s.
  U->>R: Stop
  R->>I: state = stopped, chunkCount = N
  S->>A: POST /api/meetings/{id}/finalize {total_chunks: N}
  A-->>S: 409 + missing list if a chunk is absent
  A->>B: queue finalize
  B->>B: join chunks → audio.wav, accurate pass over the whole file
  B-->>A: final segments replace the live ones, status = done
```

**Meeting audio for online calls.** "Microphone + meeting audio" asks the browser to share the
Meet/Teams/Zoom tab (or the entire screen) *with audio*. Both streams are mixed with the Web Audio API,
so the transcript contains the local speaker and the remote participants. Desktop Chrome/Edge only.

**Phones.** The page keeps the screen awake (Wake Lock) while recording, flushes audio to IndexedDB
continuously and asks for persistent storage. A web page cannot keep the microphone running with the
screen locked on iOS – that needs the native app wrapper planned after the POC (section 9).

## 4. Live transcription

Every chunk queues a live job for the meeting. The job transcribes the audio received since the last
committed point (a window of 2.5–25 s) with fast settings (beam size 1, word timestamps), then decides
what is final:

| Situation in the window | Action |
|---|---|
| No speech | Skip ahead, keep the last second (speech may be starting) |
| Pause after the last sentence | Commit everything |
| Last sentence still running into the window edge | Commit the earlier segments **and** every finished sentence inside the last one (split on `. ? !` using word times); the unfinished rest is shown greyed-out as `partial` and transcribed again with more audio |
| One sentence longer than 25 s | Cut at the window edge |

Result: text appears ~3 s after it is spoken, sentence by sentence, without words cut at chunk
boundaries. After **Stop**, the whole file is transcribed again with accurate settings (beam size 5)
and replaces the live draft (`FINAL_PASS=true`).

## 5. Languages – always the original language

Whisper decodes each 30 s window in one language; a window mixing English and Vietnamese gets one of
them dropped or translated. So when the language is "Auto-detect":

1. Silero VAD splits the audio at pauses into utterances.
2. The language is detected once per ~30 s group of utterances. If the detector is less than 90 % sure
   (mixed languages), each utterance ≥ 1 s is detected on its own; shorter ones inherit a neighbour's.
3. Consecutive utterances with the same language form a block, transcribed with that language.
   A text prompt is only carried over between blocks of the same language (a prompt in another
   language makes Whisper translate).

Every segment stores its language (shown as a badge when it differs from the meeting's main language).
If the user picks a language, detection is skipped. Wrong guess? *Re-transcribe* with a fixed language.

## 6. Upload flow (US1.3)

```mermaid
sequenceDiagram
  participant W as Web app
  participant A as API
  participant B as Batch worker
  W->>W: check extension, MIME type, size (limits from GET /api/config)
  W->>A: POST /api/uploads {filename, size}
  A-->>W: upload id, part size (8 MB), parts already received
  par 3 parts at a time, retried with backoff, waits for "online"
    W->>A: PUT /api/uploads/{id}/parts/{n}
  end
  W->>A: POST /api/uploads/{id}/complete
  A->>A: verify all parts + total size, join them → original.ext
  A->>B: queue "upload"
  B->>B: PyAV decode → audio.wav (16 kHz mono 16-bit), reject files without audio
  B->>B: transcribe, saving segments progressively (progress bar)
```

## 7. Data model

```mermaid
erDiagram
  MEETING ||--o{ SEGMENT : has
  MEETING ||--o| UPLOAD : "created by"
  MEETING ||--o| SUMMARY : has
  MEETING ||--o{ TRANSLATION : "one per language"
  TRANSLATION ||--o{ SEGMENT_TRANSLATION : has
  SEGMENT ||--o{ SEGMENT_TRANSLATION : "translated as"
  MEETING {
    string id PK "UUID (client-generated for recordings)"
    string title
    string source "recording | upload"
    string status
    string capture_mode "mic | mic+system"
    string language "chosen; null = auto"
    string detected_language
    float duration_sec
    float progress
    int received_chunks
    int total_chunks
    int live_offset "samples handled by live transcription"
  }
  SEGMENT {
    int id PK
    string meeting_id FK
    string kind "live | final"
    int idx
    float start
    float end
    string text
    string language
  }
  UPLOAD {
    string id PK
    string meeting_id FK
    string filename
    int size_bytes
    int part_size
    int total_parts
    string status "uploading | completed"
  }
  SUMMARY {
    int id PK
    string meeting_id FK "unique"
    string language "vi | en"
    string status "pending | running | done | failed"
    json content "Minutes (JSONB on PostgreSQL)"
    string model
    string mode "empty | single | map_reduce"
    int input_tokens
    int output_tokens
    float cost_usd
    string error
    int generation "bumped per request; stale runs are discarded"
  }
  TRANSLATION {
    int id PK
    string meeting_id FK
    string target_lang "unique with meeting_id"
    string status "pending | running | done | failed"
    int progress "0-100"
    string model
    string error
  }
  SEGMENT_TRANSLATION {
    int id PK
    int translation_id FK
    int segment_id FK "unique with translation_id"
    string text
    bool skipped "already in the target language"
  }
```

New tables are created by `init_db()` (`create_all`) on start-up, like the Sprint 1 tables: there is no
Alembic in the repo yet. Statuses are strings (not DB enums) to match the existing tables.

```mermaid
stateDiagram-v2
  [*] --> recording: PUT /meetings/{id}
  [*] --> uploading: POST /uploads
  recording --> queued: finalize
  uploading --> queued: complete
  queued --> processing: worker picks it up
  processing --> transcribing: audio.wav ready
  transcribing --> done
  processing --> failed: not audio / corrupt
  transcribing --> failed
  done --> queued: re-transcribe
  failed --> queued: retry
```

Storage layout (`backend/data/`, maps 1:1 to object-storage keys):

```
app.db                                   SQLite database
models/                                  downloaded Whisper models
meetings/<id>/chunks/000000.pcm          recording chunks (deleted after finalize)
meetings/<id>/original.<ext>             uploaded file as received
meetings/<id>/audio.wav                  standard format: 16 kHz, mono, 16-bit PCM
uploads/<upload-id>/000000.part          parts of an upload in progress
```

## 8. API

Interactive docs: `http://localhost:8000/docs`.

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Server up + speech model status (model, device) |
| `GET /api/config` | Limits the web app uses (chunk length, max upload, allowed types) |
| `GET /api/meetings` | List meetings |
| `PUT /api/meetings/{id}` | Create a recording (idempotent) |
| `GET / PATCH / DELETE /api/meetings/{id}` | Read, rename, delete (with its audio) |
| `PUT /api/meetings/{id}/chunks/{seq}` | Recording chunk: raw PCM s16le, 16 kHz, mono (`X-Sample-Rate: 16000`) |
| `POST /api/meetings/{id}/finalize` | `{total_chunks}`; 409 lists missing chunks. Without it: finish with what arrived |
| `GET /api/meetings/{id}/transcript?kind=&after=` | Incremental transcript (`kind` live/final, `partial` text while recording) |
| `GET /api/meetings/{id}/audio` | Normalized WAV, supports HTTP Range (seeking) |
| `GET /api/meetings/{id}/export?format=txt\|srt\|vtt\|json` | Download the transcript |
| `POST /api/meetings/{id}/retranscribe` | Run again, optionally with a fixed language |
| `POST /api/uploads` | Start an upload (validates type and size) |
| `GET /api/uploads/{id}` | Parts received so far (resume) |
| `PUT /api/uploads/{id}/parts/{n}` | One part (exact size checked) |
| `POST /api/uploads/{id}/complete` | Join parts, create the meeting, queue processing |
| `DELETE /api/uploads/{id}` | Cancel |
| `GET /api/meetings/{id}/summary` | `{status, language, content, error, updated_at, …}`; 404 when there is none |
| `POST /api/meetings/{id}/summary/regenerate` | `{language?}` → 202, replaces the summary when done; 409 while running or before the transcript |
| `POST /api/meetings/{id}/translations` | `{target_lang}` → 200 with the saved translation if it exists (never re-translated), else 202 and start |
| `GET /api/meetings/{id}/translations` | Languages already translated, with status/progress |
| `GET /api/meetings/{id}/translations/{lang}` | `{status, progress, error, segments: [{segment_id, start, end, speaker, original, translation, skipped}]}` |
| `POST /api/meetings/{id}/translations/{lang}/retry` | Only when `failed`; keeps the segments already translated |
| `GET /api/meetings/{id}/translations/{lang}/export?format=txt\|srt&mode=translated\|bilingual` | Download; TXT has a UTF-8 BOM; 409 until done |

## 9. Summary & translation (Sprint 3)

```mermaid
flowchart LR
  T[transcribe_meeting] -->|done| S[ai worker: run_summary_job]
  U[POST /translations] --> TR[ai worker: run_translation_job]
  S --> L[(LLMClient)]
  TR --> L
  L -->|AI_MOCK=false| O[OpenAI-compatible API: Ollama / cloud]
  L -->|AI_MOCK=true| M[MockLLMClient]
```

- **Code:** `app/ai/` has no dependency on the database or the job queue: `llm_client.py` (OpenAI-compatible
  client with timeout + retry on 429/5xx, mock client, token/cost accounting), `jsonutil.py` (JSON out of a
  model answer, one repair retry), `summary/` (schema, prompts, `summarize`), `translation/` (prompts,
  `detect_language`, `translate_batch`). `services/ai_jobs.py` runs them as background jobs.
- **Summary:** queued automatically when the final transcript is ready, in the language used last time for
  the meeting (or `DEFAULT_SUMMARY_LANGUAGE`). Transcript lines are sent as `[segment idx] [hh:mm:ss] text`.
  Up to `SUMMARY_CHUNK_CHARS`: one call. Longer: the lines are cut at segment boundaries into chunks that
  overlap by 2 segments, each chunk is summarized (map), then the partial minutes are merged (reduce; in
  groups first if they do not fit one prompt). `action_items[].segment_ids` are kept for Sprint 4 (#79).
- **Translation:** final segments in time order. Segments already in the target language (Whisper's
  per-segment label, checked with a Vietnamese-letter heuristic) are stored as `skipped` without an LLM call.
  The rest go in batches of `TRANSLATION_BATCH_SEGMENTS` as JSON `[{id, text}]` with the 2 previous lines as
  context; ids missing from the answer are requested again on their own. Each batch is saved with the
  progress, so a retry only translates what is missing. `translate_batch` works for one segment, for live
  translation in Sprint 4 (#84).
- **Reliability:** a job is retried as a whole `AI_JOB_RETRIES` times with backoff, then marked `failed` with
  the error; `AI_JOB_TIME_LIMIT_SEC` is checked between model calls and each HTTP call has `LLM_TIMEOUT_SEC`,
  so nothing stays `running`. Interrupted jobs are queued again on start-up. Summary and translation run on
  their own worker thread, so a failure never re-runs speech-to-text.
- **Re-transcribe:** translations are deleted (they point at the old segments) and the summary is rebuilt.
- **Budget (R6):** every run stores calls, input/output tokens and an estimated cost
  (`LLM_PRICE_INPUT_PER_1M`, `LLM_PRICE_OUTPUT_PER_1M`); the server log prints one line per summary.
- **Quality evaluation:** `backend/scripts/eval_summary.py` (ROUGE-L, decision coverage, language check,
  optional BERTScore) and `eval_translation.py` (chrF++, BLEU, English-term preservation), CSV + Markdown.

Differences from the Sprint 3 spec, because the repo is built differently: no Celery/Redis (in-process worker
thread, same retry/time-limit behaviour), SQLite only with `create_all` instead of Alembic, routes under
`/api/meetings/...` like the existing API instead of `/api/v1`, no speaker field (diarization is not built:
`speaker` is always `null`), no `preferred_language` on meetings so translation is never started
automatically, the meeting status is not given a `summarizing` stage (the summary has its own status), and
there was no `benchmark/` folder to copy prompts from, so they were written in `app/ai/`.

## 10. From POC to product

| Topic | POC v1 | Next step |
|---|---|---|
| Translation | Sprint 3: on request, per segment, any OpenAI-compatible LLM | Live translation while recording (#84), automatic translation to a user's preferred language |
| Summary | Sprint 3: automatic after transcription, vi / en, map-reduce | Action items view with links to the transcript (#79) |
| Mobile background recording | Screen kept awake, offline queue | Capacitor/React Native wrapper with a background audio session / foreground service, same API |
| Storage | Local disk, upload through the API | S3/MinIO with presigned multipart URLs (browser uploads straight to storage) |
| Jobs | Threads in the API process | Celery/RQ + Redis, separate GPU workers; faster-whisper batched pipeline for long files |
| Database | SQLite | PostgreSQL + Alembic migrations |
| Security | None (localhost) | Accounts, per-user access, HTTPS certificates, retention policy for audio |
| Speakers | – | Diarization (who spoke when), e.g. pyannote |
