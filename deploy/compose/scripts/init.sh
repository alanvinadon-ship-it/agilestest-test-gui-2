#!/usr/bin/env bash
# ─── AgilesTest — Script d'initialisation ────────────────────────────────
# Usage : ./scripts/init.sh [--demo]
# Options :
#   --demo   Créer un projet de démonstration avec données exemples
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${COMPOSE_DIR}/.env"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.prod.yml"

# ── Couleurs ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Vérifications préalables ─────────────────────────────────────────────
check_prerequisites() {
    log_info "Vérification des prérequis..."

    if ! command -v docker &>/dev/null; then
        log_error "Docker n'est pas installé. Installer Docker Engine >= 24.0"
        exit 1
    fi
    log_ok "Docker $(docker --version | awk '{print $3}')"

    if ! docker compose version &>/dev/null; then
        log_error "Docker Compose V2 n'est pas disponible."
        exit 1
    fi
    log_ok "Docker Compose $(docker compose version --short)"

    # Vérifier l'espace disque (minimum 10 Go)
    AVAILABLE_GB=$(df -BG "${COMPOSE_DIR}" | awk 'NR==2 {print $4}' | tr -d 'G')
    if [ "${AVAILABLE_GB}" -lt 10 ]; then
        log_warn "Espace disque faible : ${AVAILABLE_GB} Go disponibles (recommandé : >= 10 Go)"
    else
        log_ok "Espace disque : ${AVAILABLE_GB} Go disponibles"
    fi

    # Vérifier la RAM (minimum 4 Go)
    TOTAL_RAM_MB=$(free -m | awk '/^Mem:/ {print $2}')
    if [ "${TOTAL_RAM_MB}" -lt 4000 ]; then
        log_warn "RAM faible : ${TOTAL_RAM_MB} Mo (recommandé : >= 4 Go)"
    else
        log_ok "RAM : ${TOTAL_RAM_MB} Mo"
    fi
}

# ── Configuration .env ───────────────────────────────────────────────────
setup_env() {
    if [ ! -f "${ENV_FILE}" ]; then
        log_info "Création du fichier .env depuis env.example..."
        cp "${COMPOSE_DIR}/env.example" "${ENV_FILE}"

        # Générer un JWT_SECRET aléatoire
        JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
        sed -i "s|JWT_SECRET=CHANGE-ME-GENERATE-A-STRONG-SECRET|JWT_SECRET=${JWT_SECRET}|" "${ENV_FILE}"

        # Générer un mot de passe MinIO aléatoire
        MINIO_PWD=$(openssl rand -base64 16 2>/dev/null || head -c 16 /dev/urandom | base64)
        sed -i "s|MINIO_ROOT_PASSWORD=CHANGE-ME-STRONG-PASSWORD|MINIO_ROOT_PASSWORD=${MINIO_PWD}|" "${ENV_FILE}"

        log_ok "Fichier .env créé avec secrets générés"
        log_warn "Vérifier et adapter les valeurs dans ${ENV_FILE}"
    else
        log_ok "Fichier .env existant détecté"
    fi
}

# ── Créer le répertoire TLS ──────────────────────────────────────────────
setup_tls_dir() {
    mkdir -p "${COMPOSE_DIR}/nginx/certs"
    if [ ! -f "${COMPOSE_DIR}/nginx/certs/fullchain.pem" ]; then
        log_warn "Pas de certificat TLS trouvé dans nginx/certs/"
        log_info "Pour activer HTTPS, placer fullchain.pem et privkey.pem dans nginx/certs/"
        log_info "Mode HTTP uniquement activé."
    else
        log_ok "Certificats TLS détectés"
    fi
}

# ── Build et démarrage ───────────────────────────────────────────────────
start_services() {
    log_info "Construction des images Docker..."
    cd "${COMPOSE_DIR}"
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build

    log_info "Démarrage des services..."
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

    log_info "Attente de la disponibilité des services..."
    local MAX_WAIT=120
    local ELAPSED=0

    while [ $ELAPSED -lt $MAX_WAIT ]; do
        if docker compose -f "${COMPOSE_FILE}" ps --format json 2>/dev/null | \
           grep -q '"Health":"healthy"' || \
           curl -sf http://localhost:${PROXY_HTTP_PORT:-80}/health >/dev/null 2>&1; then
            log_ok "Services démarrés et opérationnels"
            return 0
        fi
        sleep 5
        ELAPSED=$((ELAPSED + 5))
        echo -ne "\r  Attente... ${ELAPSED}s / ${MAX_WAIT}s"
    done
    echo ""
    log_warn "Timeout atteint. Vérifier les logs : docker compose -f ${COMPOSE_FILE} logs"
}

# ── Afficher le statut ───────────────────────────────────────────────────
show_status() {
    echo ""
    log_info "═══════════════════════════════════════════════════════════"
    log_info "  AgilesTest — Installation terminée"
    log_info "═══════════════════════════════════════════════════════════"
    echo ""

    cd "${COMPOSE_DIR}"
    docker compose -f "${COMPOSE_FILE}" ps

    echo ""
    log_info "Accès :"
    log_info "  Frontend     : http://localhost:${PROXY_HTTP_PORT:-80}"
    log_info "  MinIO Console: http://localhost:${PROXY_HTTP_PORT:-80}/minio-console/"
    log_info "  API          : http://localhost:${PROXY_HTTP_PORT:-80}/api/"
    echo ""
    log_info "Compte par défaut : admin@agilestest.io / admin123"
    echo ""
    log_info "Commandes utiles :"
    log_info "  Logs     : docker compose -f ${COMPOSE_FILE} logs -f"
    log_info "  Stop     : docker compose -f ${COMPOSE_FILE} down"
    log_info "  Restart  : docker compose -f ${COMPOSE_FILE} restart"
    log_info "  Backup   : ./scripts/backup_minio.sh"
    log_info "  Smoke    : ./scripts/smoke_test.sh"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          AgilesTest — Initialisation Production             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    check_prerequisites
    setup_env
    setup_tls_dir
    start_services
    show_status
}

main "$@"
