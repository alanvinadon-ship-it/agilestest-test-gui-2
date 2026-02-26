# AgilesTest — Release Gate Checklist

Ce document définit les critères obligatoires avant toute mise en production ou mise à jour du pilote Docker.

---

## Pré-requis techniques

| # | Critère | Commande / Vérification | Statut |
|---|---------|------------------------|--------|
| 1 | **0 erreur TypeScript** | `npx tsc --noEmit` | ☐ |
| 2 | **Tous les tests passent** | `pnpm test` | ☐ |
| 3 | **Build Docker réussit** | `docker build -t agilestest .` | ☐ |
| 4 | **Migrations DB appliquées** | `pnpm db:push` ou `scripts/db-migrate.sh` | ☐ |
| 5 | **Variables d'environnement documentées** | Vérifier `.env.example.prod` | ☐ |
| 6 | **Healthz répond 200** | `curl http://localhost:3000/healthz` | ☐ |
| 7 | **Readyz répond 200** | `curl http://localhost:3000/readyz` | ☐ |

## Sécurité

| # | Critère | Vérification |
|---|---------|-------------|
| 8 | **Secrets non committés** | `git diff --cached -- .env*` vide |
| 9 | **CORS_ORIGIN configuré** | Variable non vide en prod |
| 10 | **Rate limit actif** | Tester 11 requêtes rapides sur `/api/oauth` → 429 |
| 11 | **Metrics protégé** | `curl http://localhost:3000/metrics` → 401 sans auth |
| 12 | **Headers sécurité** | `curl -I` → X-Content-Type-Options, X-Frame-Options présents |

## Stockage & Jobs

| # | Critère | Vérification |
|---|---------|-------------|
| 13 | **MinIO accessible** | `curl http://minio:9000/minio/health/live` → 200 |
| 14 | **Bucket créé** | Vérifier dans MinIO console |
| 15 | **Job queue polling actif** | Logs `[JobQueue] Polling started` |
| 16 | **Retention purge dry-run** | Enqueue `retentionPurge` avec `dryRun: true` |

## Observabilité

| # | Critère | Vérification |
|---|---------|-------------|
| 17 | **Logs JSON en prod** | `NODE_ENV=production` → sortie JSON |
| 18 | **x-request-id propagé** | `curl -v` → header `x-request-id` en réponse |
| 19 | **Prometheus scrape** | `/metrics` retourne format text/plain Prometheus |

## Processus

| # | Critère | Responsable |
|---|---------|------------|
| 20 | **Backup DB avant déploiement** | `scripts/backup.sh` |
| 21 | **Changelog mis à jour** | Rédacteur |
| 22 | **Smoke test post-déploiement** | `scripts/smoke-test.sh` |
| 23 | **Rollback plan documenté** | Voir RUNBOOK.md |

---

## Procédure de release

1. Exécuter la checklist ci-dessus (tous les ☐ doivent être ☑)
2. Créer un tag Git : `git tag -a v<version> -m "Release v<version>"`
3. Backup de la base de données : `./scripts/backup.sh`
4. Déployer : `./scripts/prod-up.sh`
5. Vérifier : `./scripts/smoke-test.sh`
6. En cas de problème : `./scripts/prod-down.sh` + restaurer le backup
