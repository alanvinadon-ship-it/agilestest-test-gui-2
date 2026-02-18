/**
 * DatasetStorageAdapter — Couche d'abstraction pour le stockage des Dataset Instances,
 * Bundles, BundleItems, SecretKeys et Validation.
 *
 * Deux implémentations :
 *   - LocalAdapter  → localStorage (demo/offline)
 *   - ApiAdapter    → Repository API REST (production)
 *
 * Le switch se fait via la variable d'environnement VITE_DATASET_STORAGE_MODE :
 *   - "local"  → LocalAdapter (défaut)
 *   - "api"    → ApiAdapter avec fallback local si API indisponible
 */

import apiClient from './client';
import {
  localDatasetInstances, localDatasetSecrets, localBundles,
  localBundleItems, localValidation,
} from './localStore';
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

// ─── LocalAdapter ─────────────────────────────────────────────────────────

const localInstancesAdapter: DatasetInstancesAdapter = {
  list: async (projectId, params) => localDatasetInstances.list(projectId, params),
  get: async (id) => localDatasetInstances.get(id),
  create: async (projectId, data) => localDatasetInstances.create(projectId, data),
  update: async (id, data) => localDatasetInstances.update(id, data),
  clone: async (id) => localDatasetInstances.clone(id),
  delete: async (id) => localDatasetInstances.delete(id),
};

const localSecretsAdapter: DatasetSecretsAdapter = {
  list: async (datasetId) => localDatasetSecrets.list(datasetId),
  set: async (datasetId, keyPath, isSecret) => localDatasetSecrets.set(datasetId, keyPath, isSecret),
  remove: async (datasetId, keyPath) => localDatasetSecrets.remove(datasetId, keyPath),
  maskValues: async (datasetId, valuesJson) => localDatasetSecrets.maskValues(datasetId, valuesJson),
};

const localBundlesAdapter: BundlesAdapter = {
  list: async (projectId, params) => localBundles.list(projectId, params),
  get: async (id) => localBundles.get(id),
  create: async (projectId, data) => localBundles.create(projectId, data),
  update: async (id, data) => localBundles.update(id, data),
  clone: async (id) => localBundles.clone(id),
  delete: async (id) => localBundles.delete(id),
};

const localBundleItemsAdapter: BundleItemsAdapter = {
  list: async (bundleId) => localBundleItems.list(bundleId),
  add: async (bundleId, datasetId) => localBundleItems.add(bundleId, datasetId),
  remove: async (bundleId, datasetId) => localBundleItems.remove(bundleId, datasetId),
};

const localValidationAdapter: ValidationAdapter = {
  validateBundleForScenario: async (bundleId, scenarioId) =>
    localValidation.validateBundleForScenario(bundleId, scenarioId),
  validateScenarioDatasets: async (scenarioId, env) =>
    localValidation.validateScenarioDatasets(scenarioId, env),
};

const LOCAL_ADAPTER: DatasetStorageAdapter = {
  instances: localInstancesAdapter,
  secrets: localSecretsAdapter,
  bundles: localBundlesAdapter,
  bundleItems: localBundleItemsAdapter,
  validation: localValidationAdapter,
  mode: 'local',
};

// ─── ApiAdapter ───────────────────────────────────────────────────────────

const API_PREFIX = '/api/v1/repository';

/**
 * Wrapper : tente l'appel API, fallback sur local en cas d'erreur.
 */
async function withApiFallback<T>(apiFn: () => Promise<T>, localFn: () => T | Promise<T>): Promise<T> {
  try {
    return await apiFn();
  } catch {
    return localFn();
  }
}

const apiInstancesAdapter: DatasetInstancesAdapter = {
  list: (projectId, params) => withApiFallback(
    () => apiClient.get<PaginatedResponse<DatasetInstance>>(
      `${API_PREFIX}/projects/${projectId}/dataset-instances`, { params }
    ).then(r => r.data),
    () => localDatasetInstances.list(projectId, params),
  ),

  get: (id) => withApiFallback(
    () => apiClient.get<{ data: DatasetInstance }>(
      `${API_PREFIX}/dataset-instances/${id}`
    ).then(r => r.data.data),
    () => localDatasetInstances.get(id),
  ),

  create: (projectId, data) => withApiFallback(
    () => apiClient.post<{ data: DatasetInstance }>(
      `${API_PREFIX}/projects/${projectId}/dataset-instances`, data
    ).then(r => r.data.data),
    () => localDatasetInstances.create(projectId, data),
  ),

  update: (id, data) => withApiFallback(
    () => apiClient.patch<{ data: DatasetInstance }>(
      `${API_PREFIX}/dataset-instances/${id}`, data
    ).then(r => r.data.data),
    () => localDatasetInstances.update(id, data),
  ),

  clone: (id) => withApiFallback(
    () => apiClient.post<{ data: DatasetInstance }>(
      `${API_PREFIX}/dataset-instances/${id}/clone`
    ).then(r => r.data.data),
    () => localDatasetInstances.clone(id),
  ),

  delete: (id) => withApiFallback(
    () => apiClient.delete(`${API_PREFIX}/dataset-instances/${id}`).then(() => undefined),
    () => localDatasetInstances.delete(id),
  ),
};

const apiSecretsAdapter: DatasetSecretsAdapter = {
  list: (datasetId) => withApiFallback(
    () => apiClient.get<{ data: DatasetSecretKey[] }>(
      `${API_PREFIX}/dataset-instances/${datasetId}/secrets`
    ).then(r => r.data.data),
    () => localDatasetSecrets.list(datasetId),
  ),

  set: (datasetId, keyPath, isSecret) => withApiFallback(
    () => apiClient.put<{ data: DatasetSecretKey }>(
      `${API_PREFIX}/dataset-instances/${datasetId}/secrets`, { key_path: keyPath, is_secret: isSecret }
    ).then(r => r.data.data),
    () => localDatasetSecrets.set(datasetId, keyPath, isSecret),
  ),

  remove: (datasetId, keyPath) => withApiFallback(
    () => apiClient.delete(
      `${API_PREFIX}/dataset-instances/${datasetId}/secrets/${encodeURIComponent(keyPath)}`
    ).then(() => undefined),
    () => localDatasetSecrets.remove(datasetId, keyPath),
  ),

  maskValues: (datasetId, valuesJson) => withApiFallback(
    () => apiClient.post<{ data: Record<string, unknown> }>(
      `${API_PREFIX}/dataset-instances/${datasetId}/mask-values`, { values_json: valuesJson }
    ).then(r => r.data.data),
    () => localDatasetSecrets.maskValues(datasetId, valuesJson),
  ),
};

const apiBundlesAdapter: BundlesAdapter = {
  list: (projectId, params) => withApiFallback(
    () => apiClient.get<PaginatedResponse<DatasetBundle>>(
      `${API_PREFIX}/projects/${projectId}/dataset-bundles`, { params }
    ).then(r => r.data),
    () => localBundles.list(projectId, params),
  ),

  get: (id) => withApiFallback(
    () => apiClient.get<{ data: DatasetBundle }>(
      `${API_PREFIX}/dataset-bundles/${id}`
    ).then(r => r.data.data),
    () => localBundles.get(id),
  ),

  create: (projectId, data) => withApiFallback(
    () => apiClient.post<{ data: DatasetBundle }>(
      `${API_PREFIX}/projects/${projectId}/dataset-bundles`, data
    ).then(r => r.data.data),
    () => localBundles.create(projectId, data),
  ),

  update: (id, data) => withApiFallback(
    () => apiClient.patch<{ data: DatasetBundle }>(
      `${API_PREFIX}/dataset-bundles/${id}`, data
    ).then(r => r.data.data),
    () => localBundles.update(id, data),
  ),

  clone: (id) => withApiFallback(
    () => apiClient.post<{ data: DatasetBundle }>(
      `${API_PREFIX}/dataset-bundles/${id}/clone`
    ).then(r => r.data.data),
    () => localBundles.clone(id),
  ),

  delete: (id) => withApiFallback(
    () => apiClient.delete(`${API_PREFIX}/dataset-bundles/${id}`).then(() => undefined),
    () => localBundles.delete(id),
  ),
};

const apiBundleItemsAdapter: BundleItemsAdapter = {
  list: (bundleId) => withApiFallback(
    () => apiClient.get<{ data: BundleItem[] }>(
      `${API_PREFIX}/dataset-bundles/${bundleId}/items`
    ).then(r => r.data.data),
    () => localBundleItems.list(bundleId),
  ),

  add: (bundleId, datasetId) => withApiFallback(
    () => apiClient.post<{ data: BundleItem }>(
      `${API_PREFIX}/dataset-bundles/${bundleId}/items`, { dataset_id: datasetId }
    ).then(r => r.data.data),
    () => localBundleItems.add(bundleId, datasetId),
  ),

  remove: (bundleId, datasetId) => withApiFallback(
    () => apiClient.delete(
      `${API_PREFIX}/dataset-bundles/${bundleId}/items/${datasetId}`
    ).then(() => undefined),
    () => localBundleItems.remove(bundleId, datasetId),
  ),
};

const apiValidationAdapter: ValidationAdapter = {
  validateBundleForScenario: (bundleId, scenarioId) => withApiFallback(
    () => apiClient.post<{ data: BundleValidationResult }>(
      `${API_PREFIX}/dataset-bundles/${bundleId}/validate-for-scenario`, { scenario_id: scenarioId }
    ).then(r => r.data.data),
    () => localValidation.validateBundleForScenario(bundleId, scenarioId),
  ),

  validateScenarioDatasets: (scenarioId, env) => withApiFallback(
    () => apiClient.post<{ data: ScenarioDatasetValidation }>(
      `${API_PREFIX}/scenarios/${scenarioId}/validate-datasets`, { env }
    ).then(r => r.data.data),
    () => localValidation.validateScenarioDatasets(scenarioId, env),
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
 *  2. VITE_DATASET_STORAGE_MODE = "local" → LocalAdapter
 *  3. Si non défini : "local" par défaut (demo/offline)
 */
function resolveStorageMode(): 'local' | 'api' {
  const mode = (import.meta.env.VITE_DATASET_STORAGE_MODE || 'local').toLowerCase();
  if (mode === 'api') return 'api';
  return 'local';
}

const STORAGE_MODE = resolveStorageMode();

export function getDatasetStorageAdapter(): DatasetStorageAdapter {
  return STORAGE_MODE === 'api' ? API_ADAPTER : LOCAL_ADAPTER;
}

/** Singleton exporté pour usage direct */
export const datasetStorage = getDatasetStorageAdapter();

/**
 * Helper : retourne le mode actuel (utile pour debug/UI)
 */
export function getStorageMode(): 'local' | 'api' {
  return STORAGE_MODE;
}
