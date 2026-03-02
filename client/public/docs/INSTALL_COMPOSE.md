# INSTALL_COMPOSE — Installation Docker Compose

> **Version** : 1.0.0 — Mission PACKAGING-DUAL-1  
> **Cible** : VM Linux (Ubuntu 22.04+ / RHEL 8+)  
> **Durée estimée** : 30 minutes

---

## 1. Prérequis

| Composant | Version minimale | Vérification |
|-----------|-----------------|--------------|
| Docker Engine | 24.0+ | `docker --version` |
| Docker Compose | V2 (2.20+) | `docker compose version` |
| RAM | 8 Go (4 Go minimum) | `free -h` |
| Disque | 20 Go libres | `df -h` |
| Ports | 80, 443 libres | `ss -tlnp \| grep -E ':80\|:443'` |
| Réseau | Accès Docker Hub | `docker pull hello-world` |

---

## 2. Planning d'installation

### J-15 : Préparation infrastructure

L'équipe infrastructure doit provisionner une VM Linux avec les spécifications ci-dessus. Installer Docker Engine et Docker Compose V2 selon la documentation officielle Docker. Vérifier que les ports 80 et 443 sont ouverts dans le pare-feu. Si un certificat TLS est requis, le commander auprès de l'autorité de certification interne Orange.

### J-2 : Pré-staging

Récupérer l'archive de déploiement et la décompresser sur la VM cible. Pré-télécharger les images Docker avec `docker compose pull` pour éviter les délais le jour J. Préparer le fichier `.env` avec les valeurs de production (secrets MinIO, JWT, domaine). Si TLS est requis, placer les certificats dans `nginx/certs/`.

```bash
tar -xzf agilestest-dual-packaging-v1.0.0.tar.gz
cd deploy/compose
cp env.example .env
# Éditer .env avec les valeurs de production
```

### Jour J : Installation

Exécuter le script d'initialisation qui vérifie les prérequis, génère les secrets manquants, construit les images et démarre tous les services.

```bash
cd deploy/compose
./scripts/init.sh
```

---

## 3. Installation manuelle (pas à pas)

Si le script `init.sh` ne convient pas, voici les étapes manuelles.

**Étape 1 — Configurer l'environnement** : Copier `env.example` en `.env` et adapter les valeurs. Les variables critiques sont `MINIO_ROOT_PASSWORD`, `JWT_SECRET` et `DOMAIN`.

```bash
cp env.example .env
# Générer un secret JWT
openssl rand -base64 32
# Éditer .env avec les valeurs
```

**Étape 2 — Construire les images** : Les Dockerfiles sont fournis pour le frontend et l'orchestration. Le runner utilise son propre Dockerfile dans `runner-agent/`.

```bash
docker compose -f docker-compose.prod.yml --env-file .env build
```

**Étape 3 — Démarrer les services** : L'ordre de démarrage est géré par les dépendances `depends_on` avec conditions `service_healthy`.

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

**Étape 4 — Vérifier** : Attendre 30 secondes que tous les healthchecks passent, puis exécuter le smoke test.

```bash
docker compose -f docker-compose.prod.yml ps
./scripts/smoke_test.sh
```

---

## 4. Configuration TLS

Pour activer HTTPS, placer les certificats dans `nginx/certs/` et décommenter le bloc HTTPS dans `nginx/conf.d/agilestest.conf`.

```bash
# Copier les certificats
cp fullchain.pem nginx/certs/
cp privkey.pem nginx/certs/

# Décommenter le bloc HTTPS dans nginx/conf.d/agilestest.conf
# Décommenter la redirection HTTP → HTTPS

# Redémarrer le proxy
docker compose -f docker-compose.prod.yml restart reverse-proxy
```

---

## 5. Vérification post-installation

| Vérification | Commande | Résultat attendu |
|--------------|----------|------------------|
| Services UP | `docker compose ps` | Tous les conteneurs "Up (healthy)" |
| Frontend | `curl http://localhost/` | Page HTML AgilesTest |
| API | `curl http://localhost/api/health` | 200 OK |
| MinIO | `docker exec agilestest-minio mc ready local` | Ready |
| Smoke test | `./scripts/smoke_test.sh` | 16/16 PASS |

---

## 6. Exploitation quotidienne

| Opération | Commande |
|-----------|----------|
| Voir les logs | `docker compose -f docker-compose.prod.yml logs -f [service]` |
| Redémarrer un service | `docker compose -f docker-compose.prod.yml restart [service]` |
| Arrêter tout | `docker compose -f docker-compose.prod.yml down` |
| Backup MinIO | `./scripts/backup_minio.sh` |
| Restore MinIO | `./scripts/restore_minio.sh <archive.tar.gz>` |
| Rotation logs | `./scripts/rotate_logs.sh` |

---

## 7. Dépannage

**Conteneur en restart loop** : Vérifier les logs avec `docker compose logs <service>`. Les causes fréquentes sont un port déjà occupé, un secret manquant dans `.env`, ou un healthcheck qui échoue.

**MinIO inaccessible** : Vérifier que le volume `minio-data` existe avec `docker volume ls`. Si le conteneur `minio-init` a échoué, relancer avec `docker compose up minio-init`.

**Runner ne poll pas** : Vérifier que `ORCHESTRATION_URL` pointe vers `http://orchestration:4000` dans `.env`. Le runner doit être sur le réseau `private`.

**Erreur TLS** : Vérifier que les certificats sont au format PEM et que les permissions sont correctes (`chmod 644 fullchain.pem privkey.pem`).
