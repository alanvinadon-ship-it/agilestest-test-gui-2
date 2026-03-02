#!/usr/bin/env bash
# ─── AgilesTest — Rotation des logs ─────────────────────────────────────
# Tronquer les logs Docker des conteneurs AgilesTest.
# Usage : ./scripts/rotate_logs.sh
# Recommandé : crontab quotidien (0 2 * * * /path/to/rotate_logs.sh)
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          AgilesTest — Rotation des logs                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

CONTAINERS=(
    "agilestest-proxy"
    "agilestest-frontend"
    "agilestest-orchestration"
    "agilestest-runner"
    "agilestest-minio"
)

MAX_SIZE_MB=50

for CONTAINER in "${CONTAINERS[@]}"; do
    LOG_FILE=$(docker inspect --format='{{.LogPath}}' "${CONTAINER}" 2>/dev/null || true)
    if [ -n "${LOG_FILE}" ] && [ -f "${LOG_FILE}" ]; then
        SIZE_MB=$(du -m "${LOG_FILE}" | cut -f1)
        if [ "${SIZE_MB}" -gt "${MAX_SIZE_MB}" ]; then
            echo "[INFO]  ${CONTAINER}: ${SIZE_MB} Mo > ${MAX_SIZE_MB} Mo — truncation"
            sudo truncate -s 0 "${LOG_FILE}"
            echo "[OK]    ${CONTAINER}: logs tronqués"
        else
            echo "[OK]    ${CONTAINER}: ${SIZE_MB} Mo (OK)"
        fi
    else
        echo "[SKIP]  ${CONTAINER}: pas de fichier log trouvé"
    fi
done

# Rotation des logs Nginx dans le conteneur
docker exec agilestest-proxy sh -c "
    if [ -f /var/log/nginx/access.log ]; then
        mv /var/log/nginx/access.log /var/log/nginx/access.log.1 2>/dev/null || true
        mv /var/log/nginx/error.log /var/log/nginx/error.log.1 2>/dev/null || true
        nginx -s reopen 2>/dev/null || true
    fi
" 2>/dev/null || true

echo ""
echo "[OK]    Rotation terminée — $(date '+%Y-%m-%d %H:%M:%S')"
