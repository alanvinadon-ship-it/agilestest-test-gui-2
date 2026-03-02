import { trpc } from '@/lib/trpc';
import type { Project, CreateProjectRequest } from '../types';

/**
 * Map DB row (camelCase) → frontend Project (snake_case)
 */
function toFrontendProject(row: any): Project {
  return {
    id: row.uid || String(row.id),
    name: row.name || '',
    description: row.description || '',
    domain: row.domain || 'WEB',
    status: row.status || 'ACTIVE',
    created_by: row.createdBy || '',
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : '',
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : '',
  };
}

export function useProjects(params?: { page?: number; limit?: number; status?: string; domain?: string }) {
  const query = trpc.projects.list.useQuery({
    page: params?.page || 1,
    pageSize: params?.limit || 50,
    status: params?.status as any,
    domain: params?.domain,
  });

  // Transform data to match the expected format { data: Project[], pagination: ... }
  const transformedData = query.data
    ? {
        data: query.data.data.map(toFrontendProject),
        pagination: query.data.pagination,
      }
    : undefined;

  return {
    ...query,
    data: transformedData,
  };
}

export function useProjectDetail(projectId: string) {
  const query = trpc.projects.get.useQuery(
    { projectId },
    { enabled: !!projectId },
  );

  const transformedData = query.data ? toFrontendProject(query.data) : undefined;

  return {
    ...query,
    data: transformedData,
  };
}

export function useCreateProject() {
  const utils = trpc.useUtils();
  return trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });
}

export function useUpdateProject() {
  const utils = trpc.useUtils();
  return trpc.projects.update.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });
}

export function useDeleteProject() {
  const utils = trpc.useUtils();
  return trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
    },
  });
}
