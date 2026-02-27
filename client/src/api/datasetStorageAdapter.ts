/**
 * DatasetStorageAdapter — Couche d'abstraction pour le stockage des Dataset Instances,
 * Bundles, BundleItems, SecretKeys et Validation.
 *
 * NOTE: L'implémentation LocalAdapter a été supprimée (localStore.ts supprimé).
 * Seul l'ApiAdapter est désormais disponible. Les fallback retournent des données vides.
 */

import apiClient from './client';
import type {
  DatasetInstance, TargetEnv, DatasetInstanceStatus,
  DatasetBundle, BundleStatus, BundleItem, DatasetSecretKey,
  BundleValidationResult, ScenarioDatasetValidation,
  PaginatedResponse,
} from '../types';

// ─── Interface ────────────────────────────────────────────────────────────

export interface DatasetInstancesAdapter {
  list(projectId: string, params?: {
    env?: TargetEnv; dataset_type_id?: string; status?: DatasetInstanceStatus;
    page?: number; limit?: number;
  }): Promise<PaginatedResponse<DatasetInstance>>;
  get(id: string): Promise<DatasetInstance>;
  create(projectId: string, data: {
    dataset_type_id: string; env: TargetEnv; values_json?: Record<string, unknown>; notes?: string;
  }): Promise<DatasetInstance>;
  update(id: string, data: Partial<Pick<DatasetInstance, 'values_json' | 'status' | 'notes'>>): Promise<DatasetInstance>;
  clone(id: string): Promise<DatasetInstance>;
  delete(id: string): Promise<void>;
}

export interface DatasetSecretsAdapter {
  list(datasetId: string): Promise<DatasetSecretKey[]>;
  set(datasetId: string, keyPath: string, isSecret: boolean): Promise<DatasetSecretKey>;
  remove(datasetId: string, keyPath: string): Promise<void>;
  maskValues(datasetId: string, valuesJson: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export interface BundlesAdapter {
  list(projectId: string, params?: {
    env?: TargetEnv; status?: BundleStatus; page?: number; limit?: number;
  }): Promise<PaginatedResponse<DatasetBundle>>;
  get(id: string): Promise<DatasetBundle>;
  create(projectId: string, data: {
    name: string; env: TargetEnv; tags?: string[];
  }): Promise<DatasetBundle>;
  update(id: string, data: Partial<Pick<DatasetBundle, 'name' | 'status' | 'tags'>>): Promise<DatasetBundle>;
  clone(id: string): Promise<DatasetBundle>;
  delete(id: string): Promise<void>;
}

export interface BundleItemsAdapter {
  list(bundleId: string): Promise<BundleItem[]>;
  add(bundleId: string, datasetId: string): Promise<BundleItem>;
  remove(bundleId: string, datasetId: string): Promise<void>;
}

export interface ValidationAdapter {
  validateBundleForScenario(bundleId: string, scenarioId: string): Promise<BundleValidationResult>;
  validateScenarioDatasets(scenarioId: string, env: TargetEnv): Promise<ScenarioDatasetValidation>;
}

export interface DatasetStorageAdapter {
  instances: DatasetInstancesAdapter;
  secrets: DatasetSecretsAdapter;
  bundles: BundlesAdapter;
  bundleItems: BundleItemsAdapter;
  validation: ValidationAdapter;
  mode: 'local' | 'api';
}

// ─── Stub fallback (données vides) ───────────────────────────────────────

const emptyPaginated = <T>(): PaginatedResponse<T> => ({
  data: [] as T[],
  pagination: { page: 1, limit: 20, total: 0, total_pages: 0 },
});

const throwLocal = (op: string): never => {
  throw new Error(`Opération "${op}" non disponible — backend API requis`);
};

const stubInstancesAdapter: DatasetInstancesAdapter = {
  list: async () => emptyPaginated<DatasetInstance>(),
  get: async () => throwLocal('instances.get'),
  create: async () => throwLocal('instances.create'),
  update: async () => throwLocal('instances.update'),
  clone: async () => throwLocal('instances.clone'),
  delete: async () => throwLocal('instances.delete'),
};

const stubSecretsAdapter: DatasetSecretsAdapter = {
  list: async () => [],
  set: async () => throwLocal('secrets.set'),
  remove: async () => throwLocal('secrets.remove'),
  maskValues: async (_d, v) => v,
};

const stubBundlesAdapter: BundlesAdapter = {
  list: async () => emptyPaginated<DatasetBundle>(),
  get: async () => throwLocal('bundles.get'),
  create: async () => throwLocal('bundles.create'),
  update: async () => throwLocal('bundles.update'),
  clone: async () => throwLocal('bundles.clone'),
  delete: async () => throwLocal('bundles.delete'),
};

const stubBundleItemsAdapter: BundleItemsAdapter = {
  list: async () => [],
  add: async () => throwLocal('bundleItems.add'),
  remove: async () => throwLocal('bundleItems.remove'),
};

const stubValidationAdapter: ValidationAdapter = {
  validateBundleForScenario: async () => throwLocal('validation.validateBundleForScenario'),
  validateScenarioDatasets: async () => throwLocal('validation.validateScenarioDatasets'),
};

const STUB_ADAPTER: DatasetStorageAdapter = {
  instances: stubInstancesAdapter,
  secrets: stubSecretsAdapter,
  bundles: stubBundlesAdapter,
  bundleItems: stubBundleItemsAdapter,
  validation: stubValidationAdapter,
  mode: 'local',
};

// ─── ApiAdapter ───────────────────────────────────────────────────────────

const API_PREFIX = '/api/v1/repository';

/**
 * Wrapper : tente l'appel API, fallback sur stub en cas d'erreur.
 */
async function withApiFallback<T>(apiFn: () => Promise<T>, stubFn: () => T | Promise<T>): Promise<T> {
  try {
    return await apiFn();
  } catch {
    return stubFn();
  }
}

const apiInstancesAdapter: DatasetInstancesAdapter = {
  list: (projectId, params) => withApiFallback(
    () => apiClient.get<PaginatedResponse<DatasetInstance>>(
      `${API_PREFIX}/projects/${projectId}/dataset-instances`, { params }
    ).then(r => r.data),
    () => emptyPaginated<DatasetInstance>(),
  ),

  get: (id) => withApiFallback(
    () => apiClient.get<{ data: DatasetInstance }>(
      `${API_PREFIX}/dataset-instances/${id}`
    ).then(r => r.data.data),
    () => throwLocal('instances.get'),
  ),

  create: (projectId, data) => withApiFallback(
    () => apiClient.post<{ data: DatasetInstance }>(
      `${API_PREFIX}/projects/${projectId}/dataset-instances`, data
    ).then(r => r.data.data),
    () => throwLocal('instances.create'),
  ),

  update: (id, data) => withApiFallback(
    () => apiClient.patch<{ data: DatasetInstance }>(
      `${API_PREFIX}/dataset-instances/${id}`, data
    ).then(r => r.data.data),
    () => throwLocal('instances.update'),
  ),

  clone: (id) => withApiFallback(
    () => apiClient.post<{ data: DatasetInstance }>(
      `${API_PREFIX}/dataset-instances/${id}/clone`
    ).then(r => r.data.data),
    () => throwLocal('instances.clone'),
  ),

  delete: (id) => withApiFallback(
    () => apiClient.delete(`${API_PREFIX}/dataset-instances/${id}`).then(() => undefined),
    () => throwLocal('instances.delete'),
  ),
};

const apiSecretsAdapter: DatasetSecretsAdapter = {
  list: (datasetId) => withApiFallback(
    () => apiClient.get<{ data: DatasetSecretKey[] }>(
      `${API_PREFIX}/dataset-instances/${datasetId}/secrets`
    ).then(r => r.data.data),
    () => [],
  ),

  set: (datasetId, keyPath, isSecret) => withApiFallback(
    () => apiClient.put<{ data: DatasetSecretKey }>(
      `${API_PREFIX}/dataset-instances/${datasetId}/secrets`, { key_path: keyPath, is_secret: isSecret }
    ).then(r => r.data.data),
    () => throwLocal('secrets.set'),
  ),

  remove: (datasetId, keyPath) => withApiFallback(
    () => apiClient.delete(
      `${API_PREFIX}/dataset-instances/${datasetId}/secrets/${encodeURIComponent(keyPath)}`
    ).then(() => undefined),
    () => throwLocal('secrets.remove'),
  ),

  maskValues: (datasetId, valuesJson) => withApiFallback(
    () => apiClient.post<{ data: Record<string, unknown> }>(
      `${API_PREFIX}/dataset-instances/${datasetId}/mask-values`, { values_json: valuesJson }
    ).then(r => r.data.data),
    () => valuesJson,
  ),
};

const apiBundlesAdapter: BundlesAdapter = {
  list: (projectId, params) => withApiFallback(
    () => apiClient.get<PaginatedResponse<DatasetBundle>>(
      `${API_PREFIX}/projects/${projectId}/dataset-bundles`, { params }
    ).then(r => r.data),
    () => emptyPaginated<DatasetBundle>(),
  ),

  get: (id) => withApiFallback(
    () => apiClient.get<{ data: DatasetBundle }>(
      `${API_PREFIX}/dataset-bundles/${id}`
    ).then(r => r.data.data),
    () => throwLocal('bundles.get'),
  ),

  create: (projectId, data) => withApiFallback(
    () => apiClient.post<{ data: DatasetBundle }>(
      `${API_PREFIX}/projects/${projectId}/dataset-bundles`, data
    ).then(r => r.data.data),
    () => throwLocal('bundles.create'),
  ),

  update: (id, data) => withApiFallback(
    () => apiClient.patch<{ data: DatasetBundle }>(
      `${API_PREFIX}/dataset-bundles/${id}`, data
    ).then(r => r.data.data),
    () => throwLocal('bundles.update'),
  ),

  clone: (id) => withApiFallback(
    () => apiClient.post<{ data: DatasetBundle }>(
      `${API_PREFIX}/dataset-bundles/${id}/clone`
    ).then(r => r.data.data),
    () => throwLocal('bundles.clone'),
  ),

  delete: (id) => withApiFallback(
    () => apiClient.delete(`${API_PREFIX}/dataset-bundles/${id}`).then(() => undefined),
    () => throwLocal('bundles.delete'),
  ),
};

const apiBundleItemsAdapter: BundleItemsAdapter = {
  list: (bundleId) => withApiFallback(
    () => apiClient.get<{ data: BundleItem[] }>(
      `${API_PREFIX}/dataset-bundles/${bundleId}/items`
    ).then(r => r.data.data),
    () => [],
  ),

  add: (bundleId, datasetId) => withApiFallback(
    () => apiClient.post<{ data: BundleItem }>(
      `${API_PREFIX}/dataset-bundles/${bundleId}/items`, { dataset_id: datasetId }
    ).then(r => r.data.data),
    () => throwLocal('bundleItems.add'),
  ),

  remove: (bundleId, datasetId) => withApiFallback(
    () => apiClient.delete(
      `${API_PREFIX}/dataset-bundles/${bundleId}/items/${datasetId}`
    ).then(() => undefined),
    () => throwLocal('bundleItems.remove'),
  ),
};

const apiValidationAdapter: ValidationAdapter = {
  validateBundleForScenario: (bundleId, scenarioId) => withApiFallback(
    () => apiClient.post<{ data: BundleValidationResult }>(
      `${API_PREFIX}/dataset-bundles/${bundleId}/validate-for-scenario`, { scenario_id: scenarioId }
    ).then(r => r.data.data),
    () => throwLocal('validation.validateBundleForScenario'),
  ),

  validateScenarioDatasets: (scenarioId, env) => withApiFallback(
    () => apiClient.post<{ data: ScenarioDatasetValidation }>(
      `${API_PREFIX}/scenarios/${scenarioId}/validate-datasets`, { env }
    ).then(r => r.data.data),
    () => throwLocal('validation.validateScenarioDatasets'),
  ),
};

const API_ADAPTER: DatasetStorageAdapter = {
  instances: apiInstancesAdapter,
  secrets: apiSecretsAdapter,
  bundles: apiBundlesAdapter,
  bundleItems: apiBundleItemsAdapter,
  validation: apiValidationAdapter,
  mode: 'api',
};

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * Résout le mode de stockage :
 *  1. VITE_DATASET_STORAGE_MODE = "api"  → ApiAdapter
 *  2. Sinon → StubAdapter (données vides, pas de localStorage)
 */
function resolveStorageMode(): 'local' | 'api' {
  const mode = (import.meta.env.VITE_DATASET_STORAGE_MODE || 'local').toLowerCase();
  if (mode === 'api') return 'api';
  return 'local';
}

const STORAGE_MODE = resolveStorageMode();

export function getDatasetStorageAdapter(): DatasetStorageAdapter {
  return STORAGE_MODE === 'api' ? API_ADAPTER : STUB_ADAPTER;
}

/** Singleton exporté pour usage direct */
export const datasetStorage = getDatasetStorageAdapter();

/**
 * Helper : retourne le mode actuel (utile pour debug/UI)
 */
export function getStorageMode(): 'local' | 'api' {
  return STORAGE_MODE;
}
