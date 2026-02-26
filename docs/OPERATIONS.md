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
