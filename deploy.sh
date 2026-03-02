#!/bin/bash
# ============================================================================
# AgilesTest — Script de Déploiement One-Click
# Ce script configure et lance la plateforme AgilesTest en production
# ============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       AgilesTest — Déploiement en Production            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Vérifier les prérequis ──────────────────────────────────────────────
echo "▶ Vérification des prérequis..."
if ! command -v docker &> /dev/null; then
    echo "  ⚠ Docker non trouvé. Installation en cours..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo "  ✔ Docker installé. Vous devrez peut-être vous reconnecter pour le groupe docker."
fi

if ! docker compose version &> /dev/null; then
    echo "  ✘ Docker Compose non trouvé. Veuillez l'installer."
    exit 1
fi
echo "  ✔ Docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
echo "  ✔ Docker Compose $(docker compose version --short)"
echo ""

# ── 2. Vérifier/Créer le fichier .env.prod ─────────────────────────────────
if [ ! -f .env.prod ]; then
    echo "▶ Création du fichier .env.prod..."
    if [ -f .env.example.prod ]; then
        cp .env.example.prod .env.prod
        # Générer des mots de passe sécurisés
        JWT_SECRET=$(openssl rand -hex 32)
        MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
        MYSQL_PASSWORD=$(openssl rand -hex 16)
        MINIO_ROOT_PASSWORD=$(openssl rand -hex 16)

        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env.prod
        sed -i "s|MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD|" .env.prod
        sed -i "s|MYSQL_PASSWORD=.*|MYSQL_PASSWORD=$MYSQL_PASSWORD|" .env.prod
        sed -i "s|MINIO_ROOT_PASSWORD=.*|MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD|" .env.prod

        echo "  ✔ Fichier .env.prod créé avec des mots de passe générés"
        echo "  ⚠ Pensez à personnaliser les valeurs dans .env.prod"
    else
        echo "  ✘ Fichier .env.example.prod non trouvé."
        exit 1
    fi
else
    echo "  ✔ Fichier .env.prod existant trouvé"
fi
echo ""

# ── 3. Créer le secret AI Config ───────────────────────────────────────────
echo "▶ Vérification des secrets Docker..."
mkdir -p deploy/docker/secrets
if [ ! -f deploy/docker/secrets/ai_config_master_key.txt ]; then
    openssl rand -base64 32 > deploy/docker/secrets/ai_config_master_key.txt
    echo "  ✔ Clé AI Config Master Key générée"
else
    echo "  ✔ Clé AI Config Master Key existante"
fi
echo ""

# ── 4. Déterminer le fichier docker-compose ────────────────────────────────
COMPOSE_FILE="docker-compose.prod.yml"
if [ -f docker-compose.sandbox.yml ]; then
    echo "▶ Fichier docker-compose.sandbox.yml détecté (mode host network)"
    read -p "  Utiliser le mode sandbox (host network) ? [o/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        COMPOSE_FILE="docker-compose.sandbox.yml"
    fi
fi
echo "  ✔ Utilisation de: $COMPOSE_FILE"
echo ""

# ── 5. Construire et lancer les services ───────────────────────────────────
echo "▶ Construction et démarrage des services..."
sudo docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --build 2>&1

echo ""
echo "▶ Attente du démarrage des services..."
sleep 15

# ── 6. Vérifier la santé des services ──────────────────────────────────────
echo ""
echo "▶ Vérification de la santé des services..."
sudo docker compose -f "$COMPOSE_FILE" --env-file .env.prod ps

echo ""
echo "▶ Test du health check backend..."
for i in {1..10}; do
    if curl -sf http://localhost:3000/healthz > /dev/null 2>&1; then
        echo "  ✔ Backend opérationnel"
        break
    fi
    echo "  ⏳ Tentative $i/10..."
    sleep 5
done

# ── 7. Créer le compte administrateur (si nécessaire) ──────────────────────
echo ""
echo "▶ Vérification du compte administrateur..."
if [ -f create-admin.cjs ]; then
    read -p "  Créer un compte administrateur local ? [o/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Oo]$ ]]; then
        node create-admin.cjs
        echo "  ✔ Compte administrateur créé"
        echo "    Email: admin@agilestest.local"
        echo "    Mot de passe: Admin@2026!"
    fi
fi

# ── 8. Résumé ──────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              Déploiement Terminé ✔                      ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Application:  http://localhost:8080                     ║"
echo "║  Backend:      http://localhost:3000                     ║"
echo "║  MinIO Console: http://localhost:9001                    ║"
echo "║                                                          ║"
echo "║  Compose file: $COMPOSE_FILE                             ║"
echo "║                                                          ║"
echo "║  Commandes utiles:                                       ║"
echo "║  - Arrêter:    docker compose -f $COMPOSE_FILE stop      ║"
echo "║  - Logs:       docker compose -f $COMPOSE_FILE logs -f   ║"
echo "║  - Redémarrer: docker compose -f $COMPOSE_FILE restart   ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
