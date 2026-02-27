/**
 * useDatasetMutations — Hook centralisé pour les mutations dataset avec
 * cache invalidation automatique et optimistic updates basiques.
 *
 * Utilise tRPC directement (plus de DatasetStorageAdapter).
 */
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type {
  DatasetInstance, DatasetBundle, TargetEnv, DatasetInstanceStatus, BundleStatus,
} from '../types';

// ─── Instance mutations ──────────────────────────────────────────────────

export function useCreateInstance(projectId: string) {
  const utils = trpc.useUtils();

  return trpc.datasetInstances.create.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      toast.success('Dataset instance créé');
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateInstance() {
  const utils = trpc.useUtils();

  return trpc.datasetInstances.update.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      utils.datasetInstances.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useCloneInstance() {
  const utils = trpc.useUtils();

  return trpc.datasetInstances.clone.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      toast.success('Dataset cloné (nouvelle version)');
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteInstance() {
  const utils = trpc.useUtils();

  return trpc.datasetInstances.delete.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      utils.bundles.list.invalidate();
      toast.success('Dataset supprimé');
    },
    onError: (err) => toast.error(err.message),
  });
}

// ─── Bundle mutations ────────────────────────────────────────────────────

export function useCreateBundle(projectId: string) {
  const utils = trpc.useUtils();

  return trpc.bundles.create.useMutation({
    onSuccess: () => {
      utils.bundles.list.invalidate();
      toast.success('Bundle créé');
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateBundle() {
  const utils = trpc.useUtils();

  return trpc.bundles.update.useMutation({
    onSuccess: () => {
      utils.bundles.list.invalidate();
      utils.bundles.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useCloneBundle() {
  const utils = trpc.useUtils();

  return trpc.bundles.clone.useMutation({
    onSuccess: () => {
      utils.bundles.list.invalidate();
      toast.success('Bundle cloné');
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteBundle() {
  const utils = trpc.useUtils();

  return trpc.bundles.delete.useMutation({
    onSuccess: () => {
      utils.bundles.list.invalidate();
      toast.success('Bundle supprimé');
    },
    onError: (err) => toast.error(err.message),
  });
}

// ─── Bundle Item mutations ───────────────────────────────────────────────

export function useAddBundleItem(bundleId: string) {
  const utils = trpc.useUtils();

  return trpc.bundleItems.add.useMutation({
    onSuccess: () => {
      utils.bundleItems.list.invalidate({ bundleId });
      utils.bundles.list.invalidate();
      toast.success('Dataset ajouté au bundle');
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useRemoveBundleItem(bundleId: string) {
  const utils = trpc.useUtils();

  return trpc.bundleItems.remove.useMutation({
    onSuccess: () => {
      utils.bundleItems.list.invalidate({ bundleId });
      utils.bundles.list.invalidate();
      toast.success('Dataset retiré du bundle');
    },
    onError: (err) => toast.error(err.message),
  });
}

// ─── Secret mutations ────────────────────────────────────────────────────

export function useToggleSecret(datasetId: string) {
  const utils = trpc.useUtils();

  return trpc.datasetSecrets.set.useMutation({
    onSuccess: () => {
      utils.datasetSecrets.list.invalidate({ datasetId });
    },
    onError: (err) => toast.error(err.message),
  });
}
