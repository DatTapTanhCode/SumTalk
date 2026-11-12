#!/usr/bin/env bash
# One-time setup of a fresh EC2 instance (Ubuntu 22.04/24.04, incl. the AWS Deep Learning GPU AMIs).
#   curl -fsSL https://raw.githubusercontent.com/<owner>/SumTalk/<branch>/deploy/scripts/ec2-bootstrap.sh | bash -s -- <git-url> [branch]
# or, after copying the repo to the server:   bash deploy/scripts/ec2-bootstrap.sh
set -euo pipefail

REPO_URL="${1:-}"
BRANCH="${2:-main}"
APP_DIR="${APP_DIR:-$HOME/sumtalk}"

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER" || true
if ! docker compose version >/dev/null 2>&1 && ! sudo docker compose version >/dev/null 2>&1; then
  sudo apt-get update -y && sudo apt-get install -y docker-compose-plugin
fi

echo "==> Swap (2 GB) so image builds do not run out of memory on small instances"
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if command -v nvidia-smi >/dev/null 2>&1; then
  echo "==> NVIDIA GPU found:"
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true
  if ! sudo docker info 2>/dev/null | grep -qi nvidia; then
    echo "    NVIDIA Container Toolkit missing: use the 'Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu)'"
    echo "    or install it: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html"
  fi
fi

echo "==> Code"
if [ -n "$REPO_URL" ] && [ ! -d "$APP_DIR/.git" ]; then
  sudo apt-get install -y git >/dev/null 2>&1 || true
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
if [ -d "$APP_DIR/deploy" ] && [ ! -f "$APP_DIR/deploy/.env" ]; then
  cp "$APP_DIR/deploy/.env.example" "$APP_DIR/deploy/.env"
  echo "    Created $APP_DIR/deploy/.env - edit it before starting."
fi

cat <<EOF

Done. Next:
  1. Log out and back in (so your user can run docker without sudo).
  2. nano $APP_DIR/deploy/.env        (SITE_ADDRESS, BASIC_AUTH_HASH, S3_BUCKET, STT_*, LLM_*)
  3. cd $APP_DIR/deploy && docker compose up -d --build
     GPU instance: docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
EOF
