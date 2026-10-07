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
