# AgilesTest — Guide des Opérations

Ce document décrit l'architecture de déploiement, les composants et les procédures opérationnelles quotidiennes.

---

## Architecture de déploiement

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Nginx     │────▶│   Backend    │────▶│    MySQL     │
│  (port 80)  │     │  (port 3000) │     │  (port 3306) │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    MinIO     │
                    │  (port 9000) │
                    └──────────────┘
```

| Service | Image | Port interne | Port exposé | Volume |
|---------|-------|-------------|-------------|--------|
| nginx | nginx:alpine | 80 | `APP_PORT` (défaut: 80) | nginx.conf |
| backend | agilestest (custom) | 3000 | — | — |
| mysql | mysql:8.0 | 3306 | `MYSQL_PORT` (défaut: 3306) | mysql_data |
| minio | minio/minio | 9000, 9001 | `MINIO_API_PORT`, `MINIO_CONSOLE_PORT` | minio_data |

---

## Variables d'environnement

Voir `.env.example.prod` pour la liste complète. Les variables critiques :

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `MYSQL_PASSWORD` | Mot de passe MySQL | Oui |
| `JWT_SECRET` | Secret de signature des sessions | Oui |
| `S3_ACCESS_KEY` | Clé d'accès MinIO | Oui |
| `S3_SECRET_KEY` | Clé secrète MinIO | Oui |
| `CORS_ORIGIN` | Origines autorisées (CSV) | Prod: Oui |
| `METRICS_BASIC_AUTH_USER` | Auth pour /metrics | Recommandé |
| `METRICS_BASIC_AUTH_PASSWORD` | Auth pour /metrics | Recommandé |

---

## Middleware Pipeline (server/_core/index.ts)

Les middlewares sont branchés dans `server/_core/index.ts` dans l'ordre suivant :

| Ordre | Middleware | Fichier | Rôle |
|-------|-----------|---------|------|
| 1 | `requestIdMiddleware` | `server/observability.ts` | Génère/propage `x-request-id` sur chaque requête |
| 2 | `requestLoggingMiddleware` | `server/observability.ts` | Log JSON structuré (pino) de chaque requête |
| 3 | `metricsMiddleware` | `server/observability.ts` | Compteurs Prometheus (HTTP, tRPC, jobs) |
| 4 | `registerSecurityMiddleware` | `server/security.ts` | Headers sécurité + rate limit `/api/oauth` (10/15min) + `/api/trpc` (200/min) |
| 5 | `corsMiddleware` | `server/security.ts` | CORS strict via `CORS_ORIGIN` (prod) ou permissif (dev) |
| 6 | Body parsers | Express built-in | JSON/URL-encoded avec limite 50MB |
| 7 | `registerHealthEndpoints` | `server/observability.ts` | `/healthz`, `/readyz`, `/metrics` |
| 8 | OAuth routes | `server/_core/oauth.ts` | `/api/oauth/callback` |
| 9 | tRPC routes | `server/routers.ts` | `/api/trpc/*` |
| 10 | Frontend | Vite (dev) / static (prod) | SPA fallback |

**Variables ENV pour activer/configurer :**

| Variable | Défaut | Description |
|----------|--------|-------------|
| `LOG_LEVEL` | `info` | Niveau de log pino (debug, info, warn, error) |
| `METRICS_ENABLED` | `true` | Active les compteurs Prometheus |
| `METRICS_BASIC_AUTH_USER` | _(vide)_ | Si défini, protège `/metrics` par Basic Auth |
| `METRICS_BASIC_AUTH_PASSWORD` | _(vide)_ | Mot de passe Basic Auth pour `/metrics` |
| `CORS_ORIGIN` | _(vide)_ | Origines autorisées (CSV). Vide = permissif en dev, bloqué en prod |
| `RATE_LIMIT_LOGIN_MAX` | `10` | Requêtes max sur `/api/oauth` par fenêtre |
| `RATE_LIMIT_LOGIN_WINDOW_MS` | `900000` | Fenêtre de rate limit login (15 min) |

---

## Endpoints de monitoring

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/healthz` | GET | Non | Liveness probe — le processus est vivant |
| `/readyz` | GET | Non | Readiness probe — DB connectée |
| `/metrics` | GET | Basic Auth | Métriques Prometheus |

---

## Tâches quotidiennes

### Vérification de santé
```bash
curl -s http://localhost/healthz | jq .status
curl -s http://localhost/readyz | jq .status
```

### Consultation des logs
```bash
# Dernières 100 lignes du backend
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# Suivre les logs en temps réel
docker compose -f docker-compose.prod.yml logs -f backend

# Filtrer les erreurs
docker compose -f docker-compose.prod.yml logs backend 2>&1 | grep '"level":"error"'
```

### Vérification des jobs
```sql
-- Jobs en attente
SELECT name, COUNT(*) as count FROM jobs WHERE status = 'QUEUED' GROUP BY name;

-- Jobs échoués récents
SELECT id, name, error, completedAt FROM jobs
WHERE status = 'FAILED' ORDER BY completedAt DESC LIMIT 10;
```

---

## Tâches hebdomadaires

### Backup
```bash
./scripts/backup.sh
# Vérifier la taille et l'intégrité
ls -lh backups/*.sql.gz | tail -5
```

### Purge de rétention (dry-run)
Lancer via l'interface admin ou l'API :
```bash
# Dry-run pour voir ce qui serait supprimé
# Via tRPC: jobs.enqueueRetentionPurge({ dryRun: true })
```

### Nettoyage Docker
```bash
docker system prune -f
docker volume prune -f
```

---

## Mise à jour de l'application

1. **Backup** : `./scripts/backup.sh`
2. **Pull** : `git pull origin main`
3. **Checklist** : Suivre `docs/RELEASE_GATE.md`
4. **Déployer** : `./scripts/prod-up.sh`
5. **Vérifier** : `./scripts/smoke-test.sh`
6. **Rollback si nécessaire** : Voir `docs/RUNBOOK.md` section 7

---

## Rétention des données

| Type de données | Durée par défaut | Variable |
|----------------|-----------------|----------|
| Artefacts (JTL, PCAP, logs) | 90 jours | `RETENTION_DAYS_ARTIFACTS` |
| Exécutions terminées | 180 jours | `RETENTION_DAYS_RUNS` |
| Sessions Drive Test | 30 jours | `RETENTION_DAYS_SESSIONS` |

La purge est déclenchée via le job `retentionPurge`. Recommandation : planifier un cron hebdomadaire.

---

## Sécurité opérationnelle

- **Rotation des secrets** : changer `JWT_SECRET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` tous les 90 jours
- **Mise à jour des images** : vérifier les CVE sur les images Docker mensuellement
- **Audit logs** : consulter la table `audit_logs` pour tracer les actions sensibles
- **Backups** : conserver au minimum 7 jours de backups, idéalement 30 jours
