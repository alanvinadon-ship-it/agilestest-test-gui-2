# Installation Docker — AgilesTest

Ce document décrit le déploiement d'AgilesTest via Docker Compose en environnement production ou pilote.

---

## Prérequis

| Composant | Version minimale |
|-----------|-----------------|
| Docker Engine | 24.x |
| Docker Compose | v2.20+ |
| RAM disponible | 2 Go minimum |
| Espace disque | 5 Go minimum |

---

## Architecture des services

```
┌─────────────────────────────────────────────────────┐
│                    nginx (:80)                      │
│              reverse proxy + cache                  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              backend (:3000)                        │
│     Express + tRPC + frontend statique              │
│     /healthz  /readyz  /metrics                     │
└──────┬───────────────────────────┬──────────────────┘
       │                           │
┌──────▼──────┐           ┌────────▼─────────┐
│ MySQL 8.0   │           │ MinIO (S3)       │
│ (:3306)     │           │ API (:9000)      │
│             │           │ Console (:9001)  │
└─────────────┘           └──────────────────┘
```

---

## Démarrage rapide

### 1. Cloner le projet

```bash
git clone <repo-url> agilestest
cd agilestest
```

### 2. Configurer l'environnement

```bash
cp .env.example.prod .env.prod
```

Éditer `.env.prod` avec vos valeurs :

```env
# MySQL (obligatoire)
MYSQL_ROOT_PASSWORD=<mot_de_passe_root_fort>
MYSQL_DATABASE=agilestest
MYSQL_USER=agilestest
MYSQL_PASSWORD=<mot_de_passe_fort>

# MinIO (obligatoire)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<mot_de_passe_fort>
S3_BUCKET=agilestest-artifacts

# Application (obligatoire)
JWT_SECRET=<secret_jwt_32_chars_minimum>
CORS_ORIGIN=https://votre-domaine.com

# OAuth Manus (obligatoire pour l'authentification)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=<votre_app_id>

# Optionnel
LOG_LEVEL=info
METRICS_ENABLED=true
RETENTION_DAYS_ARTIFACTS=90
RETENTION_DAYS_RUNS=180
RETENTION_DAYS_SESSIONS=30
```

### 3. Construire l'image

```bash
docker build -t agilestest .
```

### 4. Démarrer les services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Le compose lance dans l'ordre :
1. **mysql** — base de données, healthcheck toutes les 10s
2. **minio** — stockage objet S3-compatible
3. **minio-init** — création du bucket (one-shot)
4. **db-migrate** — migrations Drizzle (one-shot)
5. **backend** — serveur Express + frontend
6. **nginx** — reverse proxy sur le port 80

### 5. Vérifier le déploiement

```bash
# État des services
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Logs backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backend --tail 20

# Health checks
curl http://localhost/healthz    # → {"status":"ok", ...}
curl http://localhost/readyz     # → {"status":"ready", "checks":{"database":"ok"}}
curl http://localhost/metrics    # → Prometheus format
```

### 6. Smoke test

```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh http://localhost
```

---

## Commandes opérationnelles

### Démarrer / Arrêter

```bash
# Démarrer
./scripts/prod-up.sh

# Arrêter (conserve les volumes)
./scripts/prod-down.sh

# Arrêter et supprimer les volumes (DESTRUCTIF)
docker compose -f docker-compose.prod.yml --env-file .env.prod down -v
```

### Migrations base de données

```bash
./scripts/db-migrate.sh
```

### Sauvegarde / Restauration

```bash
# Sauvegarde MySQL
./scripts/backup.sh

# Restauration MySQL
./scripts/restore.sh backups/agilestest_20260226_120000.sql.gz
```

Les sauvegardes sont stockées dans le répertoire `backups/`.

---

## Endpoints de monitoring

| Endpoint | Description | Réponse |
|----------|-------------|---------|
| `GET /healthz` | Liveness probe (Kubernetes/Docker) | `200 {"status":"ok"}` |
| `GET /readyz` | Readiness probe (vérifie DB) | `200 {"status":"ready"}` ou `503` |
| `GET /metrics` | Métriques Prometheus | Format texte Prometheus |

### Métriques Prometheus exposées

```
agilestest_uptime_seconds          # Uptime du serveur
agilestest_http_requests_total     # Total requêtes HTTP
agilestest_http_requests_by_status # Requêtes par code status (2xx, 4xx, 5xx)
agilestest_http_requests_by_method # Requêtes par méthode (GET, POST, etc.)
agilestest_trpc_calls_total        # Total appels tRPC
agilestest_trpc_calls_success      # Appels tRPC réussis
agilestest_trpc_calls_error        # Appels tRPC en erreur
agilestest_jobs_total              # Total jobs par événement
agilestest_db_connections_active   # Connexions DB actives
```

---

## Sécurité

### Headers HTTP

Les headers de sécurité suivants sont appliqués automatiquement :

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Rate limiting

| Endpoint | Limite |
|----------|--------|
| `/api/oauth/*` | 10 requêtes / 15 minutes par IP |
| `/api/trpc/*` | 200 requêtes / minute par IP |

### Protection `/metrics`

Pour protéger l'endpoint `/metrics` en production, configurez :

```env
METRICS_BASIC_AUTH_USER=prometheus
METRICS_BASIC_AUTH_PASSWORD=<mot_de_passe_fort>
```

---

## MinIO (Stockage artefacts)

### Console d'administration

Accessible sur le port 9001 : `http://localhost:9001`

Identifiants : `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` définis dans `.env.prod`.

### Test de connectivité

```bash
# Via AWS CLI
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=<votre_mot_de_passe>
aws --endpoint-url http://localhost:9000 s3 ls s3://agilestest-artifacts/
```

### Rétention

Les artefacts sont purgés automatiquement selon les durées configurées :

| Type | Variable | Défaut |
|------|----------|--------|
| Artefacts de test | `RETENTION_DAYS_ARTIFACTS` | 90 jours |
| Résultats d'exécution | `RETENTION_DAYS_RUNS` | 180 jours |
| Sessions Drive Test | `RETENTION_DAYS_SESSIONS` | 30 jours |

---

## Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backend

# Causes fréquentes :
# - DATABASE_URL incorrect → vérifier MYSQL_USER/MYSQL_PASSWORD
# - Port 3000 déjà utilisé → changer PORT dans .env.prod
# - Migrations non appliquées → relancer db-migrate
```

### MySQL refuse les connexions

```bash
# Vérifier que MySQL est healthy
docker compose -f docker-compose.prod.yml --env-file .env.prod ps mysql

# Tester la connexion
docker compose -f docker-compose.prod.yml --env-file .env.prod exec mysql \
  mysql -u agilestest -p agilestest -e "SELECT 1"
```

### MinIO inaccessible

```bash
# Vérifier le healthcheck
curl http://localhost:9000/minio/health/live

# Vérifier que le bucket existe
docker compose -f docker-compose.prod.yml --env-file .env.prod logs minio-init
```

---

## Mise à jour

```bash
# 1. Pull les dernières modifications
git pull origin main

# 2. Rebuilder l'image
docker build -t agilestest .

# 3. Appliquer les migrations
./scripts/db-migrate.sh

# 4. Redémarrer les services
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d backend
```

---

## Fichiers de référence

| Fichier | Description |
|---------|-------------|
| `Dockerfile` | Build multi-stage (builder + production) |
| `docker-compose.prod.yml` | Stack complet avec réseau bridge |
| `docker-compose.local-test.yml` | Stack validation locale (host network) |
| `.env.example.prod` | Template variables d'environnement |
| `nginx/nginx.conf` | Configuration reverse proxy |
| `scripts/prod-up.sh` | Démarrage production |
| `scripts/prod-down.sh` | Arrêt production |
| `scripts/db-migrate.sh` | Migrations Drizzle |
| `scripts/backup.sh` | Sauvegarde MySQL |
| `scripts/restore.sh` | Restauration MySQL |
| `scripts/smoke-test.sh` | Tests de fumée |
