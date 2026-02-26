import { trpc } from '@/lib/trpc';
import type { TestProfile, PaginatedResponse } from '../types';

/**
 * Adapter: converts DB row (Drizzle) to frontend TestProfile type.
 */
function dbToProfile(row: any): TestProfile {
  if (!row) return row;
  return {
    id: row.uid ?? row.id,
    project_id: row.projectId ?? row.project_id ?? '',
    name: row.name ?? '',
    domain: row.domain ?? '',
    test_type: row.testType ?? row.test_type ?? 'VABF',
    protocol: row.protocol ?? '',
    description: row.description ?? '',
    profile_type: row.profileType ?? row.profile_type ?? '',
    target_host: row.targetHost ?? row.target_host ?? '',
    target_port: row.targetPort ?? row.target_port ?? 0,
    parameters: row.parameters ?? {},
    config: row.config ?? {},
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export function useProfiles(projectId: string) {
  const query = trpc.profiles.list.useQuery(
    { projectId },
    { enabled: !!projectId, staleTime: 30_000 },
  );

  const adapted: PaginatedResponse<TestProfile> | undefined = query.data
    ? {
        data: (query.data as any[]).map(dbToProfile),
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

export function useProfileDetail(profileId: string) {
  const query = trpc.profiles.getByUid.useQuery(
    { uid: profileId },
    { enabled: !!profileId, staleTime: 30_000 },
  );

  return {
    data: query.data ? dbToProfile(query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateProfile() {
  const utils = trpc.useUtils();
  const mutation = trpc.profiles.create.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
    },
  });

  return {
    mutateAsync: async (data: Record<string, any>) => {
      const result = await mutation.mutateAsync({
        projectId: data.projectId ?? data.project_id,
        name: data.name,
        domain: data.domain,
        testType: data.testType ?? data.test_type ?? 'VABF',
        protocol: data.protocol,
        description: data.description,
        profileType: data.profileType ?? data.profile_type,
        targetHost: data.targetHost ?? data.target_host,
        targetPort: data.targetPort ?? data.target_port,
        parameters: data.parameters,
        config: data.config,
      });
      return dbToProfile(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateProfile() {
  const utils = trpc.useUtils();
  const mutation = trpc.profiles.update.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
    },
  });

  return {
    mutateAsync: async (profileId: string, data: Record<string, any>) => {
      const result = await mutation.mutateAsync({
        uid: profileId,
        name: data.name,
        domain: data.domain,
        testType: data.test_type,
        protocol: data.protocol,
        description: data.description,
        profileType: data.profile_type,
        targetHost: data.target_host,
        targetPort: data.target_port,
        parameters: data.parameters,
        config: data.config,
      });
      return dbToProfile(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useDeleteProfile() {
  const utils = trpc.useUtils();
  const mutation = trpc.profiles.delete.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
    },
  });

  return {
    mutateAsync: async (profileId: string) => {
      return mutation.mutateAsync({ uid: profileId });
    },
    isPending: mutation.isPending,
  };
}
