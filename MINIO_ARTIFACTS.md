# MINIO_ARTIFACTS — Stockage d'artefacts MinIO/S3

## Vue d'ensemble

Les artefacts d'exécution (logs, screenshots, traces Playwright, vidéos, HAR) sont stockés dans **MinIO**, un serveur de stockage objet compatible S3. Cette architecture permet un stockage scalable, une rétention configurable, et un accès direct via URLs pré-signées.

---

## Bucket et convention de chemins

| Propriété | Valeur |
|-----------|--------|
| Bucket | `agilestest-artifacts` |
| Région | `us-east-1` (défaut MinIO) |
| Accès public | Download uniquement (anonymous read) |

### Convention de chemin S3

```
s3://agilestest-artifacts/{project_id}/{execution_id}/{artifact_type}/{filename}
```

| Segment | Description | Exemple |
|---------|-------------|---------|
| `project_id` | ID du projet AgilesTest | `proj_abc123` |
| `execution_id` | ID de l'exécution | `exec_def456` |
| `artifact_type` | Type en minuscules | `screenshot`, `trace`, `log`, `video`, `har` |
| `filename` | Nom du fichier original | `failure_step2.png` |

### Exemples de chemins complets

```
s3://agilestest-artifacts/proj_abc123/exec_def456/screenshot/failure_step2.png
s3://agilestest-artifacts/proj_abc123/exec_def456/trace/trace.zip
s3://agilestest-artifacts/proj_abc123/exec_def456/log/playwright-stderr.log
s3://agilestest-artifacts/proj_abc123/exec_def456/video/test-video.webm
```

---

## Types d'artefacts

| Type | Extensions | MIME | Usage |
|------|-----------|------|-------|
| `LOG` | `.log`, `.txt` | `text/plain` | Logs d'exécution, stderr Playwright |
| `SCREENSHOT` | `.png`, `.jpg`, `.webp` | `image/*` | Captures d'écran (échec ou systématique) |
| `VIDEO` | `.mp4`, `.webm` | `video/*` | Enregistrement vidéo de l'exécution |
| `TRACE` | `.zip` | `application/zip` | Trace Playwright (replay détaillé) |
| `HAR` | `.har` | `application/json` | HTTP Archive (requêtes réseau) |
| `OTHER` | `.json`, etc. | `application/octet-stream` | Résultats JSON, données custom |

---

## Artifact Manifest

Chaque job complété retourne un **artifact manifest** — un tableau JSON décrivant tous les artefacts uploadés :

```typescript
interface ArtifactManifestEntry {
  type: string;           // LOG, SCREENSHOT, TRACE, etc.
  filename: string;       // Nom du fichier
  s3_key: string;         // Chemin complet dans le bucket
  s3_uri: string;         // URI S3 complète (s3://bucket/key)
  size_bytes: number;     // Taille en octets
  mime_type: string;      // Type MIME
  checksum: string | null; // SHA-256 du fichier
  download_url: string;   // URL de téléchargement direct
}
```

---

## Upload Policy

La politique d'upload est configurable par job via `artifact_upload_policy`. Elle détermine quels types d'artefacts sont collectés et uploadés.

| Policy | Types uploadés |
|--------|---------------|
| `screenshot` | SCREENSHOT |
| `trace` | TRACE |
| `video` | VIDEO |
| `log` | LOG (toujours inclus) |
| `har` | HAR |

La policy par défaut est `['screenshot', 'trace', 'log']`. Les logs sont toujours inclus quel que soit la policy.

---

## Intégrité des données

Chaque artefact uploadé est accompagné d'un **checksum SHA-256** calculé côté runner avant l'upload. Ce checksum est stocké dans les metadata S3 et dans le manifest, permettant une vérification d'intégrité côté consommateur.

```typescript
// Calcul du checksum
const hash = crypto.createHash('sha256');
hash.update(fs.readFileSync(filePath));
const checksum = hash.digest('hex');
```

---

## Docker Compose

Le stack complet est défini dans `docker-compose.runner.yml` :

| Service | Image | Ports | Rôle |
|---------|-------|-------|------|
| `minio` | `minio/minio:latest` | `9000` (S3), `9001` (Console) | Stockage objet |
| `minio-init` | `minio/mc:latest` | — | Création du bucket |
| `orchestration` | `node:20-slim` | `4000` | API Orchestration (stub) |
| `runner` | `agilestest-runner-agent` | — | Exécution Playwright |

### Démarrage

```bash
docker-compose -f docker-compose.runner.yml up -d
```

### Console MinIO

Accessible sur `http://localhost:9001` avec les identifiants `minioadmin / minioadmin`.

---

## UI — Affichage des artefacts

La page **ExecutionDetailPage** affiche les artefacts avec :

- **Colonne Stockage** : indicateur `local` ou `MinIO/S3` avec le chemin S3 tronqué
- **Badge MinIO/S3** : affiché en haut de la section si au moins un artefact est stocké sur S3
- **Checksum** : affiché sous le nom de fichier (SHA-256 tronqué)
- **Preview** : bouton pour les screenshots (ouvre dans un nouvel onglet)
- **Download** : lien direct vers l'URL S3 ou locale

Le module **Repair from failure** consomme ces artefacts réels (logs, screenshots) pour alimenter le moteur IA de réparation.

---

## Orchestration Stub

Pour le développement local, un serveur Node.js minimal (`orchestration-stub/server.mjs`) expose les endpoints nécessaires au runner. En production, ces endpoints sont fournis par le vrai service Orchestration.

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/v1/executions` | POST | Crée une exécution + job PENDING |
| `/api/v1/jobs/next` | GET | Retourne le prochain job PENDING (lock) |
| `/api/v1/jobs/:id/heartbeat` | POST | Heartbeat du runner |
| `/api/v1/jobs/:id/complete` | POST | Complète un job (status + metrics + manifest) |
| `/api/v1/dataset-bundles/:id/resolve` | POST | Résout un bundle en JSON fusionné |
