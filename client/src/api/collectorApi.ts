import apiClient from './client';
import type {
  Artifact, Incident, PaginatedResponse,
  CaptureJob, CaptureDetail, CreateCaptureRequest,
  Probe, ProbeWithPolicy, ProbeWithScope, CreateProbeRequest, UpdateProbeRequest,
  CaptureProfile, CaptureProfileDef, SitesAndZones, ProbeRecommendation,
} from '../types';

const PREFIX = '/api/v1/collector';

export const collectorApi = {
  // ─── Artifacts ─────────────────────────────────────────────────────────────

  listArtifacts: (executionId: string) =>
    apiClient
      .get<PaginatedResponse<Artifact>>(`${PREFIX}/executions/${executionId}/artifacts`)
      .then((r) => r.data),

  getArtifact: (id: string) =>
    apiClient.get<Artifact>(`${PREFIX}/artifacts/${id}`).then((r) => r.data),

  getArtifactDownloadUrl: (artifactId: string) =>
    apiClient
      .get<{ download_url: string; expires_in_sec: number | null }>(`${PREFIX}/artifacts/${artifactId}/download`)
      .then((r) => r.data),

  // ─── Incidents ─────────────────────────────────────────────────────────────

  getIncident: (id: string) =>
    apiClient.get<Incident>(`${PREFIX}/incidents/${id}`).then((r) => r.data),

  listIncidentsByExecution: (executionId: string) =>
    apiClient
      .get<PaginatedResponse<Incident>>(`${PREFIX}/executions/${executionId}/incidents`)
      .then((r) => r.data)
      .catch(() => ({ data: [] as Incident[], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } })),

  // ─── Captures ──────────────────────────────────────────────────────────────

  createCapture: (data: CreateCaptureRequest) =>
    apiClient.post<CaptureDetail>(`${PREFIX}/captures`, data).then((r) => r.data),

  getCapture: (captureId: string) =>
    apiClient.get<CaptureDetail>(`${PREFIX}/captures/${captureId}`).then((r) => r.data),

  listCaptures: (executionId: string) =>
    apiClient
      .get<{ data: CaptureJob[]; total: number }>(`${PREFIX}/captures`, { params: { execution_id: executionId } })
      .then((r) => r.data),

  cancelCapture: (captureId: string) =>
    apiClient.post<CaptureJob>(`${PREFIX}/captures/${captureId}/cancel`).then((r) => r.data),

  // ─── Probes ────────────────────────────────────────────────────────────────

  listProbes: (params?: { status?: string; type?: string; site?: string; zone?: string; project_id?: string }) =>
    apiClient
      .get<{ data: Probe[]; total: number }>(`${PREFIX}/probes`, { params })
      .then((r) => r.data),

  getProbe: (probeId: string) =>
    apiClient.get<{ data: ProbeWithScope }>(`${PREFIX}/probes/${probeId}`).then((r) => r.data.data),

  createProbe: (data: CreateProbeRequest) =>
    apiClient.post<{ data: ProbeWithPolicy & { auth_token: string } }>(`${PREFIX}/probes`, data).then((r) => r.data.data),

  updateProbe: (probeId: string, data: UpdateProbeRequest) =>
    apiClient.put<{ data: ProbeWithPolicy }>(`${PREFIX}/probes/${probeId}`, data).then((r) => r.data.data),

  deleteProbe: (probeId: string) =>
    apiClient.delete(`${PREFIX}/probes/${probeId}`).then((r) => r.data),

  regenerateProbeToken: (probeId: string) =>
    apiClient.post<{ data: { token: string } }>(`${PREFIX}/probes/${probeId}/regenerate-token`).then((r) => r.data.data),

  listOnlineProbes: () =>
    apiClient
      .get<{ data: Probe[]; total: number }>(`${PREFIX}/probes`, { params: { status: 'ONLINE' } })
      .then((r) => r.data),

  // ─── Sites & Zones ─────────────────────────────────────────────────────────

  listSitesAndZones: (projectId?: string) =>
    apiClient
      .get<{ data: SitesAndZones }>(`${PREFIX}/probes-meta/sites-zones`, { params: projectId ? { project_id: projectId } : {} })
      .then((r) => r.data.data),

  listCompatibleProbes: (params: {
    project_id: string;
    capture_type: 'LOGS' | 'PCAP';
    site?: string;
    zone?: string;
  }) =>
    apiClient
      .get<{ data: ProbeWithPolicy[] }>(`${PREFIX}/probes-meta/compatible`, { params })
      .then((r) => r.data.data),

  // ─── Capture Profiles ──────────────────────────────────────────────────────

  getCaptureProfiles: () =>
    apiClient
      .get<{ data: Record<CaptureProfile, CaptureProfileDef> }>(`${PREFIX}/capture-profiles`)
      .then((r) => r.data.data),

  getCaptureProfile: (profile: CaptureProfile) =>
    apiClient
      .get<{ data: CaptureProfileDef & { profile: CaptureProfile } }>(`${PREFIX}/capture-profiles/${profile}`)
      .then((r) => r.data.data),

  getProbeRecommendation: (profile: CaptureProfile) =>
    apiClient
      .get<{ data: ProbeRecommendation }>(`${PREFIX}/capture-profiles/${profile}/recommendation`)
      .then((r) => r.data.data),
};
