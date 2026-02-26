import { trpc } from '@/lib/trpc';

/**
 * Hooks tRPC pour le module Drive Test.
 * Remplace les appels directs à localStore pour les campagnes, jobs, KPI, etc.
 */

// ─── Campaigns ──────────────────────────────────────────────────────────

export function useDriveCampaigns(projectId: string) {
  const query = trpc.drivetest.listCampaigns.useQuery(
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

export function useDriveCampaignDetail(campaignId: string) {
  const query = trpc.drivetest.getCampaign.useQuery(
    { uid: campaignId },
    { enabled: !!campaignId, staleTime: 30_000 },
  );

  return {
    data: query.data as any | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateDriveCampaign() {
  const utils = trpc.useUtils();
  const mutation = trpc.drivetest.createCampaign.useMutation({
    onSuccess: () => {
      utils.drivetest.listCampaigns.invalidate();
    },
  });

  return {
    mutateAsync: async (data: Record<string, any>) => {
      return mutation.mutateAsync({
        projectId: data.project_id ?? data.projectId,
        name: data.name,
        description: data.description,
        targetEnv: data.target_env ?? data.targetEnv,
        networkType: data.network_type ?? data.networkType,
        area: data.area ?? data.region,
        startDate: data.start_date ?? data.startDate,
        endDate: data.end_date ?? data.endDate,
        createdBy: data.created_by ?? data.createdBy,
      });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateDriveCampaign() {
  const utils = trpc.useUtils();
  const mutation = trpc.drivetest.updateCampaign.useMutation({
    onSuccess: () => {
      utils.drivetest.listCampaigns.invalidate();
    },
  });

  return {
    mutateAsync: async (campaignId: string, data: Record<string, any>) => {
      return mutation.mutateAsync({
        uid: campaignId,
        name: data.name,
        description: data.description,
        status: data.status,
        targetEnv: data.target_env ?? data.targetEnv,
        networkType: data.network_type ?? data.networkType,
        area: data.area ?? data.region,
        startDate: data.start_date ?? data.startDate,
        endDate: data.end_date ?? data.endDate,
      });
    },
    isPending: mutation.isPending,
  };
}

export function useDeleteDriveCampaign() {
  const utils = trpc.useUtils();
  const mutation = trpc.drivetest.deleteCampaign.useMutation({
    onSuccess: () => {
      utils.drivetest.listCampaigns.invalidate();
    },
  });

  return {
    mutateAsync: async (campaignId: string) => {
      return mutation.mutateAsync({ uid: campaignId });
    },
    isPending: mutation.isPending,
  };
}

// ─── Drive Jobs (Runs) ─────────────────────────────────────────────────

export function useDriveJobs(campaignId: string) {
  const query = trpc.drivetest.listJobs.useQuery(
    { campaignId },
    { enabled: !!campaignId, staleTime: 30_000 },
  );

  return {
    data: query.data as any[] | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateDriveJob() {
  const utils = trpc.useUtils();
  const mutation = trpc.drivetest.createJob.useMutation({
    onSuccess: () => {
      utils.drivetest.listJobs.invalidate();
    },
  });

  return {
    mutateAsync: async (data: Record<string, any>) => {
      return mutation.mutateAsync({
        campaignId: data.campaign_id ?? data.campaignId,
        routeId: data.route_id ?? data.routeId,
        deviceId: data.device_id ?? data.deviceId,
        targetEnv: data.target_env ?? data.targetEnv,
        runnerId: data.runner_id ?? data.runnerId,
      });
    },
    isPending: mutation.isPending,
  };
}

export function useUpdateDriveJob() {
  const utils = trpc.useUtils();
  const mutation = trpc.drivetest.updateJob.useMutation({
    onSuccess: () => {
      utils.drivetest.listJobs.invalidate();
    },
  });

  return {
    mutateAsync: async (jobId: string, data: Record<string, any>) => {
      return mutation.mutateAsync({
        uid: jobId,
        status: data.status,
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        finishedAt: data.finished_at ? new Date(data.finished_at) : undefined,
        progressPct: data.progress_pct ?? data.progressPct,
        errorMessage: data.error_message ?? data.errorMessage,
      });
    },
    isPending: mutation.isPending,
  };
}

// ─── KPI Samples ────────────────────────────────────────────────────────

export function useDriveKpiSamples(driveJobId: string) {
  const query = trpc.drivetest.listKpiSamples.useQuery(
    { driveJobId },
    { enabled: !!driveJobId, staleTime: 30_000 },
  );

  return {
    data: query.data as any[] | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useInsertDriveKpiSamples() {
  const utils = trpc.useUtils();
  const mutation = trpc.drivetest.insertKpiSamples.useMutation({
    onSuccess: () => {
      utils.drivetest.listKpiSamples.invalidate();
    },
  });

  return {
    mutateAsync: async (samples: Record<string, any>[]) => {
      return mutation.mutateAsync({
        samples: samples.map((s) => ({
          driveJobId: s.drive_job_id ?? s.driveJobId,
          campaignId: s.campaign_id ?? s.campaignId,
          routeId: s.route_id ?? s.routeId,
          timestamp: new Date(s.timestamp),
          lat: s.lat,
          lon: s.lon ?? s.lng,
          kpiName: s.kpi_name ?? s.kpiName ?? s.kpi_type,
          value: s.value,
          unit: s.unit,
          cellId: s.cell_id ?? s.cellId,
          technology: s.technology,
        })),
      });
    },
    isPending: mutation.isPending,
  };
}

// ─── Run Summary ────────────────────────────────────────────────────────

export function useDriveRunSummary(driveJobId: string) {
  const query = trpc.drivetest.getRunSummary.useQuery(
    { driveJobId },
    { enabled: !!driveJobId, staleTime: 30_000 },
  );

  return {
    data: query.data as any | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────

export function useDriveRoutes(campaignId: string) {
  const query = trpc.drivetest.listRoutes.useQuery(
    { campaignId },
    { enabled: !!campaignId, staleTime: 30_000 },
  );

  return {
    data: query.data as any[] | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ─── Devices ────────────────────────────────────────────────────────────

export function useDriveDevices(projectId: string) {
  const query = trpc.drivetest.listDevices.useQuery(
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
