#!/bin/bash
# ============================================================================
# AgilesTest — Script de démarrage complet (one-click)
# Usage: ./start.sh [--install] [--stop] [--status]
# ============================================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env.prod"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Fonctions ───────────────────────────────────────────────────────────────

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_warn "Docker non installé. Installation en cours..."
        curl -fsSL https://get.docker.com | sudo sh
        sudo usermod -aG docker "$USER"
        log_info "Docker installé avec succès"
    fi
    sudo systemctl start docker 2>/dev/null || true
}

check_nginx() {
    if ! command -v nginx &> /dev/null; then
        log_warn "Nginx non installé. Installation en cours..."
        sudo apt-get update -qq && sudo apt-get install -y -qq nginx
        log_info "Nginx installé avec succès"
    fi
}

check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js non installé. Veuillez installer Node.js 22+"
        exit 1
    fi
}

install_deps() {
    log_info "Installation des dépendances npm..."
    cd "$PROJECT_DIR"
    if command -v pnpm &> /dev/null; then
        pnpm install --frozen-lockfile
    else
        npm install -g pnpm@10.4.1
        pnpm install --frozen-lockfile
    fi
}

build_project() {
    log_info "Construction du projet..."
    cd "$PROJECT_DIR"
    pnpm build
}

setup_env() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warn ".env.prod non trouvé. Création à partir de l'exemple..."
        cp "$PROJECT_DIR/.env.example.prod" "$ENV_FILE"
        # Générer JWT_SECRET
        JWT_SECRET=$(openssl rand -hex 32)
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
        # Générer ENCRYPTION_MASTER_KEY
        ENC_KEY=$(openssl rand -hex 32)
        echo "ENCRYPTION_MASTER_KEY=$ENC_KEY" >> "$ENV_FILE"
        log_info "Fichier .env.prod créé avec des secrets générés"
    fi
}

create_keycloak_db() {
    log_info "Création de la base de données Keycloak..."
    source "$ENV_FILE"
    local MYSQL_PORT_VAL=${MYSQL_PORT:-3307}
    local MAX_RETRIES=30
    local RETRY=0
    while ! mysqladmin ping -h 127.0.0.1 -P "$MYSQL_PORT_VAL" -u root -p"$MYSQL_ROOT_PASSWORD" --silent 2>/dev/null; do
        RETRY=$((RETRY + 1))
        if [ $RETRY -ge $MAX_RETRIES ]; then
            log_error "MySQL non disponible après ${MAX_RETRIES} tentatives"
            return 1
        fi
        sleep 2
    done
    docker exec agilestest-test-gui-2-mysql-1 mysql -u root -p"$MYSQL_ROOT_PASSWORD" \
        -e "CREATE DATABASE IF NOT EXISTS keycloak; GRANT ALL PRIVILEGES ON keycloak.* TO '${MYSQL_USER}'@'%'; FLUSH PRIVILEGES;" 2>/dev/null
    log_info "Base de données Keycloak créée"
}

run_migrations() {
    log_info "Exécution des migrations Drizzle..."
    cd "$PROJECT_DIR"
    source "$ENV_FILE"
    DATABASE_URL="mysql://root:${MYSQL_ROOT_PASSWORD}@127.0.0.1:${MYSQL_PORT:-3307}/${MYSQL_DATABASE:-agilestest}" \
        npx drizzle-kit push --force 2>&1 | tail -5
    log_info "Migrations appliquées"
}

start_docker_services() {
    log_info "Démarrage des services Docker (MySQL, MinIO, Keycloak)..."
    cd "$PROJECT_DIR"
    sudo docker compose -f docker-compose.sandbox.yml --env-file "$ENV_FILE" up -d mysql minio minio-init keycloak 2>&1
    log_info "Services Docker démarrés"
}

start_backend() {
    log_info "Démarrage du backend Node.js..."
    # Arrêter l'ancien processus si existant
    pkill -f "node.*dist/index.js" 2>/dev/null || true
    sleep 1
    cd "$PROJECT_DIR"
    source "$ENV_FILE"
    export DATABASE_URL="mysql://root:${MYSQL_ROOT_PASSWORD}@127.0.0.1:${MYSQL_PORT:-3307}/${MYSQL_DATABASE:-agilestest}"
    export VITE_APP_ID="${VITE_APP_ID:-agilestest-local}"
    export NODE_ENV=production
    export PORT=3000
    nohup node dist/index.js > /tmp/agilestest-backend.log 2>&1 &
    sleep 3
    if curl -s http://localhost:3000/healthz | grep -q '"ok"'; then
        log_info "Backend démarré avec succès (PID: $!)"
    else
        log_error "Le backend n'a pas démarré correctement. Voir /tmp/agilestest-backend.log"
    fi
}

start_nginx() {
    log_info "Configuration et démarrage de Nginx..."
    sudo cp "$PROJECT_DIR/nginx/nginx-sandbox.conf" /etc/nginx/sites-available/agilestest
    sudo ln -sf /etc/nginx/sites-available/agilestest /etc/nginx/sites-enabled/agilestest
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t 2>&1 && sudo systemctl restart nginx
    log_info "Nginx démarré"
}

install_systemd() {
    log_info "Installation des services systemd..."
    sudo cp "$PROJECT_DIR/agilestest-docker.service" /etc/systemd/system/
    sudo cp "$PROJECT_DIR/agilestest-backend.service" /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable docker agilestest-docker agilestest-backend nginx 2>&1
    log_info "Services systemd installés et activés"
}

show_status() {
    echo ""
    echo "============================================="
    echo "  AgilesTest — État des services"
    echo "============================================="
    echo ""
    echo "Docker containers:"
    sudo docker ps -a --format "  {{.Names}}: {{.Status}}" 2>/dev/null || echo "  Docker non disponible"
    echo ""
    echo "Backend:"
    if curl -s http://localhost:3000/healthz 2>/dev/null | grep -q '"ok"'; then
        echo "  ✅ Backend opérationnel"
    else
        echo "  ❌ Backend non disponible"
    fi
    echo ""
    echo "Nginx:"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null | grep -q "200"; then
        echo "  ✅ Nginx opérationnel (port 8080)"
    else
        echo "  ❌ Nginx non disponible"
    fi
    echo ""
}

stop_all() {
    log_info "Arrêt de tous les services..."
    pkill -f "node.*dist/index.js" 2>/dev/null || true
    sudo systemctl stop nginx 2>/dev/null || true
    cd "$PROJECT_DIR"
    sudo docker compose -f docker-compose.sandbox.yml --env-file "$ENV_FILE" down 2>&1
    log_info "Tous les services arrêtés"
}

# ── Main ────────────────────────────────────────────────────────────────────

case "${1:-start}" in
    --install)
        log_info "=== Installation complète AgilesTest ==="
        check_docker
        check_nginx
        check_node
        setup_env
        install_deps
        build_project
        start_docker_services
        sleep 10
        create_keycloak_db
        run_migrations
        start_backend
        start_nginx
        install_systemd
        show_status
        log_info "Installation terminée !"
        ;;
    --stop)
        stop_all
        ;;
    --status)
        show_status
        ;;
    start|"")
        log_info "=== Démarrage AgilesTest ==="
        check_docker
        start_docker_services
        sleep 10
        create_keycloak_db
        start_backend
        start_nginx
        show_status
        log_info "Plateforme démarrée !"
        ;;
    *)
        echo "Usage: $0 [--install|--stop|--status|start]"
        echo ""
        echo "  start       Démarrer tous les services (par défaut)"
        echo "  --install   Installation complète (dépendances + build + démarrage)"
        echo "  --stop      Arrêter tous les services"
        echo "  --status    Afficher l'état des services"
        exit 1
        ;;
esac
