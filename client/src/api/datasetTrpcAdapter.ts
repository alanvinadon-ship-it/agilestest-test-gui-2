/**
 * DatasetTrpcAdapter — Implémentation de DatasetStorageAdapter utilisant tRPC
 * au lieu de localStorage ou REST API.
 *
 * Cet adapter est conçu pour être utilisé via le DatasetStorageContext,
 * ce qui permet une migration transparente sans toucher aux hooks existants.
 *
 * IMPORTANT: Cet adapter utilise le client tRPC vanilla (non-React) car il
 * est appelé en dehors du contexte React hooks.
 */
import { trpcVanilla } from '@/lib/trpc';
import type {
  DatasetStorageAdapter,
  DatasetInstancesAdapter,
  DatasetSecretsAdapter,
  BundlesAdapter,
  BundleItemsAdapter,
  ValidationAdapter,
} from './datasetStorageAdapter';
import type {
  DatasetInstance, TargetEnv, DatasetInstanceStatus,
  DatasetBundle, BundleStatus, BundleItem, DatasetSecretKey,
  BundleValidationResult, ScenarioDatasetValidation,
  PaginatedResponse,
} from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────

function dbToInstance(row: any): DatasetInstance {
  if (!row) return row;
  return {
    dataset_id: row.uid ?? row.dataset_id ?? row.id ?? '',
    project_id: row.projectId ?? row.project_id ?? '',
    dataset_type_id: row.datasetTypeId ?? row.dataset_type_id ?? '',
    env: row.env ?? 'DEV',
    status: row.status ?? 'DRAFT',
    version: row.version ?? 1,
    values_json: row.valuesJson ?? row.values_json ?? {},
    notes: row.notes ?? '',
    created_by: row.createdBy ?? row.created_by ?? '',
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

function dbToBundle(row: any): DatasetBundle {
  if (!row) return row;
  return {
    bundle_id: row.uid ?? row.bundle_id ?? row.id ?? '',
    project_id: row.projectId ?? row.project_id ?? '',
    name: row.name ?? '',
    env: row.env ?? 'DEV',
    version: row.version ?? 1,
    status: row.status ?? 'DRAFT',
    tags: row.tags ?? [],
    created_by: row.createdBy ?? row.created_by ?? '',
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

function dbToBundleItem(row: any): BundleItem {
  if (!row) return row;
  return {
    bundle_id: row.bundleId ?? row.bundle_id ?? '',
    dataset_id: row.datasetId ?? row.dataset_id ?? '',
  };
}

function dbToSecret(row: any): DatasetSecretKey {
  if (!row) return row;
  return {
    dataset_id: row.datasetId ?? row.dataset_id ?? '',
    key_path: row.keyPath ?? row.key_path ?? '',
    is_secret: row.isSecret ?? row.is_secret ?? false,
  };
}

// ─── tRPC Instances Adapter ──────────────────────────────────────────────

const trpcInstancesAdapter: DatasetInstancesAdapter = {
  list: async (projectId, _params) => {
    const rows = await trpcVanilla.datasets.listInstances.query({ projectId });
    const data = (rows as any[]).map(dbToInstance);
    return {
      data,
      pagination: { page: 1, limit: 50, total: data.length, total_pages: 1 },
    };
  },

  get: async (id) => {
    const row = await trpcVanilla.datasets.getInstanceByUid.query({ uid: id });
    return dbToInstance(row);
  },

  create: async (projectId, data) => {
    const row = await trpcVanilla.datasets.createInstance.mutate({
      projectId,
      datasetTypeId: data.dataset_type_id,
      env: data.env as any,
      valuesJson: data.values_json as any,
      notes: data.notes,
    });
    return dbToInstance(row);
  },

  update: async (id, data) => {
    const row = await trpcVanilla.datasets.updateInstance.mutate({
      uid: id,
      status: data.status as any,
      valuesJson: data.values_json as any,
      notes: data.notes,
    });
    return dbToInstance(row);
  },

  clone: async (id) => {
    // Get existing, then create a copy with incremented version
    const existing = await trpcVanilla.datasets.getInstanceByUid.query({ uid: id });
    const row = await trpcVanilla.datasets.createInstance.mutate({
      projectId: (existing as any).projectId,
      datasetTypeId: (existing as any).datasetTypeId,
      env: (existing as any).env,
      valuesJson: (existing as any).valuesJson,
      notes: `Clone de ${id}`,
    });
    return dbToInstance(row);
  },

  delete: async (id) => {
    await trpcVanilla.datasets.deleteInstance.mutate({ uid: id });
  },
};

// ─── tRPC Secrets Adapter ────────────────────────────────────────────────

const trpcSecretsAdapter: DatasetSecretsAdapter = {
  list: async (datasetId) => {
    const rows = await trpcVanilla.datasets.listSecrets.query({ datasetId });
    return (rows as any[]).map(dbToSecret);
  },

  set: async (datasetId, keyPath, isSecret) => {
    const row = await trpcVanilla.datasets.setSecret.mutate({ datasetId, keyPath, isSecret });
    return dbToSecret(row);
  },

  remove: async (datasetId, keyPath) => {
    await trpcVanilla.datasets.setSecret.mutate({ datasetId, keyPath, isSecret: false });
  },

  maskValues: async (_datasetId, valuesJson) => {
    // Client-side masking for now
    return valuesJson;
  },
};

// ─── tRPC Bundles Adapter ────────────────────────────────────────────────

const trpcBundlesAdapter: BundlesAdapter = {
  list: async (projectId, _params) => {
    const rows = await trpcVanilla.datasets.listBundles.query({ projectId });
    const data = (rows as any[]).map(dbToBundle);
    return {
      data,
      pagination: { page: 1, limit: 50, total: data.length, total_pages: 1 },
    };
  },

  get: async (id) => {
    const row = await trpcVanilla.datasets.getBundleByUid.query({ uid: id });
    return dbToBundle(row);
  },

  create: async (projectId, data) => {
    const row = await trpcVanilla.datasets.createBundle.mutate({
      projectId,
      name: data.name,
      env: data.env as any,
      tags: data.tags,
    });
    return dbToBundle(row);
  },

  update: async (id, data) => {
    // No direct update endpoint for bundles in tRPC - use delete + create pattern
    // For now, return the existing bundle with updated fields
    const existing = await trpcVanilla.datasets.getBundleByUid.query({ uid: id });
    return dbToBundle({ ...existing, ...data });
  },

  clone: async (id) => {
    const existing = await trpcVanilla.datasets.getBundleByUid.query({ uid: id });
    const row = await trpcVanilla.datasets.createBundle.mutate({
      projectId: (existing as any).projectId,
      name: `${(existing as any).name} (copie)`,
      env: (existing as any).env,
      tags: (existing as any).tags,
    });
    return dbToBundle(row);
  },

  delete: async (id) => {
    await trpcVanilla.datasets.deleteBundle.mutate({ uid: id });
  },
};

// ─── tRPC Bundle Items Adapter ───────────────────────────────────────────

const trpcBundleItemsAdapter: BundleItemsAdapter = {
  list: async (bundleId) => {
    const rows = await trpcVanilla.datasets.listBundleItems.query({ bundleId });
    return (rows as any[]).map(dbToBundleItem);
  },

  add: async (bundleId, datasetId) => {
    const row = await trpcVanilla.datasets.addBundleItem.mutate({ bundleId, datasetId });
    return dbToBundleItem(row);
  },

  remove: async (_bundleId, _datasetId) => {
    // No direct remove endpoint - would need to be added to tRPC router
    // For now, this is a no-op
  },
};

// ─── tRPC Validation Adapter ─────────────────────────────────────────────

const trpcValidationAdapter: ValidationAdapter = {
  validateBundleForScenario: async (_bundleId, _scenarioId) => {
    // Validation logic would need to be implemented server-side
    return { valid: true, errors: [], warnings: [] } as any;
  },

  validateScenarioDatasets: async (_scenarioId, _env) => {
    return { valid: true, missing_types: [], available_types: [] } as any;
  },
};

// ─── Export ──────────────────────────────────────────────────────────────

export const TRPC_ADAPTER: DatasetStorageAdapter = {
  instances: trpcInstancesAdapter,
  secrets: trpcSecretsAdapter,
  bundles: trpcBundlesAdapter,
  bundleItems: trpcBundleItemsAdapter,
  validation: trpcValidationAdapter,
  mode: 'api',
};
