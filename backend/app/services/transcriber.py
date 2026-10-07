"""Speech-to-text with faster-whisper (OpenAI Whisper on CTranslate2), running locally - no API key, 99 languages."""

import ctypes
import logging
import os
import sys
import threading
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from ..config import SAMPLE_RATE, get_settings

log = logging.getLogger(__name__)
settings = get_settings()

GROUP_SAMPLES = 30 * SAMPLE_RATE  # language is detected once per ~30 s of speech...
MONOLINGUAL_CONFIDENCE = 0.9  # ...unless the detector is less sure than this (mixed languages)
MIN_DETECT_SAMPLES = SAMPLE_RATE  # utterances shorter than 1 s inherit a neighbour's language

# Windows without developer mode cannot create symlinks; the HF cache copes, but warns loudly.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# Phrases Whisper is known to invent on silence/music (YouTube outro captions in its training data).
_HALLUCINATIONS = (
    "subscribe",
    "amara.org",
    "subtitles by",
    "ghiền mì gõ",
    "đăng ký kênh",
    "like và đăng ký",
    "hẹn gặp lại các bạn trong những video tiếp theo",
)


@dataclass
class TranscribedSegment:
    start: float
    end: float
    text: str
    language: str | None
    words: list[tuple[float, float, str]] | None = None  # (start, end, word) when word timestamps were requested


def _register_nvidia_libraries() -> None:
    """The optional nvidia-cublas/cudnn wheels install their DLLs under site-packages/nvidia/*/(bin|lib)."""
    try:
        import nvidia  # namespace package from the nvidia-* wheels
    except ImportError:
        return
    for base in map(Path, nvidia.__path__):
        if sys.platform == "win32":
            for bin_dir in base.glob("*/bin"):
                os.add_dll_directory(str(bin_dir))
                os.environ["PATH"] = f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}"
        else:
            for lib in sorted(base.glob("*/lib/lib*.so*")):
                try:
                    ctypes.CDLL(str(lib), mode=ctypes.RTLD_GLOBAL)
                except OSError:
                    pass


def _cuda_available() -> bool:
    import ctranslate2

    if ctranslate2.get_cuda_device_count() == 0:
        return False
    # CTranslate2 kills the whole process when cuBLAS/cuDNN are missing, so check they load first.
    if sys.platform == "win32":
        libs = ("cublas64_12.dll", "cudnn_ops64_9.dll", "cudnn_cnn64_9.dll")
    else:
        libs = ("libcublas.so.12", "libcudnn_ops.so.9", "libcudnn_cnn.so.9")
    for name in libs:
        try:
            ctypes.CDLL(name)
        except OSError:
            log.info("CUDA GPU found but %s is missing - using CPU (pip install -r requirements-gpu.txt)", name)
            return False
    return True


def _looks_like_hallucination(segment) -> bool:
    if segment.no_speech_prob > 0.6 and segment.avg_logprob < -0.8:
        return True
    text = segment.text.lower()
    return any(phrase in text for phrase in _HALLUCINATIONS)


@dataclass
class Detection:
    language: str | None
    probability: float


def _language_plan(model, audio: np.ndarray) -> tuple[list[tuple[int, int, str]], Detection]:
    """Split the audio at pauses (Silero VAD) into utterances and find each one's language.

    Whisper decodes a 30 s window in a single language: a window mixing English and Vietnamese
    gets one of them dropped or translated. So: detect once per ~30 s group of utterances; when
    the group does not look clearly monolingual, detect every utterance on its own. Consecutive
    utterances in the same language become one block, transcribed with that language.
    Returns ([(start_sample, end_sample, language)], dominant language).
    """
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    speech = get_speech_timestamps(audio, VadOptions(min_silence_duration_ms=500, speech_pad_ms=200))
    if not speech:
        return [], Detection(None, 0.0)

    def detect(clip: np.ndarray) -> tuple[str, float]:
        language, probability, _ = model.detect_language(clip)
        return language, probability

    langs: list[str | None] = [None] * len(speech)
    probs = [0.0] * len(speech)
    groups: list[list[int]] = [[]]
    for i, chunk in enumerate(speech):
        if groups[-1] and chunk["end"] - speech[groups[-1][0]]["start"] > GROUP_SAMPLES:
            groups.append([])
        groups[-1].append(i)

    for group in groups:
        clip = np.concatenate([audio[speech[i]["start"] : speech[i]["end"]] for i in group])
        language, probability = detect(clip)
        if probability >= MONOLINGUAL_CONFIDENCE or len(group) == 1:
            for i in group:
                langs[i], probs[i] = language, probability
            continue
        for i in group:  # looks mixed: decide per utterance (short ones inherit from neighbours)
            start, end = speech[i]["start"], speech[i]["end"]
            if end - start >= MIN_DETECT_SAMPLES:
                lang_i, prob_i = detect(audio[start:end])
                if prob_i >= 0.5:
                    langs[i], probs[i] = lang_i, prob_i
        if all(langs[i] is None for i in group):
            for i in group:
                langs[i], probs[i] = language, probability

    for i in range(1, len(langs)):  # fill gaps from the previous utterance, then from the next one
        langs[i] = langs[i] or langs[i - 1]
    for i in range(len(langs) - 2, -1, -1):
        langs[i] = langs[i] or langs[i + 1]

    plan: list[list] = []
    for chunk, language in zip(speech, langs):
        if plan and plan[-1][2] == language:
            plan[-1][1] = chunk["end"]
        else:
            plan.append([chunk["start"], chunk["end"], language])

    seconds: dict[str, float] = {}
    for chunk, language in zip(speech, langs):
        seconds[language] = seconds.get(language, 0.0) + (chunk["end"] - chunk["start"])
    dominant = max(seconds, key=seconds.get)
    confidence = max((p for p, l in zip(probs, langs) if l == dominant), default=0.0)
    return [tuple(block) for block in plan], Detection(dominant, confidence)


class Transcriber:
    def __init__(self) -> None:
        self._model = None
        self._lock = threading.Lock()
        self.status = "idle"  # idle | loading | ready | error
        self.model_name: str | None = None
        self.device: str | None = None
        self.compute_type: str | None = None
        self.error: str | None = None

    def get_model(self):
        if self._model is None:
            with self._lock:
                if self._model is None:
                    self._model = self._load()
        return self._model

    def _load(self):
        self.status, self.error = "loading", None
        try:
            _register_nvidia_libraries()
            device = settings.whisper_device
            if device in ("auto", "cuda"):
                device = "cuda" if _cuda_available() else "cpu"
            try:
                return self._load_on(device)
            except Exception:
                if device != "cuda":
                    raise
                log.exception("Loading Whisper on the GPU failed, falling back to CPU")
                return self._load_on("cpu")
        except Exception as exc:
            self.status, self.error = "error", str(exc)
            raise

    def _load_on(self, device: str):
        on_gpu = device == "cuda"
        name = settings.whisper_model if settings.whisper_model != "auto" else ("large-v3-turbo" if on_gpu else "small")
        compute = settings.whisper_compute_type
        if compute == "auto":
            compute = "float16" if on_gpu else "int8"
        threads = settings.whisper_cpu_threads or max(4, min(8, (os.cpu_count() or 4) // 2))

        log.info("Loading Whisper '%s' on %s (%s). First run downloads the model...", name, device, compute)
        from faster_whisper import WhisperModel

        model = WhisperModel(
            name,
            device=device,
            compute_type=compute,
            cpu_threads=threads,
            num_workers=2,  # live + batch transcription can run in parallel
            download_root=str(settings.models_dir),
        )
        # Warm-up: surfaces missing GPU libraries now instead of in the middle of a meeting.
        segments, _ = model.transcribe(np.zeros(16_000, dtype=np.float32), language="en", beam_size=1)
        list(segments)

        self.model_name, self.device, self.compute_type = name, device, compute
        self.status = "ready"
        log.info("Whisper model ready: %s on %s (%s)", name, device, compute)
        return model

    def transcribe(
        self,
        audio: np.ndarray,  # 16 kHz mono float32 (we decode ourselves; see services/audio.py)
        *,
        language: str | None = None,
        beam_size: int = 5,
        initial_prompt: str | None = None,
        prompt_language: str | None = None,
        word_timestamps: bool = False,
    ) -> tuple[Iterator[TranscribedSegment], Detection]:
        """Transcribe in the language(s) actually spoken - never translated.

        With `language=None` every utterance gets its own language (see _language_plan), so a meeting
        that switches between e.g. English and Vietnamese keeps each part in its original language.
        Returns a lazy segment iterator (decoding happens while iterating) and the dominant language.
        """
        model = self.get_model()
        if language:
            plan, detection = [(0, len(audio), language)], Detection(language, 1.0)
        else:
            plan, detection = _language_plan(model, audio)

        def iterate() -> Iterator[TranscribedSegment]:
            prompt, prompt_lang = initial_prompt, prompt_language or language
            for start, end, lang in plan:
                offset = start / SAMPLE_RATE
                segments, _ = model.transcribe(
                    audio[start:end],
                    language=lang,
                    beam_size=beam_size,
                    # A prompt in another language makes Whisper translate instead of transcribe.
                    initial_prompt=prompt if prompt_lang == lang else None,
                    condition_on_previous_text=False,
                    word_timestamps=word_timestamps,
                    vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 500},
                )
                texts = []
                for s in segments:
                    text = s.text.strip()
                    if not text or _looks_like_hallucination(s):
                        continue
                    texts.append(text)
                    yield TranscribedSegment(
                        start=offset + s.start,
                        end=offset + s.end,
                        text=text,
                        language=lang,
                        words=[(offset + w.start, offset + w.end, w.word) for w in s.words] if s.words else None,
                    )
                if texts:
                    prompt, prompt_lang = " ".join(texts)[-200:], lang

        return iterate(), detection


transcriber = Transcriber()
