import { trpc } from '@/lib/trpc';
import type { CaptureJob, PaginatedResponse } from '../types';

export const captureKeys = {
  all: ['captures'] as const,
  list: (executionId: string) => [...captureKeys.all, 'list', executionId] as const,
  detail: (captureId: string) => [...captureKeys.all, 'detail', captureId] as const,
};

/** Extract items array from paginated result { items, total } */
function extractItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * Adapter: converts DB row (Drizzle) to frontend CaptureJob type.
 */
function dbToCapture(row: any): CaptureJob {
  if (!row) return row;
  return {
    capture_id: row.uid ?? row.capture_id ?? row.id,
    execution_id: row.executionId ?? row.execution_id ?? '',
    incident_id: row.incidentId ?? row.incident_id ?? null,
    project_id: row.projectId ?? row.project_id ?? '',
    triggered_by: row.triggeredBy ?? row.triggered_by ?? '',
    status: row.status ?? 'QUEUED',
    capture_type: row.captureType ?? row.capture_type ?? 'LOGS',
    target_type: row.targetType ?? row.target_type ?? 'K8S',
    duration_seconds: row.durationSeconds ?? row.duration_seconds ?? 0,
    max_size_mb: row.maxSizeMb ?? row.max_size_mb ?? 0,
    profile: row.profile ?? null,
    params: row.params ?? null,
    error_message: row.errorMessage ?? row.error_message ?? null,
    started_at: row.startedAt ? new Date(row.startedAt).toISOString() : (row.started_at ?? null),
    completed_at: row.completedAt ? new Date(row.completedAt).toISOString() : (row.completed_at ?? null),
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
  };
}

export function useCaptures(executionId: string) {
  const query = trpc.captures.listSessionsByExecution.useQuery(
    { executionId },
    { enabled: !!executionId, staleTime: 30_000 },
  );

  const items = extractItems(query.data);
  const total = (query.data as any)?.total ?? items.length;

  const adapted: PaginatedResponse<CaptureJob> | undefined = query.data
    ? {
        data: items.map(dbToCapture),
        pagination: { page: 1, limit: 50, total, total_pages: Math.max(1, Math.ceil(total / 50)) },
      }
    : undefined;

  return {
    data: adapted,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCaptureDetail(captureId: string) {
  const query = trpc.captures.getJobByUid.useQuery(
    { uid: captureId },
    { enabled: !!captureId, staleTime: 30_000 },
  );

  return {
    data: query.data ? dbToCapture(query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateCapture() {
  const utils = trpc.useUtils();
  const mutation = trpc.captures.createJob.useMutation({
    onSuccess: () => {
      utils.captures.listSessionsByExecution.invalidate();
      utils.captures.listJobs.invalidate();
    },
  });

  return {
    mutateAsync: async (data: {
      execution_id: string;
      project_id: string;
      capture_type: string;
      target_type: string;
      incident_id?: string;
      triggered_by?: string;
      duration_seconds?: number;
      max_size_mb?: number;
      profile?: string;
      params?: Record<string, unknown>;
    }) => {
      const result = await mutation.mutateAsync({
        executionId: data.execution_id,
        projectId: data.project_id,
        captureType: data.capture_type as any,
        targetType: data.target_type as any,
        incidentId: data.incident_id,
        triggeredBy: data.triggered_by,
        durationSeconds: data.duration_seconds,
        maxSizeMb: data.max_size_mb,
        profile: data.profile,
        params: data.params,
      });
      return dbToCapture(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useCancelCapture() {
  const utils = trpc.useUtils();
  const mutation = trpc.captures.updateJob.useMutation({
    onSuccess: () => {
      utils.captures.listSessionsByExecution.invalidate();
      utils.captures.listJobs.invalidate();
    },
  });

  return {
    mutateAsync: async (captureId: string) => {
      return mutation.mutateAsync({
        uid: captureId,
        status: 'CANCELLED',
      });
    },
    isPending: mutation.isPending,
  };
}
