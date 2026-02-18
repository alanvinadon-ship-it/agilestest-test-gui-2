# UPGRADE_COMPOSE — Guide de mise à jour Docker Compose

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1

---

## 1. Stratégie de mise à jour

La mise à jour d'AgilesTest en Docker Compose suit une approche **rolling update manuelle** : backup, pull des nouvelles images, restart des services. Le frontend étant une SPA statique, les mises à jour sont sans interruption visible pour les utilisateurs connectés.

---

## 2. Procédure standard

### 2.1 Pré-mise à jour

Avant toute mise à jour, sauvegarder les données MinIO et noter la version actuelle.

```bash
cd deploy/compose

# 1. Backup MinIO
./scripts/backup_minio.sh

# 2. Noter la version actuelle
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Image}}\t{{.Status}}"

# 3. Vérifier le smoke test avant mise à jour
./scripts/smoke_test.sh
```

### 2.2 Mise à jour des images

Deux méthodes sont possibles selon que les images sont pré-construites (registry) ou construites localement.

**Méthode A — Registry (recommandé pour production)** :

```bash
# Mettre à jour le tag dans .env
# TAG=1.1.0

# Pull les nouvelles images
docker compose -f docker-compose.prod.yml --env-file .env pull

# Redémarrer avec les nouvelles images
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

**Méthode B — Build local** :

```bash
# Récupérer le nouveau code source
git pull origin main  # ou extraire la nouvelle archive

# Rebuild
docker compose -f docker-compose.prod.yml --env-file .env build --no-cache

# Redémarrer
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

### 2.3 Post-mise à jour

```bash
# Vérifier les services
docker compose -f docker-compose.prod.yml ps

# Smoke test
./scripts/smoke_test.sh

# Nettoyer les anciennes images
docker image prune -f
```

---

## 3. Rollback

Si la mise à jour échoue, restaurer la version précédente.

```bash
# 1. Arrêter les services
docker compose -f docker-compose.prod.yml down

# 2. Restaurer le tag précédent dans .env
# TAG=1.0.0

# 3. Redémarrer
docker compose -f docker-compose.prod.yml --env-file .env up -d

# 4. Si nécessaire, restaurer MinIO
./scripts/restore_minio.sh backups/minio/<timestamp>.tar.gz

# 5. Vérifier
./scripts/smoke_test.sh
```

---

## 4. Matrice de compatibilité

| Version | MinIO | Node.js | Playwright | Notes |
|---------|-------|---------|------------|-------|
| 1.0.0 | RELEASE.2024-06-13 | 20-slim | 1.42.1 | Version initiale pilote |

---

## 5. Changelog

### v1.0.0 (2026-02-18)

Version initiale pour le pilote Orange. Inclut le frontend SPA, l'orchestration stub, le runner agent avec Playwright et tcpdump, MinIO pour les artefacts, et le reverse proxy Nginx.
