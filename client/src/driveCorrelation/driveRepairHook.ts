/**
 * driveRepairHook.ts — Hook IA REPAIR Drive depuis incidents auto-générés
 * Mission DRIVE-CORRELATION-1
 *
 * Construit le contexte d'analyse à partir d'un DriveIncident
 * et appelle le template PROMPT_DRIVE_REPAIR_v1.
 */
import type { RepairResult } from '../ai/types';
import type { DriveIncident, ArtifactTimeIndex, EnrichedKpiSample } from './types';
import { KPI_LABELS, KPI_UNITS, SEVERITY_LABELS, DEFAULT_KPI_THRESHOLDS } from './types';

// ─── Build Repair Context ───────────────────────────────────────────────────

export interface DriveRepairContext {
  incident: DriveIncident;
  kpi_summary: string;
  artifact_list: string;
  threshold_info: string;
  segment_info: string;
  capture_analysis: string;
}

/**
 * Construire le contexte IA REPAIR à partir d'un incident Drive.
 */
export function buildDriveRepairContext(
  incident: DriveIncident,
  samples: EnrichedKpiSample[],
  artifacts: ArtifactTimeIndex[],
): DriveRepairContext {
  // KPI summary
  const kpiLabel = KPI_LABELS[incident.kpi_name] || incident.kpi_name;
  const kpiUnit = KPI_UNITS[incident.kpi_name] || '';
  const t = DEFAULT_KPI_THRESHOLDS[incident.kpi_name];

  const kpiSummary = [
    `KPI: ${kpiLabel} (${kpiUnit})`,
    `Seuil: ${incident.threshold} ${kpiUnit} (direction: ${t?.direction || 'unknown'})`,
    `Observé: min=${incident.observed_min.toFixed(1)}, avg=${incident.observed_avg.toFixed(1)}, max=${incident.observed_max.toFixed(1)}`,
    `Breach: ${incident.breach_pct}% des échantillons en violation`,
    `Segments affectés: ${incident.segment_count}`,
    `Sévérité: ${SEVERITY_LABELS[incident.severity]}`,
  ].join('\n');

  // Artifact list
  const artifactList = artifacts.length > 0
    ? artifacts.map(a => `- ${a.filename} (${a.source}, ${(a.size_bytes / 1024 / 1024).toFixed(1)} MB, ${a.type})`).join('\n')
    : 'Aucun artefact disponible dans la fenêtre temporelle.';

  // Threshold info
  const thresholdInfo = t
    ? `WARN: ${t.warn} ${kpiUnit}, CRIT: ${t.crit} ${kpiUnit}, Direction: ${t.direction}`
    : 'Seuils non définis pour ce KPI.';

  // Segment info
  const segmentInfo = [
    `Zone: lat=[${incident.geo_bbox.min_lat.toFixed(4)}, ${incident.geo_bbox.max_lat.toFixed(4)}], lon=[${incident.geo_bbox.min_lon.toFixed(4)}, ${incident.geo_bbox.max_lon.toFixed(4)}]`,
    `Centre: ${incident.geo_point.lat.toFixed(4)}, ${incident.geo_point.lon.toFixed(4)}`,
    `Fenêtre: ${incident.time_window.start} → ${incident.time_window.end}`,
  ].join('\n');

  // Capture analysis (simplified — in production, tshark summary would be here)
  const pcapArtifacts = artifacts.filter(a => a.type === 'PCAP');
  const captureAnalysis = pcapArtifacts.length > 0
    ? `${pcapArtifacts.length} fichier(s) PCAP disponible(s) dans la fenêtre ±30s:\n` +
      pcapArtifacts.map(a => `  - ${a.filename} (${a.source}, ${new Date(a.start_ts).toLocaleTimeString('fr-FR')} → ${new Date(a.end_ts).toLocaleTimeString('fr-FR')})`).join('\n')
    : 'Aucun fichier PCAP disponible pour analyse.';

  return {
    incident,
    kpi_summary: kpiSummary,
    artifact_list: artifactList,
    threshold_info: thresholdInfo,
    segment_info: segmentInfo,
    capture_analysis: captureAnalysis,
  };
}

// ─── Simulate Drive Repair ──────────────────────────────────────────────────

/**
 * Simuler un appel IA REPAIR Drive (MVP local).
 * En production, cela appellerait le backend avec PROMPT_DRIVE_REPAIR_v1.
 */
export function simulateDriveRepair(context: DriveRepairContext): RepairResult {
  const { incident } = context;
  const kpiLabel = KPI_LABELS[incident.kpi_name] || incident.kpi_name;
  const t = DEFAULT_KPI_THRESHOLDS[incident.kpi_name];

  // Générer des patches simulés selon le type de KPI
  const patches = generateSimulatedPatches(incident, t);

  return {
    patches,
    root_cause: buildRootCause(incident, t),
    suggested_fix: buildSuggestedFix(incident, t),
    confidence: incident.severity === 'P0' ? 0.75 : incident.severity === 'P1' ? 0.80 : 0.85,
    warnings: [
      'Analyse simulée. En production, le modèle IA analyserait les PCAP et logs réels.',
      `Basé sur ${incident.evidence_refs.sample_ids.length} échantillons et ${incident.evidence_refs.artifact_ids.length} artefact(s).`,
    ],
  };
}

function generateSimulatedPatches(
  incident: DriveIncident,
  threshold?: { warn: number; crit: number; direction: string },
): RepairResult['patches'] {
  const kpi = incident.kpi_name;

  if (kpi === 'RSRP' || kpi === 'RSRQ' || kpi === 'SINR') {
    return [{
      file_path: 'drive-test/radio_measurement.yaml',
      original_snippet: `measurement_interval: 1000\nscan_mode: passive`,
      patched_snippet: `measurement_interval: 500\nscan_mode: active\nantenna_diversity: true`,
      explanation: `Le ${kpi} moyen (${incident.observed_avg.toFixed(1)}) est en dessous du seuil (${threshold?.warn}). Réduire l'intervalle de mesure et activer le scan actif pour améliorer la détection des cellules voisines.`,
    }];
  }

  if (kpi === 'THROUGHPUT_DL' || kpi === 'THROUGHPUT_UL') {
    return [{
      file_path: 'drive-test/iperf_config.yaml',
      original_snippet: `parallel_streams: 1\nwindow_size: 64K`,
      patched_snippet: `parallel_streams: 4\nwindow_size: 256K\ntcp_no_delay: true`,
      explanation: `Le débit ${kpi === 'THROUGHPUT_DL' ? 'descendant' : 'montant'} moyen (${incident.observed_avg.toFixed(1)} Mbps) est insuffisant. Augmenter le parallélisme et la fenêtre TCP.`,
    }];
  }

  if (kpi === 'LATENCY' || kpi === 'JITTER') {
    return [{
      file_path: 'drive-test/ping_config.yaml',
      original_snippet: `target: 8.8.8.8\ncount: 10\ninterval: 1`,
      patched_snippet: `target: ${kpi === 'LATENCY' ? 'nearest-edge.orange.ci' : '8.8.8.8'}\ncount: 30\ninterval: 0.5\npacket_size: 64`,
      explanation: `La ${kpi === 'LATENCY' ? 'latence' : 'gigue'} moyenne (${incident.observed_avg.toFixed(0)} ms) dépasse le seuil. Utiliser un serveur edge plus proche et augmenter la fréquence de mesure.`,
    }];
  }

  return [{
    file_path: 'drive-test/config.yaml',
    original_snippet: `kpi_threshold_${kpi.toLowerCase()}: ${threshold?.warn || 'auto'}`,
    patched_snippet: `kpi_threshold_${kpi.toLowerCase()}: ${threshold?.crit || 'auto'}\nretry_on_breach: true\nmax_retries: 3`,
    explanation: `Le KPI ${kpi} (avg: ${incident.observed_avg.toFixed(1)}) est en violation. Ajuster le seuil et activer le retry automatique.`,
  }];
}

function buildRootCause(
  incident: DriveIncident,
  threshold?: { warn: number; crit: number; direction: string },
): string {
  const kpiLabel = KPI_LABELS[incident.kpi_name] || incident.kpi_name;
  const dir = threshold?.direction === 'higher_better' ? 'en dessous' : 'au-dessus';
  return `Le KPI ${kpiLabel} est ${dir} du seuil sur ${incident.segment_count} segment(s) de route ` +
    `(${incident.breach_pct}% des échantillons en violation). ` +
    `Valeur moyenne observée: ${incident.observed_avg.toFixed(1)}, seuil: ${incident.threshold}. ` +
    `Zone géographique: ${incident.geo_point.lat.toFixed(4)}, ${incident.geo_point.lon.toFixed(4)}.`;
}

function buildSuggestedFix(
  incident: DriveIncident,
  threshold?: { warn: number; crit: number; direction: string },
): string {
  const kpi = incident.kpi_name;
  if (kpi === 'RSRP' || kpi === 'RSRQ' || kpi === 'SINR') {
    return 'Vérifier la couverture radio dans la zone, ajuster les paramètres d\'antenne, et valider les cellules voisines.';
  }
  if (kpi === 'THROUGHPUT_DL' || kpi === 'THROUGHPUT_UL') {
    return 'Augmenter le parallélisme iperf, vérifier la congestion réseau, et valider la configuration QoS.';
  }
  if (kpi === 'LATENCY' || kpi === 'JITTER') {
    return 'Utiliser un serveur de test plus proche, vérifier le routage réseau, et analyser les captures PCAP pour identifier les retransmissions.';
  }
  return `Analyser les artefacts terrain pour identifier la cause racine de la violation ${kpiLabel(kpi)}.`;
}

function kpiLabel(kpi: string): string {
  return KPI_LABELS[kpi] || kpi;
}
