/**
 * driveRepairSimulator.ts — Simulateur opérateur-grade v2
 * Mission DRIVE-REPAIR-REAL-2
 *
 * Génère un DriveRepairResult complet à partir du contexte v2.
 * En production, ce module serait remplacé par un appel au backend IA.
 */
import type { DriveRepairContextV2 } from './driveRepairTypes';
import type {
  DriveRepairResult, Observation, Hypothesis, RootCauseCandidate,
  Recommendation, RerunPlan, NextMeasurement, GlossaryEntry,
  AnalysisLayer, EvidenceRef,
} from './driveRepairTypes';
import { ANALYSIS_LAYERS } from './driveRepairTypes';

let reportCounter = 0;

export function simulateDriveRepairV2(ctx: DriveRepairContextV2): DriveRepairResult {
  reportCounter++;
  const reportId = `RPT-${Date.now()}-${reportCounter}`;

  const observations = buildObservations(ctx);
  const hypotheses = buildHypotheses(ctx, observations);
  const rootCauses = buildRootCauses(ctx, hypotheses);
  const recommendations = buildRecommendations(ctx, rootCauses);
  const rerunPlan = buildRerunPlan(ctx);
  const nextMeasurements = buildNextMeasurements(ctx);
  const glossary = buildGlossary(ctx);
  const insufficientData = buildInsufficientData(ctx);

  const overallConfidence = rootCauses.length > 0
    ? Math.min(rootCauses[0].confidence + 0.05, 0.95)
    : 0.3;

  return {
    schema_version: '2.0.0',
    report_id: reportId,
    incident_id: ctx.incident.incident_id,
    generated_at: new Date().toISOString(),
    observations,
    hypotheses,
    root_cause_candidates: rootCauses,
    recommendations,
    rerun_plan: rerunPlan,
    next_measurements: nextMeasurements,
    glossary,
    overall_confidence: overallConfidence,
    warnings: [
      'Analyse simulée (MVP). En production, le modèle IA analyserait les PCAP et logs réels.',
    ],
    insufficient_data: insufficientData.length > 0 ? insufficientData : undefined,
  };
}

// ─── Observations ───────────────────────────────────────────────────────────

function buildObservations(ctx: DriveRepairContextV2): Observation[] {
  const obs: Observation[] = [];
  const kpi = ctx.incident;

  // O1: KPI breach principal
  obs.push({
    id: 'OBS-001',
    fact: `Le KPI ${kpi.kpi_label} présente une valeur moyenne de ${kpi.observed.avg.toFixed(1)} ${kpi.kpi_unit}, ${kpi.threshold_direction === 'higher_better' ? 'en dessous' : 'au-dessus'} du seuil de ${kpi.threshold} ${kpi.kpi_unit}.`,
    layer: classifyKpiLayer(kpi.kpi_name),
    severity: kpi.severity === 'P0' ? 'CRITICAL' : kpi.severity === 'P1' ? 'WARNING' : 'INFO',
    evidence: [{
      type: 'THRESHOLD', id: `thr-${kpi.kpi_name}`, label: `Seuil ${kpi.kpi_label}`,
      value: `${kpi.threshold} ${kpi.kpi_unit}`,
    }, {
      type: 'KPI_SAMPLE', id: `avg-${kpi.kpi_name}`, label: `Moyenne observée`,
      value: `${kpi.observed.avg.toFixed(1)} ${kpi.kpi_unit}`,
    }],
  });

  // O2: Breach percentage
  obs.push({
    id: 'OBS-002',
    fact: `${kpi.breach_pct}% des échantillons sont en violation sur ${kpi.segment_count} segment(s) de route.`,
    layer: classifyKpiLayer(kpi.kpi_name),
    severity: kpi.breach_pct > 50 ? 'CRITICAL' : 'WARNING',
    evidence: [{
      type: 'SEGMENT', id: ctx.top_segments[0]?.segment_id || 'unknown',
      label: `Segment le plus affecté`,
      value: `${ctx.top_segments[0]?.kpi_stats.breach_pct || 0}% breach`,
    }],
  });

  // O3: Min/Max spread
  const spread = Math.abs(kpi.observed.max - kpi.observed.min);
  obs.push({
    id: 'OBS-003',
    fact: `L'écart entre la valeur minimale (${kpi.observed.min.toFixed(1)}) et maximale (${kpi.observed.max.toFixed(1)}) est de ${spread.toFixed(1)} ${kpi.kpi_unit}, indiquant ${spread > Math.abs(kpi.threshold) * 0.5 ? 'une forte variabilité' : 'une variabilité modérée'}.`,
    layer: classifyKpiLayer(kpi.kpi_name),
    severity: 'INFO',
    evidence: [{
      type: 'KPI_SAMPLE', id: 'min-max-spread', label: 'Écart min/max',
      value: `${spread.toFixed(1)} ${kpi.kpi_unit}`,
    }],
  });

  // O4: Correlated KPI issues
  const critCorrelated = ctx.correlated_kpis.filter(k => k.breach_level === 'CRIT');
  if (critCorrelated.length > 0) {
    obs.push({
      id: 'OBS-004',
      fact: `${critCorrelated.length} autre(s) KPI en violation critique sur les mêmes segments : ${critCorrelated.map(k => `${k.kpi_label} (avg: ${k.avg.toFixed(1)} ${k.unit})`).join(', ')}.`,
      layer: 'QOS',
      severity: 'CRITICAL',
      evidence: critCorrelated.map(k => ({
        type: 'KPI_SAMPLE' as const, id: `corr-${k.kpi_name}`, label: k.kpi_label,
        value: `${k.avg.toFixed(1)} ${k.unit}`,
      })),
    });
  }

  // O5: Artifact availability
  if (ctx.artifacts.length > 0) {
    const pcapCount = ctx.artifacts.filter(a => a.type === 'PCAP').length;
    const logCount = ctx.artifacts.filter(a => a.type !== 'PCAP').length;
    obs.push({
      id: 'OBS-005',
      fact: `${ctx.artifacts.length} artefact(s) corrélé(s) disponible(s) : ${pcapCount} PCAP, ${logCount} log(s).`,
      layer: 'CAPTURE',
      severity: 'INFO',
      evidence: ctx.artifacts.map(a => ({
        type: 'ARTIFACT' as const, id: a.artifact_id, label: a.filename,
        value: `${(a.size_bytes / 1024 / 1024).toFixed(1)} MB`,
      })),
    });
  } else {
    obs.push({
      id: 'OBS-005',
      fact: 'Aucun artefact (PCAP/logs) disponible dans la fenêtre temporelle de l\'incident. Le diagnostic est limité aux seules métriques KPI.',
      layer: 'CAPTURE',
      severity: 'WARNING',
      evidence: [{
        type: 'TIMESTAMP', id: 'tw-start', label: 'Fenêtre temporelle',
        value: `${kpi.time_window.start} → ${kpi.time_window.end}`,
      }],
    });
  }

  // O6: PCAP stats if available
  if (ctx.pcap_stats) {
    if (ctx.pcap_stats.retransmission_pct > 2) {
      obs.push({
        id: 'OBS-006',
        fact: `Taux de retransmission TCP élevé : ${ctx.pcap_stats.retransmission_pct.toFixed(1)}% (${ctx.pcap_stats.retransmissions} retransmissions sur ${ctx.pcap_stats.total_packets} paquets).`,
        layer: 'APP',
        severity: ctx.pcap_stats.retransmission_pct > 5 ? 'CRITICAL' : 'WARNING',
        evidence: [{
          type: 'ARTIFACT', id: 'pcap-retrans', label: 'Retransmissions TCP',
          value: `${ctx.pcap_stats.retransmission_pct.toFixed(1)}%`,
        }],
      });
    }
    if (ctx.pcap_stats.dns_failures > 0) {
      obs.push({
        id: 'OBS-007',
        fact: `${ctx.pcap_stats.dns_failures} échec(s) DNS détecté(s) dans la capture réseau.`,
        layer: 'APP',
        severity: 'WARNING',
        evidence: [{
          type: 'ARTIFACT', id: 'pcap-dns', label: 'Échecs DNS',
          value: `${ctx.pcap_stats.dns_failures}`,
        }],
      });
    }
  }

  // O8: Geographic concentration
  if (ctx.top_segments.length >= 2) {
    const allCrit = ctx.top_segments.every(s => s.breach_level === 'CRIT');
    if (allCrit) {
      obs.push({
        id: 'OBS-008',
        fact: `Tous les segments les plus affectés (${ctx.top_segments.length}) sont en état CRITIQUE, suggérant un problème localisé et non transitoire.`,
        layer: classifyKpiLayer(kpi.kpi_name),
        severity: 'CRITICAL',
        evidence: ctx.top_segments.map(s => ({
          type: 'SEGMENT' as const, id: s.segment_id, label: `Segment #${s.index + 1}`,
          value: `${s.kpi_stats.breach_pct}% breach`,
        })),
      });
    }
  }

  return obs;
}

// ─── Hypotheses ─────────────────────────────────────────────────────────────

function buildHypotheses(ctx: DriveRepairContextV2, observations: Observation[]): Hypothesis[] {
  const hyps: Hypothesis[] = [];
  const kpi = ctx.incident;
  const layer = classifyKpiLayer(kpi.kpi_name);

  // H1: Primary layer hypothesis
  hyps.push({
    id: 'HYP-001',
    layer,
    title: getLayerHypothesisTitle(kpi.kpi_name, layer),
    description: getLayerHypothesisDesc(kpi, layer, ctx),
    confidence: kpi.severity === 'P0' ? 0.75 : 0.65,
    evidence_refs: ['OBS-001', 'OBS-002'],
    requires_verification: true,
    verification_method: getVerificationMethod(layer),
  });

  // H2: QoS / congestion hypothesis (if throughput or latency)
  if (['THROUGHPUT_DL', 'THROUGHPUT_UL', 'LATENCY', 'JITTER', 'PACKET_LOSS'].includes(kpi.kpi_name)) {
    hyps.push({
      id: 'HYP-002',
      layer: 'QOS',
      title: 'Congestion réseau ou dégradation QoS',
      description: `La dégradation du ${kpi.kpi_label} peut être causée par une congestion sur le réseau d'accès ou de transport, un problème de prioritisation QoS, ou une saturation de la bande passante.`,
      confidence: ctx.correlated_kpis.some(k => k.breach_level === 'CRIT') ? 0.70 : 0.45,
      evidence_refs: ['OBS-001', 'OBS-003', ...(observations.find(o => o.id === 'OBS-004') ? ['OBS-004'] : [])],
      requires_verification: true,
      verification_method: 'Analyser les captures PCAP pour identifier les patterns de congestion (fenêtre TCP, retransmissions, RTT).',
    });
  }

  // H3: Radio hypothesis (if not already primary)
  if (layer !== 'RADIO' && ctx.correlated_kpis.some(k => ['RSRP', 'RSRQ', 'SINR'].includes(k.kpi_name) && k.breach_level !== 'OK')) {
    const radioKpi = ctx.correlated_kpis.find(k => ['RSRP', 'RSRQ', 'SINR'].includes(k.kpi_name) && k.breach_level !== 'OK');
    hyps.push({
      id: 'HYP-003',
      layer: 'RADIO',
      title: 'Dégradation de la couche radio',
      description: `Le ${radioKpi?.kpi_label} est également en violation (avg: ${radioKpi?.avg.toFixed(1)} ${radioKpi?.unit}), ce qui peut être la cause racine de la dégradation du ${kpi.kpi_label}.`,
      confidence: 0.60,
      evidence_refs: ['OBS-004'],
      requires_verification: true,
      verification_method: 'Vérifier les logs radio du terminal (RSRP, RSRQ, SINR, PCI) et les handovers.',
    });
  }

  // H4: Capture/observability gap
  if (ctx.artifacts.length === 0) {
    hyps.push({
      id: 'HYP-004',
      layer: 'CAPTURE',
      title: 'Manque d\'observabilité — diagnostic limité',
      description: 'Aucun artefact réseau (PCAP, logs) n\'est disponible pour cette fenêtre temporelle. Le diagnostic repose uniquement sur les métriques KPI, ce qui limite la capacité à identifier la cause racine avec certitude.',
      confidence: 0.30,
      evidence_refs: ['OBS-005'],
      requires_verification: false,
    });
  }

  // H5: Dataset/config hypothesis
  if (kpi.breach_pct > 80) {
    hyps.push({
      id: 'HYP-005',
      layer: 'DATASET',
      title: 'Erreur de configuration ou de dataset',
      description: `Avec ${kpi.breach_pct}% de breach, il est possible que les seuils soient mal configurés, que le dataset de test soit incorrect (mauvais serveur, mauvais port), ou que l'environnement de test ne corresponde pas à la cible.`,
      confidence: kpi.breach_pct > 90 ? 0.55 : 0.35,
      evidence_refs: ['OBS-001', 'OBS-002'],
      requires_verification: true,
      verification_method: 'Vérifier les paramètres du dataset (serveur iperf, cibles ping, credentials SIP) et les seuils KPI.',
    });
  }

  return hyps.sort((a, b) => b.confidence - a.confidence);
}

// ─── Root Causes ────────────────────────────────────────────────────────────

function buildRootCauses(ctx: DriveRepairContextV2, hypotheses: Hypothesis[]): RootCauseCandidate[] {
  return hypotheses
    .filter(h => h.confidence >= 0.4)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((h, i) => ({
      rank: i + 1,
      layer: h.layer,
      title: h.title,
      description: h.description,
      confidence: h.confidence,
      supporting_hypotheses: [h.id],
      impact: getImpactDescription(ctx.incident, h.layer),
    }));
}

// ─── Recommendations ────────────────────────────────────────────────────────

function buildRecommendations(ctx: DriveRepairContextV2, rootCauses: RootCauseCandidate[]): Recommendation[] {
  const recs: Recommendation[] = [];
  const kpi = ctx.incident;
  let priority = 1;

  // Always recommend capture/observability
  recs.push({
    id: `REC-${String(priority).padStart(3, '0')}`,
    category: 'CAPTURE',
    action: ctx.artifacts.length === 0
      ? `Activer la capture réseau (mode ${ctx.capture_policy.mode === 'NONE' ? 'RUNNER_TCPDUMP' : ctx.capture_policy.mode}) pour la prochaine exécution sur ces segments.`
      : `Conserver la capture réseau active et ajouter un filtre BPF ciblé pour isoler le trafic ${getProtocolHint(kpi.kpi_name)}.`,
    expected_impact: 'Permettre un diagnostic approfondi avec analyse protocolaire.',
    effort: 'LOW',
    risk: 'LOW',
    priority: priority++,
    commands_hint: ctx.artifacts.length === 0
      ? ['capture_mode: RUNNER_TCPDUMP', `bpf_filter: "${getBpfHint(kpi.kpi_name)}"`, 'snaplen: 1500']
      : [`bpf_filter: "${getBpfHint(kpi.kpi_name)}"`, 'rotate_mb: 100'],
  });

  // Layer-specific recommendations
  for (const rc of rootCauses) {
    const layerRecs = getLayerRecommendations(kpi, rc.layer, ctx);
    for (const lr of layerRecs) {
      recs.push({
        ...lr,
        id: `REC-${String(priority).padStart(3, '0')}`,
        priority: priority++,
        related_hypothesis: rc.supporting_hypotheses[0],
      });
    }
  }

  return recs;
}

// ─── Rerun Plan ─────────────────────────────────────────────────────────────

function buildRerunPlan(ctx: DriveRepairContextV2): RerunPlan {
  const kpi = ctx.incident;
  return {
    segments: ctx.top_segments.map(s => ({
      segment_id: s.segment_id,
      reason: `Segment #${s.index + 1} en ${s.breach_level} (${s.kpi_stats.breach_pct}% breach, avg: ${s.kpi_stats.avg.toFixed(1)})`,
    })),
    time_window: {
      preferred_start: '08:00',
      preferred_end: '10:00',
      duration_min: Math.max(15, ctx.top_segments.length * 10),
      rationale: 'Fenêtre matinale pour conditions radio stables et trafic modéré.',
    },
    required_capture_mode: ctx.artifacts.length === 0 ? 'RUNNER_TCPDUMP' : ctx.capture_policy.mode,
    capture_filters: {
      bpf_filter: getBpfHint(kpi.kpi_name),
      snaplen: 1500,
      rationale: `Filtre ciblé pour le protocole ${getProtocolHint(kpi.kpi_name)} afin de réduire le volume de capture.`,
    },
    required_datasets: [
      { type: 'server_config', key: 'iperf_server', value_hint: 'Vérifier l\'accessibilité du serveur' },
      { type: 'thresholds', key: `threshold_${kpi.kpi_name.toLowerCase()}`, value_hint: `Actuel: ${kpi.threshold} ${kpi.kpi_unit}` },
    ],
    pre_checks: [
      'Vérifier la connectivité réseau du terminal de test',
      'Vérifier l\'accessibilité du serveur de test (iperf/ping/SIP)',
      'Vérifier l\'espace disque pour les captures PCAP',
      'Vérifier que la sonde probe est en ligne (si mode PROBE)',
      `Confirmer le seuil ${kpi.kpi_label}: ${kpi.threshold} ${kpi.kpi_unit}`,
    ],
    commands_hint: [
      `# Pré-vérification`,
      `ping -c 5 <server_ip>`,
      `iperf3 -c <server_ip> -t 5 --json`,
      `# Lancer le drive test sur les segments ciblés`,
    ],
  };
}

// ─── Next Measurements ──────────────────────────────────────────────────────

function buildNextMeasurements(ctx: DriveRepairContextV2): NextMeasurement[] {
  const measurements: NextMeasurement[] = [];
  const kpi = ctx.incident;

  measurements.push({
    id: 'NM-001',
    what: `Mesure ${kpi.kpi_label} avec capture PCAP sur les segments affectés`,
    why: 'Corréler les métriques KPI avec l\'analyse protocolaire pour confirmer la cause racine.',
    how: `Activer la capture ${ctx.capture_policy.mode === 'NONE' ? 'RUNNER_TCPDUMP' : ctx.capture_policy.mode} avec filtre BPF "${getBpfHint(kpi.kpi_name)}"`,
    priority: 'MUST',
  });

  if (!ctx.correlated_kpis.some(k => ['RSRP', 'RSRQ', 'SINR'].includes(k.kpi_name))) {
    measurements.push({
      id: 'NM-002',
      what: 'Mesures radio (RSRP, RSRQ, SINR) simultanées',
      why: 'Vérifier si la dégradation est corrélée à un problème de couverture radio.',
      how: 'Activer les mesures radio dans G-NetTrack avec intervalle 500ms.',
      priority: 'SHOULD',
    });
  }

  measurements.push({
    id: 'NM-003',
    what: 'Mesure comparative à un horaire différent',
    why: 'Déterminer si le problème est lié à la charge réseau (heure de pointe vs heure creuse).',
    how: 'Répéter le même parcours entre 06:00-07:00 (heure creuse).',
    priority: 'NICE_TO_HAVE',
  });

  return measurements;
}

// ─── Glossary ───────────────────────────────────────────────────────────────

function buildGlossary(ctx: DriveRepairContextV2): GlossaryEntry[] {
  const glossary: GlossaryEntry[] = [];
  const kpi = ctx.incident.kpi_name;

  const terms: Record<string, { def: string; layer?: AnalysisLayer }> = {
    RSRP: { def: 'Reference Signal Received Power — Puissance du signal de référence reçu (dBm). Indicateur principal de couverture LTE/5G.', layer: 'RADIO' },
    RSRQ: { def: 'Reference Signal Received Quality — Qualité du signal de référence (dB). Combine RSRP et interférence.', layer: 'RADIO' },
    SINR: { def: 'Signal to Interference plus Noise Ratio — Rapport signal/bruit+interférence (dB). Indicateur de qualité radio.', layer: 'RADIO' },
    THROUGHPUT_DL: { def: 'Débit descendant — Volume de données reçues par seconde (Mbps).', layer: 'QOS' },
    THROUGHPUT_UL: { def: 'Débit montant — Volume de données envoyées par seconde (Mbps).', layer: 'QOS' },
    LATENCY: { def: 'Latence — Temps d\'aller-retour (RTT) d\'un paquet réseau (ms).', layer: 'QOS' },
    JITTER: { def: 'Gigue — Variation de la latence entre paquets consécutifs (ms).', layer: 'QOS' },
    PACKET_LOSS: { def: 'Perte de paquets — Pourcentage de paquets non reçus (%).', layer: 'QOS' },
    BPF: { def: 'Berkeley Packet Filter — Langage de filtrage pour les captures réseau (tcpdump, Wireshark).', layer: 'CAPTURE' },
    PCAP: { def: 'Packet Capture — Format de fichier standard pour les captures réseau.', layer: 'CAPTURE' },
    HANDOVER: { def: 'Transfert intercellulaire — Passage d\'une cellule radio à une autre pendant le déplacement.', layer: 'RADIO' },
    QoS: { def: 'Quality of Service — Mécanismes de priorisation du trafic réseau.', layer: 'QOS' },
    EPC: { def: 'Evolved Packet Core — Cœur de réseau 4G/LTE.', layer: 'CORE' },
    '5GC': { def: '5G Core — Cœur de réseau 5G.', layer: 'CORE' },
    MOS: { def: 'Mean Opinion Score — Score de qualité vocale perçue (1-5).', layer: 'APP' },
  };

  // Add KPI-specific terms
  if (terms[kpi]) {
    glossary.push({ term: kpi, definition: terms[kpi].def, layer: terms[kpi].layer });
  }

  // Add common terms
  for (const [term, info] of Object.entries(terms)) {
    if (term !== kpi && glossary.length < 8) {
      glossary.push({ term, definition: info.def, layer: info.layer });
    }
  }

  return glossary;
}

// ─── Insufficient Data ──────────────────────────────────────────────────────

function buildInsufficientData(ctx: DriveRepairContextV2) {
  const gaps: Array<{ what: string; impact: string; how_to_collect: string }> = [];

  if (ctx.artifacts.length === 0) {
    gaps.push({
      what: 'Captures réseau (PCAP)',
      impact: 'Impossible d\'analyser les protocoles, retransmissions, DNS, SIP. Diagnostic limité aux métriques KPI.',
      how_to_collect: 'Activer la capture réseau (RUNNER_TCPDUMP ou PROBE_SPAN_TAP) dans la Capture Policy du projet.',
    });
  }

  if (!ctx.pcap_stats) {
    gaps.push({
      what: 'Statistiques PCAP (tshark summary)',
      impact: 'Pas d\'analyse protocolaire automatique (retransmissions, DNS failures, SIP codes).',
      how_to_collect: 'Installer tshark sur le runner ou la sonde probe pour l\'analyse automatique des captures.',
    });
  }

  if (!ctx.device_info) {
    gaps.push({
      what: 'Informations terminal (modèle, OS, type réseau)',
      impact: 'Impossible de corréler les problèmes avec le matériel ou la configuration réseau du terminal.',
      how_to_collect: 'Configurer le dataset avec les informations du terminal de test.',
    });
  }

  if (ctx.correlated_kpis.length === 0) {
    gaps.push({
      what: 'KPI corrélés (autres métriques sur les mêmes segments)',
      impact: 'Impossible de déterminer si le problème est isolé à un KPI ou systémique.',
      how_to_collect: 'Activer la collecte de tous les KPI (radio + transport + application) pendant le drive test.',
    });
  }

  return gaps;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function classifyKpiLayer(kpiName: string): AnalysisLayer {
  if (['RSRP', 'RSRQ', 'SINR', 'ATTACH_SUCCESS', 'DROP_CALL', 'HANDOVER_SUCCESS'].includes(kpiName)) return 'RADIO';
  if (['THROUGHPUT_DL', 'THROUGHPUT_UL', 'LATENCY', 'JITTER', 'PACKET_LOSS'].includes(kpiName)) return 'QOS';
  if (['VOLTE_MOS', 'VOLTE_SETUP_TIME', 'DNS_RESOLUTION_TIME', 'HTTP_RESPONSE_TIME'].includes(kpiName)) return 'APP';
  return 'QOS';
}

function getProtocolHint(kpiName: string): string {
  if (['THROUGHPUT_DL', 'THROUGHPUT_UL'].includes(kpiName)) return 'TCP/iperf3';
  if (['LATENCY', 'JITTER', 'PACKET_LOSS'].includes(kpiName)) return 'ICMP/UDP';
  if (['VOLTE_MOS', 'VOLTE_SETUP_TIME'].includes(kpiName)) return 'SIP/RTP';
  if (['DNS_RESOLUTION_TIME'].includes(kpiName)) return 'DNS';
  if (['HTTP_RESPONSE_TIME'].includes(kpiName)) return 'HTTP';
  return 'IP';
}

function getBpfHint(kpiName: string): string {
  if (['THROUGHPUT_DL', 'THROUGHPUT_UL'].includes(kpiName)) return 'tcp port 5201';
  if (['LATENCY', 'JITTER', 'PACKET_LOSS'].includes(kpiName)) return 'icmp or udp';
  if (['VOLTE_MOS', 'VOLTE_SETUP_TIME'].includes(kpiName)) return 'port 5060 or portrange 10000-20000';
  if (['DNS_RESOLUTION_TIME'].includes(kpiName)) return 'port 53';
  if (['HTTP_RESPONSE_TIME'].includes(kpiName)) return 'tcp port 80 or tcp port 443';
  return '';
}

function getLayerHypothesisTitle(kpiName: string, layer: AnalysisLayer): string {
  const titles: Record<AnalysisLayer, string> = {
    RADIO: 'Dégradation de la couverture ou qualité radio',
    CORE: 'Problème au niveau du cœur de réseau',
    QOS: 'Dégradation de la qualité de service réseau',
    APP: 'Problème applicatif ou de transport',
    CAPTURE: 'Problème de capture réseau',
    DATASET: 'Erreur de configuration ou de dataset',
  };
  return titles[layer];
}

function getLayerHypothesisDesc(kpi: DriveRepairContextV2['incident'], layer: AnalysisLayer, ctx: DriveRepairContextV2): string {
  switch (layer) {
    case 'RADIO':
      return `Le ${kpi.kpi_label} moyen (${kpi.observed.avg.toFixed(1)} ${kpi.kpi_unit}) sur ${kpi.segment_count} segment(s) suggère un problème de couverture radio dans la zone ${kpi.geo_point.lat.toFixed(4)}, ${kpi.geo_point.lon.toFixed(4)}. Causes possibles : zone d'ombre, interférence inter-cellulaire, handover raté, ou antenne mal orientée.`;
    case 'QOS':
      return `La dégradation du ${kpi.kpi_label} (avg: ${kpi.observed.avg.toFixed(1)} ${kpi.kpi_unit}) peut être causée par une congestion sur le réseau d'accès ou de transport, un problème de prioritisation QoS, une saturation de la bande passante, ou un problème de routage.`;
    case 'APP':
      return `Le ${kpi.kpi_label} (avg: ${kpi.observed.avg.toFixed(1)} ${kpi.kpi_unit}) indique un problème au niveau applicatif ou transport. Causes possibles : serveur de test surchargé, problème DNS, configuration SIP incorrecte, ou timeout réseau.`;
    default:
      return `Le ${kpi.kpi_label} est en violation sur ${kpi.segment_count} segment(s). Une analyse approfondie est nécessaire.`;
  }
}

function getVerificationMethod(layer: AnalysisLayer): string {
  switch (layer) {
    case 'RADIO': return 'Analyser les logs radio (RSRP/RSRQ/SINR/PCI) et les événements de handover dans G-NetTrack.';
    case 'QOS': return 'Analyser les captures PCAP pour identifier congestion, retransmissions, et fenêtre TCP.';
    case 'APP': return 'Vérifier les logs applicatifs, la résolution DNS, et la connectivité au serveur de test.';
    case 'CORE': return 'Vérifier les compteurs EPC/5GC (attach, PDN, bearer) et les logs MME/AMF.';
    default: return 'Collecter des données supplémentaires pour confirmer.';
  }
}

function getImpactDescription(incident: DriveRepairContextV2['incident'], layer: AnalysisLayer): string {
  switch (layer) {
    case 'RADIO': return `Dégradation de la couverture radio affectant ${incident.segment_count} segment(s) sur la route de test.`;
    case 'QOS': return `Qualité de service insuffisante pour les utilisateurs dans la zone (${incident.breach_pct}% des mesures en violation).`;
    case 'APP': return `Service applicatif dégradé avec un ${incident.kpi_label} moyen de ${incident.observed.avg.toFixed(1)} ${incident.kpi_unit}.`;
    case 'CORE': return `Problème potentiel au niveau du cœur de réseau affectant la connectivité.`;
    default: return `Impact sur le ${incident.kpi_label} dans la zone de test.`;
  }
}

function getLayerRecommendations(kpi: DriveRepairContextV2['incident'], layer: AnalysisLayer, ctx: DriveRepairContextV2): Omit<Recommendation, 'id' | 'priority' | 'related_hypothesis'>[] {
  switch (layer) {
    case 'RADIO':
      return [{
        category: 'RADIO',
        action: 'Vérifier la couverture radio dans la zone affectée : scanner les cellules voisines, mesurer RSRP/RSRQ/SINR avec intervalle 500ms, et identifier les zones d\'ombre.',
        expected_impact: 'Identifier les cellules problématiques et les zones de handover.',
        effort: 'MEDIUM',
        risk: 'LOW',
        commands_hint: ['G-NetTrack: scan_interval=500ms', 'Activer le log des handovers'],
      }, {
        category: 'RADIO',
        action: 'Signaler la zone à l\'équipe radio pour vérification des paramètres d\'antenne (tilt, azimut, puissance).',
        expected_impact: 'Amélioration de la couverture dans la zone identifiée.',
        effort: 'HIGH',
        risk: 'MEDIUM',
      }];
    case 'QOS':
      return [{
        category: 'QOS',
        action: `Analyser les captures PCAP avec tshark pour identifier les patterns de congestion : retransmissions TCP, fenêtre de congestion, RTT.`,
        expected_impact: 'Identifier la cause exacte de la dégradation QoS.',
        effort: 'MEDIUM',
        risk: 'LOW',
        commands_hint: ['tshark -r capture.pcap -q -z io,stat,1', 'tshark -r capture.pcap -q -z expert'],
      }, {
        category: 'QOS',
        action: 'Vérifier la configuration QoS (bearer, QCI, APN) et les compteurs de congestion sur le réseau d\'accès.',
        expected_impact: 'Confirmer ou infirmer un problème de priorisation.',
        effort: 'MEDIUM',
        risk: 'LOW',
      }];
    case 'APP':
      return [{
        category: 'APP',
        action: `Vérifier l'accessibilité et les performances du serveur de test (${getProtocolHint(kpi.kpi_name)}).`,
        expected_impact: 'Éliminer le serveur comme cause de la dégradation.',
        effort: 'LOW',
        risk: 'LOW',
        commands_hint: [`ping -c 10 <server_ip>`, `iperf3 -c <server_ip> -t 10 --json`],
      }];
    case 'DATASET':
      return [{
        category: 'DATASET',
        action: 'Vérifier les paramètres du dataset de test : adresses serveur, ports, credentials, et seuils KPI.',
        expected_impact: 'Corriger les erreurs de configuration qui faussent les résultats.',
        effort: 'LOW',
        risk: 'LOW',
      }];
    default:
      return [];
  }
}
