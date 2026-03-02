# AgilesTest — Runbook Opérationnel

Ce document décrit les procédures de diagnostic et de résolution des incidents courants en production.

---

## 1. L'application ne répond plus

**Symptômes** : timeout HTTP, page blanche, erreur 502/504 nginx.

**Diagnostic** :
```bash
# Vérifier l'état des containers
docker compose -f docker-compose.prod.yml ps

# Logs du backend
docker compose -f docker-compose.prod.yml logs --tail=100 backend

# Healthz
curl -s http://localhost/healthz | jq .

# Readyz
curl -s http://localhost/readyz | jq .
```

**Résolution** :
```bash
# Redémarrer le backend
docker compose -f docker-compose.prod.yml restart backend

# Si le problème persiste, redémarrer tout le stack
./scripts/prod-down.sh && ./scripts/prod-up.sh
```

---

## 2. Base de données inaccessible

**Symptômes** : `/readyz` retourne `503`, erreurs `ECONNREFUSED` dans les logs.

**Diagnostic** :
```bash
# Vérifier le container MySQL
docker compose -f docker-compose.prod.yml ps mysql
docker compose -f docker-compose.prod.yml logs --tail=50 mysql

# Tester la connexion
docker compose -f docker-compose.prod.yml exec mysql \
  mysql -u$MYSQL_USER -p$MYSQL_PASSWORD -e "SELECT 1"
```

**Résolution** :
```bash
# Redémarrer MySQL
docker compose -f docker-compose.prod.yml restart mysql

# Attendre que MySQL soit prêt, puis redémarrer le backend
sleep 10
docker compose -f docker-compose.prod.yml restart backend
```

---

## 3. MinIO / Stockage S3 indisponible

**Symptômes** : upload/download d'artefacts échoue, erreur `S3 configuration missing`.

**Diagnostic** :
```bash
# Vérifier le container MinIO
docker compose -f docker-compose.prod.yml ps minio
docker compose -f docker-compose.prod.yml logs --tail=50 minio

# Tester la santé MinIO
curl -s http://localhost:9000/minio/health/live
```

**Résolution** :
```bash
# Redémarrer MinIO
docker compose -f docker-compose.prod.yml restart minio
```

---

## 4. Jobs bloqués (RUNNING depuis trop longtemps)

**Symptômes** : jobs en statut `RUNNING` depuis plus de 30 minutes.

**Diagnostic** :
```sql
-- Lister les jobs bloqués
SELECT id, name, status, startedAt, attempts
FROM jobs
WHERE status = 'RUNNING'
AND startedAt < NOW() - INTERVAL 30 MINUTE;
```

**Résolution** :
```sql
-- Remettre en queue les jobs bloqués
UPDATE jobs
SET status = 'QUEUED', startedAt = NULL
WHERE status = 'RUNNING'
AND startedAt < NOW() - INTERVAL 30 MINUTE;
```

---

## 5. Rate limiting trop agressif

**Symptômes** : utilisateurs légitimes reçoivent des erreurs 429.

**Diagnostic** :
```bash
# Vérifier les headers de rate limit
curl -I http://localhost/api/trpc/auth.me
# Chercher X-RateLimit-Remaining
```

**Résolution** :
Ajuster les variables dans `.env.prod` :
```env
RATE_LIMIT_LOGIN_MAX=20          # Défaut: 10
RATE_LIMIT_LOGIN_WINDOW_MS=900000  # Défaut: 15 min
```
Puis redémarrer : `docker compose -f docker-compose.prod.yml restart backend`

---

## 6. Espace disque insuffisant

**Symptômes** : erreurs d'écriture, MySQL crash, MinIO refuse les uploads.

**Diagnostic** :
```bash
# Espace disque
df -h

# Taille des volumes Docker
docker system df -v

# Taille des données MinIO
docker compose -f docker-compose.prod.yml exec minio du -sh /data
```

**Résolution** :
```bash
# Purger les artefacts expirés (dry-run d'abord)
# Via l'interface admin ou directement :
curl -X POST http://localhost/api/trpc/jobs.enqueueRetentionPurge \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Nettoyer les images Docker inutilisées
docker system prune -f
```

---

## 7. Rollback d'urgence

**Procédure** :
```bash
# 1. Arrêter le stack
./scripts/prod-down.sh

# 2. Restaurer le backup DB
./scripts/restore.sh backups/agilestest_YYYYMMDD_HHMMSS.sql.gz

# 3. Revenir à l'image Docker précédente
docker compose -f docker-compose.prod.yml up -d --no-build

# 4. Vérifier
./scripts/smoke-test.sh
```

---

## 8. Backup et restauration

**Backup manuel** :
```bash
./scripts/backup.sh
# Fichier créé dans ./backups/agilestest_YYYYMMDD_HHMMSS.sql.gz
```

**Backup automatique** (cron recommandé) :
```bash
# Ajouter au crontab du serveur
0 2 * * * /opt/agilestest/scripts/backup.sh /opt/agilestest/backups >> /var/log/agilestest-backup.log 2>&1
```

**Restauration** :
```bash
./scripts/restore.sh backups/agilestest_20260226_020000.sql.gz
```

---

## Contacts

| Rôle | Contact |
|------|---------|
| Administrateur système | À définir |
| DBA | À définir |
| Développeur principal | À définir |
