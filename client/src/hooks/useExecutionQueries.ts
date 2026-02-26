import { trpc } from '@/lib/trpc';
import type { Execution, PaginatedResponse } from '../types';

/**
 * Adapter: converts DB row (Drizzle) to frontend Execution type.
 */
function dbToExecution(row: any): Execution {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    project_id: row.projectId ?? row.project_id ?? '',
    profile_id: row.profileId ?? row.profile_id ?? '',
    scenario_id: row.scenarioId ?? row.scenario_id ?? '',
    status: row.status ?? 'PENDING',
    runner_type: row.runnerType ?? row.runner_type ?? '',
    script_id: row.scriptId ?? row.script_id ?? null,
    script_version: row.scriptVersion ?? row.script_version ?? null,
    dataset_bundle_id: row.datasetBundleId ?? row.dataset_bundle_id ?? null,
    target_env: row.targetEnv ?? row.target_env ?? 'DEV',
    runner_id: row.runnerId ?? row.runner_id ?? null,
    started_at: row.startedAt ? new Date(row.startedAt).toISOString() : (row.started_at ?? null),
    finished_at: row.finishedAt ? new Date(row.finishedAt).toISOString() : (row.finished_at ?? null),
    duration_ms: row.durationMs ?? row.duration_ms ?? null,
    artifacts_count: row.artifactsCount ?? row.artifacts_count ?? 0,
    incidents_count: row.incidentsCount ?? row.incidents_count ?? 0,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export function useExecutions(projectId: string) {
  const query = trpc.executions.list.useQuery(
    { projectId },
    { enabled: !!projectId, staleTime: 30_000 },
  );

  const adapted: PaginatedResponse<Execution> | undefined = query.data
    ? {
        data: (query.data as any[]).map(dbToExecution),
        pagination: { page: 1, limit: 50, total: (query.data as any[]).length, total_pages: 1 },
      }
    : undefined;

  return {
    data: adapted,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useExecutionDetail(executionId: string) {
  const query = trpc.executions.getByUid.useQuery(
    { uid: executionId },
    { enabled: !!executionId, staleTime: 30_000 },
  );

  return {
    data: query.data ? dbToExecution(query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateExecution() {
  const utils = trpc.useUtils();
  const mutation = trpc.executions.create.useMutation({
    onSuccess: () => {
      utils.executions.list.invalidate();
    },
  });

  return {
    mutateAsync: async (data: Record<string, any>) => {
      const result = await mutation.mutateAsync({
        projectId: data.project_id ?? data.projectId,
        profileId: data.profile_id ?? data.profileId,
        scenarioId: data.scenario_id ?? data.scenarioId,
        runnerType: data.runner_type ?? data.runnerType,
        scriptId: data.script_id ?? data.scriptId,
        scriptVersion: data.script_version ?? data.scriptVersion,
        datasetBundleId: data.dataset_bundle_id ?? data.datasetBundleId,
        targetEnv: data.target_env ?? data.targetEnv,
        runnerId: data.runner_id ?? data.runnerId,
      });
      return dbToExecution(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateExecutionStatus() {
  const utils = trpc.useUtils();
  const mutation = trpc.executions.updateStatus.useMutation({
    onSuccess: () => {
      utils.executions.list.invalidate();
    },
  });

  return {
    mutateAsync: async (executionId: string, data: Record<string, any>) => {
      const result = await mutation.mutateAsync({
        uid: executionId,
        status: data.status,
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        finishedAt: data.finished_at ? new Date(data.finished_at) : undefined,
        durationMs: data.duration_ms,
        artifactsCount: data.artifacts_count,
        incidentsCount: data.incidents_count,
        runnerId: data.runner_id,
      });
      return dbToExecution(result);
    },
    isPending: mutation.isPending,
  };
}

export function useDeleteExecution() {
  const utils = trpc.useUtils();
  const mutation = trpc.executions.delete.useMutation({
    onSuccess: () => {
      utils.executions.list.invalidate();
    },
  });

  return {
    mutateAsync: async (executionId: string) => {
      return mutation.mutateAsync({ uid: executionId });
    },
    isPending: mutation.isPending,
  };
}

// ─── Artifacts ──────────────────────────────────────────────────────────

export function useArtifacts(executionId: string) {
  const query = trpc.executions.listArtifacts.useQuery(
    { executionId },
    { enabled: !!executionId, staleTime: 30_000 },
  );

  return {
    data: query.data as any[] | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── Incidents ──────────────────────────────────────────────────────────

export function useIncidents(projectId: string) {
  const query = trpc.executions.listIncidents.useQuery(
    { projectId },
    { enabled: !!projectId, staleTime: 30_000 },
  );

  return {
    data: query.data as any[] | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useIncidentsByExecution(executionId: string) {
  const query = trpc.executions.listIncidentsByExecution.useQuery(
    { executionId },
    { enabled: !!executionId, staleTime: 30_000 },
  );

  return {
    data: query.data as any[] | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateIncident() {
  const utils = trpc.useUtils();
  const mutation = trpc.executions.createIncident.useMutation({
    onSuccess: () => {
      utils.executions.listIncidents.invalidate();
      utils.executions.listIncidentsByExecution.invalidate();
    },
  });

  return {
    mutateAsync: async (data: Record<string, any>) => {
      return mutation.mutateAsync({
        executionId: data.execution_id ?? data.executionId,
        projectId: data.project_id ?? data.projectId,
        title: data.title,
        description: data.description,
        severity: data.severity,
        stepName: data.step_name ?? data.stepName,
        expectedResult: data.expected_result ?? data.expectedResult,
        actualResult: data.actual_result ?? data.actualResult,
      });
    },
    isPending: mutation.isPending,
  };
}
