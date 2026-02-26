#!/usr/bin/env bash
# ============================================================================
# AgilesTest — Start production stack
# Usage: ./scripts/prod-up.sh
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check .env.prod exists
if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod not found. Copy .env.example.prod to .env.prod and fill in your values."
  exit 1
fi

# Load env for variable substitution
set -a
source .env.prod
set +a

echo "==> Starting AgilesTest production stack..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "==> Waiting for services to be healthy..."
sleep 5

# Check health
echo ""
echo "==> Service status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "==> Stack is up. Access the application at http://localhost:${APP_PORT:-80}"
echo "==> MinIO console at http://localhost:${MINIO_CONSOLE_PORT:-9001}"
