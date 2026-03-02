# DRIVE_RUNNER.md — Exécution de campagnes Drive Test

## Vue d'ensemble

Le module Drive Runner permet l'exécution réelle de campagnes Drive Test depuis l'interface AgilesTest. Il orchestre la création de jobs, l'exécution de commandes réseau (iperf3, ping, tcpdump), la collecte d'artefacts et l'ingestion automatique des KPI dans le système de reporting.

## Architecture

```
DriveCampaignsPage          DriveReportingPage
       │                           ▲
       ▼                           │
  localDriveJobs.create()    localKpiSamples.list()
       │                    localDriveRunSummaries.get()
       ▼                           ▲
  Simulation locale         Ingestion KPI
  (ou Runner Agent)         (auto ou import manuel)
       │                           │
       ▼                           │
  localKpiSamples.bulkInsert() ────┘
  localDriveRunSummaries.computeAndStore()
```

## Modèle DriveJob

| Champ | Type | Description |
|-------|------|-------------|
| `drive_job_id` | string | Identifiant unique du job |
| `campaign_id` | string | Campagne parente |
| `route_id` | string | Route à parcourir |
| `device_id` | string | Équipement de test |
| `target_env` | TargetEnv | Environnement cible |
| `status` | DriveJobStatus | PENDING → RUNNING → DONE/FAILED |
| `progress_pct` | number | Progression 0-100 |
| `artifacts_manifest` | DriveArtifactEntry[] | Artefacts MinIO |
| `started_at` / `finished_at` | string | Timestamps |
| `error_message` | string? | Message d'erreur si FAILED |

### Statuts du job

```
PENDING → RUNNING → DONE
                  → FAILED
```

## Modèle KpiSample

Chaque mesure KPI est stockée comme un `KpiSample` :

| Champ | Type | Description |
|-------|------|-------------|
| `sample_id` | string | Identifiant unique |
| `drive_job_id` | string | Job parent |
| `campaign_id` | string | Campagne |
| `route_id` | string | Route |
| `timestamp` | string (ISO) | Horodatage |
| `lat` / `lon` | number | Coordonnées GPS |
| `kpi_name` | DriveKpi | RSRP, SINR, THROUGHPUT_DL, etc. |
| `value` | number | Valeur mesurée |
| `unit` | string | Unité (dBm, dB, Mbps, ms, %) |
| `cell_id` | string? | Identifiant cellule |
| `technology` | NetworkType? | 4G, 5G_NSA, etc. |

### KPIs supportés

- **RSRP** (dBm) — Puissance signal reçu
- **RSRQ** (dB) — Qualité signal reçu
- **SINR** (dB) — Rapport signal/bruit
- **THROUGHPUT_DL** (Mbps) — Débit descendant
- **THROUGHPUT_UL** (Mbps) — Débit montant
- **LATENCY** (ms) — Latence RTT
- **JITTER** (ms) — Variation de latence
- **PACKET_LOSS** (%) — Taux de perte
- **HANDOVER_SUCCESS** (%) — Taux de succès handover
- **ATTACH_TIME** (ms) — Temps d'attachement
- **CSFB_TIME** (ms) — Temps CS Fallback

## Flow d'exécution

### 1. Lancement depuis l'UI

1. Ouvrir **Drive Test → Campagnes**
2. Sélectionner une campagne avec statut READY
3. Cliquer **Lancer l'exécution**
4. Sélectionner route, équipement, environnement
5. Confirmer → Job créé en PENDING

### 2. Exécution (simulation locale)

En mode local, l'exécution est simulée :
- Progression de 0% à 100% en 5 secondes
- Génération de KPI samples aléatoires réalistes
- Calcul automatique du summary avec violations de seuils
- Génération d'artefacts simulés (kpi_series.json, geo.geojson, etc.)

### 3. Exécution (Runner Agent Docker)

En mode production avec le Runner Agent :
1. Le Runner poll `GET /jobs/next?runner_id=...`
2. Télécharge le drive package
3. Exécute les commandes (iperf3, ping, tcpdump)
4. Collecte les résultats
5. Upload vers MinIO
6. POST complete avec manifest

### 4. Ingestion et Reporting

Après exécution :
- Les KPI samples sont stockés dans `localKpiSamples`
- Le summary est calculé via `localDriveRunSummaries.computeAndStore()`
- La page **Reporting** affiche les données réelles automatiquement
- Le badge "Données réelles" / "Données simulées" indique la source

## Seuils par défaut

| KPI | Seuil | Direction |
|-----|-------|-----------|
| RSRP | -100 dBm | ≥ (plus haut = mieux) |
| SINR | 5 dB | ≥ |
| THROUGHPUT_DL | 20 Mbps | ≥ |
| THROUGHPUT_UL | 5 Mbps | ≥ |
| LATENCY | 50 ms | ≤ (plus bas = mieux) |
| JITTER | 20 ms | ≤ |
| PACKET_LOSS | 1% | ≤ |
| HANDOVER_SUCCESS | 95% | ≥ |

## Runner Agent Docker (mode DRIVE)

Le Runner Agent supporte un mode `drive-run` :

```bash
docker run --rm \
  -e ORCHESTRATION_URL=http://orchestration:3001 \
  -e RUNNER_ID=runner-drive-01 \
  -e MINIO_ENDPOINT=minio:9000 \
  -e MINIO_BUCKET=agilestest-artifacts \
  agilestest/runner-agent:latest
```

Le module `driveRunner.ts` :
1. Télécharge le drive package (runbook + commands)
2. Exécute les commandes réseau
3. Parse les résultats (CSV, JSON, iperf3)
4. Collecte les artefacts
5. Upload vers MinIO avec SHA-256
6. Retourne le manifest

## API localStore

```typescript
// Créer un job
localDriveJobs.create({ campaign_id, route_id, device_id, target_env })

// Lister les jobs
localDriveJobs.list({ campaign_id, status, limit })

// Mettre à jour le statut
localDriveJobs.updateStatus(id, status, { progress_pct, artifacts_manifest })

// Simuler une exécution complète
localDriveJobs.simulateExecution(id)

// Lister les KPI samples
localKpiSamples.list({ drive_job_id, campaign_id, kpi_name })

// Insérer en masse
localKpiSamples.bulkInsert(samples)

// Calculer et stocker le summary
localDriveRunSummaries.computeAndStore(jobId, campaignId, thresholds)
```

## Artefacts MinIO

Convention de chemin :
```
/{campaign_id}/{drive_job_id}/{artifact_type}/{filename}
```

Types d'artefacts :
- `kpi_series` — kpi_series.json ou kpi_series.csv
- `geo` — geo.geojson ou track.gpx
- `device_logs` — device_logs.zip
- `pcap` — capture.pcapng (si activé)
- `summary` — summary.json

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `client/src/types/index.ts` | Types DriveJob, KpiSample, DriveRunSummary |
| `client/src/api/localStore.ts` | CRUD localDriveJobs, localKpiSamples, localDriveRunSummaries |
| `client/src/pages/DriveCampaignsPage.tsx` | Bouton Run + suivi jobs |
| `client/src/pages/DriveReportingPage.tsx` | Rapport KPI réel/simulé |
| `client/src/components/ImportResultsModal.tsx` | Import manuel résultats |
| `client/src/ai/kpiParsers.ts` | Parsers CSV/JSON/GPX/GeoJSON/iperf3 |
| `runner-agent/src/driveRunner.ts` | Runner mode DRIVE |
