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

## Pages migrées (surveillées)

| Page | Routeur tRPC | Statut |
|------|-------------|--------|
| `ProfilesPage.tsx` | `trpc.profiles.*` | Migré |
| `DatasetTypesPage.tsx` | `trpc.datasetTypes.*` | Migré |
| `DatasetsPage.tsx` | `trpc.datasetTypes.*` + `trpc.datasetInstances.*` | Migré |
| `DriveCampaignsPage.tsx` | `trpc.driveCampaigns.*` + `trpc.driveRoutes.*` + `trpc.driveDevices.*` + `trpc.driveProbeLinks.*` + `trpc.driveJobs.*` | Migré (sauf `localCapturePolicies` — exception documentée) |
| `ProjectsPage.tsx` | `trpc.projects.*` | Migré |
| `ProbesPage.tsx` | `trpc.probes.*` | Migré |
| `ExecutionsPage.tsx` | `trpc.executions.*` | Migré |
| `CapturesPage.tsx` | `trpc.captures.*` | Migré |
| `BundlesPage.tsx` | `trpc.bundles.*` | Migré |

## Pages non encore migrées

| Page | Dépendances localStorage | Priorité |
|------|--------------------------|----------|
| `ScenariosPage.tsx` | `localScenarios`, `localDatasetTypes`, `localCapturePolicies` | Haute |
| `AdminProjectAccessPage.tsx` | `localStore` | Moyenne |
| `ProjectSettingsPage.tsx` | `localStore` | Moyenne |
| `DriveIncidentReportPage.tsx` | `localStore` | Basse |
| `DriveReportingPage.tsx` | `localStore` | Basse |

## Comment ajouter une page migrée

1. Migrer la page vers tRPC (supprimer les imports `localStore`/`repositoryApi`)
2. Ajouter le fichier dans la liste `files` de `eslint.config.js`
3. Vérifier avec `pnpm lint`

## Exceptions temporaires

Si une page migrée a encore besoin d'un import `localStore` pour une fonctionnalité non encore migrée (ex: `localCapturePolicies`), utiliser un commentaire d'exception documenté :

```ts
// eslint-disable-next-line no-restricted-imports -- TODO: migrer capturePolicies vers tRPC/DB
import { localCapturePolicies } from '@/api/localStore';
```
