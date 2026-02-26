import { trpc } from '@/lib/trpc';
import type { CreateProjectRequest, UpdateProjectRequest, PaginatedResponse, Project } from '../types';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/**
 * Adapter: converts DB row (Drizzle) to frontend Project type.
 * DB uses { uid, created_by, createdAt, ... } while frontend uses { id, created_by, created_at, ... }
 */
function dbToProject(row: any): Project {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    name: row.name,
    description: row.description ?? '',
    domain: row.domain,
    status: row.status ?? 'ACTIVE',
    created_by: row.createdBy ?? row.created_by ?? '',
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

/** Extract items array from paginated result { items, total } */
function extractItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  return [];
}

export function useProjects(params?: { page?: number; limit?: number; status?: string; domain?: string }) {
  const query = trpc.projects.list.useQuery({}, {
    staleTime: 30_000,
  });

  // Adapt the tRPC paginated response { items, total } to PaginatedResponse<Project>
  const adapted: PaginatedResponse<Project> | undefined = query.data
    ? {
        data: extractItems(query.data).map(dbToProject),
        pagination: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 50,
          total: (query.data as any).total ?? extractItems(query.data).length,
          total_pages: Math.max(1, Math.ceil(((query.data as any).total ?? extractItems(query.data).length) / (params?.limit ?? 50))),
        },
      }
    : undefined;

  return {
    data: adapted,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useProjectDetail(projectId: string) {
  const query = trpc.projects.getByUid.useQuery(
    { uid: projectId },
    { enabled: !!projectId, staleTime: 30_000 },
  );

  return {
    data: query.data ? dbToProject(query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateProject() {
  const utils = trpc.useUtils();
  const mutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });

  return {
    mutateAsync: async (data: CreateProjectRequest) => {
      const result = await mutation.mutateAsync({
        name: data.name,
        domain: data.domain,
        description: data.description,
      });
      return dbToProject(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateProject() {
  const utils = trpc.useUtils();
  const mutation = trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });

  return {
    mutateAsync: async ({ projectId, data }: { projectId: string; data: UpdateProjectRequest }) => {
      const result = await mutation.mutateAsync({
        uid: projectId,
        name: data.name,
        domain: data.domain,
        description: data.description,
        status: data.status as any,
      });
      return dbToProject(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useDeleteProject() {
  const utils = trpc.useUtils();
  const mutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });

  return {
    mutateAsync: async (projectId: string) => {
      return mutation.mutateAsync({ uid: projectId });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
