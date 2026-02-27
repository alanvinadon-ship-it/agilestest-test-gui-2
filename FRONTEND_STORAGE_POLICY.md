# Frontend Storage Policy — AgilesTest

## Statut : ✅ ZÉRO localStorage pour données métier

**Date** : 27 février 2026

### Résumé

Le fichier `localStore.ts` a été **supprimé**. Le fichier `repositoryApi.ts` a été **supprimé**.
Toutes les données métier (projets, profils, scénarios, datasets, bundles, campagnes, routes, devices, probes, jobs, captures, exécutions, KPI, incidents, rapports, capture policies) transitent désormais par **tRPC/DB**.

### Gate ESLint

```bash
pnpm lint   # ESLint global — bloque tout import de localStore ou repositoryApi
```

La gate couvre **tous les fichiers** `client/src/**/*.{ts,tsx}`.

### Fichiers supprimés

| Fichier | Raison |
|---------|--------|
| `client/src/api/localStore.ts` | Remplacé par tRPC hooks |
| `client/src/api/repositoryApi.ts` | Remplacé par tRPC hooks |
| `client/src/components/ImportResultsModal.tsx` | Code mort (0 importeurs) |

### Fichiers nettoyés (imports localStore retirés)

| Fichier | Avant | Après |
|---------|-------|-------|
| `collectorApi.ts` | Fallback localStorage | Stubs vides (backend API only) |
| `datasetStorageAdapter.ts` | LocalAdapter localStorage | Stub adapter (backend API only) |
| `scenarioSuggestionEngine.ts` | Appels directs localScenarios | Injection de dépendances (ScenarioStore) |
| `SuggestScenariosModal.tsx` | — | Passe ScenarioStore basé sur tRPC |
| `ScenarioDatasetSection.tsx` | localDatasetTypes | trpc.datasetTypes.list |
| `GeneratePromptModal.tsx` | localBundleItems (inutilisé) | Import supprimé |

### Pages migrées vers tRPC (14 pages)

| Page | Routeurs tRPC utilisés |
|------|----------------------|
| ProfilesPage | profiles.list/create/update/delete |
| ScenariosPage | scenarios.list/create/update/delete + capturePolicies |
| DatasetTypesPage | datasetTypes.list/create/update/delete |
| DatasetsPage | datasetTypes.list + datasetInstances.list/create/update/delete |
| BundlesPage | bundles.list/create/update/delete |
| DriveCampaignsPage | driveCampaigns + driveRoutes + driveDevices + driveProbeLinks + driveJobs + capturePolicies |
| ProjectsPage | projects.list/create/update/delete |
| ProbesPage | probes.list/create/update/delete |
| ExecutionsPage | executions.list |
| CapturesPage | captures.list |
| AdminProjectAccessPage | projects.list |
| ProjectSettingsPage | capturePolicies.getByScope/upsert/remove |
| DriveIncidentReportPage | projects + driveCampaigns + driveRoutes + driveJobs + kpiSamples |
| DriveReportingPage | driveCampaigns + driveRoutes + driveJobs + driveRunSummaries + kpiSamples |

### Cursor pagination "Charger plus" (8 pages)

| Page | pageSize | Pattern |
|------|----------|---------|
| ProfilesPage | 30 | cursor + accumulation + déduplication |
| ScenariosPage | 30 | cursor + accumulation + déduplication |
| DriveCampaignsPage | 30 | cursor + accumulation + déduplication |
| CapturesPage | 30 | cursor + accumulation + compteur total |
| ExecutionsPage | 30 | cursor + accumulation + compteur total |
| ProbesPage | 30 | cursor + accumulation + resetCursor |
| DatasetTypesPage | 50 | cursor + accumulation |
| BundlesPage | 30 | cursor + accumulation + resetCursor |

### Tables DB créées dans ce sprint

| Table | Routeur tRPC |
|-------|-------------|
| capture_policies | capturePolicies |
| kpi_samples | kpiSamples |
| drive_run_summaries | driveRunSummaries |

### Qualité

- **470 tests Vitest** passent (0 échecs)
- **0 erreur TypeScript** (tsc --noEmit --skipLibCheck)
- **0 erreur ESLint** (pnpm lint)
- **0 import localStore/repositoryApi** dans tout le code source
