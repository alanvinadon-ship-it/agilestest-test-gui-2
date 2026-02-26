/**
 * DatasetStorageContext — Fournit l'adapter de stockage dataset à toute l'app.
 *
 * Usage :
 *   const { adapter, mode } = useDatasetStorage();
 *   const instances = await adapter.instances.list(projectId);
 *
 * Le mode est déterminé par VITE_DATASET_STORAGE_MODE :
 *   - "trpc" (défaut) → tRPC (base de données)
 *   - "local"         → localStorage (demo/offline)
 *   - "api"           → Repository API avec fallback local
 */
import { createContext, useContext, type ReactNode } from 'react';
import {
  datasetStorage,
  getStorageMode,
  type DatasetStorageAdapter,
} from '../api/datasetStorageAdapter';
import { TRPC_ADAPTER } from '../api/datasetTrpcAdapter';

interface DatasetStorageContextValue {
  adapter: DatasetStorageAdapter;
  mode: 'local' | 'api' | 'trpc';
}

function resolveAdapter(): DatasetStorageContextValue {
  const envMode = (import.meta.env.VITE_DATASET_STORAGE_MODE || '').toLowerCase();
  if (envMode === 'local') {
    return { adapter: datasetStorage, mode: 'local' };
  }
  if (envMode === 'api') {
    return { adapter: datasetStorage, mode: 'api' };
  }
  // Default: use tRPC adapter (database)
  return { adapter: TRPC_ADAPTER, mode: 'trpc' };
}

const resolved = resolveAdapter();

const DatasetStorageCtx = createContext<DatasetStorageContextValue>(resolved);

export function DatasetStorageProvider({ children }: { children: ReactNode }) {
  return (
    <DatasetStorageCtx.Provider value={resolved}>
      {children}
    </DatasetStorageCtx.Provider>
  );
}

export function useDatasetStorage() {
  return useContext(DatasetStorageCtx);
}
