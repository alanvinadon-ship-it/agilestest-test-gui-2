import { trpc } from '@/lib/trpc';
import type { TestScenario, PaginatedResponse } from '../types';

/** Extract items array from paginated result { items, total } */
function extractItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * Adapter: converts DB row (Drizzle) to frontend TestScenario type.
 */
function dbToScenario(row: any): TestScenario {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    profile_id: row.profileId ?? row.profile_id ?? '',
    project_id: row.projectId ?? row.project_id ?? '',
    scenario_code: row.scenarioCode ?? row.scenario_code ?? '',
    name: row.name ?? '',
    description: row.description ?? '',
    status: row.status ?? 'DRAFT',
    version: row.version ?? 1,
    steps: row.steps ?? [],
    required_dataset_types: row.requiredDatasetTypes ?? row.required_dataset_types ?? [],
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export function useScenarios(profileId: string) {
  const query = trpc.scenarios.list.useQuery(
    { projectId: profileId },
    { enabled: !!profileId, staleTime: 30_000 },
  );

  return {
    data: query.data ? extractItems(query.data).map(dbToScenario) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useScenarioDetail(scenarioId: string) {
  const query = trpc.scenarios.getByUid.useQuery(
    { uid: scenarioId },
    { enabled: !!scenarioId, staleTime: 30_000 },
  );

  return {
    data: query.data ? dbToScenario(query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateScenario() {
  const utils = trpc.useUtils();
  const mutation = trpc.scenarios.create.useMutation({
    onSuccess: () => {
      utils.scenarios.list.invalidate();
    },
  });

  return {
    mutateAsync: async (profileId: string, data: Record<string, any>, projectId?: string) => {
      const result = await mutation.mutateAsync({
        projectId: projectId ?? data.project_id ?? '',
        profileId,
        scenarioCode: data.scenario_code ?? `SC-${Date.now()}`,
        name: data.name ?? '',
        description: data.description,
        testType: (data.test_type as any) ?? 'VABF',
        steps: data.steps as any,
        requiredDatasetTypes: data.required_dataset_types,
        artifactPolicy: data.artifact_policy,
        kpiThresholds: data.kpi_thresholds as any,
      });
      return dbToScenario(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateScenario() {
  const utils = trpc.useUtils();
  const mutation = trpc.scenarios.update.useMutation({
    onSuccess: () => {
      utils.scenarios.list.invalidate();
    },
  });

  return {
    mutateAsync: async (scenarioId: string, data: Record<string, any>) => {
      const result = await mutation.mutateAsync({
        uid: scenarioId,
        name: data.name,
        description: data.description,
        scenarioCode: data.scenario_code,
        testType: data.test_type as any,
        status: data.status as any,
        version: data.version,
        steps: data.steps as any,
        requiredDatasetTypes: data.required_dataset_types,
        artifactPolicy: data.artifact_policy,
        kpiThresholds: data.kpi_thresholds as any,
      });
      return dbToScenario(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useDeleteScenario() {
  const utils = trpc.useUtils();
  const mutation = trpc.scenarios.delete.useMutation({
    onSuccess: () => {
      utils.scenarios.list.invalidate();
    },
  });

  return {
    mutateAsync: async (scenarioId: string) => {
      return mutation.mutateAsync({ uid: scenarioId });
    },
    isPending: mutation.isPending,
  };
}

export function useFinalizeScenario() {
  const utils = trpc.useUtils();
  const mutation = trpc.scenarios.update.useMutation({
    onSuccess: () => {
      utils.scenarios.list.invalidate();
    },
  });

  return {
    mutateAsync: async (scenarioId: string) => {
      const result = await mutation.mutateAsync({
        uid: scenarioId,
        status: 'FINAL',
      });
      return dbToScenario(result);
    },
    isPending: mutation.isPending,
  };
}

export function useDeprecateScenario() {
  const utils = trpc.useUtils();
  const mutation = trpc.scenarios.update.useMutation({
    onSuccess: () => {
      utils.scenarios.list.invalidate();
    },
  });

  return {
    mutateAsync: async (scenarioId: string) => {
      const result = await mutation.mutateAsync({
        uid: scenarioId,
        status: 'DEPRECATED',
      });
      return dbToScenario(result);
    },
    isPending: mutation.isPending,
  };
}
