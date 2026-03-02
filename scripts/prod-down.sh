#!/usr/bin/env bash
# ============================================================================
# AgilesTest — Stop production stack
# Usage: ./scripts/prod-down.sh [--volumes]
# --volumes: Also remove data volumes (DESTRUCTIVE)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if [ "${1:-}" = "--volumes" ]; then
  echo "WARNING: This will remove all data volumes (database, MinIO storage)."
  read -p "Are you sure? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker compose -f docker-compose.prod.yml down -v
    echo "==> Stack stopped and volumes removed."
  else
    echo "==> Aborted."
  fi
else
  docker compose -f docker-compose.prod.yml down
  echo "==> Stack stopped. Data volumes preserved."
fi
