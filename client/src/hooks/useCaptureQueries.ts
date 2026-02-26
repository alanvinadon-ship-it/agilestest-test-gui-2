import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectorApi } from '../api/collectorApi';
import type { CreateCaptureRequest } from '../types';

export const captureKeys = {
  all: ['captures'] as const,
  list: (executionId: string) => [...captureKeys.all, 'list', executionId] as const,
  detail: (captureId: string) => [...captureKeys.all, 'detail', captureId] as const,
};

export function useCaptures(executionId: string) {
  return useQuery({
    queryKey: captureKeys.list(executionId),
    queryFn: () => collectorApi.listCaptures(executionId),
    enabled: !!executionId,
  });
}

export function useCaptureDetail(captureId: string) {
  return useQuery({
    queryKey: captureKeys.detail(captureId),
    queryFn: () => collectorApi.getCapture(captureId),
    enabled: !!captureId,
  });
}

export function useCreateCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCaptureRequest) => collectorApi.createCapture(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: captureKeys.list(variables.execution_id) });
    },
  });
}

export function useCancelCapture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (captureId: string) => collectorApi.cancelCapture(captureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: captureKeys.all });
    },
  });
}
