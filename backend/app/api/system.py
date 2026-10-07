from fastapi import APIRouter

from ..config import SAMPLE_RATE, get_settings
from ..schemas import ClientConfig, HealthOut, SttStatus
from ..services.transcriber import transcriber

router = APIRouter(prefix="/api", tags=["system"])
settings = get_settings()


@router.get("/health", response_model=HealthOut)
def health():
    return HealthOut(
        ok=True,
        stt=SttStatus(
            status=transcriber.status,
            model=transcriber.model_name,
            device=transcriber.device,
            compute_type=transcriber.compute_type,
            error=transcriber.error,
        ),
    )


@router.get("/config", response_model=ClientConfig)
def client_config():
    """Settings the web app needs, so limits are defined in one place."""
    return ClientConfig(
        sample_rate=SAMPLE_RATE,
        chunk_seconds=settings.chunk_seconds,
        max_upload_mb=settings.max_upload_mb,
        allowed_extensions=settings.allowed_extensions,
        live_transcription=settings.live_transcription,
    )
