import logging
import mimetypes
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import meetings, system, uploads
from .config import get_settings
from .db import init_db
from .services import pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")
for noisy in ("httpx", "huggingface_hub", "faster_whisper"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

# Windows takes MIME types from the registry, where .js is sometimes text/plain (breaks module scripts).
for mime, ext in [
    ("text/javascript", ".js"),
    ("text/javascript", ".mjs"),
    ("text/css", ".css"),
    ("image/svg+xml", ".svg"),
    ("application/manifest+json", ".webmanifest"),
]:
    mimetypes.add_type(mime, ext)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    pipeline.start_workers()
    yield
    pipeline.stop_workers()


app = FastAPI(title="SumTalk API", version="0.1.0", lifespan=lifespan)
app.include_router(system.router)
app.include_router(meetings.router)
app.include_router(uploads.router)


class SinglePageApp(StaticFiles):
    """Serves the built web app; unknown paths return index.html so client-side routes work on reload."""

    async def get_response(self, path, scope):
        if path.replace("\\", "/").split("/")[0] == "api":  # Starlette hands us OS separators on Windows
            raise StarletteHTTPException(404)
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            return await super().get_response("index.html", scope)


if (settings.frontend_dist / "index.html").exists():
    app.mount("/", SinglePageApp(directory=settings.frontend_dist, html=True), name="web")
