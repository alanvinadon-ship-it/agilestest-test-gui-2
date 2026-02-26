#!/usr/bin/env bash
# ============================================================================
# AgilesTest — Run database migrations
# Usage: ./scripts/db-migrate.sh
# Runs drizzle-kit generate + migrate against the production database
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Check .env.prod exists
if [ ! -f .env.prod ]; then
  echo "ERROR: .env.prod not found."
  exit 1
fi

# Load env
set -a
source .env.prod
set +a

# Build DATABASE_URL if not set
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="mysql://${MYSQL_USER:-agilestest}:${MYSQL_PASSWORD}@localhost:${MYSQL_PORT:-3306}/${MYSQL_DATABASE:-agilestest}"
fi

echo "==> Running database migrations..."
echo "    DATABASE_URL: mysql://${MYSQL_USER:-agilestest}:***@localhost:${MYSQL_PORT:-3306}/${MYSQL_DATABASE:-agilestest}"

npx drizzle-kit generate
npx drizzle-kit migrate

echo "==> Migrations applied successfully."
