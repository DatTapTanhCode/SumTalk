#!/usr/bin/env bash
# Deploy the latest code: pull, rebuild, restart. Data (volume) and S3 objects are kept.
#   bash deploy/scripts/update.sh [branch]
set -euo pipefail
cd "$(dirname "$0")/../.."
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
cd deploy
FILES=(-f docker-compose.yml)
if grep -q '^GPU=1' .env 2>/dev/null; then FILES+=(-f docker-compose.gpu.yml); fi
docker compose "${FILES[@]}" up -d --build
docker image prune -f >/dev/null
docker compose "${FILES[@]}" ps
