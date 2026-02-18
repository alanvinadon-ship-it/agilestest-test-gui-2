# RUNNER_AGENT — Remote Runner Agent Docker

## Vue d'ensemble

Le **Runner Agent** est un conteneur Docker autonome qui exécute les scripts de test Playwright générés par le module IA-SCRIPT. Il fonctionne en mode **pull** : il interroge périodiquement l'API Orchestration pour récupérer les jobs en attente, télécharge le script package, résout le bundle de datasets, exécute Playwright, collecte les artefacts et les uploade vers MinIO/S3.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Run Center (UI)                           │
│  Sélection Profile → Scenario → Script → Bundle → Env → Runner  │
│                           │                                      │
│                    POST /executions                               │
│                           ↓                                      │
│              ┌────────────────────────┐                           │
│              │   Orchestration API    │                           │
│              │  (Job Queue Manager)   │                           │
│              └────────┬───────────────┘                           │
│                       │ GET /jobs/next                            │
│                       ↓                                          │
│              ┌────────────────────────┐                           │
│              │    Runner Agent        │                           │
│              │  (Docker Container)    │                           │
│              │                        │                           │
│              │  1. Download script    │                           │
│              │  2. Resolve dataset    │                           │
│              │  3. Run Playwright     │                           │
│              │  4. Collect artifacts  │                           │
│              │  5. Upload to MinIO    │                           │
│              │  6. POST /complete     │                           │
│              └────────┬───────────────┘                           │
│                       │                                          │
│                       ↓                                          │
│              ┌────────────────────────┐                           │
│              │     MinIO / S3         │                           │
│              │  agilestest-artifacts  │                           │
│              └────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Image Docker

Le Runner Agent utilise l'image officielle **Playwright** comme base, qui inclut Node.js et tous les navigateurs (Chromium, Firefox, WebKit).

| Propriété | Valeur |
|-----------|--------|
| Base image | `mcr.microsoft.com/playwright:v1.42.1-jammy` |
| Runtime | Node.js 20 |
| Navigateurs | Chromium, Firefox, WebKit (pré-installés) |
| Workspace | `/workspace` (scripts téléchargés) |
| Artifacts | `/artifacts` (artefacts collectés) |

### Build

```bash
cd runner-agent
docker build -t agilestest-runner-agent .
```

---

## Configuration

| Variable | Défaut | Description |
|----------|--------|-------------|
| `RUNNER_ID` | `runner-docker-01` | Identifiant unique du runner |
| `ORCHESTRATION_URL` | `http://orchestration:4000` | URL de l'API Orchestration |
| `POLL_INTERVAL_MS` | `5000` | Intervalle de polling en ms |
| `MINIO_ENDPOINT` | `minio` | Hostname du serveur MinIO |
| `MINIO_PORT` | `9000` | Port S3 de MinIO |
| `MINIO_ACCESS_KEY` | `minioadmin` | Clé d'accès MinIO |
| `MINIO_SECRET_KEY` | `minioadmin` | Clé secrète MinIO |
| `MINIO_BUCKET` | `agilestest-artifacts` | Nom du bucket |
| `MINIO_USE_SSL` | `false` | Utiliser HTTPS pour MinIO |
| `WORKSPACE_DIR` | `/workspace` | Répertoire de travail |
| `ARTIFACTS_DIR` | `/artifacts` | Répertoire des artefacts |

---

## Flow d'exécution

Le Runner Agent suit un cycle de vie précis pour chaque job :

**Étape 1 — Poll** : Le runner interroge `GET /api/v1/jobs/next?runner_id=...` toutes les 5 secondes. Si un job PENDING est disponible, l'Orchestration le verrouille (status → RUNNING) et le retourne.

**Étape 2 — Download** : Le script package est téléchargé depuis `download_url` (ZIP) ou récupéré fichier par fichier via l'API. Les fichiers sont extraits dans `/workspace/{job_id}/`.

**Étape 3 — Dataset** : Si un `dataset_bundle_id` est spécifié, le runner appelle `POST /api/v1/dataset-bundles/{id}/resolve` pour obtenir le JSON fusionné. Les secrets sont remplacés par des placeholders `{{SECRET:key}}` et injectés via variables d'environnement.

**Étape 4 — Playwright** : Le runner exécute `npx playwright test` avec la configuration appropriée. Le `dataset.json` résolu est écrit dans le workspace et accessible via `process.env.DATASET_PATH`. Le timeout est fixé à 5 minutes.

**Étape 5 — Collect** : Le module `artifactCollector` scanne le répertoire d'artefacts et filtre selon la politique d'upload (screenshot, trace, video, log, har).

**Étape 6 — Upload** : Chaque artefact est uploadé vers MinIO via le SDK AWS S3. Le chemin suit la convention `/{project_id}/{execution_id}/{type}/{filename}`. Un checksum SHA-256 est calculé et stocké en metadata.

**Étape 7 — Complete** : Le runner envoie `POST /api/v1/jobs/{id}/complete` avec le status (DONE/FAILED), les métriques Playwright, et le manifest des artefacts uploadés.

---

## Heartbeat

Pendant l'exécution, le runner envoie un heartbeat toutes les 15 secondes via `POST /api/v1/jobs/{id}/heartbeat`. Cela permet à l'Orchestration de détecter les runners morts et de réassigner les jobs.

---

## Modules

| Module | Fichier | Responsabilité |
|--------|---------|----------------|
| Agent | `src/agent.ts` | Boucle principale, orchestration du flow |
| S3 Uploader | `src/s3Uploader.ts` | Upload vers MinIO/S3 avec checksum |
| Artifact Collector | `src/artifactCollector.ts` | Scan et classification des artefacts |

---

## Scaling

Pour exécuter plusieurs runners en parallèle :

```bash
docker-compose -f docker-compose.runner.yml up -d --scale runner=3
```

Chaque instance reçoit un `RUNNER_ID` unique. L'Orchestration distribue les jobs en mode FIFO avec verrouillage atomique.
