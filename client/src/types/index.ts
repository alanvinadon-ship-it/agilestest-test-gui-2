// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'CANCELLED';
export type ArtifactType = 'LOG' | 'SCREENSHOT' | 'VIDEO' | 'HAR' | 'TRACE' | 'PCAP' | 'SIP_TRACE' | 'KPI_SERIES' | 'GEOJSON_ROUTE' | 'DEVICE_LOGS' | 'IPERF_RESULTS' | 'SUMMARY_JSON' | 'OTHER';
export type CaptureStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type CaptureTargetType = 'K8S' | 'SSH' | 'PROBE';
export type ProbeType = 'LINUX_EDGE' | 'K8S_CLUSTER' | 'NETWORK_TAP';
export type ProbeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';
export type ProbeCapability = 'LOGS' | 'PCAP';
export type CaptureType = 'LOGS' | 'PCAP';
export type CaptureProfile = 'WEB' | 'IMS' | 'DIAMETER' | 'HTTP2' | 'SIP' | 'CUSTOM';
export type IncidentSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
export type TestType = 'VABF' | 'VSR' | 'VABE';
export type ScenarioStatus = 'DRAFT' | 'FINAL' | 'DEPRECATED';
export type ImportMode = 'SKIP' | 'RENAME' | 'OVERWRITE';
export type TargetEnv = 'DEV' | 'PREPROD' | 'PILOT_ORANGE' | 'PROD';
export type DatasetInstanceStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
export type BundleStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';

/** Codes domaine normalisés pour les IDs de scénarios */
export type DomainCode = 'WEB' | 'API' | 'MOB' | 'DESK' | 'IMS' | 'RAN' | 'EPC4' | '5GSA' | '5GNSA' | 'DRIVE';
export type AnalysisStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type ProjectDomain = 'WEB' | 'API' | 'IMS' | 'RAN' | 'EPC' | '5GC' | 'DRIVE_TEST';

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
  /** Script IA utilisé pour cette exécution */
  script_id?: string;
  /** Version du script au moment du lancement */
  script_version?: number;
  /** Bundle de datasets utilisé */
  dataset_bundle_id?: string;
  /** Environnement cible */
  target_env?: TargetEnv;
  /** Identifiant du runner (probe/agent) */
  runner_id?: string;
  /** Si cette exécution résulte d'un repair, référence l'exécution d'origine */
  ai_repair_from_execution_id?: string;
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
  // ── PROBE-HARDEN-1 ──
  version?: string;
  uptime_seconds?: number;
  cpu_percent?: number;
  disk_free_mb?: number;
  interfaces?: string[];
  active_sessions?: number;
  total_captures?: number;
  last_error?: string | null;
  health_status?: 'healthy' | 'degraded' | 'unhealthy';
  heartbeat_interval_sec?: number;
  allowlist_cidrs?: string[];
  tls_enabled?: boolean;
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
  /** Code normalisé du scénario (ex: VABF-WEB-001-AUTH-UTILISATEUR) */
  scenario_code?: string;
  name: string;
  description: string;
  steps: ScenarioStep[];
  /** Statut du scénario : DRAFT → FINAL → DEPRECATED */
  status: ScenarioStatus;
  /** Version (incrémentée à chaque modification d'un scénario FINAL) */
  version: number;
  /** Dataset types requis pour ce scénario (slugs normalisés) */
  required_dataset_types?: string[];
  /** Métadonnées d'import et audit */
  metadata?: {
    import_source_id?: string;
    import_mode?: ImportMode;
    source_template_id?: string;
    imported_at?: string;
    imported_by?: string;
  };
  created_at: string;
  updated_at: string;
}

/** Entrée du journal d'audit pour les imports */
export interface AuditLogEntry {
  id: string;
  actor_user_id: string;
  project_id: string;
  profile_id: string;
  action: 'IMPORT' | 'FINALIZE' | 'DEPRECATE' | 'UPDATE';
  timestamp: string;
  import_mode?: ImportMode;
  imported_ids: string[];
  details?: Record<string, unknown>;
}

/** Rapport d'import en masse */
export interface ImportReport {
  imported_count: number;
  skipped_count: number;
  renamed_count: number;
  overwritten_count: number;
  details: Array<{
    scenario_id: string;
    scenario_code: string;
    action: 'IMPORTED' | 'SKIPPED' | 'RENAMED' | 'OVERWRITTEN';
    old_id?: string;
    message?: string;
  }>;
  audit_log_id: string;
  timestamp: string;
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
  /** Référence vers un DatasetType (gabarit) */
  dataset_type_id?: string;
  created_at: string;
  updated_at: string;
}

// ─── Dataset Instances & Bundles (DATASET-1) ──────────────────────────────

export interface DatasetInstance {
  dataset_id: string;
  project_id: string;
  dataset_type_id: string;
  env: TargetEnv;
  version: number;
  status: DatasetInstanceStatus;
  values_json: Record<string, unknown>;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetBundle {
  bundle_id: string;
  project_id: string;
  name: string;
  env: TargetEnv;
  version: number;
  status: BundleStatus;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BundleItem {
  bundle_id: string;
  dataset_id: string;
}

export interface DatasetSecretKey {
  dataset_id: string;
  key_path: string;
  is_secret: boolean;
}

export interface BundleValidationResult {
  ok: boolean;
  missing_types: string[];
  conflicts: Array<{ dataset_type_id: string; dataset_ids: string[] }>;
  schema_errors_by_type: Record<string, string[]>;
  warnings: string[];
}

export interface ScenarioDatasetValidation {
  compatible_bundles: Array<{ bundle_id: string; name: string; status: BundleStatus; version: number }>;
  missing_types_global: string[];
  ok_for_env: boolean;
}

// ─── Dataset Type (Gabarit) ────────────────────────────────────────────────

export interface DatasetTypeField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'date' | 'phone' | 'ip' | 'enum';
  required: boolean;
  description: string;
  example?: string;
  enum_values?: string[];
  min?: number;
  max?: number;
  pattern?: string;
}

export interface DatasetType {
  id: string;
  dataset_type_id: string; // slug normalisé ex: user_admin
  domain: string; // WEB, API, IMS, 5GC, etc.
  test_type?: TestType; // optionnel
  name: string;
  description: string;
  schema_fields: DatasetTypeField[];
  example_placeholders: Record<string, string>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ─── Runner Job (Orchestration) ─────────────────────────────────────────

export type RunnerJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type ArtifactUploadPolicy = 'screenshot' | 'trace' | 'video' | 'log' | 'har' | 'pcap' | 'sip_trace' | 'kpi_series' | 'geojson' | 'device_logs' | 'iperf_results' | 'summary_json';

export interface RunnerJob {
  job_id: string;
  execution_id: string;
  project_id: string;
  runner_id: string | null;
  status: RunnerJobStatus;
  /** Script à exécuter */
  script_id: string;
  script_version: number;
  /** URL de téléchargement du script package (zip) */
  download_url: string | null;
  /** Bundle de datasets */
  dataset_bundle_id: string | null;
  /** Environnement cible */
  target_env: TargetEnv;
  /** Politique d'upload des artefacts */
  artifact_upload_policy: ArtifactUploadPolicy[];
  /** Métriques d'exécution renvoyées par le runner */
  metrics: JobMetrics | null;
  /** Manifest des artefacts uploadés */
  artifact_manifest: ArtifactManifestEntry[] | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface JobMetrics {
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  playwright_version?: string;
  browser?: string;
}

export interface ArtifactManifestEntry {
  type: ArtifactType;
  filename: string;
  s3_key: string;
  s3_uri: string;
  size_bytes: number;
  mime_type: string;
  checksum: string | null;
  download_url: string;
}

/** Payload pour compléter un job */
export interface JobCompletePayload {
  status: 'DONE' | 'FAILED';
  metrics: JobMetrics;
  artifact_manifest: ArtifactManifestEntry[];
  error_message?: string;
}

/** Résultat de la résolution d'un bundle */
export interface BundleResolveResult {
  bundle_id: string;
  env: TargetEnv;
  merged_json: Record<string, unknown>;
  secrets_placeholder_keys: string[];
  resolved_at: string;
}

// ─── Drive Test Domain ────────────────────────────────────────────────────

export type NetworkType = '4G' | '5G_SA' | '5G_NSA' | 'IMS' | 'IP';
export type CampaignStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'DONE';
export type DeviceType = 'ANDROID' | 'MODEM' | 'CPE' | 'LAPTOP';
export type DriveToolName = 'GNetTrack' | 'NSG' | 'QXDM' | 'Wireshark' | 'iperf3' | 'ping' | 'traceroute' | 'tcpdump';
export type ProbeLocation = 'RUNNER_HOST' | 'EDGE_VM' | 'K8S_NODE' | 'SPAN_PORT' | 'MIRROR_TAP';
export type DriveCaptureType = 'PCAP' | 'SIP_TRACE' | 'DIAMETER' | 'GTPU' | 'NGAP' | 'NAS' | 'HTTP' | 'DNS' | 'SYSLOG';
export type ProbeOutputTarget = 'MINIO' | 'LOCAL' | 'BOTH';

/** KPI cibles pour les profils Drive Test */
export type DriveKpi =
  | 'RSRP' | 'RSRQ' | 'SINR'
  | 'THROUGHPUT_DL' | 'THROUGHPUT_UL'
  | 'LATENCY' | 'JITTER' | 'PACKET_LOSS'
  | 'ATTACH_SUCCESS' | 'DROP_CALL' | 'HANDOVER_SUCCESS'
  | 'VOLTE_MOS' | 'VOLTE_SETUP_TIME'
  | 'DNS_RESOLUTION_TIME' | 'HTTP_RESPONSE_TIME';

/** Campagne de Drive Test */
export interface DriveCampaign {
  campaign_id: string;
  project_id: string;
  name: string;
  description: string;
  target_env: TargetEnv;
  network_type: NetworkType;
  area: string;
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Route de Drive Test (parcours terrain) */
export interface DriveRoute {
  route_id: string;
  campaign_id: string;
  name: string;
  /** GeoJSON LineString du parcours */
  route_geojson: GeoJSON.LineString | null;
  /** GeoJSON FeatureCollection des checkpoints */
  checkpoints_geojson: GeoJSON.FeatureCollection | null;
  expected_duration_min: number;
  created_at: string;
  updated_at: string;
}

/** Équipement de test (terminal, modem, CPE, laptop) */
export interface TestDevice {
  device_id: string;
  project_id: string;
  type: DeviceType;
  model: string;
  os_version: string;
  diag_capable: boolean;
  tools_enabled: DriveToolName[];
  notes: string;
  created_at: string;
  updated_at: string;
}

/** Configuration de sonde pour la collecte Drive Test */
export interface DriveProbeConfig {
  probe_id: string;
  project_id: string;
  name: string;
  location: ProbeLocation;
  capture_type: DriveCaptureType;
  retention_days: number;
  max_size_mb: number;
  rotation: boolean;
  output_target: ProbeOutputTarget;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Namespace GeoJSON minimal pour éviter une dépendance externe */
export namespace GeoJSON {
  export interface Position extends Array<number> {}
  export interface LineString {
    type: 'LineString';
    coordinates: number[][];
  }
  export interface Point {
    type: 'Point';
    coordinates: number[];
  }
  export interface Feature {
    type: 'Feature';
    geometry: Point | LineString;
    properties: Record<string, unknown>;
  }
  export interface FeatureCollection {
    type: 'FeatureCollection';
    features: Feature[];
  }
}

/** Template de scénario Drive Test */
export interface DriveScenarioTemplate {
  template_id: string;
  scenario_code: string;
  test_type: TestType;
  name: string;
  description: string;
  steps: ScenarioStep[];
  required_dataset_types: string[];
  artifact_policy: ArtifactUploadPolicy[];
  kpi_thresholds: Record<string, number>;
}

// ─── Drive Job & KPI Ingestion ──────────────────────────────────────────────

export type DriveJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

/** Job d'exécution d'une campagne Drive Test */
export interface DriveJob {
  drive_job_id: string;
  campaign_id: string;
  route_id: string;
  device_id: string;
  target_env: TargetEnv;
  runner_id: string;
  status: DriveJobStatus;
  progress_pct: number;
  error_message?: string;
  artifacts_manifest: DriveArtifactEntry[];
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

/** Entrée d'artefact Drive dans le manifest */
export interface DriveArtifactEntry {
  artifact_type: 'kpi_series' | 'geo' | 'device_logs' | 'pcap' | 'summary';
  filename: string;
  minio_path: string;
  size_bytes: number;
  sha256: string;
  content_type: string;
}

/** Échantillon KPI ingéré depuis les résultats Drive */
export interface KpiSample {
  sample_id: string;
  drive_job_id: string;
  campaign_id: string;
  route_id: string;
  timestamp: string;
  lat: number;
  lon: number;
  kpi_name: DriveKpi;
  value: number;
  unit: string;
  cell_id?: string;
  technology?: NetworkType;
}

/** Résumé d'exécution Drive */
export interface DriveRunSummary {
  drive_job_id: string;
  campaign_id: string;
  total_samples: number;
  duration_sec: number;
  distance_km: number;
  kpi_averages: Record<string, number>;
  kpi_min: Record<string, number>;
  kpi_max: Record<string, number>;
  threshold_violations: ThresholdViolation[];
  overall_pass: boolean;
}

/** Violation de seuil KPI */
export interface ThresholdViolation {
  kpi_name: DriveKpi;
  threshold: number;
  actual_avg: number;
  direction: 'above' | 'below';
  violation_count: number;
  total_samples: number;
}

/** Configuration d'un run Drive (envoyée au runner) */
export interface DriveRunConfig {
  campaign: DriveCampaign;
  route: DriveRoute;
  device: TestDevice;
  probes: DriveProbeConfig[];
  kpi_thresholds: Record<string, number>;
  capture_pcap: boolean;
  capture_video: boolean;
  commands_pack_url?: string;
}

/** Résultat d'import manuel de résultats Drive */
export interface DriveImportResult {
  import_id: string;
  campaign_id: string;
  source_filename: string;
  source_format: 'CSV' | 'JSON' | 'GPX' | 'GEOJSON' | 'IPERF3';
  samples_imported: number;
  samples_skipped: number;
  errors: string[];
  imported_at: string;
}
