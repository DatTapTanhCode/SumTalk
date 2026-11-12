# SumTalk web server image (API + built web app). Used by deploy/docker-compose.yml.
#   docker build -t sumtalk .                  CPU (or STT_PROVIDER=remote)
#   docker build -t sumtalk --build-arg GPU=1 .  + NVIDIA CUDA libraries for local Whisper on a GPU instance
# Data (database, audio being processed, Whisper models) lives in the /data volume.

FROM node:22-slim AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim AS app
ARG GPU=0
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DATA_DIR=/data \
    FRONTEND_DIST=/app/frontend/dist \
    HF_HUB_DISABLE_TELEMETRY=1
WORKDIR /app/backend

COPY backend/requirements.txt backend/requirements-server.txt backend/requirements-gpu.txt ./
RUN pip install -r requirements-server.txt \
    && if [ "$GPU" = "1" ]; then pip install -r requirements-gpu.txt; fi

COPY backend/app ./app
COPY backend/run.py ./
COPY --from=web /src/frontend/dist /app/frontend/dist

RUN useradd --create-home --uid 1000 sumtalk && mkdir -p /data && chown sumtalk:sumtalk /data
USER sumtalk
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)"
# --lan = listen on 0.0.0.0 inside the container; Caddy in front adds HTTPS + login.
CMD ["python", "run.py", "--lan", "--port", "8000"]
