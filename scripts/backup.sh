#!/usr/bin/env bash
# ============================================================================
# AgilesTest — Backup database (mysqldump)
# Usage: ./scripts/backup.sh [output_dir]
# Default output: ./backups/agilestest_YYYYMMDD_HHMMSS.sql.gz
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Load env
if [ -f .env.prod ]; then
  set -a
  source .env.prod
  set +a
fi

OUTPUT_DIR="${1:-./backups}"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/agilestest_${TIMESTAMP}.sql.gz"

DB_HOST="${MYSQL_HOST:-localhost}"
DB_PORT="${MYSQL_PORT:-3306}"
DB_USER="${MYSQL_USER:-agilestest}"
DB_PASSWORD="${MYSQL_PASSWORD}"
DB_NAME="${MYSQL_DATABASE:-agilestest}"

echo "==> Backing up database '${DB_NAME}' to ${BACKUP_FILE}..."

# Use docker exec if running in compose, or direct mysqldump if available
if docker compose -f docker-compose.prod.yml ps mysql 2>/dev/null | grep -q "running"; then
  docker compose -f docker-compose.prod.yml exec -T mysql \
    mysqldump -u"${DB_USER}" -p"${DB_PASSWORD}" \
    --single-transaction --routines --triggers \
    "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
  mysqldump -h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USER}" -p"${DB_PASSWORD}" \
    --single-transaction --routines --triggers \
    "${DB_NAME}" | gzip > "${BACKUP_FILE}"
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "==> Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"
echo "==> To restore: ./scripts/restore.sh ${BACKUP_FILE}"
