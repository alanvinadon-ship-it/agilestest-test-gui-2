#!/bin/bash
# ─── AgilesTest Docker Compose Up Script ──────────────────────────────────────
# Usage: ./deploy/scripts/up.sh [--build] [--no-logs]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: $ENV_FILE not found"
  echo "ℹ️  Copy .env.example to .env and update values:"
  echo "   cp $SCRIPT_DIR/.env.example $ENV_FILE"
  exit 1
fi

echo "🚀 Starting AgilesTest services..."
echo "📁 Compose file: $COMPOSE_FILE"
echo "🔧 Environment: $ENV_FILE"

# Parse arguments
BUILD_FLAG=""
NO_LOGS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --build)
      BUILD_FLAG="--build"
      shift
      ;;
    --no-logs)
      NO_LOGS=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Start services
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d $BUILD_FLAG

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check health status
echo "🏥 Health check status:"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

if [ "$NO_LOGS" = false ]; then
  echo ""
  echo "📋 Showing logs (Ctrl+C to exit)..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
fi

echo "✅ AgilesTest is running!"
echo "🌐 Frontend: http://localhost"
echo "📊 MinIO Console: http://localhost:9001"
