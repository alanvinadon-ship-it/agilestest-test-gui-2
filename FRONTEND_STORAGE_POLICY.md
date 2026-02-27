# Frontend Storage Policy

## Règle générale

Toutes les pages migrées vers tRPC/DB **doivent** utiliser les hooks `trpc.*` pour la persistance des données. L'import de `localStore` ou `repositoryApi` est **interdit** dans ces pages.

## Gate ESLint

Une règle `no-restricted-imports` est configurée dans `eslint.config.js` pour bloquer automatiquement les imports interdits dans les pages migrées.

```bash
# Vérifier la conformité
pnpm lint

# Le script échoue si un import interdit est détecté
```

## Pages migrées (gate ESLint active) — 10 pages

| Page | Routeur(s) tRPC | Cursor pagination |
|------|----------------|:-----------------:|
| `ProfilesPage.tsx` | `trpc.profiles.*` | Charger plus |
| `DatasetTypesPage.tsx` | `trpc.datasetTypes.*` | — |
| `DatasetsPage.tsx` | `trpc.datasetTypes.*` + `trpc.datasetInstances.*` | — |
| `DriveCampaignsPage.tsx` | `trpc.driveCampaigns.*` + `trpc.driveRoutes.*` + `trpc.driveDevices.*` + `trpc.driveProbeLinks.*` + `trpc.driveJobs.*` + `trpc.capturePolicies.*` | Charger plus |
| `ScenariosPage.tsx` | `trpc.scenarios.*` + `trpc.capturePolicies.*` | Charger plus |
| `ProjectsPage.tsx` | `trpc.projects.*` | — |
| `ProbesPage.tsx` | `trpc.probes.*` | — |
| `ExecutionsPage.tsx` | `trpc.executions.*` | Charger plus |
| `CapturesPage.tsx` | `trpc.captures.*` | Charger plus |
| `BundlesPage.tsx` | `trpc.bundles.*` | — |

## Pages non encore migrées (exclues de la gate) — 4 pages

| Page | Dépendances localStorage | Priorité |
|------|--------------------------|----------|
| `AdminProjectAccessPage.tsx` | `localProjects` | Moyenne |
| `ProjectSettingsPage.tsx` | `localCapturePolicies` | Moyenne |
| `DriveIncidentReportPage.tsx` | `localDriveRunSummaries`, `localDriveCampaigns` | Basse |
| `DriveReportingPage.tsx` | `localDriveRunSummaries`, `localDriveCampaigns` | Basse |

## Comment ajouter une page migrée

1. Migrer la page vers tRPC (supprimer les imports `localStore`/`repositoryApi`)
2. Ajouter le fichier dans la liste `files` de `eslint.config.js`
3. Vérifier avec `pnpm lint`

## Exceptions temporaires

Aucune exception active. Toutes les pages surveillées sont 100% tRPC.
