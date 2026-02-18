/**
 * DatasetStorageContext — Fournit l'adapter de stockage dataset à toute l'app.
 *
 * Usage :
 *   const { adapter, mode } = useDatasetStorage();
 *   const instances = await adapter.instances.list(projectId);
 *
 * Le mode est déterminé par VITE_DATASET_STORAGE_MODE :
 *   - "local" (défaut) → localStorage
 *   - "api"            → Repository API avec fallback local
 */
import { createContext, useContext, type ReactNode } from 'react';
import {
  datasetStorage,
  getStorageMode,
  type DatasetStorageAdapter,
} from '../api/datasetStorageAdapter';

interface DatasetStorageContextValue {
  adapter: DatasetStorageAdapter;
  mode: 'local' | 'api';
}

const DatasetStorageCtx = createContext<DatasetStorageContextValue>({
  adapter: datasetStorage,
  mode: getStorageMode(),
});

export function DatasetStorageProvider({ children }: { children: ReactNode }) {
  const value: DatasetStorageContextValue = {
    adapter: datasetStorage,
    mode: getStorageMode(),
  };

  return (
    <DatasetStorageCtx.Provider value={value}>
      {children}
    </DatasetStorageCtx.Provider>
  );
}

export function useDatasetStorage() {
  return useContext(DatasetStorageCtx);
}
