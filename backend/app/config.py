import os
import sys
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

# True inside the packaged desktop app (backend frozen with PyInstaller): the code then lives in a
# read-only install folder, so data goes to the user's profile instead of next to the code.
FROZEN = bool(getattr(sys, "frozen", False))


def _default_data_dir() -> Path:
    if FROZEN:
        return Path(os.environ.get("LOCALAPPDATA") or Path.home() / ".local" / "share") / "SumTalk" / "data"
    return BACKEND_DIR / "data"


# backend/.env, then the file the desktop app points to (SUMTALK_ENV_FILE) - later files win.
_ENV_FILES = tuple(p for p in (BACKEND_DIR / ".env", os.environ.get("SUMTALK_ENV_FILE")) if p)

# Recording chunks are raw PCM in this exact format (the browser converts to it).
SAMPLE_RATE = 16_000
SAMPLE_WIDTH = 2  # bytes, signed 16-bit little-endian
CHANNELS = 1


class Settings(BaseSettings):
    """All settings can be overridden with environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=_ENV_FILES, env_file_encoding="utf-8", extra="ignore")

    data_dir: Path = _default_data_dir()
    frontend_dist: Path = BACKEND_DIR.parent / "frontend" / "dist"

    # --- Speech-to-text (faster-whisper) ---
    # "auto" picks large-v3-turbo on an NVIDIA GPU and small on CPU.
    whisper_model: str = "auto"
    whisper_device: str = "auto"  # auto | cuda | cpu
    whisper_compute_type: str = "auto"  # auto | float16 | int8_float16 | int8 | float32
    whisper_cpu_threads: int = 0  # 0 = pick automatically
    preload_model: bool = True
    beam_size: int = 5

    # --- Speech-to-text engine ---
    # local  = faster-whisper on this machine (downloads the model; fast with an NVIDIA GPU).
    # remote = an OpenAI-compatible transcription API, nothing downloaded here: a SumTalk server with a GPU
    #          (https://<server>/v1, see STT_SERVER_API_KEYS), Groq (https://api.groq.com/openai/v1),
    #          OpenAI (https://api.openai.com/v1), speaches...
    stt_provider: str = "local"
    stt_base_url: str = ""
    stt_api_key: str = ""
    stt_model: str = "whisper-large-v3-turbo"  # OpenAI: whisper-1 ; Groq: whisper-large-v3-turbo
    stt_timeout_sec: float = 120.0
    stt_max_retries: int = 3  # on 429 / 5xx / network errors, with backoff
    stt_concurrency: int = 4  # parallel requests when transcribing a long file
    stt_block_sec: float = 30.0  # audio per request, cut at pauses (Whisper works on 30 s windows)
    # This server's own OpenAI-compatible API (/v1/audio/transcriptions) for desktop apps and other
    # installs, backed by its local Whisper. Off while empty. Comma-separated keys.
    stt_server_api_keys: str = ""

    # --- Live transcription while recording ---
    live_transcription: bool = True
    live_min_window_sec: float = 1.0
    # Words both of the last two passes agree on are committed once the window is this long, so the
    # window (and the work per pass) stays short even when nobody pauses.
    live_soft_window_sec: float = 8.0
    live_max_window_sec: float = 15.0
    live_interval_sec: float = 0.0  # minimum time between two live passes (2 is gentler on paid APIs)
    # After a recording stops, re-transcribe the whole file with the accurate settings.
    final_pass: bool = True
    # Long files are transcribed in sections of about this length, cut at a quiet moment: the first
    # lines appear after seconds and memory stays flat whatever the length.
    long_section_sec: float = 300.0

    # --- Recording / upload limits ---
    chunk_seconds: float = 1.0  # length of the PCM chunks the browser sends while recording
    max_chunk_bytes: int = 4 * 1024 * 1024
    max_upload_mb: int = 1024
    upload_part_mb: int = 8
    allowed_extensions: list[str] = [
        ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".webm",
        ".flac", ".wma", ".amr", ".3gp", ".mp4", ".mov", ".mkv",
    ]

    # --- LLM for summary + translation (Sprint 3) ---
    # Any OpenAI-compatible endpoint: local Ollama (http://localhost:11434/v1) or a cloud provider.
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = ""
    summary_model: str = "gemma4:26b-a4b"
    translation_model: str = "gemma4:26b-a4b"
    llm_timeout_sec: float = 120.0  # one HTTP call
    llm_max_retries: int = 2  # HTTP retries on 429 / 5xx / network errors (with backoff)
    llm_temperature: float = 0.2
    # Estimated price in USD per 1M tokens, only used to log the cost of each call (budget tracking, R6).
    llm_price_input_per_1m: float = 0.0
    llm_price_output_per_1m: float = 0.0
    summary_chunk_chars: int = 12_000  # longer transcripts are summarized with map-reduce
    translation_batch_segments: int = 20
    default_summary_language: str = "vi"
    summary_languages: list[str] = ["vi", "en"]
    translation_languages: list[str] = ["vi", "en"]
    # Background AI jobs: a whole job is retried this many times, and given up after the time limit.
    ai_job_retries: int = 2
    ai_job_time_limit_sec: float = 1800.0
    ai_retry_backoff_sec: float = 5.0
    ai_mock: bool = False  # true: deterministic fake LLM (tests, CI, machines without a model)

    @property
    def stt_server_keys(self) -> list[str]:
        return [key.strip() for key in self.stt_server_api_keys.split(",") if key.strip()]

    @property
    def models_dir(self) -> Path:
        return self.data_dir / "models"

    @property
    def meetings_dir(self) -> Path:
        return self.data_dir / "meetings"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"


@lru_cache
def get_settings() -> Settings:
    return Settings()
