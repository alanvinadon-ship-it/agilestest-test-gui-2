import { trpc } from '@/lib/trpc';
import type { DatasetType } from '../types';

/**
 * Adapter: converts DB row (Drizzle) to frontend DatasetType type.
 */
function dbToDatasetType(row: any): DatasetType {
  if (!row) return row;
  return {
    id: row.uid ?? row.id ?? '',
    dataset_type_id: row.datasetTypeId ?? row.dataset_type_id ?? row.uid ?? '',
    domain: row.domain ?? '',
    name: row.name ?? '',
    test_type: row.testType ?? row.test_type ?? undefined,
    description: row.description ?? '',
    schema_fields: row.schemaFields ?? row.schema_fields ?? [],
    example_placeholders: row.examplePlaceholders ?? row.example_placeholders ?? {},
    tags: row.tags ?? [],
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export function useDatasetTypes(params?: { domain?: string; test_type?: string }) {
  const query = trpc.datasets.listTypes.useQuery(
    { domain: params?.domain },
    { staleTime: 60_000 },
  );

  const extractItems = (d: any): any[] => {
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (d.items && Array.isArray(d.items)) return d.items;
    return [];
  };

  return {
    data: query.data ? extractItems(query.data).map(dbToDatasetType) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDatasetTypeDetail(typeId: string) {
  const query = trpc.datasets.getTypeByUid.useQuery(
    { uid: typeId },
    { enabled: !!typeId, staleTime: 60_000 },
  );

  return {
    data: query.data ? dbToDatasetType(query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCreateDatasetType() {
  const utils = trpc.useUtils();
  const mutation = trpc.datasets.createType.useMutation({
    onSuccess: () => {
      utils.datasets.listTypes.invalidate();
    },
  });

  return {
    mutateAsync: async (data: Record<string, any>) => {
      const result = await mutation.mutateAsync({
        datasetTypeId: data.dataset_type_id ?? `DST-${Date.now()}`,
        domain: data.domain,
        name: data.name,
        testType: data.test_type,
        description: data.description,
        schemaFields: data.schema_fields,
        examplePlaceholders: data.example_placeholders,
        tags: data.tags,
      });
      return dbToDatasetType(result);
    },
    isPending: mutation.isPending,
  };
}
