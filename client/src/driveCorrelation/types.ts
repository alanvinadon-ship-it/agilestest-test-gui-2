/**
 * driveCorrelation/types.ts — Types pour la corrélation KPI ↔ route ↔ artefacts
 * Mission DRIVE-CORRELATION-1
 */
import type { DriveKpi, IncidentSeverity } from '../types';

// ─── Breach Level ───────────────────────────────────────────────────────────

export type BreachLevel = 'OK' | 'WARN' | 'CRIT';

// ─── Route Segment ──────────────────────────────────────────────────────────

/** Segment de route avec KPI agrégés */
export interface RouteSegment {
  segment_id: string;
  route_id: string;
  campaign_id: string;
  /** Index du segment dans la route (0-based) */
  index: number;
  /** Coordonnées du segment [lon, lat][] */
  coordinates: number[][];
  /** Centre géographique du segment */
  center: { lat: number; lon: number };
  /** Longueur du segment en mètres */
  length_m: number;
  /** Fenêtre temporelle du segment */
  time_window: { start: string; end: string };
  /** KPI agrégés par nom */
  kpi_stats: Record<string, SegmentKpiStats>;
  /** Niveau de breach global du segment (pire des KPI) */
  breach_level: BreachLevel;
  /** Nombre total de samples dans ce segment */
  sample_count: number;
}

/** Statistiques KPI pour un segment */
export interface SegmentKpiStats {
  kpi_name: DriveKpi;
  min: number;
  max: number;
  avg: number;
  count: number;
  unit: string;
  /** Pourcentage de points en breach */
  breach_pct: number;
  breach_level: BreachLevel;
  /** Seuil utilisé */
  threshold: number;
}

// ─── Window Key (bucketing) ─────────────────────────────────────────────────

export type WindowSize = '5s' | '10s' | '30s';

/** Échantillon KPI enrichi avec segment et breach */
export interface EnrichedKpiSample {
  sample_id: string;
  segment_id: string;
  breach_level: BreachLevel;
  window_key: string;
  kpi_name: DriveKpi;
  value: number;
  threshold: number;
  lat: number;
  lon: number;
  timestamp: string;
}

// ─── Artifact Time Index ────────────────────────────────────────────────────

export type ArtifactSource = 'RUNNER' | 'PROBE';

export interface ArtifactTimeIndex {
  artifact_id: string;
  source: ArtifactSource;
  start_ts: string;
  end_ts: string;
  /** Tags pour le filtrage */
  tags: {
    project_id?: string;
    campaign_id?: string;
    route_id?: string;
    device_id?: string;
    session_id?: string;
    drive_job_id?: string;
  };
  filename: string;
  size_bytes: number;
  type: string;
  minio_path?: string;
  download_url?: string;
}

// ─── Drive Incident ─────────────────────────────────────────────────────────

export type DriveIncidentType = 'DRIVE_KPI_THRESHOLD_BREACH';

export type DriveIncidentSeverity = 'P0' | 'P1' | 'P2';

export interface DriveIncident {
  incident_id: string;
  campaign_id: string;
  route_id: string;
  drive_job_id?: string;
  type: DriveIncidentType;
  /** KPI en violation */
  kpi_name: DriveKpi;
  /** Seuil configuré */
  threshold: number;
  /** Valeurs observées */
  observed_min: number;
  observed_max: number;
  observed_avg: number;
  /** Bounding box géographique */
  geo_bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
  /** Point central */
  geo_point: { lat: number; lon: number };
  /** Fenêtre temporelle */
  time_window: { start: string; end: string };
  /** Sévérité */
  severity: DriveIncidentSeverity;
  /** Références aux preuves */
  evidence_refs: {
    artifact_ids: string[];
    sample_ids: string[];
    segment_ids: string[];
  };
  /** Segment(s) concerné(s) */
  segment_count: number;
  /** Pourcentage de samples en breach */
  breach_pct: number;
  /** Statut */
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  /** Lien vers l'analyse IA */
  analysis_id?: string;
  /** Timestamps */
  created_at: string;
  updated_at: string;
}

// ─── Seuils par défaut ──────────────────────────────────────────────────────

/** Seuils par défaut pour les KPI Drive (Orange CI) */
export const DEFAULT_KPI_THRESHOLDS: Record<string, { warn: number; crit: number; direction: 'higher_better' | 'lower_better' }> = {
  RSRP:               { warn: -100, crit: -110, direction: 'higher_better' },
  RSRQ:               { warn: -12,  crit: -15,  direction: 'higher_better' },
  SINR:               { warn: 5,    crit: 0,    direction: 'higher_better' },
  THROUGHPUT_DL:      { warn: 10,   crit: 5,    direction: 'higher_better' },
  THROUGHPUT_UL:      { warn: 5,    crit: 2,    direction: 'higher_better' },
  LATENCY:            { warn: 50,   crit: 100,  direction: 'lower_better' },
  JITTER:             { warn: 20,   crit: 50,   direction: 'lower_better' },
  PACKET_LOSS:        { warn: 1,    crit: 3,    direction: 'lower_better' },
  ATTACH_SUCCESS:     { warn: 95,   crit: 90,   direction: 'higher_better' },
  DROP_CALL:          { warn: 2,    crit: 5,    direction: 'lower_better' },
  HANDOVER_SUCCESS:   { warn: 95,   crit: 90,   direction: 'higher_better' },
  VOLTE_MOS:          { warn: 3.5,  crit: 3.0,  direction: 'higher_better' },
  VOLTE_SETUP_TIME:   { warn: 3000, crit: 5000, direction: 'lower_better' },
  DNS_RESOLUTION_TIME:{ warn: 100,  crit: 200,  direction: 'lower_better' },
  HTTP_RESPONSE_TIME: { warn: 500,  crit: 1000, direction: 'lower_better' },
};

// ─── Segmentation Config ────────────────────────────────────────────────────

export interface SegmentationConfig {
  /** Mode de segmentation */
  mode: 'distance' | 'time';
  /** Taille du segment en mètres (mode distance) */
  segment_length_m: number;
  /** Taille du segment en secondes (mode time) */
  segment_duration_sec: number;
  /** Fenêtre d'agrégation pour le bucketing */
  window_size: WindowSize;
}

export const DEFAULT_SEGMENTATION_CONFIG: SegmentationConfig = {
  mode: 'distance',
  segment_length_m: 50,
  segment_duration_sec: 5,
  window_size: '5s',
};

// ─── Auto-incident Config ───────────────────────────────────────────────────

export interface AutoIncidentConfig {
  enabled: boolean;
  /** Seuil de breach_pct pour créer un incident CRIT -> P0 */
  crit_threshold_pct: number;
  /** Seuil de breach_pct pour créer un incident WARN -> P1 */
  warn_threshold_pct: number;
  /** Fenêtre de déduplication en secondes */
  dedup_window_sec: number;
}

export const DEFAULT_AUTO_INCIDENT_CONFIG: AutoIncidentConfig = {
  enabled: true,
  crit_threshold_pct: 30,
  warn_threshold_pct: 50,
  dedup_window_sec: 60,
};

// ─── Drill-down Data ────────────────────────────────────────────────────────

export interface SegmentDrillDown {
  segment: RouteSegment;
  samples: EnrichedKpiSample[];
  artifacts: ArtifactTimeIndex[];
  incidents: DriveIncident[];
  /** Top violations triées par sévérité */
  top_violations: Array<{
    kpi_name: DriveKpi;
    breach_level: BreachLevel;
    breach_pct: number;
    avg: number;
    threshold: number;
    direction: 'higher_better' | 'lower_better';
  }>;
}

// ─── Labels & Colors ────────────────────────────────────────────────────────

export const BREACH_COLORS: Record<BreachLevel, string> = {
  OK: '#22c55e',
  WARN: '#f59e0b',
  CRIT: '#ef4444',
};

export const BREACH_BG_COLORS: Record<BreachLevel, string> = {
  OK: 'bg-green-500/10',
  WARN: 'bg-amber-500/10',
  CRIT: 'bg-red-500/10',
};

export const BREACH_TEXT_COLORS: Record<BreachLevel, string> = {
  OK: 'text-green-400',
  WARN: 'text-amber-400',
  CRIT: 'text-red-400',
};

export const BREACH_LABELS: Record<BreachLevel, string> = {
  OK: 'Conforme',
  WARN: 'Avertissement',
  CRIT: 'Critique',
};

export const SEVERITY_LABELS: Record<DriveIncidentSeverity, string> = {
  P0: 'Critique (P0)',
  P1: 'Majeur (P1)',
  P2: 'Mineur (P2)',
};

export const SEVERITY_COLORS: Record<DriveIncidentSeverity, string> = {
  P0: 'text-red-400',
  P1: 'text-orange-400',
  P2: 'text-yellow-400',
};

export const KPI_LABELS: Record<string, string> = {
  RSRP: 'RSRP',
  RSRQ: 'RSRQ',
  SINR: 'SINR',
  THROUGHPUT_DL: 'Débit DL',
  THROUGHPUT_UL: 'Débit UL',
  LATENCY: 'Latence',
  JITTER: 'Jitter',
  PACKET_LOSS: 'Perte paquets',
  ATTACH_SUCCESS: 'Attach Success',
  DROP_CALL: 'Drop Call',
  HANDOVER_SUCCESS: 'Handover Success',
  VOLTE_MOS: 'VoLTE MOS',
  VOLTE_SETUP_TIME: 'VoLTE Setup',
  DNS_RESOLUTION_TIME: 'DNS Resolution',
  HTTP_RESPONSE_TIME: 'HTTP Response',
};

export const KPI_UNITS: Record<string, string> = {
  RSRP: 'dBm',
  RSRQ: 'dB',
  SINR: 'dB',
  THROUGHPUT_DL: 'Mbps',
  THROUGHPUT_UL: 'Mbps',
  LATENCY: 'ms',
  JITTER: 'ms',
  PACKET_LOSS: '%',
  ATTACH_SUCCESS: '%',
  DROP_CALL: '%',
  HANDOVER_SUCCESS: '%',
  VOLTE_MOS: 'MOS',
  VOLTE_SETUP_TIME: 'ms',
  DNS_RESOLUTION_TIME: 'ms',
  HTTP_RESPONSE_TIME: 'ms',
};
