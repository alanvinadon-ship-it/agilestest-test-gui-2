import apiClient from './client';
import {
  localArtifacts, localIncidents, localCaptures, localProbes,
} from './localStore';
import type {
  Artifact, Incident, PaginatedResponse,
  CaptureJob, CaptureDetail, CreateCaptureRequest,
  Probe, ProbeWithPolicy, ProbeWithScope, CreateProbeRequest, UpdateProbeRequest,
  CaptureProfile, CaptureProfileDef, SitesAndZones, ProbeRecommendation,
} from '../types';

const PREFIX = '/api/v1/collector';

/**
 * Détecte si une API backend est configurée.
 */
const API_AVAILABLE = !!import.meta.env.VITE_API_BASE_URL;

/**
 * Wrapper : si l'API est configurée, tente l'appel distant avec fallback local.
 * Sinon, utilise directement le localStore (pas d'attente réseau).
 */
async function withFallback<T>(apiFn: () => Promise<T>, localFn: () => T): Promise<T> {
  if (!API_AVAILABLE) {
    return localFn();
  }
  try {
    return await apiFn();
  } catch {
    return localFn();
  }
}

export const collectorApi = {
  // ─── Artifacts ─────────────────────────────────────────────────────────────

  listArtifacts: (executionId: string) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<Artifact>>(`${PREFIX}/executions/${executionId}/artifacts`).then(r => r.data),
      () => localArtifacts.list(executionId),
    ),

  getArtifact: (id: string) =>
    withFallback(
      () => apiClient.get<Artifact>(`${PREFIX}/artifacts/${id}`).then(r => r.data),
      () => { throw new Error('Non disponible en mode local'); },
    ),

  getArtifactDownloadUrl: (artifactId: string) =>
    withFallback(
      () => apiClient.get<{ download_url: string; expires_in_sec: number | null }>(`${PREFIX}/artifacts/${artifactId}/download`).then(r => r.data),
      () => ({ download_url: '#', expires_in_sec: null }),
    ),

  // ─── Incidents ─────────────────────────────────────────────────────────────

  getIncident: (id: string) =>
    withFallback(
      () => apiClient.get<Incident>(`${PREFIX}/incidents/${id}`).then(r => r.data),
      () => { throw new Error('Non disponible en mode local'); },
    ),

  listIncidentsByExecution: (executionId: string) =>
    withFallback(
      () => apiClient.get<PaginatedResponse<Incident>>(`${PREFIX}/executions/${executionId}/incidents`).then(r => r.data)
        .catch(() => ({ data: [] as Incident[], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } })),
      () => localIncidents.list(executionId),
    ),

  // ─── Captures ──────────────────────────────────────────────────────────────

  createCapture: (data: CreateCaptureRequest) =>
    withFallback(
      () => apiClient.post<CaptureDetail>(`${PREFIX}/captures`, data).then(r => r.data),
      () => localCaptures.create(data),
    ),

  getCapture: (captureId: string) =>
    withFallback(
      () => apiClient.get<CaptureDetail>(`${PREFIX}/captures/${captureId}`).then(r => r.data),
      () => localCaptures.get(captureId),
    ),

  listCaptures: (executionId: string) =>
    withFallback(
      () => apiClient.get<{ data: CaptureJob[]; total: number }>(`${PREFIX}/captures`, { params: { execution_id: executionId } }).then(r => r.data),
      () => localCaptures.list(executionId),
    ),

  cancelCapture: (captureId: string) =>
    withFallback(
      () => apiClient.post<CaptureJob>(`${PREFIX}/captures/${captureId}/cancel`).then(r => r.data),
      () => { throw new Error('Non disponible en mode local'); },
    ),

  // ─── Probes ────────────────────────────────────────────────────────────────

  listProbes: (params?: { status?: string; type?: string; site?: string; zone?: string; project_id?: string }) =>
    withFallback(
      () => apiClient.get<{ data: Probe[]; total: number }>(`${PREFIX}/probes`, { params }).then(r => r.data),
      () => localProbes.list(params),
    ),

  getProbe: (probeId: string) =>
    withFallback(
      () => apiClient.get<{ data: ProbeWithScope }>(`${PREFIX}/probes/${probeId}`).then(r => r.data.data),
      () => localProbes.get(probeId),
    ),

  createProbe: (data: CreateProbeRequest) =>
    withFallback(
      () => apiClient.post<{ data: ProbeWithPolicy & { auth_token: string } }>(`${PREFIX}/probes`, data).then(r => r.data.data),
      () => localProbes.create(data),
    ),

  updateProbe: (probeId: string, data: UpdateProbeRequest) =>
    withFallback(
      () => apiClient.put<{ data: ProbeWithPolicy }>(`${PREFIX}/probes/${probeId}`, data).then(r => r.data.data),
      () => localProbes.update(probeId, data),
    ),

  deleteProbe: (probeId: string) =>
    withFallback(
      () => apiClient.delete(`${PREFIX}/probes/${probeId}`).then(r => r.data),
      () => localProbes.delete(probeId),
    ),

  regenerateProbeToken: (probeId: string) =>
    withFallback(
      () => apiClient.post<{ data: { token: string } }>(`${PREFIX}/probes/${probeId}/regenerate-token`).then(r => r.data.data),
      () => localProbes.regenerateToken(probeId),
    ),

  listOnlineProbes: () =>
    withFallback(
      () => apiClient.get<{ data: Probe[]; total: number }>(`${PREFIX}/probes`, { params: { status: 'ONLINE' } }).then(r => r.data),
      () => localProbes.list({ status: 'ONLINE' }),
    ),

  // ─── Probe Hardening (PROBE-HARDEN-1) ───────────────────────────────

  probeHeartbeat: (probeId: string, payload?: {
    status?: 'healthy' | 'degraded' | 'unhealthy';
    version?: string;
    cpu_percent?: number;
    disk_free_mb?: number;
    interfaces?: string[];
    active_sessions?: number;
  }) =>
    withFallback(
      () => apiClient.post<{ data: Probe }>(`${PREFIX}/probes/${probeId}/heartbeat`, payload).then(r => r.data.data),
      () => localProbes.heartbeat(probeId, payload),
    ),

  getProbeHealth: (probeId: string) =>
    withFallback(
      () => apiClient.get<{ data: ReturnType<typeof localProbes.getHealth> }>(`${PREFIX}/probes/${probeId}/health`).then(r => r.data.data),
      () => localProbes.getHealth(probeId),
    ),

  testProbeCapture: (probeId: string, iface: string) =>
    withFallback(
      () => apiClient.post<{ data: ReturnType<typeof localProbes.testCapture> }>(`${PREFIX}/probes/${probeId}/test-capture`, { iface }).then(r => r.data.data),
      () => localProbes.testCapture(probeId, iface),
    ),

  // ─── Sites & Zones ─────────────────────────────────────────────────────────

  listSitesAndZones: (projectId?: string) =>
    withFallback(
      () => apiClient.get<{ data: SitesAndZones }>(`${PREFIX}/probes-meta/sites-zones`, { params: projectId ? { project_id: projectId } : {} }).then(r => r.data.data),
      () => ({ sites: ['Abidjan', 'Yamoussoukro', 'Bouaké'], zones: ['DMZ', 'Core', 'Edge'] }),
    ),

  listCompatibleProbes: (params: { project_id: string; capture_type: 'LOGS' | 'PCAP'; site?: string; zone?: string }) =>
    withFallback(
      () => apiClient.get<{ data: ProbeWithPolicy[] }>(`${PREFIX}/probes-meta/compatible`, { params }).then(r => r.data.data),
      () => [] as ProbeWithPolicy[],
    ),

  // ─── Capture Profiles ──────────────────────────────────────────────────────

  getCaptureProfiles: () =>
    withFallback(
      () => apiClient.get<{ data: Record<CaptureProfile, CaptureProfileDef> }>(`${PREFIX}/capture-profiles`).then(r => r.data.data),
      () => ({
        WEB: { label: 'Web', description: 'Capture HTTP/HTTPS', default_capture_type: 'PCAP' as const, default_bpf_filter: 'tcp port 80 or tcp port 443', recommended_probe_type: 'LINUX_EDGE' as const },
        IMS: { label: 'IMS', description: 'Capture SIP/RTP', default_capture_type: 'PCAP' as const, default_bpf_filter: 'udp port 5060', recommended_probe_type: 'NETWORK_TAP' as const },
        SIP: { label: 'SIP', description: 'Capture SIP', default_capture_type: 'PCAP' as const, default_bpf_filter: 'udp port 5060', recommended_probe_type: 'NETWORK_TAP' as const },
        HTTP2: { label: 'HTTP/2', description: 'Capture HTTP/2', default_capture_type: 'PCAP' as const, default_bpf_filter: 'tcp port 443', recommended_probe_type: 'LINUX_EDGE' as const },
        DIAMETER: { label: 'Diameter', description: 'Capture Diameter', default_capture_type: 'PCAP' as const, default_bpf_filter: 'tcp port 3868', recommended_probe_type: 'NETWORK_TAP' as const },
        CUSTOM: { label: 'Custom', description: 'Capture personnalisée', default_capture_type: 'PCAP' as const, default_bpf_filter: '', recommended_probe_type: 'LINUX_EDGE' as const },
      }),
    ),

  getCaptureProfile: (profile: CaptureProfile) =>
    withFallback(
      () => apiClient.get<{ data: CaptureProfileDef & { profile: CaptureProfile } }>(`${PREFIX}/capture-profiles/${profile}`).then(r => r.data.data),
      () => ({ profile, label: profile, description: `Profil ${profile}`, default_capture_type: 'PCAP' as const, default_bpf_filter: '', recommended_probe_type: 'LINUX_EDGE' as const }),
    ),

  getProbeRecommendation: (profile: CaptureProfile) =>
    withFallback(
      () => apiClient.get<{ data: ProbeRecommendation }>(`${PREFIX}/capture-profiles/${profile}/recommendation`).then(r => r.data.data),
      () => ({ recommended: 'LINUX_EDGE' as const, reason: 'Recommandation par défaut' }),
    ),
};
