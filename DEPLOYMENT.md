# AgilesTest — Guide de Déploiement Production

## Architecture de Déploiement

Le déploiement utilise Docker Compose pour orchestrer les services suivants :

| Service | Image | Port | Rôle |
|---------|-------|------|------|
| **MySQL 8.0** | `mysql:8.0` | 3307 | Base de données relationnelle |
| **MinIO** | `minio/minio:latest` | 9000 (API) / 9001 (Console) | Stockage objet S3-compatible |
| **MinIO Init** | `minio/mc:latest` | - | Initialisation du bucket (one-shot) |
| **DB Migrate** | Custom (Drizzle Kit) | - | Migrations de base de données (one-shot) |
| **Backend** | Custom (Node.js 22) | 3000 | Serveur Express + tRPC + Frontend statique |
| **Nginx** | `nginx:alpine` | 8080 | Reverse proxy avec headers de sécurité |

## Fichiers de Configuration

### Variables d'Environnement (`.env.prod`)

```bash
# Base de données MySQL
MYSQL_ROOT_PASSWORD=rootpass123
MYSQL_DATABASE=agilestest
MYSQL_USER=agilestest
MYSQL_PASSWORD=agilestest123
MYSQL_PORT=3307

# MinIO (S3-compatible)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=miniopass123
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
S3_BUCKET=agilestest-artifacts
S3_REGION=us-east-1

# Application
APP_PORT=8080
NODE_ENV=production
JWT_SECRET=<généré automatiquement>
```

### Secrets

Le fichier `deploy/docker/secrets/ai_config_master_key.txt` contient la clé AES-256 pour le chiffrement de la configuration AI. Générée avec `openssl rand -hex 32`.

## Commandes de Déploiement

### Démarrer tous les services
```bash
docker compose -f docker-compose.sandbox.yml --env-file .env.prod up -d --build
```

### Vérifier l'état des services
```bash
docker compose -f docker-compose.sandbox.yml --env-file .env.prod ps -a
```

### Consulter les logs
```bash
# Tous les services
docker compose -f docker-compose.sandbox.yml --env-file .env.prod logs -f

# Un service spécifique
docker compose -f docker-compose.sandbox.yml --env-file .env.prod logs backend
```

### Arrêter les services
```bash
docker compose -f docker-compose.sandbox.yml --env-file .env.prod down
```

### Arrêter et supprimer les volumes
```bash
docker compose -f docker-compose.sandbox.yml --env-file .env.prod down -v
```

## Endpoints de Vérification

| Endpoint | URL | Description |
|----------|-----|-------------|
| **Frontend** | `http://localhost:8080/` | Interface utilisateur |
| **Health Check** | `http://localhost:8080/healthz` | État de santé du backend |
| **Readiness** | `http://localhost:8080/readyz` | Prêt à recevoir du trafic |
| **Metrics** | `http://localhost:8080/metrics` | Métriques Prometheus |
| **MinIO Console** | `http://localhost:9001/` | Console d'administration MinIO |

## Rétention des Données

| Type | Durée |
|------|-------|
| Artefacts | 90 jours |
| Runs | 180 jours |
| Sessions | 30 jours |

## Notes de Sécurité

- Les headers de sécurité (X-Frame-Options, X-Content-Type-Options, etc.) sont configurés via Nginx
- La compression Gzip est activée pour les fichiers statiques
- La taille maximale d'upload est de 100 MB
- Le backend tourne sous un utilisateur non-root dans le conteneur
- Les secrets sont gérés via Docker Secrets
