# AgilesTest — Guide de Déploiement Permanent

Ce document décrit la procédure complète pour déployer et maintenir la plateforme AgilesTest en production de manière permanente.

---

## Architecture des Services

La plateforme repose sur cinq services orchestrés via Docker Compose, chacun configuré avec `restart: unless-stopped` pour garantir la haute disponibilité.

| Service | Image | Port | Rôle |
|---------|-------|------|------|
| **MySQL 8.0** | `mysql:8.0` | 3307 | Base de données relationnelle |
| **MinIO** | `minio/minio:latest` | 9000 / 9001 | Stockage objet S3-compatible |
| **Backend** | Build local (Node.js) | 3000 | API tRPC + Frontend statique |
| **Nginx** | `nginx:alpine` | 8080 | Reverse proxy avec HTTPS forwarding |
| **db-migrate** | Build local | — | Migrations de schéma (one-shot) |

---

## Déploiement Rapide (One-Click)

Pour déployer la plateforme sur un nouveau serveur, exécutez simplement :

```bash
git clone https://github.com/alanvinadon-ship-it/agilestest-test-gui-2.git
cd agilestest-test-gui-2
chmod +x deploy.sh
./deploy.sh
```

Le script `deploy.sh` effectue automatiquement les opérations suivantes : vérification des prérequis Docker, génération des mots de passe sécurisés, création des secrets, construction des images et démarrage de tous les services.

---

## Déploiement Manuel Étape par Étape

### 1. Prérequis

Le serveur cible doit disposer de Docker Engine (version 24+) et Docker Compose (version 2+). L'installation peut être réalisée via le script officiel :

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

### 2. Configuration des Variables d'Environnement

Copier le fichier d'exemple et personnaliser les valeurs sensibles :

```bash
cp .env.example.prod .env.prod
```

Les variables critiques à définir sont les suivantes :

| Variable | Description | Génération |
|----------|-------------|------------|
| `JWT_SECRET` | Clé de signature des tokens de session | `openssl rand -hex 32` |
| `MYSQL_ROOT_PASSWORD` | Mot de passe root MySQL | `openssl rand -hex 16` |
| `MYSQL_PASSWORD` | Mot de passe utilisateur MySQL | `openssl rand -hex 16` |
| `MINIO_ROOT_PASSWORD` | Mot de passe admin MinIO | `openssl rand -hex 16` |
| `VITE_APP_ID` | Identifiant de l'application | `agilestest-local` |

### 3. Création des Secrets Docker

```bash
mkdir -p deploy/docker/secrets
openssl rand -base64 32 > deploy/docker/secrets/ai_config_master_key.txt
```

### 4. Lancement des Services

Pour un environnement avec support iptables complet (serveur standard) :

```bash
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Pour un environnement sans iptables (sandbox, conteneur dans conteneur) :

```bash
sudo docker compose -f docker-compose.sandbox.yml --env-file .env.prod up -d --build
```

### 5. Création du Compte Administrateur

```bash
node create-admin.cjs
```

Ce script crée un compte avec les identifiants par défaut `admin@agilestest.local` / `Admin@2026!`. Il est fortement recommandé de modifier le mot de passe après la première connexion.

---

## Redémarrage Automatique (systemd)

Pour que la plateforme redémarre automatiquement après un reboot du serveur, installer le service systemd :

```bash
sudo cp agilestest.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agilestest.service
```

Le fichier `agilestest.service` est inclus dans le repository. Les conteneurs Docker sont également configurés avec `restart: unless-stopped`, ce qui assure une double couche de résilience.

---

## Commandes d'Administration

| Action | Commande |
|--------|----------|
| Vérifier l'état | `sudo docker compose -f docker-compose.sandbox.yml --env-file .env.prod ps` |
| Voir les logs | `sudo docker compose -f docker-compose.sandbox.yml --env-file .env.prod logs -f` |
| Redémarrer tout | `sudo docker compose -f docker-compose.sandbox.yml --env-file .env.prod restart` |
| Arrêter | `sudo docker compose -f docker-compose.sandbox.yml --env-file .env.prod down` |
| Reconstruire | `sudo docker compose -f docker-compose.sandbox.yml --env-file .env.prod up -d --build` |
| Health check | `curl -s http://localhost:3000/healthz` |

---

## Déploiement sur un Serveur Cloud

Pour rendre la plateforme accessible publiquement de manière permanente, les étapes recommandées sont les suivantes :

1. **Provisionner un VPS** (AWS EC2, DigitalOcean, OVH, Hetzner) avec au minimum 2 vCPU, 4 Go RAM, 40 Go SSD.
2. **Configurer un nom de domaine** pointant vers l'adresse IP publique du serveur.
3. **Installer un certificat TLS** via Let's Encrypt / Certbot pour le HTTPS.
4. **Cloner le repository** et exécuter `./deploy.sh`.
5. **Configurer le pare-feu** pour n'exposer que les ports 80 et 443.

### Exemple avec Certbot (HTTPS automatique)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d votre-domaine.com
```

---

## Endpoints de Vérification

| Endpoint | URL | Description |
|----------|-----|-------------|
| **Frontend** | `http://localhost:8080/` | Interface utilisateur |
| **Health Check** | `http://localhost:8080/healthz` | État de santé du backend |
| **MinIO Console** | `http://localhost:9001/` | Console d'administration MinIO |

---

## Rétention des Données

| Type | Durée |
|------|-------|
| Artefacts | 90 jours |
| Runs | 180 jours |
| Sessions | 30 jours |

---

## Sécurité

La plateforme intègre plusieurs couches de sécurité. Les mots de passe sont hachés avec **bcrypt** (12 rounds) et les sessions utilisent des **JWT signés HS256** avec expiration d'un an. Les cookies de session sont configurés avec les flags **HttpOnly**, **Secure** et **SameSite=None**. Les secrets Docker sont montés en lecture seule via le mécanisme natif Docker Secrets, et le conteneur backend s'exécute avec un utilisateur **non-root** (UID 1001). Nginx agit comme reverse proxy et transmet les en-têtes `X-Forwarded-Proto` pour la détection HTTPS.

---

## Identifiants par Défaut

| Élément | Valeur |
|---------|--------|
| **Email admin** | `admin@agilestest.local` |
| **Mot de passe admin** | `Admin@2026!` |
| **MinIO Console** | `http://localhost:9001` (minioadmin / voir .env.prod) |
| **MySQL** | Port 3307 (voir .env.prod pour les identifiants) |
