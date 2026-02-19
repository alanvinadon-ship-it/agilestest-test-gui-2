#!/bin/bash
# ─── AgilesTest Docker Compose Down Script ────────────────────────────────────
# Usage: ./deploy/scripts/down.sh [--remove-volumes]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env"

echo "🛑 Stopping AgilesTest services..."

REMOVE_VOLUMES=""
if [[ "$1" == "--remove-volumes" ]]; then
  REMOVE_VOLUMES="-v"
  echo "⚠️  WARNING: Removing volumes (data will be deleted)"
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down $REMOVE_VOLUMES

echo "✅ AgilesTest services stopped"
