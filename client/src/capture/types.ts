// ─── Capture Policy Types (DRIVE-CAPTURE-POLICY-1) ──────────────────────────

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
export type CaptureSessionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** Session de capture probe (Mode B) */
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
  started_at?: string;
  stopped_at?: string;
  artifacts: CaptureSessionArtifact[];
  error_message?: string;
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
