from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Recording chunks are raw PCM in this exact format (the browser converts to it).
SAMPLE_RATE = 16_000
SAMPLE_WIDTH = 2  # bytes, signed 16-bit little-endian
CHANNELS = 1


class Settings(BaseSettings):
    """All settings can be overridden with environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    data_dir: Path = BACKEND_DIR / "data"
    frontend_dist: Path = BACKEND_DIR.parent / "frontend" / "dist"

    # --- Speech-to-text (faster-whisper) ---
    # "auto" picks large-v3-turbo on an NVIDIA GPU and small on CPU.
    whisper_model: str = "auto"
    whisper_device: str = "auto"  # auto | cuda | cpu
    whisper_compute_type: str = "auto"  # auto | float16 | int8_float16 | int8 | float32
    whisper_cpu_threads: int = 0  # 0 = pick automatically
    preload_model: bool = True
    beam_size: int = 5

    # --- Live transcription while recording ---
    live_transcription: bool = True
    live_min_window_sec: float = 2.5
    live_max_window_sec: float = 25.0
    # After a recording stops, re-transcribe the whole file with the accurate settings.
    final_pass: bool = True

    # --- Recording / upload limits ---
    chunk_seconds: int = 3  # length of the PCM chunks the browser sends while recording
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
