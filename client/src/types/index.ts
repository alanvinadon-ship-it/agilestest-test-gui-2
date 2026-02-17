// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'CANCELLED';
export type ArtifactType = 'LOG' | 'SCREENSHOT' | 'VIDEO' | 'HAR' | 'TRACE' | 'PCAP' | 'OTHER';
export type CaptureStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type CaptureTargetType = 'K8S' | 'SSH' | 'PROBE';
export type ProbeType = 'LINUX_EDGE' | 'K8S_CLUSTER' | 'NETWORK_TAP';
export type ProbeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';
export type ProbeCapability = 'LOGS' | 'PCAP';
export type CaptureType = 'LOGS' | 'PCAP';
export type CaptureProfile = 'WEB' | 'IMS' | 'DIAMETER' | 'HTTP2' | 'SIP' | 'CUSTOM';
export type IncidentSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
export type TestType = 'VABF' | 'VSR' | 'VABE';
export type AnalysisStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type ProjectDomain = 'WEB' | 'API' | 'IMS' | 'RAN' | 'EPC' | '5GC';

// ─── Domain Models ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  domain: string;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  project_id: string;
  profile_id: string;
  scenario_id: string;
  status: ExecutionStatus;
  runner_type: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  artifacts_count: number;
  incidents_count: number;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  artifact_id?: string;
  execution_id: string;
  type: ArtifactType;
  filename: string;
  name?: string;
  mime_type: string;
  content_type?: string;
  size_bytes: number;
  storage_path: string;
  storage_url?: string;
  s3_uri: string | null;
  checksum: string | null;
  capture_job_id: string | null;
  download_url: string | null;
  created_at: string;
  uploaded_at?: string;
}

export interface Incident {
  id: string;
  execution_id: string;
  project_id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  step_name: string | null;
  expected_result: string | null;
  actual_result: string | null;
  detected_at: string;
}

export interface AnalysisPhase {
  phase: string;
  content: string;
}

export interface AnalysisHypothesis {
  id: string;
  description: string;
  confidence: number;
  selected: boolean;
}

export interface Analysis {
  id: string;
  incident_id: string;
  status: AnalysisStatus;
  observation: string;
  hypotheses: AnalysisHypothesis[];
  root_cause: string;
  root_cause_justification: string;
  recommended_solution: string;
  confidence_score: number;
  pipeline_phases: AnalysisPhase[];
  created_at: string;
  completed_at: string | null;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  trace_id?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ─── Capture Models ──────────────────────────────────────────────────────────

export interface CaptureJob {
  capture_id: string;
  execution_id: string;
  incident_id: string | null;
  project_id: string;
  triggered_by: string;
  status: CaptureStatus;
  capture_type: CaptureType;
  target_type: CaptureTargetType;
  duration_seconds: number;
  max_size_mb: number;
  profile: CaptureProfile | null;
  params: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface CaptureSource {
  source_id: string;
  capture_id: string;
  namespace: string | null;
  pod_selector: string | null;
  container_name: string | null;
  host: string | null;
  ssh_port: number | null;
  ssh_user: string | null;
  log_paths: string[] | null;
  created_at: string;
}

export interface CaptureArtifact {
  artifact_id: string;
  execution_id: string;
  type: string;
  name: string;
  storage_url: string;
  s3_uri: string | null;
  content_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  capture_job_id: string | null;
  uploaded_at: string;
  download_url: string | null;
}

export interface CaptureDetail extends CaptureJob {
  sources: CaptureSource[];
  artifacts: CaptureArtifact[];
}

export interface K8sSourceInput {
  namespace: string;
  pod_selector: string;
  container_name?: string;
}

export interface SshSourceInput {
  host: string;
  ssh_port?: number;
  ssh_user: string;
  log_paths: string[];
}

export interface CreateCaptureRequest {
  execution_id: string;
  incident_id?: string;
  project_id: string;
  target_type: CaptureTargetType;
  capture_type: CaptureType;
  duration_seconds?: number;
  max_size_mb?: number;
  probe_id?: string;
  bpf_filter?: string;
  interface_name?: string;
  profile?: CaptureProfile;
  sources: Array<K8sSourceInput | SshSourceInput>;
}

// ─── Probe Models ───────────────────────────────────────────────────────────

export interface Probe {
  probe_id: string;
  site: string;
  zone: string;
  type: ProbeType;
  capabilities: ProbeCapability[];
  status: ProbeStatus;
  auth_token_hash: string | null;
  last_seen_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProbePolicy {
  policy_id: string;
  probe_id: string;
  max_capture_duration_sec: number;
  max_capture_size_mb: number;
  pcap_interfaces_allowlist: string[];
  pcap_bpf_allowlist: string[];
  storage_kind: string;
  storage_endpoint: string | null;
  storage_bucket: string | null;
  storage_prefix: string | null;
  redaction_enabled: boolean;
  redaction_patterns: string[];
  created_at: string;
  updated_at: string;
}

export interface ProbeWithPolicy extends Probe {
  policy: ProbePolicy | null;
}

export interface ProbeWithScope extends Probe {
  project_ids: string[];
  policy: ProbePolicy | null;
}

export interface CaptureProfileDef {
  label: string;
  description: string;
  default_capture_type: CaptureType;
  default_bpf_filter: string;
  recommended_probe_type: ProbeType;
}

export interface SitesAndZones {
  sites: string[];
  zones: string[];
}

export interface ProbeRecommendation {
  recommended: ProbeType;
  reason: string;
}

export interface CreateProbeRequest {
  probe_id: string;
  site: string;
  zone: string;
  type: ProbeType;
  capabilities: ProbeCapability[];
  project_ids?: string[];
  policy?: {
    max_capture_duration_sec?: number;
    max_capture_size_mb?: number;
    pcap_interfaces_allowlist?: string[];
    pcap_bpf_allowlist?: string[];
    storage_kind?: string;
    storage_endpoint?: string;
    storage_bucket?: string;
    storage_prefix?: string;
    redaction_enabled?: boolean;
    redaction_patterns?: string[];
  };
}

export interface UpdateProbeRequest {
  site?: string;
  zone?: string;
  capabilities?: ProbeCapability[];
  project_ids?: string[];
  policy?: CreateProbeRequest['policy'];
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  domain: ProjectDomain;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  domain?: ProjectDomain;
  status?: ProjectStatus;
}

export interface ReportingSummary {
  total_executions: number;
  passed: number;
  failed: number;
  error: number;
  pass_rate: number;
  total_incidents: number;
  incidents_by_severity: Record<IncidentSeverity, number>;
  analyses_completed: number;
  avg_confidence_score: number;
}

// ─── Test Profile & Scenario Models ─────────────────────────────────────────

export interface TestProfile {
  id: string;
  project_id: string;
  name: string;
  description: string;
  /** @deprecated Use domain + profile_type instead */
  protocol: CaptureProfile;
  /** Type de test : VABF, VSR ou VABE — obligatoire */
  test_type: TestType;
  /** Domain-first: domaine du profil (WEB, API, TELECOM_IMS, etc.) */
  domain?: string;
  /** Domain-first: type de profil (UI_E2E, REST, SIP, etc.) */
  profile_type?: string;
  target_host: string;
  target_port: number;
  parameters: Record<string, unknown>;
  /** Domain-first: configuration dynamique par type */
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TestScenario {
  id: string;
  profile_id: string;
  project_id: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
  created_at: string;
  updated_at: string;
}

export interface ScenarioStep {
  id: string;
  order: number;
  action: string;
  description: string;
  expected_result: string;
  parameters: Record<string, unknown>;
}

export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  description: string;
  format: 'CSV' | 'JSON' | 'YAML';
  row_count: number;
  size_bytes: number;
  storage_url: string;
  created_at: string;
  updated_at: string;
}
