#!/usr/bin/env bash
# ─── AgilesTest — Backup MinIO ──────────────────────────────────────────
# Sauvegarde complète du bucket MinIO vers un répertoire local.
# Usage : ./scripts/backup_minio.sh [backup_dir]
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${COMPOSE_DIR}/.env"

# Charger les variables d'environnement
if [ -f "${ENV_FILE}" ]; then
    set -a; source "${ENV_FILE}"; set +a
fi

BACKUP_DIR="${1:-${COMPOSE_DIR}/backups/minio}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
BUCKET="${MINIO_BUCKET:-agilestest-artifacts}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          AgilesTest — Backup MinIO                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "[INFO]  Bucket     : ${BUCKET}"
echo "[INFO]  Destination: ${BACKUP_PATH}"
echo ""

# Créer le répertoire de backup
mkdir -p "${BACKUP_PATH}"

# Configurer mc (MinIO Client) dans le conteneur
docker exec agilestest-minio sh -c "
    mc alias set backup http://localhost:9000 '${MINIO_USER}' '${MINIO_PASS}' 2>/dev/null
    echo '[INFO]  Comptage des objets...'
    mc ls --recursive backup/${BUCKET} | wc -l
"

# Copier les données via docker cp depuis le volume
echo "[INFO]  Export des données..."
docker exec agilestest-minio sh -c "
    mc mirror backup/${BUCKET} /tmp/minio-backup/ --overwrite 2>/dev/null
"
docker cp agilestest-minio:/tmp/minio-backup/ "${BACKUP_PATH}/data/"
docker exec agilestest-minio rm -rf /tmp/minio-backup/

# Créer un manifest
cat > "${BACKUP_PATH}/manifest.json" <<EOF
{
  "type": "minio_backup",
  "timestamp": "${TIMESTAMP}",
  "bucket": "${BUCKET}",
  "source": "agilestest-minio",
  "files_count": $(find "${BACKUP_PATH}/data/" -type f 2>/dev/null | wc -l),
  "total_size": "$(du -sh "${BACKUP_PATH}/data/" 2>/dev/null | cut -f1)"
}
EOF

# Compresser
echo "[INFO]  Compression..."
cd "${BACKUP_DIR}"
tar -czf "${TIMESTAMP}.tar.gz" "${TIMESTAMP}/"
rm -rf "${BACKUP_PATH}"

FINAL_SIZE=$(du -sh "${BACKUP_DIR}/${TIMESTAMP}.tar.gz" | cut -f1)
echo ""
echo "[OK]    Backup terminé : ${BACKUP_DIR}/${TIMESTAMP}.tar.gz (${FINAL_SIZE})"
echo "[INFO]  Pour restaurer : ./scripts/restore_minio.sh ${BACKUP_DIR}/${TIMESTAMP}.tar.gz"

# Nettoyage des anciens backups (garder les 5 derniers)
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | wc -l)
if [ "${BACKUP_COUNT}" -gt 5 ]; then
    echo "[INFO]  Nettoyage des anciens backups (garder 5 derniers)..."
    ls -1t "${BACKUP_DIR}"/*.tar.gz | tail -n +6 | xargs rm -f
fi
