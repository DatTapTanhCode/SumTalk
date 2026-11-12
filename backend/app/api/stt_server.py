"""OpenAI-compatible transcription API backed by this server's local Whisper.

Desktop apps and other SumTalk installs set STT_PROVIDER=remote + STT_BASE_URL=https://<this server>/v1
and need no model of their own. Any OpenAI client works too:

    curl https://<server>/v1/audio/transcriptions -H "Authorization: Bearer <key>" \
         -F file=@meeting.mp3 -F model=whisper-large-v3-turbo -F response_format=verbose_json

Off unless STT_SERVER_API_KEYS is set. Each segment of a verbose_json answer carries its own
"language" (the server detects it per utterance), which a SumTalk client keeps.
"""

import hmac
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from ..config import get_settings
from ..services import audio
from ..services.transcriber import local_transcriber

router = APIRouter(prefix="/v1", tags=["transcription API"])
settings = get_settings()


def require_key(authorization: str | None = Header(default=None)) -> None:
    keys = settings.stt_server_keys
    if not keys:
        raise HTTPException(404, "The transcription API is off on this server (set STT_SERVER_API_KEYS).")
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not any(hmac.compare_digest(token, key) for key in keys):
        raise HTTPException(401, "Invalid API key.")


@router.get("/models", dependencies=[Depends(require_key)])
def list_models():
    name = local_transcriber.model_name or settings.whisper_model
    return {"object": "list", "data": [{"id": name, "object": "model", "owned_by": "sumtalk"}]}


@router.post("/audio/transcriptions", dependencies=[Depends(require_key)])
def create_transcription(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-1"),  # noqa: ARG001 - this server has one model
    language: str | None = Form(default=None),
    prompt: str | None = Form(default=None),
    response_format: str = Form(default="json"),
    temperature: float = Form(default=0.0),  # noqa: ARG001
    timestamp_granularities: list[str] | None = Form(default=None, alias="timestamp_granularities[]"),
):
    if response_format not in ("json", "text", "verbose_json"):
        raise HTTPException(400, "response_format must be json, text or verbose_json")
    want_words = "word" in (timestamp_granularities or [])
    language = (language or "").strip().lower() or None

    with tempfile.TemporaryDirectory(prefix="sumtalk-v1-") as tmp:
        source = Path(tmp) / f"input{Path(file.filename or 'audio').suffix or '.bin'}"
        size, limit = 0, settings.max_upload_mb * 1024 * 1024
        with source.open("wb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"File larger than {settings.max_upload_mb} MB")
                out.write(chunk)
        wav = Path(tmp) / "audio.wav"
        try:
            duration = audio.convert_to_wav(source, wav)
        except audio.AudioError as exc:
            raise HTTPException(400, str(exc)) from exc
        samples = audio.load_wav(wav)

    segments_iter, detection = local_transcriber.transcribe(
        samples,
        language=language,
        beam_size=settings.beam_size,
        initial_prompt=prompt,
        prompt_language=language,
        word_timestamps=want_words,
    )
    segments = list(segments_iter)
    text = " ".join(s.text for s in segments)
    if response_format == "text":
        return PlainTextResponse(text)
    if response_format == "json":
        return {"text": text}

    out_segments, all_words = [], []
    for i, s in enumerate(segments):
        item = {"id": i, "start": round(s.start, 3), "end": round(s.end, 3), "text": s.text, "language": s.language}
        if want_words and s.words:
            words = [{"word": w, "start": round(a, 3), "end": round(b, 3)} for a, b, w in s.words]
            item["words"] = words
            all_words.extend(words)
        out_segments.append(item)
    body = {
        "task": "transcribe",
        "language": detection.language,
        "duration": round(duration, 3),
        "text": text,
        "segments": out_segments,
    }
    if want_words:
        body["words"] = all_words
    return body
