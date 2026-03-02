# DATASET_STORAGE.md — Architecture de stockage des datasets

## Vue d'ensemble

Le module Dataset d'AgilesTest supporte deux modes de persistance, sélectionnables via une variable d'environnement. L'architecture repose sur un **DatasetStorageAdapter** qui abstrait la source de données, permettant aux pages UI de fonctionner de manière identique quel que soit le mode choisi.

| Mode | Variable d'environnement | Source | Cas d'usage |
|------|--------------------------|--------|-------------|
| `local` (défaut) | `VITE_DATASET_STORAGE_MODE=local` | `localStorage` du navigateur | Démo, développement offline, POC |
| `api` | `VITE_DATASET_STORAGE_MODE=api` | Repository API (`/api/v1/repository/...`) | Production, multi-utilisateurs, persistance serveur |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│                   Pages UI                    │
│  DatasetsPage · BundlesPage · ScenarioSection │
└────────────────────┬─────────────────────────┘
                     │ useDatasetStorage()
                     ▼
┌──────────────────────────────────────────────┐
│          DatasetStorageContext (React)         │
│          fournit: adapter + mode              │
└────────────────────┬─────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────┐       ┌───────────────┐
│  LocalAdapter │       │   ApiAdapter  │
│  (localStorage│       │ (repositoryApi│
│   wrappers)   │       │  + fallback)  │
└───────────────┘       └───────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             API disponible?          Fallback local
             → HTTP calls             → localStorage
```

---

## Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `client/src/api/datasetStorageAdapter.ts` | Interface `DatasetStorageAdapter`, `LocalAdapter`, `ApiAdapter`, factory `createAdapter()` |
| `client/src/contexts/DatasetStorageContext.tsx` | React Context fournissant l'adapter à toute l'app |
| `client/src/hooks/useDatasetMutations.ts` | Hooks de mutation centralisés avec cache invalidation |
| `client/src/api/repositoryApi.ts` | Endpoints API (sections DATASET-1B) avec `withFallback` |
| `client/src/api/localStore.ts` | CRUD localStorage (sections dataset instances, bundles, items, secrets, validation) |

---

## Interface DatasetStorageAdapter

L'adapter expose 5 sous-modules, chacun avec des opérations CRUD :

```typescript
interface DatasetStorageAdapter {
  instances: {
    list(projectId, params?) → PaginatedResponse<DatasetInstance>
    get(id) → DatasetInstance
    create(projectId, data) → DatasetInstance
    update(id, data) → DatasetInstance
    clone(id) → DatasetInstance
    delete(id) → void
  }
  secrets: {
    list(datasetId) → DatasetSecretKey[]
    set(datasetId, keyPath, isSecret) → DatasetSecretKey
    remove(datasetId, keyPath) → void
    maskValues(datasetId, values) → Record<string, unknown>
  }
  bundles: {
    list(projectId, params?) → PaginatedResponse<DatasetBundle>
    get(id) → DatasetBundle
    create(projectId, data) → DatasetBundle
    update(id, data) → DatasetBundle
    clone(id) → DatasetBundle
    delete(id) → void
  }
  bundleItems: {
    list(bundleId) → BundleItem[]
    add(bundleId, datasetId) → BundleItem
    remove(bundleId, datasetId) → void
  }
  validation: {
    validateBundleForScenario(bundleId, scenarioId) → BundleValidationResult
    validateScenarioDatasets(scenarioId, env) → ScenarioDatasetValidation
  }
}
```

---

## Configuration

### Mode local (défaut)

Aucune configuration nécessaire. Le mode `local` est activé automatiquement si `VITE_DATASET_STORAGE_MODE` n'est pas défini ou vaut `local`.

```env
# .env (optionnel, c'est le défaut)
VITE_DATASET_STORAGE_MODE=local
```

### Mode API

Nécessite un backend Repository API fonctionnel avec les endpoints dataset-instances, dataset-bundles, etc.

```env
VITE_DATASET_STORAGE_MODE=api
VITE_API_BASE_URL=https://api.agilestest.example.com
```

---

## Endpoints API attendus (backend)

Lorsque le mode `api` est actif, l'ApiAdapter appelle les endpoints suivants via `repositoryApi`. Si l'API échoue, le fallback local est utilisé automatiquement (même mécanisme `withFallback` que le reste de l'app).

### Dataset Instances

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/repository/projects/:projectId/dataset-instances` | Liste avec filtres `env`, `dataset_type_id`, `status` |
| GET | `/api/v1/repository/dataset-instances/:id` | Détail d'une instance |
| POST | `/api/v1/repository/projects/:projectId/dataset-instances` | Création |
| PATCH | `/api/v1/repository/dataset-instances/:id` | Mise à jour partielle |
| POST | `/api/v1/repository/dataset-instances/:id/clone` | Clone (nouvelle version) |
| DELETE | `/api/v1/repository/dataset-instances/:id` | Suppression |

### Dataset Secrets

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/repository/dataset-instances/:id/secrets` | Liste des clés secrètes |
| PUT | `/api/v1/repository/dataset-instances/:id/secrets` | Définir/modifier un secret |
| DELETE | `/api/v1/repository/dataset-instances/:id/secrets/:keyPath` | Retirer un marquage secret |
| POST | `/api/v1/repository/dataset-instances/:id/mask-values` | Masquer les valeurs secrètes |

### Dataset Bundles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/repository/projects/:projectId/dataset-bundles` | Liste avec filtres `env`, `status` |
| GET | `/api/v1/repository/dataset-bundles/:id` | Détail d'un bundle |
| POST | `/api/v1/repository/projects/:projectId/dataset-bundles` | Création |
| PATCH | `/api/v1/repository/dataset-bundles/:id` | Mise à jour partielle |
| POST | `/api/v1/repository/dataset-bundles/:id/clone` | Clone |
| DELETE | `/api/v1/repository/dataset-bundles/:id` | Suppression |

### Bundle Items

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/repository/dataset-bundles/:bundleId/items` | Liste des datasets du bundle |
| POST | `/api/v1/repository/dataset-bundles/:bundleId/items` | Ajouter un dataset |
| DELETE | `/api/v1/repository/dataset-bundles/:bundleId/items/:datasetId` | Retirer un dataset |

### Validation

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/v1/repository/dataset-bundles/:id/validate-for-scenario` | Valider un bundle pour un scénario |
| POST | `/api/v1/repository/scenarios/:id/validate-datasets` | Valider la couverture datasets d'un scénario par env |

---

## Cache invalidation

Les mutations utilisent TanStack Query avec invalidation automatique des query keys suivantes :

| Query Key | Invalidé par |
|-----------|-------------|
| `dataset_instances` | Create, update, clone, delete instance |
| `dataset_bundles` | Create, update, clone, delete bundle |
| `bundle_items` | Add, remove bundle item |
| `dataset_secrets` | Set, remove secret |
| `scenario_dataset_validation` | Toute mutation affectant instances, bundles ou items |

Le hook `useDatasetMutations.ts` centralise ces patterns pour éviter les oublis d'invalidation.

---

## RBAC (à implémenter côté backend)

| Rôle | Permissions |
|------|------------|
| `viewer` | Lecture seule (list, get, validate) |
| `manager` | Lecture + écriture (create, update, clone) |
| `admin` | Toutes permissions (y compris delete, override status) |

Côté frontend, le flag `canWrite` de `useAuth()` contrôle déjà la visibilité des boutons d'écriture.

---

## Migrations DB (à implémenter côté backend)

Tables attendues pour le mode `api` :

```sql
CREATE TABLE dataset_instances (
  dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  dataset_type_id VARCHAR(100) NOT NULL,
  env VARCHAR(20) NOT NULL CHECK (env IN ('DEV','PREPROD','PILOT_ORANGE','PROD')),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
  values_json JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES dataset_instances(dataset_id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dataset_secret_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES dataset_instances(dataset_id) ON DELETE CASCADE,
  key_path VARCHAR(255) NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dataset_id, key_path)
);

CREATE TABLE dataset_bundles (
  bundle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  name VARCHAR(200) NOT NULL,
  env VARCHAR(20) NOT NULL CHECK (env IN ('DEV','PREPROD','PILOT_ORANGE','PROD')),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
  version INTEGER NOT NULL DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dataset_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES dataset_bundles(bundle_id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES dataset_instances(dataset_id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bundle_id, dataset_id)
);
```

---

## Test smoke (manuel)

1. Ouvrir la page Datasets → créer un dataset instance (type + env)
2. Éditer les valeurs JSON, marquer un champ comme secret, sauvegarder
3. Aller sur Bundles → créer un bundle, ajouter le dataset
4. Valider le bundle avec un scénario
5. Rafraîchir la page → vérifier que les données persistent
6. Vérifier le badge `mode: local` ou `mode: api` dans le header des pages
