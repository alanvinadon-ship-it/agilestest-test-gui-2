# Guide Exploitation — AgilesTest

## Runner Agent Docker

### Prérequis

| Composant | Version minimale | Notes |
|-----------|-----------------|-------|
| Docker | 20.10+ | Docker Engine ou Docker Desktop |
| Docker Compose | 2.0+ | Plugin Docker Compose V2 |
| Réseau | Accès sortant | Vers MinIO et Orchestration API |
| RAM | 2 Go minimum | Par instance de runner |
| Disque | 5 Go minimum | Pour les navigateurs Playwright |

### Image Docker

Le Runner Agent utilise l'image officielle Playwright comme base. Elle inclut Node.js 20 et les trois navigateurs (Chromium, Firefox, WebKit) pré-installés.

```bash
cd runner-agent
docker build -t agilestest-runner-agent .
```

### Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `RUNNER_ID` | `runner-docker-01` | Identifiant unique du runner. Doit être unique par instance. |
| `ORCHESTRATION_URL` | `http://orchestration:4000` | URL de l'API Orchestration |
| `POLL_INTERVAL_MS` | `5000` | Intervalle de polling en millisecondes |
| `MINIO_ENDPOINT` | `minio` | Hostname du serveur MinIO |
| `MINIO_PORT` | `9000` | Port S3 de MinIO |
| `MINIO_ACCESS_KEY` | `minioadmin` | Clé d'accès MinIO |
| `MINIO_SECRET_KEY` | `minioadmin` | Clé secrète MinIO |
| `MINIO_BUCKET` | `agilestest-artifacts` | Nom du bucket S3 |
| `MINIO_USE_SSL` | `false` | Activer HTTPS pour MinIO |
| `WORKSPACE_DIR` | `/workspace` | Répertoire de travail pour les scripts |
| `ARTIFACTS_DIR` | `/artifacts` | Répertoire de collecte des artefacts |

### Enregistrement du Runner

Chaque runner est identifié par son `RUNNER_ID`. Il n'y a pas de processus d'enregistrement explicite : le runner s'annonce automatiquement lors du premier poll vers l'Orchestration API. L'Orchestration enregistre le `runner_id` dans le job lorsqu'il est assigné.

Pour exécuter plusieurs runners en parallèle, chaque instance doit avoir un `RUNNER_ID` unique :

```bash
docker-compose -f docker-compose.runner.yml up -d --scale runner=3
```

> **Note** : Avec `--scale`, Docker Compose attribue des noms de conteneur incrémentaux. Configurez `RUNNER_ID` dynamiquement via un script d'entrée si nécessaire.

### Workflow d'exécution d'un Job

Le Runner Agent suit un cycle de vie précis pour chaque job :

**1. Poll** — Le runner interroge `GET /api/v1/jobs/next?runner_id={id}` à intervalles réguliers. Si aucun job n'est disponible, la réponse est `204 No Content`. Si un job PENDING est disponible, l'Orchestration le verrouille (status → RUNNING) et le retourne.

**2. Download** — Le script package est téléchargé depuis `download_url` (ZIP) et extrait dans `{WORKSPACE_DIR}/{job_id}/`. Les fichiers du package incluent les tests Playwright, la configuration et les dépendances.

**3. Resolve Dataset** — Si un `dataset_bundle_id` est spécifié, le runner appelle `POST /api/v1/dataset-bundles/{id}/resolve?env={env}` pour obtenir le JSON fusionné. Le JSON est écrit dans `{WORKSPACE_DIR}/{job_id}/dataset.json`.

**4. Execute** — Le runner exécute `npx playwright test` avec les options configurées. Le chemin du dataset est passé via `DATASET_PATH`. Le timeout global est de 5 minutes.

**5. Collect** — Le module `artifactCollector` scanne `{ARTIFACTS_DIR}/` et filtre les fichiers selon la politique d'upload (`artifact_upload_policy`).

**6. Upload** — Chaque artefact est uploadé vers MinIO via le SDK AWS S3. Un checksum SHA-256 est calculé et stocké en metadata S3.

**7. Complete** — Le runner envoie `POST /api/v1/jobs/{id}/complete` avec le statut final (DONE/FAILED), les métriques Playwright et le manifest des artefacts.

**8. Heartbeat** — Pendant l'exécution (étapes 4-6), le runner envoie un heartbeat toutes les 15 secondes via `POST /api/v1/jobs/{id}/heartbeat`.

---

## MinIO / S3

### Docker Compose de référence

Le fichier `docker-compose.runner.yml` à la racine du projet définit le stack complet :

| Service | Image | Ports | Rôle |
|---------|-------|-------|------|
| `minio` | `minio/minio:latest` | `9000` (S3), `9001` (Console) | Stockage objet S3-compatible |
| `minio-init` | `minio/mc:latest` | — | Création automatique du bucket |
| `orchestration` | `node:20-slim` | `4000` | API Orchestration (stub pour dev local) |
| `runner` | `agilestest-runner-agent` | — | Exécution Playwright |

### Démarrage

```bash
docker-compose -f docker-compose.runner.yml up -d
```

### Console MinIO

La console d'administration MinIO est accessible sur `http://localhost:9001` avec les identifiants `minioadmin / minioadmin`. Elle permet de naviguer dans les buckets, visualiser les objets et gérer les politiques d'accès.

### Bucket et conventions de chemins

| Propriété | Valeur |
|-----------|--------|
| Bucket | `agilestest-artifacts` |
| Accès | Download public (anonymous read) |
| Création | Automatique via `minio-init` |

Convention de chemin S3 :

```
/{project_id}/{execution_id}/{artifact_type}/{filename}
```

Exemples :

```
/proj_abc123/exec_def456/screenshot/failure_step2.png
/proj_abc123/exec_def456/trace/trace.zip
/proj_abc123/exec_def456/log/playwright-stderr.log
```

### Rotation et purge des artefacts

La rotation automatique des artefacts n'est **pas encore implémentée**. En attendant, la purge manuelle peut être effectuée via la console MinIO ou la CLI `mc` :

```bash
# Supprimer les artefacts de plus de 30 jours
mc find local/agilestest-artifacts --older-than 30d --exec "mc rm {}"
```

> **Placeholder** : Une politique de rétention configurable (lifecycle rules) sera ajoutée dans une future version.

---

## Bundle Resolve

### Endpoint

```
POST /api/v1/dataset-bundles/{bundle_id}/resolve
Body: { "env": "DEV" }
```

### Réponse

```json
{
  "data": {
    "bundle_id": "bundle_abc123",
    "env": "DEV",
    "merged_json": {
      "user_credentials": { "email": "test@example.com", "password": "{{SECRET:user_password}}" },
      "payment_card": { "number": "4111111111111111", "cvv": "{{SECRET:card_cvv}}" }
    },
    "secrets_placeholder_keys": ["user_password", "card_cvv"],
    "resolved_at": "2026-02-18T10:00:00Z"
  }
}
```

### Politique de secrets

Les secrets ne sont **jamais** transmis en clair dans le JSON résolu. Ils sont remplacés par des placeholders au format `{{SECRET:key_name}}`. Le Runner Agent injecte les valeurs réelles via des variables d'environnement au moment de l'exécution.

En mode **local** (localStorage), le resolve fusionne les instances du bundle et remplace les secrets par des placeholders. En mode **api**, le Repository API effectue la même opération côté serveur.

---

## Gestion des utilisateurs et invitations

### Onboarding par invitation

Le processus d'onboarding des utilisateurs suit un flux d'invitation contrôlé :

1. **L'administrateur crée une invitation** depuis **Administration → Utilisateurs → Inviter**
2. L'invitation contient : email, rôle global assigné, date d'expiration (7 jours par défaut)
3. Un lien d'activation est généré (simulé en MVP, email réel en production)
4. L'utilisateur clique sur le lien et complète son profil
5. Le statut passe de **INVITED** à **ACTIVE**

### Gestion des invitations

| Action | Description | Rôle requis |
|--------|-------------|-------------|
| **Inviter** | Créer une nouvelle invitation | ADMIN |
| **Renvoyer** | Régénérer le lien d'activation (reset expiration) | ADMIN |
| **Révoquer** | Annuler une invitation en attente | ADMIN |
| **Voir la liste** | Consulter toutes les invitations (drawer) | ADMIN |

### Expiration des invitations

Les invitations expirent après **7 jours** par défaut. Une invitation expirée ne peut plus être utilisée. L'administrateur peut :

- **Renvoyer** l'invitation pour réinitialiser le délai
- **Révoquer** l'invitation et en créer une nouvelle

> **Bonne pratique** : Vérifiez régulièrement les invitations en attente depuis le drawer "Invitations" et relancez ou révoquez celles qui sont expirées.

### Révocation d'accès

Pour retirer l'accès à un utilisateur :

1. **Désactiver le compte** : depuis **Administration → Utilisateurs**, cliquez sur "Désactiver". L'utilisateur ne peut plus se connecter mais son historique est conservé.
2. **Retirer d'un projet** : depuis **Administration → Accès Projets**, supprimez la membership. L'utilisateur perd l'accès au projet spécifique.
3. **Rétrograder le rôle** : changez le rôle global de MANAGER à VIEWER pour limiter les permissions.

### Audit et traçabilité

Toutes les actions d'administration sont tracées dans le **Journal d'audit** (`/admin/audit`). Chaque entrée contient :

| Champ | Description |
|-------|-------------|
| `actor` | Email de l'administrateur qui a effectué l'action |
| `action` | Type d'action (create, update, delete, disable, enable, invite, revoke, resend, reset_password) |
| `entity_type` | Type d'entité concernée (user, role, invite, access) |
| `entity_id` | Identifiant de l'entité |
| `metadata` | Détails supplémentaires en JSON |
| `timestamp` | Horodatage ISO 8601 |

### Export de l'audit

L'audit est exportable en deux formats depuis la page `/admin/audit` :

- **CSV** : pour import dans Excel, Google Sheets ou un SIEM
- **JSON** : pour intégration programmatique ou archivage

Les filtres actifs (action, entité, période, acteur) sont appliqués à l'export. Pour exporter l'intégralité, réinitialisez les filtres avant l'export.

> **Conformité** : Conservez les exports d'audit pendant au moins 12 mois pour répondre aux exigences de traçabilité des accès.

---

## Diagnostics

### Lecture du trace_id

Chaque exécution possède un identifiant unique (`execution_id`) qui sert de trace_id. Cet identifiant est affiché dans le détail d'exécution et dans les chemins S3 des artefacts. Il permet de corréler les logs, screenshots et traces d'une même exécution.

### Checksum mismatch

Si un artefact téléchargé ne correspond pas au checksum SHA-256 affiché dans l'UI, cela indique une corruption lors du transfert ou du stockage. Actions recommandées :

1. Vérifier la connectivité réseau vers MinIO
2. Re-télécharger l'artefact
3. Comparer le checksum local avec celui affiché : `sha256sum fichier.png`
4. Si le problème persiste, vérifier l'intégrité du bucket MinIO

### Job bloqué (stuck)

Un job peut rester en statut RUNNING si le runner a crashé sans envoyer le `complete`. Indicateurs :

- Le heartbeat n'est plus reçu (timeout configurable côté Orchestration)
- Le job est en RUNNING depuis plus de 10 minutes (timeout par défaut)

Actions recommandées :

1. Vérifier les logs du conteneur runner : `docker logs agilestest-runner`
2. Vérifier la connectivité vers l'Orchestration API
3. Redémarrer le runner : `docker restart agilestest-runner`
4. Si le job reste bloqué, le marquer manuellement comme FAILED via l'API

> **Note** : Le mécanisme de timeout automatique des jobs est un **placeholder** — il sera implémenté dans une future version de l'Orchestration API.
