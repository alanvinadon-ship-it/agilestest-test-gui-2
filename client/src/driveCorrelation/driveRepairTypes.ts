/**
 * driveRepairTypes.ts — Schema Zod strict pour DriveRepairResult v2
 * Mission DRIVE-REPAIR-REAL-2
 *
 * Sortie opérateur-grade : observations, hypothèses hiérarchisées,
 * recommandations actionnables, plan de rerun ciblé, glossaire auto.
 */
import { z } from 'zod';
import type { DriveKpi, IncidentSeverity } from '../types';
import type { BreachLevel, ArtifactSource, DriveIncidentSeverity } from './types';

// ─── Analysis Layers ────────────────────────────────────────────────────────

export const ANALYSIS_LAYERS = ['RADIO', 'CORE', 'QOS', 'APP', 'CAPTURE', 'DATASET'] as const;
export type AnalysisLayer = typeof ANALYSIS_LAYERS[number];

export const LAYER_LABELS: Record<AnalysisLayer, string> = {
  RADIO: 'Couche Radio (L1/L2)',
  CORE: 'Cœur de Réseau (EPC/5GC)',
  QOS: 'Qualité de Service (QoS)',
  APP: 'Application / Transport',
  CAPTURE: 'Capture / Observabilité',
  DATASET: 'Dataset / Configuration',
};

export const LAYER_ICONS: Record<AnalysisLayer, string> = {
  RADIO: '📡',
  CORE: '🏗️',
  QOS: '⚡',
  APP: '🌐',
  CAPTURE: '📦',
  DATASET: '📋',
};

export const LAYER_COLORS: Record<AnalysisLayer, string> = {
  RADIO: 'text-blue-400',
  CORE: 'text-purple-400',
  QOS: 'text-amber-400',
  APP: 'text-green-400',
  CAPTURE: 'text-cyan-400',
  DATASET: 'text-orange-400',
};

export const LAYER_BG_COLORS: Record<AnalysisLayer, string> = {
  RADIO: 'bg-blue-500/10 border-blue-500/20',
  CORE: 'bg-purple-500/10 border-purple-500/20',
  QOS: 'bg-amber-500/10 border-amber-500/20',
  APP: 'bg-green-500/10 border-green-500/20',
  CAPTURE: 'bg-cyan-500/10 border-cyan-500/20',
  DATASET: 'bg-orange-500/10 border-orange-500/20',
};

// ─── Evidence Reference ─────────────────────────────────────────────────────

export const EvidenceRefSchema = z.object({
  type: z.enum(['KPI_SAMPLE', 'SEGMENT', 'ARTIFACT', 'TIMESTAMP', 'THRESHOLD', 'DEVICE']),
  id: z.string().describe('ID de la preuve (sample_id, segment_id, artifact_id, etc.)'),
  label: z.string().describe('Label lisible pour l\'UI'),
  value: z.string().optional().describe('Valeur associée (ex: "-112 dBm")'),
  timestamp: z.string().optional().describe('Timestamp ISO si applicable'),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

// ─── Observation ────────────────────────────────────────────────────────────

export const ObservationSchema = z.object({
  id: z.string().describe('ID unique de l\'observation'),
  fact: z.string().describe('Fait observé, formulé de manière neutre'),
  layer: z.enum(ANALYSIS_LAYERS).describe('Couche concernée'),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).describe('Sévérité de l\'observation'),
  evidence: z.array(EvidenceRefSchema).min(1).describe('Preuves citées (au moins 1)'),
  timestamp: z.string().optional().describe('Timestamp de l\'observation'),
});
export type Observation = z.infer<typeof ObservationSchema>;

// ─── Hypothesis ─────────────────────────────────────────────────────────────

export const HypothesisSchema = z.object({
  id: z.string().describe('ID unique de l\'hypothèse'),
  layer: z.enum(ANALYSIS_LAYERS).describe('Couche d\'analyse'),
  title: z.string().describe('Titre court de l\'hypothèse'),
  description: z.string().describe('Description détaillée'),
  confidence: z.number().min(0).max(1).describe('Score de confiance [0-1]'),
  evidence_refs: z.array(z.string()).min(1).describe('IDs des observations qui supportent cette hypothèse'),
  counter_evidence: z.array(z.string()).optional().describe('IDs des observations qui contredisent'),
  requires_verification: z.boolean().describe('Nécessite une vérification supplémentaire'),
  verification_method: z.string().optional().describe('Comment vérifier cette hypothèse'),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

// ─── Root Cause Candidate ───────────────────────────────────────────────────

export const RootCauseCandidateSchema = z.object({
  rank: z.number().min(1).describe('Rang (1 = plus probable)'),
  layer: z.enum(ANALYSIS_LAYERS).describe('Couche d\'analyse'),
  title: z.string().describe('Titre de la cause racine'),
  description: z.string().describe('Description détaillée'),
  confidence: z.number().min(0).max(1).describe('Score de confiance'),
  supporting_hypotheses: z.array(z.string()).describe('IDs des hypothèses supportant'),
  impact: z.string().describe('Impact sur le service'),
});
export type RootCauseCandidate = z.infer<typeof RootCauseCandidateSchema>;

// ─── Recommendation ─────────────────────────────────────────────────────────

export const RecommendationCategorySchema = z.enum(['RADIO', 'CORE', 'QOS', 'APP', 'CAPTURE', 'DATASET']);
export type RecommendationCategory = z.infer<typeof RecommendationCategorySchema>;

export const EffortLevel = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const RiskLevel = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const RecommendationSchema = z.object({
  id: z.string().describe('ID unique'),
  category: RecommendationCategorySchema.describe('Catégorie de la recommandation'),
  action: z.string().describe('Action concrète à réaliser'),
  expected_impact: z.string().describe('Impact attendu'),
  effort: EffortLevel.describe('Effort requis'),
  risk: RiskLevel.describe('Risque associé'),
  priority: z.number().min(1).max(10).describe('Priorité (1 = la plus haute)'),
  commands_hint: z.array(z.string()).optional().describe('Commandes ou configurations suggérées'),
  related_hypothesis: z.string().optional().describe('ID de l\'hypothèse liée'),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

// ─── Rerun Plan ─────────────────────────────────────────────────────────────

export const RerunPlanSchema = z.object({
  /** Segments à re-tester */
  segments: z.array(z.object({
    segment_id: z.string(),
    reason: z.string(),
  })).min(1).describe('Segments ciblés pour le rerun'),
  /** Fenêtre temporelle recommandée */
  time_window: z.object({
    preferred_start: z.string().optional().describe('Heure de début préférée (ex: "08:00")'),
    preferred_end: z.string().optional().describe('Heure de fin préférée (ex: "10:00")'),
    duration_min: z.number().describe('Durée minimale en minutes'),
    rationale: z.string().describe('Justification de la fenêtre'),
  }),
  /** Mode de capture requis */
  required_capture_mode: z.enum(['NONE', 'RUNNER_TCPDUMP', 'PROBE_SPAN_TAP']).describe('Mode de capture requis'),
  /** Filtres BPF recommandés */
  capture_filters: z.object({
    bpf_filter: z.string().optional(),
    vlan_filter: z.string().optional(),
    snaplen: z.number().optional(),
    rationale: z.string(),
  }).optional(),
  /** Datasets requis */
  required_datasets: z.array(z.object({
    type: z.string(),
    key: z.string(),
    value_hint: z.string().optional(),
  })).describe('Datasets nécessaires'),
  /** Commandes de pré-vérification */
  pre_checks: z.array(z.string()).describe('Vérifications avant le rerun'),
  /** Commandes de test */
  commands_hint: z.array(z.string()).optional().describe('Commandes de test suggérées'),
});
export type RerunPlan = z.infer<typeof RerunPlanSchema>;

// ─── Next Measurements ──────────────────────────────────────────────────────

export const NextMeasurementSchema = z.object({
  id: z.string(),
  what: z.string().describe('Quoi mesurer'),
  why: z.string().describe('Pourquoi cette mesure'),
  how: z.string().describe('Comment mesurer (outil, config)'),
  priority: z.enum(['MUST', 'SHOULD', 'NICE_TO_HAVE']),
});
export type NextMeasurement = z.infer<typeof NextMeasurementSchema>;

// ─── Glossary Entry ─────────────────────────────────────────────────────────

export const GlossaryEntrySchema = z.object({
  term: z.string(),
  definition: z.string(),
  layer: z.enum(ANALYSIS_LAYERS).optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

// ─── DriveRepairResult v2 (schema complet) ──────────────────────────────────

export const DriveRepairResultSchema = z.object({
  /** Version du schema */
  schema_version: z.literal('2.0.0'),
  /** ID unique du rapport */
  report_id: z.string(),
  /** ID de l'incident analysé */
  incident_id: z.string(),
  /** Timestamp de génération */
  generated_at: z.string(),

  /** Observations factuelles (preuves) */
  observations: z.array(ObservationSchema).min(1).describe('Faits observés avec preuves'),

  /** Hypothèses par couche */
  hypotheses: z.array(HypothesisSchema).min(1).describe('Hypothèses hiérarchisées'),

  /** Candidats cause racine (classés) */
  root_cause_candidates: z.array(RootCauseCandidateSchema).min(1).describe('Causes racines candidates, classées'),

  /** Recommandations actionnables */
  recommendations: z.array(RecommendationSchema).min(1).describe('Actions concrètes'),

  /** Plan de rerun ciblé */
  rerun_plan: RerunPlanSchema.describe('Plan de rerun ciblé'),

  /** Mesures supplémentaires à capturer */
  next_measurements: z.array(NextMeasurementSchema).describe('Prochaines mesures recommandées'),

  /** Glossaire auto-généré */
  glossary: z.array(GlossaryEntrySchema).describe('Glossaire des termes techniques'),

  /** Score de confiance global */
  overall_confidence: z.number().min(0).max(1).describe('Confiance globale du diagnostic'),

  /** Avertissements */
  warnings: z.array(z.string()).optional(),

  /** Données insuffisantes */
  insufficient_data: z.array(z.object({
    what: z.string().describe('Donnée manquante'),
    impact: z.string().describe('Impact sur le diagnostic'),
    how_to_collect: z.string().describe('Comment collecter cette donnée'),
  })).optional().describe('Données insuffisantes pour le diagnostic'),
});
export type DriveRepairResult = z.infer<typeof DriveRepairResultSchema>;

// ─── Context Builder Types ──────────────────────────────────────────────────

/** Contexte déterministe pour le repair IA v2 */
export interface DriveRepairContextV2 {
  /** Metadata de l'incident */
  incident: {
    incident_id: string;
    kpi_name: string;
    kpi_label: string;
    kpi_unit: string;
    threshold: number;
    threshold_direction: 'higher_better' | 'lower_better';
    severity: DriveIncidentSeverity;
    observed: { min: number; max: number; avg: number };
    breach_pct: number;
    segment_count: number;
    time_window: { start: string; end: string };
    geo_point: { lat: number; lon: number };
    geo_bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number };
  };

  /** Top 3 segments avec stats détaillées */
  top_segments: Array<{
    segment_id: string;
    index: number;
    center: { lat: number; lon: number };
    length_m: number;
    breach_level: BreachLevel;
    kpi_stats: {
      min: number;
      max: number;
      avg: number;
      breach_pct: number;
      count: number;
    };
    time_window: { start: string; end: string };
  }>;

  /** Timeline KPI autour de la fenêtre (samples triés par timestamp) */
  timeline_samples: Array<{
    timestamp: string;
    value: number;
    breach_level: BreachLevel;
    segment_id: string;
    lat: number;
    lon: number;
  }>;

  /** Artefacts corrélés */
  artifacts: Array<{
    artifact_id: string;
    filename: string;
    type: string;
    source: ArtifactSource;
    size_bytes: number;
    start_ts: string;
    end_ts: string;
    sha256?: string;
  }>;

  /** PCAP quick stats (si disponible) */
  pcap_stats?: {
    total_packets: number;
    total_bytes: number;
    duration_sec: number;
    top_protocols: Array<{ protocol: string; pct: number }>;
    retransmissions: number;
    retransmission_pct: number;
    dns_failures: number;
    sip_codes?: Record<string, number>;
  };

  /** Info device */
  device_info?: {
    device_id: string;
    model: string;
    os: string;
    network_type: '4G' | '5G_NSA' | '5G_SA' | 'IMS' | 'IP';
    carrier: string;
    imei?: string;
  };

  /** Capture policy effective */
  capture_policy: {
    mode: 'NONE' | 'RUNNER_TCPDUMP' | 'PROBE_SPAN_TAP';
    iface?: string;
    bpf_filter?: string;
    probe_id?: string;
  };

  /** KPI corrélés (autres KPI sur les mêmes segments) */
  correlated_kpis: Array<{
    kpi_name: string;
    kpi_label: string;
    avg: number;
    breach_level: BreachLevel;
    breach_pct: number;
    threshold: number;
    unit: string;
  }>;
}

// ─── Effort & Risk Labels ───────────────────────────────────────────────────

export const EFFORT_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
};

export const RISK_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
};

export const PRIORITY_LABELS: Record<string, string> = {
  MUST: 'Obligatoire',
  SHOULD: 'Recommandé',
  NICE_TO_HAVE: 'Optionnel',
};
