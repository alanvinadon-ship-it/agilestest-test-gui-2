import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectorApi } from '../api/collectorApi';
import type { CreateProbeRequest, UpdateProbeRequest } from '../types';

export const probeKeys = {
  all: ['probes'] as const,
  list: (params?: Record<string, unknown>) => [...probeKeys.all, 'list', params] as const,
  detail: (probeId: string) => [...probeKeys.all, 'detail', probeId] as const,
};

export function useProbes(params?: { status?: string; type?: string; site?: string; zone?: string; project_id?: string }) {
  return useQuery({
    queryKey: probeKeys.list(params as Record<string, unknown>),
    queryFn: () => collectorApi.listProbes(params),
  });
}

export function useProbeDetail(probeId: string) {
  return useQuery({
    queryKey: probeKeys.detail(probeId),
    queryFn: () => collectorApi.getProbe(probeId),
    enabled: !!probeId,
  });
}

export function useCreateProbe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProbeRequest) => collectorApi.createProbe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: probeKeys.all });
    },
  });
}

export function useUpdateProbe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ probeId, data }: { probeId: string; data: UpdateProbeRequest }) =>
      collectorApi.updateProbe(probeId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: probeKeys.all });
      queryClient.invalidateQueries({ queryKey: probeKeys.detail(variables.probeId) });
    },
  });
}

export function useDeleteProbe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (probeId: string) => collectorApi.deleteProbe(probeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: probeKeys.all });
    },
  });
}

export function useRegenerateProbeToken() {
  return useMutation({
    mutationFn: (probeId: string) => collectorApi.regenerateProbeToken(probeId),
  });
}

export function useSitesAndZones(projectId?: string) {
  return useQuery({
    queryKey: ['sites-zones', projectId],
    queryFn: () => collectorApi.listSitesAndZones(projectId),
  });
}

export function useCaptureProfiles() {
  return useQuery({
    queryKey: ['capture-profiles'],
    queryFn: () => collectorApi.getCaptureProfiles(),
  });
}
