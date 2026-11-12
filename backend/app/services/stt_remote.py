"""Speech-to-text through an OpenAI-compatible API (STT_PROVIDER=remote).

Nothing is downloaded on this machine: a SumTalk server with a GPU (its /v1 API), Groq, OpenAI or any
server implementing POST /audio/transcriptions does the work. The audio is first split at pauses with
Silero VAD (a 2 MB model shipped inside faster-whisper) into blocks of at most STT_BLOCK_SEC:
  - silence is never sent (no cost, no text invented on noise),
  - each request stays small (APIs cap uploads at 25 MB) and a long file goes out in parallel,
  - the language is detected per block, so a meeting mixing English and Vietnamese keeps both.
A SumTalk server also returns a language per segment (it runs the local per-utterance detection).
"""

import io
import logging
import threading
import time
import wave
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import httpx
import numpy as np

from ..config import SAMPLE_RATE, get_settings
from .stt_types import Detection, TranscribedSegment, language_code, looks_like_hallucination

log = logging.getLogger(__name__)
settings = get_settings()


class RemoteSttError(RuntimeError):
    pass


def speech_blocks(audio: np.ndarray, max_block_sec: float) -> list[tuple[int, int]]:
    """Sample ranges [(start, end)] that hold speech, each at most `max_block_sec` long."""
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    options = VadOptions(min_silence_duration_ms=500, speech_pad_ms=200, max_speech_duration_s=max_block_sec)
    limit = int(max_block_sec * SAMPLE_RATE)
    blocks: list[list[int]] = []
    for chunk in get_speech_timestamps(audio, options):
        if blocks and chunk["end"] - blocks[-1][0] <= limit:
            blocks[-1][1] = chunk["end"]
        else:
            blocks.append([chunk["start"], chunk["end"]])
    return [(start, end) for start, end in blocks]


def wav_bytes(samples: np.ndarray) -> bytes:
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes()
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return buffer.getvalue()


def _word(item: dict, offset: float) -> tuple[float, float, str]:
    text = item.get("word") or ""
    return offset + float(item["start"]), offset + float(item["end"]), text if text.startswith(" ") else f" {text}"


def parse_response(payload: dict, offset: float, fallback_language: str | None, want_words: bool) -> list[TranscribedSegment]:
    """verbose_json -> segments in seconds from the start of the whole audio."""
    top_language = language_code(payload.get("language")) or fallback_language
    segments = payload.get("segments")
    if segments is None:  # plain json answer: one segment, no timestamps inside
        text = (payload.get("text") or "").strip()
        duration = float(payload.get("duration") or 0.0)
        return [TranscribedSegment(offset, offset + duration, text, top_language)] if text else []

    loose_words = payload.get("words") or []  # OpenAI/Groq list words for the whole request, not per segment
    w = 0
    result: list[TranscribedSegment] = []
    for i, segment in enumerate(segments):
        start, end = float(segment["start"]), float(segment["end"])
        words = segment.get("words")
        if words is None and loose_words:
            last = i == len(segments) - 1
            words = []
            while w < len(loose_words) and (last or float(loose_words[w]["start"]) < end):
                words.append(loose_words[w])
                w += 1
        text = (segment.get("text") or "").strip()
        if not text or looks_like_hallucination(text, segment.get("no_speech_prob"), segment.get("avg_logprob")):
            continue
        result.append(
            TranscribedSegment(
                start=offset + start,
                end=offset + end,
                text=text,
                language=language_code(segment.get("language")) or top_language,
                words=[_word(x, offset) for x in words] if want_words and words else None,
            )
        )
    return result


class RemoteTranscriber:
    """Same interface as transcriber.Transcriber, backed by an OpenAI-compatible API."""

    def __init__(self, client: httpx.Client | None = None) -> None:
        self.status = "idle"  # idle | loading | ready | error
        self.model_name: str | None = settings.stt_model
        self.device: str | None = "remote"
        self.compute_type: str | None = urlparse(settings.stt_base_url).netloc or None  # shown as the host
        self.error: str | None = None
        self._client = client
        self._lock = threading.Lock()

    @property
    def client(self) -> httpx.Client:
        if self._client is None:
            headers = {"Authorization": f"Bearer {settings.stt_api_key}"} if settings.stt_api_key else {}
            self._client = httpx.Client(
                base_url=settings.stt_base_url.rstrip("/") + "/", headers=headers, timeout=settings.stt_timeout_sec
            )
        return self._client

    def get_model(self) -> "RemoteTranscriber":
        """Nothing to load: check once that the API answers and accepts the key."""
        if self.status == "ready":
            return self
        with self._lock:
            if self.status == "ready":
                return self
            self.status = "loading"
            try:
                if self._client is None and not settings.stt_base_url:
                    raise RemoteSttError("STT_PROVIDER=remote needs STT_BASE_URL")
                try:
                    response = self.client.get("models")
                except httpx.HTTPError as exc:
                    raise RemoteSttError(f"Cannot reach the speech API at {settings.stt_base_url}: {exc}") from exc
                if response.status_code in (401, 403):
                    raise RemoteSttError(f"The speech API refused the key (HTTP {response.status_code})")
                if response.status_code >= 500:
                    raise RemoteSttError(f"The speech API is failing (HTTP {response.status_code})")
                # 404 = no /models on this server; the first transcription will tell if it works.
            except RemoteSttError as exc:
                self.status, self.error = "error", str(exc)
                raise
            self.status, self.error = "ready", None
            log.info("Remote speech-to-text ready: %s at %s", self.model_name, settings.stt_base_url)
        return self

    def _request(self, samples: np.ndarray, *, language: str | None, prompt: str | None, words: bool) -> dict:
        data: dict[str, str | list[str]] = {
            "model": self.model_name or "whisper-1",
            "response_format": "verbose_json",
            "temperature": "0",
            "timestamp_granularities[]": ["segment", "word"] if words else ["segment"],
        }
        if language:
            data["language"] = language
        if prompt:
            data["prompt"] = prompt
        files = {"file": ("audio.wav", wav_bytes(samples), "audio/wav")}

        delay, error = 1.0, ""
        for attempt in range(settings.stt_max_retries + 1):
            try:
                response = self.client.post("audio/transcriptions", data=data, files=files)
            except httpx.HTTPError as exc:
                error = f"network error: {exc}"
            else:
                if response.status_code == 200:
                    return response.json()
                error = f"HTTP {response.status_code}: {response.text[:300]}"
                if response.status_code < 500 and response.status_code not in (408, 409, 429):
                    raise RemoteSttError(f"The speech API refused the request ({error})")
                try:
                    delay = max(delay, float(response.headers.get("retry-after", 0)))
                except ValueError:
                    pass
            if attempt < settings.stt_max_retries:
                time.sleep(min(delay, 30.0))
                delay *= 2
        raise RemoteSttError(f"The speech API failed after {settings.stt_max_retries + 1} attempts ({error})")

    def transcribe(
        self,
        audio: np.ndarray,
        *,
        language: str | None = None,
        beam_size: int = 5,  # noqa: ARG002 - decided by the API
        initial_prompt: str | None = None,
        prompt_language: str | None = None,
        word_timestamps: bool = False,
    ) -> tuple[Iterator[TranscribedSegment], Detection]:
        self.get_model()
        blocks = speech_blocks(audio, settings.stt_block_sec)
        # The language of each block is only known from the answers; the caller recomputes the
        # dominant language from the saved segments.
        detection = Detection(language, 1.0 if language else 0.0)
        # A prompt in another language makes Whisper translate: only use it when the language is fixed.
        prompt = initial_prompt if language and prompt_language in (None, language) else None

        def run(index: int) -> list[TranscribedSegment]:
            start, end = blocks[index]
            payload = self._request(
                audio[start:end], language=language, prompt=prompt if index == 0 else None, words=word_timestamps
            )
            return parse_response(payload, start / SAMPLE_RATE, language, word_timestamps)

        def iterate() -> Iterator[TranscribedSegment]:
            if len(blocks) <= 1 or settings.stt_concurrency <= 1:
                for index in range(len(blocks)):
                    yield from run(index)
                return
            workers = min(settings.stt_concurrency, len(blocks))
            with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="stt-remote") as pool:
                futures = [pool.submit(run, index) for index in range(len(blocks))]
                try:
                    for future in futures:  # in order, so the transcript is saved front to back
                        yield from future.result()
                finally:
                    for future in futures:
                        future.cancel()

        return iterate(), detection
