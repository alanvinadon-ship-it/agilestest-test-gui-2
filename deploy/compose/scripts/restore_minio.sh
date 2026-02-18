#!/usr/bin/env bash
# ─── AgilesTest — Restore MinIO ─────────────────────────────────────────
# Restaurer un backup MinIO depuis une archive tar.gz.
# Usage : ./scripts/restore_minio.sh <backup_file.tar.gz>
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${COMPOSE_DIR}/.env"

if [ -f "${ENV_FILE}" ]; then
    set -a; source "${ENV_FILE}"; set +a
fi

BACKUP_FILE="${1:-}"
BUCKET="${MINIO_BUCKET:-agilestest-artifacts}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
    echo "[ERROR] Usage : $0 <backup_file.tar.gz>"
    exit 1
fi

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          AgilesTest — Restore MinIO                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "[INFO]  Source : ${BACKUP_FILE}"
echo "[INFO]  Bucket : ${BUCKET}"
echo ""

read -p "⚠️  Cette opération écrasera les données existantes. Continuer ? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "[INFO]  Restauration annulée."
    exit 0
fi

# Extraire l'archive
TEMP_DIR=$(mktemp -d)
echo "[INFO]  Extraction de l'archive..."
tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"

# Trouver le répertoire data
DATA_DIR=$(find "${TEMP_DIR}" -name "data" -type d | head -1)
if [ -z "${DATA_DIR}" ]; then
    echo "[ERROR] Pas de répertoire 'data' trouvé dans l'archive."
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Copier vers le conteneur MinIO
echo "[INFO]  Upload vers MinIO..."
docker cp "${DATA_DIR}/." agilestest-minio:/tmp/minio-restore/

docker exec agilestest-minio sh -c "
    mc alias set restore http://localhost:9000 '${MINIO_USER}' '${MINIO_PASS}' 2>/dev/null
    mc mb restore/${BUCKET} --ignore-existing
    mc mirror /tmp/minio-restore/ restore/${BUCKET}/ --overwrite 2>/dev/null
    rm -rf /tmp/minio-restore/
"

# Nettoyage
rm -rf "${TEMP_DIR}"

echo ""
echo "[OK]    Restauration terminée."
echo "[INFO]  Vérifier : docker exec agilestest-minio mc ls restore/${BUCKET}/"
