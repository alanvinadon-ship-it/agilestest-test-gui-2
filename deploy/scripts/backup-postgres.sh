#!/bin/bash
# ─── PostgreSQL Backup Script ──────────────────────────────────────────────────
# Usage: ./deploy/scripts/backup-postgres.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/agilestest_db_$TIMESTAMP.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "💾 Backing up PostgreSQL database..."
echo "📁 Backup file: $BACKUP_FILE"

# Execute backup
docker compose -f "$SCRIPT_DIR/docker-compose.prod.yml" exec -T postgres \
  pg_dump -U agilestest agilestest_prod | gzip > "$BACKUP_FILE"

echo "✅ Backup completed: $BACKUP_FILE"
echo "📊 Size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Optional: Keep only last 7 backups
echo "🧹 Cleaning old backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/agilestest_db_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm

echo "✅ Done!"
