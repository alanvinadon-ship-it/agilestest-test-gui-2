#!/bin/bash
# ─── AgilesTest Docker Compose Logs Script ────────────────────────────────────
# Usage: ./deploy/scripts/logs.sh [service_name] [--tail 100]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env"

SERVICE="${1:-}"
TAIL_FLAG="${2:---tail 50}"

if [ -z "$SERVICE" ]; then
  echo "📋 Available services:"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --services
  echo ""
  echo "Usage: ./deploy/scripts/logs.sh <service_name> [--tail 100]"
  echo "Example: ./deploy/scripts/logs.sh admin-api --tail 100"
  exit 0
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs $TAIL_FLAG "$SERVICE"
