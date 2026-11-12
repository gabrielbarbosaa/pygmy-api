#!/usr/bin/env bash
# Atualiza o pygmy na VPS: puxa o código e recria SOMENTE os containers deste projeto.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
docker compose -p pygmy up -d --build
docker image prune -f >/dev/null
docker compose -p pygmy ps
