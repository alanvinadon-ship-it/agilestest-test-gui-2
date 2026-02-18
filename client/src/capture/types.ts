// ─── Capture Policy Types (DRIVE-CAPTURE-POLICY-1 + PROBE-HARDEN-1) ─────────

// ─── Probe Hardening Types ──────────────────────────────────────────────────

/** Reason codes standard pour les échecs probe */
export type ProbeReasonCode =
  | 'PROBE_OFFLINE'
  | 'IFACE_NOT_FOUND'
  | 'NO_PACKETS'
  | 'CAPTURE_FAILED'
  | 'UPLOAD_FAILED'
  | 'AUTH_FAILED'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED'
  | 'CONFIG_INVALID';

/** Labels humains pour les reason codes */
export const REASON_CODE_LABELS: Record<ProbeReasonCode, string> = {
  PROBE_OFFLINE: 'Sonde hors ligne',
  IFACE_NOT_FOUND: 'Interface réseau introuvable',
  NO_PACKETS: 'Aucun paquet capturé (30s)',
  CAPTURE_FAILED: 'Échec de capture tcpdump',
  UPLOAD_FAILED: 'Échec upload PCAP vers MinIO',
  AUTH_FAILED: 'Authentification refusée (token invalide)',
  TIMEOUT: 'Timeout de la session de capture',
  QUOTA_EXCEEDED: 'Quota de capture dépassé',
  CONFIG_INVALID: 'Configuration probe invalide',
};

/** Sévérité d'un reason code */
export const REASON_CODE_SEVERITY: Record<ProbeReasonCode, 'critical' | 'error' | 'warning'> = {
  PROBE_OFFLINE: 'critical',
  IFACE_NOT_FOUND: 'critical',
  NO_PACKETS: 'warning',
  CAPTURE_FAILED: 'error',
  UPLOAD_FAILED: 'error',
  AUTH_FAILED: 'critical',
  TIMEOUT: 'warning',
  QUOTA_EXCEEDED: 'warning',
  CONFIG_INVALID: 'critical',
};

/** Réponse du endpoint /probe/health */
export interface ProbeHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  interfaces: ProbeInterfaceInfo[];
  disk_free_mb: number;
  cpu_percent: number;
  last_error: string | null;
  active_sessions: number;
  total_captures: number;
}

/** Info d'une interface réseau sur la probe */
export interface ProbeInterfaceInfo {
  name: string;
  up: boolean;
  speed_mbps: number | null;
  rx_bytes: number;
  tx_bytes: number;
  promisc: boolean;
}

/** Payload heartbeat envoyé par la probe */
export interface ProbeHeartbeat {
  probe_id: string;
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  cpu_percent: number;
  disk_free_mb: number;
  active_sessions: number;
  interfaces: string[];
}

/** Configuration auth de la probe */
export interface ProbeAuthConfig {
  token: string;
  allowlist_cidrs: string[];
  tls_enabled: boolean;
  tls_cert_path?: string;
  tls_key_path?: string;
}

/** Quotas de capture */
export interface CaptureQuotas {
  max_concurrent_sessions: number;
  max_session_duration_sec: number;
  max_total_size_mb: number;
  max_files_per_session: number;
  no_packets_timeout_sec: number;
}

export const DEFAULT_CAPTURE_QUOTAS: CaptureQuotas = {
  max_concurrent_sessions: 3,
  max_session_duration_sec: 3600,
  max_total_size_mb: 5000,
  max_files_per_session: 20,
  no_packets_timeout_sec: 30,
};

// ─── Original Capture Policy Types ──────────────────────────────────────────

/** Mode de capture réseau */
export type CaptureMode = 'NONE' | 'RUNNER_TCPDUMP' | 'PROBE_SPAN_TAP';

/** Configuration tcpdump côté runner (Mode A) */
export interface RunnerTcpdumpConfig {
  iface: string;
  bpf_filter: string;
  snaplen: number;
  rotate_mb: number;
  max_files: number;
  enabled: boolean;
}

/** Configuration sonde SPAN/TAP (Mode B) */
export interface ProbeSpanTapConfig {
  probe_id: string;
  iface: string;
  vlan_filter?: number;
  bpf_filter: string;
  rotate_mb: number;
  enabled: boolean;
}

/** Politique de capture unifiée */
export interface CapturePolicy {
  default_mode: CaptureMode;
  runner_tcpdump: RunnerTcpdumpConfig;
  probe_span_tap: ProbeSpanTapConfig;
  retention_days: number;
}

/** Source d'un artefact PCAP */
export type CaptureSource = 'RUNNER' | 'PROBE';

/** Statut d'une session de capture probe */
export type CaptureSessionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';

/** Session de capture probe (Mode B) — durcie */
export interface CaptureSession {
  session_id: string;
  project_id: string;
  campaign_id?: string;
  drive_job_id?: string;
  execution_id?: string;
  probe_id: string;
  iface: string;
  bpf_filter: string;
  vlan_filter?: number;
  status: CaptureSessionStatus;
  reason_code?: ProbeReasonCode;
  started_at?: string;
  stopped_at?: string;
  artifacts: CaptureSessionArtifact[];
  error_message?: string;
  packets_captured?: number;
  bytes_captured?: number;
  duration_sec?: number;
  is_test_capture?: boolean;
  created_at: string;
}

/** Artefact d'une session de capture */
export interface CaptureSessionArtifact {
  filename: string;
  minio_path: string;
  size_bytes: number;
  sha256: string;
}

/** Résultat de la résolution de la CapturePolicy (cascade) */
export interface EffectiveCapturePolicy {
  policy: CapturePolicy;
  source: 'PROJECT' | 'CAMPAIGN' | 'SCENARIO' | 'RUN_OVERRIDE';
  mode: CaptureMode;
  /** Erreurs de validation empêchant l'exécution */
  validation_errors: string[];
  /** Avertissements non bloquants */
  warnings: string[];
  /** Prêt à exécuter */
  ready: boolean;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_RUNNER_TCPDUMP: RunnerTcpdumpConfig = {
  iface: 'eth0',
  bpf_filter: '',
  snaplen: 65535,
  rotate_mb: 100,
  max_files: 5,
  enabled: true,
};

export const DEFAULT_PROBE_SPAN_TAP: ProbeSpanTapConfig = {
  probe_id: '',
  iface: '',
  bpf_filter: '',
  rotate_mb: 100,
  enabled: true,
};

export const DEFAULT_CAPTURE_POLICY: CapturePolicy = {
  default_mode: 'NONE',
  runner_tcpdump: { ...DEFAULT_RUNNER_TCPDUMP },
  probe_span_tap: { ...DEFAULT_PROBE_SPAN_TAP },
  retention_days: 30,
};

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Résout la CapturePolicy effective en cascade :
 * RunOverride > Scenario > Campaign > Project
 * 
 * Chaque niveau peut être null/undefined (pas d'override).
 * Le premier override non-null trouvé en remontant la cascade est utilisé.
 */
export function resolveCapturePolicy(
  projectPolicy: CapturePolicy | null | undefined,
  campaignPolicy?: CapturePolicy | null,
  scenarioPolicy?: CapturePolicy | null,
  runOverride?: CapturePolicy | null,
): EffectiveCapturePolicy {
  // Déterminer la source et la policy effective
  let policy: CapturePolicy;
  let source: EffectiveCapturePolicy['source'];

  if (runOverride && runOverride.default_mode !== 'NONE') {
    policy = runOverride;
    source = 'RUN_OVERRIDE';
  } else if (scenarioPolicy && scenarioPolicy.default_mode !== 'NONE') {
    policy = scenarioPolicy;
    source = 'SCENARIO';
  } else if (campaignPolicy && campaignPolicy.default_mode !== 'NONE') {
    policy = campaignPolicy;
    source = 'CAMPAIGN';
  } else if (projectPolicy) {
    policy = projectPolicy;
    source = 'PROJECT';
  } else {
    policy = { ...DEFAULT_CAPTURE_POLICY };
    source = 'PROJECT';
  }

  const mode = policy.default_mode;
  const validation_errors: string[] = [];
  const warnings: string[] = [];

  // Validation selon le mode
  if (mode === 'RUNNER_TCPDUMP') {
    if (!policy.runner_tcpdump.iface || policy.runner_tcpdump.iface.trim() === '') {
      validation_errors.push('Interface réseau (iface) requise pour le mode Runner tcpdump');
    }
    if (!policy.runner_tcpdump.enabled) {
      warnings.push('La configuration tcpdump runner est désactivée');
    }
    if (policy.runner_tcpdump.snaplen < 64) {
      warnings.push('snaplen < 64 peut tronquer les en-têtes de paquets');
    }
  } else if (mode === 'PROBE_SPAN_TAP') {
    if (!policy.probe_span_tap.probe_id || policy.probe_span_tap.probe_id.trim() === '') {
      validation_errors.push('probe_id requis pour le mode Probe SPAN/TAP');
    }
    if (!policy.probe_span_tap.iface || policy.probe_span_tap.iface.trim() === '') {
      validation_errors.push('Interface réseau (iface) requise pour le mode Probe SPAN/TAP');
    }
    if (!policy.probe_span_tap.enabled) {
      warnings.push('La configuration probe SPAN/TAP est désactivée');
    }
  }

  if (policy.retention_days < 1) {
    warnings.push('retention_days < 1 jour : les artefacts seront supprimés rapidement');
  }

  return {
    policy,
    source,
    mode,
    validation_errors,
    warnings,
    ready: validation_errors.length === 0,
  };
}

/**
 * Vérifie si une probe est en ligne (simulation locale, API réelle en production)
 */
export function isProbeOnline(probeId: string, probes: Array<{ probe_id?: string; id?: string; status?: string }>): boolean {
  const probe = probes.find(p => (p.probe_id || p.id) === probeId);
  return probe ? probe.status === 'ONLINE' : false;
}

/**
 * Retourne un label humain pour le CaptureMode
 */
export function captureModeLabel(mode: CaptureMode): string {
  switch (mode) {
    case 'NONE': return 'Aucune capture';
    case 'RUNNER_TCPDUMP': return 'Mode A — Runner tcpdump';
    case 'PROBE_SPAN_TAP': return 'Mode B — Probe SPAN/TAP';
  }
}

/**
 * Retourne un label court pour la source
 */
export function captureSourceLabel(source: EffectiveCapturePolicy['source']): string {
  switch (source) {
    case 'PROJECT': return 'Défaut projet';
    case 'CAMPAIGN': return 'Override campagne';
    case 'SCENARIO': return 'Override scénario';
    case 'RUN_OVERRIDE': return 'Override run (admin)';
  }
}
