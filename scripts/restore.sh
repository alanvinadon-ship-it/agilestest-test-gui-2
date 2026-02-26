#!/usr/bin/env bash
# ============================================================================
# AgilesTest — Restore database from backup
# Usage: ./scripts/restore.sh <backup_file.sql.gz>
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh backups/*.sql.gz 2>/dev/null || echo "  (none)"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Load env
if [ -f .env.prod ]; then
  set -a
  source .env.prod
  set +a
fi

DB_HOST="${MYSQL_HOST:-localhost}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_USER="${MYSQL_USER:-agilestest}"
DB_PASSWORD="${MYSQL_PASSWORD}"
DB_NAME="${MYSQL_DATABASE:-agilestest}"

echo "WARNING: This will overwrite the database '${DB_NAME}' with the backup."
read -p "Are you sure? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "==> Aborted."
  exit 0
fi

echo "==> Restoring database from ${BACKUP_FILE}..."

if docker compose -f docker-compose.prod.yml ps mysql 2>/dev/null | grep -q "running"; then
  gunzip -c "${BACKUP_FILE}" | docker compose -f docker-compose.prod.yml exec -T mysql \
    mysql -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}"
else
  gunzip -c "${BACKUP_FILE}" | mysql -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}"
fi

echo "==> Restore complete."
