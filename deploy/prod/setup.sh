#!/bin/bash
# ============================================================================
# AgilesTest — Script de Déploiement Permanent (One-Click)
# Ce script installe toutes les dépendances et lance la plateforme AgilesTest
# ============================================================================
set -e

# Dossier racine du projet (deux niveaux au-dessus de deploy/prod)
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PROD_DIR="$ROOT_DIR/deploy/prod"
ENV_FILE="$PROD_DIR/.env.prod"
SECRETS_DIR="$ROOT_DIR/deploy/docker/secrets"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo -e "${GREEN}"
echo "  🚀 Déploiement Permanent AgilesTest"
echo "=========================================="
echo -e "${NC}"

# 1. Vérification des prérequis
log_info "Vérification des prérequis..."
if ! command -v docker &> /dev/null; then
    log_warn "Docker non détecté. Installation en cours..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    log_info "Docker installé."
fi

# 2. Configuration de l'environnement
log_info "Configuration des dossiers de secrets..."
mkdir -p "$SECRETS_DIR"
if [ ! -f "$SECRETS_DIR/ai_config_master_key.txt" ]; then
    log_info "Génération de la clé maître AI..."
    openssl rand -hex 32 > "$SECRETS_DIR/ai_config_master_key.txt"
fi

if [ ! -f "$ENV_FILE" ]; then
    log_info "Configuration du fichier .env..."
    if [ -f "$ROOT_DIR/.env.example" ]; then
        cp "$ROOT_DIR/.env.example" "$ENV_FILE"
    else
        touch "$ENV_FILE"
    fi
    chmod 600 "$ENV_FILE"
    
    # Génération de secrets uniques
    JWT_SECRET=$(openssl rand -hex 32)
    ENC_KEY=$(openssl rand -hex 32)
    
    # S'assurer que les clés existent dans le fichier
    for key in JWT_SECRET ENCRYPTION_MASTER_KEY; do
        if ! grep -q "^$key=" "$ENV_FILE"; then
            echo "$key=" >> "$ENV_FILE"
        fi
    done

    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_FILE"
    sed -i "s|^ENCRYPTION_MASTER_KEY=.*|ENCRYPTION_MASTER_KEY=$ENC_KEY|" "$ENV_FILE"
    
    log_info "Secrets générés avec succès dans .env.prod"
fi

# 3. Lancement des services Docker
log_info "Lancement des services Docker..."
# On se place dans le dossier prod pour que docker-compose trouve les fichiers relatifs si besoin
cd "$PROD_DIR"
sudo docker compose down || true
sudo docker compose --env-file "$ENV_FILE" up -d

log_info "Services Docker démarrés."

# 4. Initialisation de la base de données
log_info "Attente du démarrage de MySQL (30s)..."
sleep 30
# On essaie de créer la base keycloak si elle n'existe pas
sudo docker exec prod-mysql-1 mysql -u root -prootpass123 -e "CREATE DATABASE IF NOT EXISTS keycloak;" || log_warn "Impossible de créer la DB keycloak automatiquement, vérifiez les logs de MySQL."

echo -e "${GREEN}"
echo "=========================================="
echo "  ✅ SERVICES DOCKER LANCÉS !"
echo "=========================================="
echo -e "${NC}"
echo "La plateforme est en cours de démarrage."
echo "Vérifiez l'accès sur http://192.168.200.83:8080"
