/**
 * useDatasetMutations — Hook centralisé pour les mutations dataset avec
 * cache invalidation automatique et optimistic updates basiques.
 *
 * Utilise le DatasetStorageAdapter (local ou API selon feature flag).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatasetStorage } from '../contexts/DatasetStorageContext';
import { toast } from 'sonner';
import type {
  DatasetInstance, DatasetBundle, TargetEnv, DatasetInstanceStatus, BundleStatus,
} from '../types';

// ─── Query key constants ─────────────────────────────────────────────────

export const QUERY_KEYS = {
  instances: 'dataset_instances',
  bundles: 'dataset_bundles',
  bundleItems: 'bundle_items',
  secrets: 'dataset_secrets',
  validation: 'scenario_dataset_validation',
} as const;

/** Invalidate all dataset-related queries */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.instances] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundles] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundleItems] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.secrets] });
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
}

// ─── Instance mutations ──────────────────────────────────────────────────

export function useCreateInstance(projectId: string) {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (data: { dataset_type_id: string; env: TargetEnv; notes?: string }) =>
      adapter.instances.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.instances] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
      toast.success('Dataset instance créé');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateInstance() {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<DatasetInstance, 'values_json' | 'status' | 'notes'>> }) =>
      adapter.instances.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.instances] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloneInstance() {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (id: string) => adapter.instances.clone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.instances] });
      toast.success('Dataset cloné (nouvelle version)');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (id: string) => adapter.instances.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.instances] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
      toast.success('Dataset supprimé');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Bundle mutations ────────────────────────────────────────────────────

export function useCreateBundle(projectId: string) {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (data: { name: string; env: TargetEnv; tags?: string[] }) =>
      adapter.bundles.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundles] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
      toast.success('Bundle créé');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBundle() {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<DatasetBundle, 'name' | 'status' | 'tags'>> }) =>
      adapter.bundles.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundles] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloneBundle() {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (id: string) => adapter.bundles.clone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundles] });
      toast.success('Bundle cloné');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBundle() {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (id: string) => adapter.bundles.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundles] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
      toast.success('Bundle supprimé');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Bundle Item mutations ───────────────────────────────────────────────

export function useAddBundleItem(bundleId: string) {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (datasetId: string) => adapter.bundleItems.add(bundleId, datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundleItems, bundleId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundles] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
      toast.success('Dataset ajouté au bundle');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveBundleItem(bundleId: string) {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: (datasetId: string) => adapter.bundleItems.remove(bundleId, datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundleItems, bundleId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.bundles] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.validation] });
      toast.success('Dataset retiré du bundle');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Secret mutations ────────────────────────────────────────────────────

export function useToggleSecret(datasetId: string) {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();

  return useMutation({
    mutationFn: ({ keyPath, isSecret }: { keyPath: string; isSecret: boolean }) =>
      adapter.secrets.set(datasetId, keyPath, isSecret),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.secrets, datasetId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
