import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { Probe, ProbeWithPolicy, PaginatedResponse, CreateProbeRequest, UpdateProbeRequest } from '../types';

export const probeKeys = {
  all: ['probes'] as const,
  list: (params?: Record<string, unknown>) => [...probeKeys.all, 'list', params] as const,
  detail: (probeId: string) => [...probeKeys.all, 'detail', probeId] as const,
};

/** Extract items array from paginated result { items, total } */
function extractItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.items && Array.isArray(data.items)) return data.items;
  return [];
}

/**
 * Adapter: converts DB row (Drizzle) to frontend Probe type.
 */
function dbToProbe(row: any): Probe {
  if (!row) return row;
  return {
    probe_id: row.uid ?? row.probe_id ?? row.id,
    site: row.site ?? '',
    zone: row.zone ?? '',
    type: row.type ?? 'LINUX_EDGE',
    status: row.status ?? 'OFFLINE',
    capabilities: row.capabilities ?? [],
    auth_token_hash: row.authTokenHash ?? row.auth_token_hash ?? null,
    metadata: row.metadata ?? null,
    version: row.version ?? null,
    interfaces: row.interfaces ?? [],
    heartbeat_interval_sec: row.heartbeatIntervalSec ?? row.heartbeat_interval_sec ?? 60,
    allowlist_cidrs: row.allowlistCidrs ?? row.allowlist_cidrs ?? [],
    tls_enabled: row.tlsEnabled ?? row.tls_enabled ?? false,
    last_seen_at: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : (row.last_seen_at ?? null),
    uptime_seconds: row.uptimeSeconds ?? row.uptime_seconds ?? null,
    cpu_percent: row.cpuPercent ?? row.cpu_percent ?? null,
    disk_free_mb: row.diskFreeMb ?? row.disk_free_mb ?? null,
    active_sessions: row.activeSessions ?? row.active_sessions ?? null,
    total_captures: row.totalCaptures ?? row.total_captures ?? null,
    last_error: row.lastError ?? row.last_error ?? null,
    health_status: row.healthStatus ?? row.health_status ?? null,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ?? ''),
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ?? ''),
  };
}

export function useProbes(params?: { status?: string; type?: string; site?: string; zone?: string; project_id?: string }) {
  const query = trpc.probes.list.useQuery(
    { site: params?.site },
    { staleTime: 30_000 },
  );

  const items = extractItems(query.data);
  const total = (query.data as any)?.total ?? items.length;

  const adapted: PaginatedResponse<Probe> | undefined = query.data
    ? {
        data: items.map(dbToProbe),
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

export function useProbeDetail(probeId: string) {
  const query = trpc.probes.getByUid.useQuery(
    { uid: probeId },
    { enabled: !!probeId, staleTime: 30_000 },
  );

  return {
    data: query.data ? dbToProbe(query.data) : undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateProbe() {
  const utils = trpc.useUtils();
  const mutation = trpc.probes.create.useMutation({
    onSuccess: () => {
      utils.probes.list.invalidate();
    },
  });

  return {
    mutateAsync: async (data: CreateProbeRequest) => {
      const result = await mutation.mutateAsync({
        site: data.site,
        zone: data.zone,
        type: data.type as any,
        status: data.status as any,
        capabilities: data.capabilities,
        metadata: data.metadata,
        version: data.version,
        interfaces: data.interfaces,
        heartbeatIntervalSec: data.heartbeat_interval_sec,
        allowlistCidrs: data.allowlist_cidrs,
        tlsEnabled: data.tls_enabled,
      });
      return dbToProbe(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useUpdateProbe() {
  const utils = trpc.useUtils();
  const mutation = trpc.probes.update.useMutation({
    onSuccess: () => {
      utils.probes.list.invalidate();
    },
  });

  return {
    mutateAsync: async ({ probeId, data }: { probeId: string; data: UpdateProbeRequest }) => {
      const result = await mutation.mutateAsync({
        uid: probeId,
        status: data.status as any,
        capabilities: data.capabilities,
        metadata: data.metadata,
        version: data.version,
        interfaces: data.interfaces,
      });
      return dbToProbe(result);
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

export function useDeleteProbe() {
  const utils = trpc.useUtils();
  const mutation = trpc.probes.delete.useMutation({
    onSuccess: () => {
      utils.probes.list.invalidate();
    },
  });

  return {
    mutateAsync: async (probeId: string) => {
      return mutation.mutateAsync({ uid: probeId });
    },
    mutate: (probeId: string, opts?: any) => {
      mutation.mutateAsync({ uid: probeId }).then(r => opts?.onSuccess?.(r)).catch(e => opts?.onError?.(e));
    },
    isPending: mutation.isPending,
  };
}

export function useRegenerateProbeToken() {
  // No direct tRPC endpoint for token regeneration yet - placeholder
  const mutateAsync = async (_probeId: string) => {
    return { token: 'token-regeneration-not-implemented' };
  };
  return {
    mutateAsync,
    mutate: (probeId: string, opts?: any) => {
      mutateAsync(probeId).then(r => opts?.onSuccess?.(r)).catch(e => opts?.onError?.(e));
    },
    isPending: false,
  };
}

export function useSitesAndZones(_projectId?: string) {
  // Derive sites/zones from probe list
  const query = trpc.probes.list.useQuery({}, { staleTime: 60_000 });

  const items = extractItems(query.data);
  const sitesAndZones = items.length > 0
    ? {
        sites: [...new Set(items.map((p: any) => p.site).filter(Boolean))],
        zones: [...new Set(items.map((p: any) => p.zone).filter(Boolean))],
      }
    : { sites: [], zones: [] };

  return {
    data: sitesAndZones,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCaptureProfiles() {
  // Capture profiles are static definitions - return hardcoded list
  return {
    data: [
      { id: 'WEB', name: 'Web', description: 'HTTP/HTTPS traffic capture' },
      { id: 'IMS', name: 'IMS', description: 'IMS/SIP signaling capture' },
      { id: 'DIAMETER', name: 'Diameter', description: 'Diameter protocol capture' },
      { id: 'HTTP2', name: 'HTTP/2', description: 'HTTP/2 traffic capture' },
      { id: 'SIP', name: 'SIP', description: 'SIP protocol capture' },
      { id: 'CUSTOM', name: 'Custom', description: 'Custom BPF filter' },
    ],
    isLoading: false,
    error: null,
  };
}

// ─── Probe Hardening (PROBE-HARDEN-1) ─────────────────────────────────────

export function useProbeHealth(probeId: string) {
  const query = trpc.probes.getByUid.useQuery(
    { uid: probeId },
    { enabled: !!probeId, refetchInterval: 30000 },
  );

  const health = query.data
    ? {
        status: (query.data as any).healthStatus ?? 'unknown',
        cpu_percent: (query.data as any).cpuPercent,
        disk_free_mb: (query.data as any).diskFreeMb,
        uptime_seconds: (query.data as any).uptimeSeconds,
        last_seen_at: (query.data as any).lastSeenAt,
        active_sessions: (query.data as any).activeSessions,
        last_error: (query.data as any).lastError ?? null,
        total_captures: (query.data as any).totalCaptures ?? 0,
        interfaces: (query.data as any).interfaces ?? [],
        version: (query.data as any).version ?? null,
      }
    : undefined;

  return {
    data: health,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useProbeHeartbeat() {
  const utils = trpc.useUtils();
  const mutation = trpc.probes.update.useMutation({
    onSuccess: () => {
      utils.probes.list.invalidate();
    },
  });

  type HeartbeatParams = {
    probeId: string;
    payload?: {
      status?: 'healthy' | 'degraded' | 'unhealthy';
      version?: string;
      cpu_percent?: number;
      disk_free_mb?: number;
      interfaces?: string[];
      active_sessions?: number;
    };
  };

  const doMutate = (params: HeartbeatParams) => {
    return mutation.mutateAsync({
      uid: params.probeId,
      healthStatus: params.payload?.status as any,
      version: params.payload?.version,
      cpuPercent: params.payload?.cpu_percent,
      diskFreeMb: params.payload?.disk_free_mb,
      interfaces: params.payload?.interfaces,
      activeSessions: params.payload?.active_sessions,
      lastSeenAt: new Date(),
    });
  };

  return {
    mutateAsync: doMutate,
    mutate: (params: HeartbeatParams, opts?: { onSuccess?: (r: any) => void; onError?: (e: any) => void }) => {
      doMutate(params).then(r => opts?.onSuccess?.(r)).catch(e => opts?.onError?.(e));
    },
    isPending: mutation.isPending,
  };
}

export function useTestProbeCapture() {
  // Placeholder - test capture not yet available via tRPC
  const [data, setData] = useState<any>(null);
  const mutateAsync = async (_params: { probeId: string; iface: string }) => {
    const result = { success: true, message: 'Test capture not implemented via tRPC yet', packets_captured: 0, reason_code: '' };
    setData(result);
    return result;
  };
  return {
    mutateAsync,
    mutate: (params: { probeId: string; iface: string }, opts?: any) => {
      mutateAsync(params).then(r => opts?.onSuccess?.(r)).catch(e => opts?.onError?.(e));
    },
    data,
    isPending: false,
  };
}
