#!/bin/bash
# ============================================================================
# AgilesTest — Script de Déploiement Permanent (One-Click)
# Ce script installe toutes les dépendances et lance la plateforme AgilesTest
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

if ! command -v node &> /dev/null; then
    log_warn "Node.js non détecté. Installation de Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
    log_info "Node.js installé."
fi

if ! command -v nginx &> /dev/null; then
    log_warn "Nginx non détecté. Installation..."
    sudo apt-get update && sudo apt-get install -y nginx
    log_info "Nginx installé."
fi

# 2. Configuration de l'environnement
# Créer le dossier des secrets si nécessaire
mkdir -p "$PROJECT_DIR/deploy/docker/secrets"
if [ ! -f "$PROJECT_DIR/deploy/docker/secrets/ai_config_master_key.txt" ]; then
    openssl rand -hex 32 > "$PROJECT_DIR/deploy/docker/secrets/ai_config_master_key.txt"
fi

if [ ! -f "$ENV_FILE" ]; then
    log_info "Configuration du fichier .env..."
    cp "$PROJECT_DIR/.env.example" "$ENV_FILE" && chmod 600 "$ENV_FILE"
    
    # Génération de secrets uniques
    JWT_SECRET=$(openssl rand -hex 32)
    ENC_KEY=$(openssl rand -hex 32)
    
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
    sed -i "s/ENCRYPTION_MASTER_KEY=.*/ENCRYPTION_MASTER_KEY=$ENC_KEY/" "$ENV_FILE"
    
    log_info "Secrets générés avec succès dans .env.prod"
fi

# 3. Lancement des services Docker (MySQL, MinIO, Keycloak)
# Correction des chemins de volumes pour le contexte local
sed -i 's|\./deploy/keycloak/|../../deploy/keycloak/|g' "$PROJECT_DIR/docker-compose.yml"
sed -i 's|\./nginx/|../../nginx/|g' "$PROJECT_DIR/docker-compose.yml"
sed -i 's|\./deploy/docker/secrets/|../../deploy/docker/secrets/|g' "$PROJECT_DIR/docker-compose.yml"

log_info "Lancement des services Docker..."
sudo docker compose -f "$PROJECT_DIR/docker-compose.yml" --env-file "$ENV_FILE" up -d
log_info "Services Docker démarrés."

# 4. Initialisation de la base de données
log_info "Attente du démarrage de MySQL..."
sleep 15
sudo docker exec agilestest-test-gui-2-mysql-1 mysql -u root -prootpass123 -e "CREATE DATABASE IF NOT EXISTS keycloak;" || true
log_info "Base de données Keycloak prête."

# 5. Installation des services systemd pour la persistance
log_info "Configuration de la persistance (systemd)..."
sudo cp "$PROJECT_DIR/../../agilestest-docker.service" /etc/systemd/system/
sudo cp "$PROJECT_DIR/../../agilestest-backend.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agilestest-docker agilestest-backend
sudo systemctl restart agilestest-docker agilestest-backend
log_info "Services de persistance activés."

# 6. Configuration Nginx
log_info "Configuration du serveur web (Nginx)..."
sudo cp "$PROJECT_DIR/../../nginx/nginx-sandbox.conf" /etc/nginx/sites-available/agilestest
sudo ln -sf /etc/nginx/sites-available/agilestest /etc/nginx/sites-enabled/agilestest
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
log_info "Serveur web prêt."

echo -e "${GREEN}"
echo "=========================================="
echo "  ✅ DÉPLOIEMENT TERMINÉ !"
echo "=========================================="
echo -e "${NC}"
echo "La plateforme est accessible sur le port 8080."
echo "Pour configurer un domaine (HTTPS), utilisez Certbot."
