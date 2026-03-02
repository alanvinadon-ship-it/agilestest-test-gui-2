/**
 * driveRepairContextBuilder.ts — Context builder déterministe v2
 * Mission DRIVE-REPAIR-REAL-2
 */
import type { DriveIncident, EnrichedKpiSample, ArtifactTimeIndex, RouteSegment, BreachLevel } from './types';
import { KPI_LABELS, KPI_UNITS, DEFAULT_KPI_THRESHOLDS } from './types';
import type { DriveRepairContextV2 } from './driveRepairTypes';

export interface ContextBuilderInput {
  incident: DriveIncident;
  segments: RouteSegment[];
  allSamples: EnrichedKpiSample[];
  artifactIndex: ArtifactTimeIndex[];
  deviceInfo?: DriveRepairContextV2['device_info'];
  capturePolicy?: DriveRepairContextV2['capture_policy'];
  pcapStats?: DriveRepairContextV2['pcap_stats'];
}

export function buildDriveRepairContextV2(input: ContextBuilderInput): DriveRepairContextV2 {
  const { incident, segments, allSamples, artifactIndex, deviceInfo, capturePolicy, pcapStats } = input;
  const t = DEFAULT_KPI_THRESHOLDS[incident.kpi_name];

  const incidentMeta: DriveRepairContextV2['incident'] = {
    incident_id: incident.incident_id,
    kpi_name: incident.kpi_name,
    kpi_label: KPI_LABELS[incident.kpi_name] || incident.kpi_name,
    kpi_unit: KPI_UNITS[incident.kpi_name] || '',
    threshold: incident.threshold,
    threshold_direction: t?.direction || 'higher_better',
    severity: incident.severity,
    observed: { min: incident.observed_min, max: incident.observed_max, avg: incident.observed_avg },
    breach_pct: incident.breach_pct,
    segment_count: incident.segment_count,
    time_window: incident.time_window,
    geo_point: incident.geo_point,
    geo_bbox: incident.geo_bbox,
  };

  const incidentSegmentIds = new Set(incident.evidence_refs.segment_ids);
  const incidentSegments = segments
    .filter(s => incidentSegmentIds.has(s.segment_id))
    .sort((a, b) => {
      const aStats = a.kpi_stats[incident.kpi_name];
      const bStats = b.kpi_stats[incident.kpi_name];
      return (bStats?.breach_pct || 0) - (aStats?.breach_pct || 0);
    })
    .slice(0, 3);

  const topSegments: DriveRepairContextV2['top_segments'] = incidentSegments.map(seg => {
    const stats = seg.kpi_stats[incident.kpi_name];
    return {
      segment_id: seg.segment_id,
      index: seg.index,
      center: seg.center,
      length_m: seg.length_m,
      breach_level: stats?.breach_level || seg.breach_level,
      kpi_stats: {
        min: stats?.min || 0, max: stats?.max || 0, avg: stats?.avg || 0,
        breach_pct: stats?.breach_pct || 0, count: stats?.count || 0,
      },
      time_window: seg.time_window,
    };
  });

  const incidentSamples = allSamples
    .filter(s => incidentSegmentIds.has(s.segment_id) && s.kpi_name === incident.kpi_name)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const timelineSamples: DriveRepairContextV2['timeline_samples'] = incidentSamples.map(s => ({
    timestamp: s.timestamp, value: s.value, breach_level: s.breach_level,
    segment_id: s.segment_id, lat: s.lat, lon: s.lon,
  }));

  const incidentArtifactIds = new Set(incident.evidence_refs.artifact_ids);
  const correlatedArtifacts: DriveRepairContextV2['artifacts'] = artifactIndex
    .filter(a => incidentArtifactIds.has(a.artifact_id))
    .map(a => ({
      artifact_id: a.artifact_id, filename: a.filename, type: a.type,
      source: a.source, size_bytes: a.size_bytes, start_ts: a.start_ts, end_ts: a.end_ts,
    }));

  const otherKpiNames = new Set<string>();
  allSamples.forEach(s => {
    if (incidentSegmentIds.has(s.segment_id) && s.kpi_name !== incident.kpi_name) {
      otherKpiNames.add(s.kpi_name);
    }
  });

  const correlatedKpis: DriveRepairContextV2['correlated_kpis'] = [];
  for (const kpiName of otherKpiNames) {
    const kpiSamples = allSamples.filter(s => incidentSegmentIds.has(s.segment_id) && s.kpi_name === kpiName);
    if (kpiSamples.length === 0) continue;
    const values = kpiSamples.map(s => s.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const breachCount = kpiSamples.filter(s => s.breach_level !== 'OK').length;
    const breachPct = Math.round((breachCount / kpiSamples.length) * 100);
    const kpiThreshold = DEFAULT_KPI_THRESHOLDS[kpiName];
    let worstBreach: BreachLevel = 'OK';
    if (kpiSamples.some(s => s.breach_level === 'CRIT')) worstBreach = 'CRIT';
    else if (kpiSamples.some(s => s.breach_level === 'WARN')) worstBreach = 'WARN';
    correlatedKpis.push({
      kpi_name: kpiName, kpi_label: KPI_LABELS[kpiName] || kpiName,
      avg, breach_level: worstBreach, breach_pct: breachPct,
      threshold: kpiThreshold?.warn || 0, unit: KPI_UNITS[kpiName] || '',
    });
  }
  correlatedKpis.sort((a, b) => b.breach_pct - a.breach_pct);

  return {
    incident: incidentMeta,
    top_segments: topSegments,
    timeline_samples: timelineSamples,
    artifacts: correlatedArtifacts,
    pcap_stats: pcapStats,
    device_info: deviceInfo,
    capture_policy: capturePolicy || { mode: 'NONE' as const },
    correlated_kpis: correlatedKpis,
  };
}

export function contextToPromptString(ctx: DriveRepairContextV2): string {
  const sections: string[] = [];
  sections.push(`## INCIDENT\n- ID: ${ctx.incident.incident_id}\n- KPI: ${ctx.incident.kpi_label} (${ctx.incident.kpi_unit})\n- Seuil: ${ctx.incident.threshold} ${ctx.incident.kpi_unit} (${ctx.incident.threshold_direction})\n- Observé: min=${ctx.incident.observed.min.toFixed(1)}, avg=${ctx.incident.observed.avg.toFixed(1)}, max=${ctx.incident.observed.max.toFixed(1)}\n- Breach: ${ctx.incident.breach_pct}%\n- Sévérité: ${ctx.incident.severity}\n- Segments: ${ctx.incident.segment_count}\n- Fenêtre: ${ctx.incident.time_window.start} → ${ctx.incident.time_window.end}\n- Géo: ${ctx.incident.geo_point.lat.toFixed(4)}, ${ctx.incident.geo_point.lon.toFixed(4)}`);

  if (ctx.top_segments.length > 0) {
    sections.push(`## TOP SEGMENTS (${ctx.top_segments.length})\n${ctx.top_segments.map(s => `### Segment #${s.index + 1}\n- Centre: ${s.center.lat.toFixed(4)}, ${s.center.lon.toFixed(4)}\n- Longueur: ${s.length_m.toFixed(0)}m\n- Breach: ${s.breach_level} (${s.kpi_stats.breach_pct}%)\n- Stats: min=${s.kpi_stats.min.toFixed(1)}, avg=${s.kpi_stats.avg.toFixed(1)}, max=${s.kpi_stats.max.toFixed(1)}\n- Samples: ${s.kpi_stats.count}`).join('\n')}`);
  }

  if (ctx.timeline_samples.length > 0) {
    const critCount = ctx.timeline_samples.filter(s => s.breach_level === 'CRIT').length;
    const warnCount = ctx.timeline_samples.filter(s => s.breach_level === 'WARN').length;
    sections.push(`## TIMELINE (${ctx.timeline_samples.length} samples)\n- CRIT: ${critCount}, WARN: ${warnCount}, OK: ${ctx.timeline_samples.length - critCount - warnCount}`);
  }

  if (ctx.artifacts.length > 0) {
    sections.push(`## ARTEFACTS (${ctx.artifacts.length})\n${ctx.artifacts.map(a => `- ${a.filename} (${a.type}, ${a.source}, ${(a.size_bytes / 1024 / 1024).toFixed(1)} MB)`).join('\n')}`);
  } else {
    sections.push(`## ARTEFACTS\nAucun artefact disponible.`);
  }

  if (ctx.pcap_stats) {
    sections.push(`## PCAP STATS\n- Packets: ${ctx.pcap_stats.total_packets}\n- Retransmissions: ${ctx.pcap_stats.retransmissions} (${ctx.pcap_stats.retransmission_pct.toFixed(1)}%)\n- DNS failures: ${ctx.pcap_stats.dns_failures}`);
  }

  if (ctx.device_info) {
    sections.push(`## DEVICE\n- ${ctx.device_info.model} (${ctx.device_info.os})\n- Réseau: ${ctx.device_info.network_type}\n- Opérateur: ${ctx.device_info.carrier}`);
  }

  sections.push(`## CAPTURE POLICY\n- Mode: ${ctx.capture_policy.mode}${ctx.capture_policy.iface ? `\n- Interface: ${ctx.capture_policy.iface}` : ''}${ctx.capture_policy.bpf_filter ? `\n- BPF: ${ctx.capture_policy.bpf_filter}` : ''}`);

  if (ctx.correlated_kpis.length > 0) {
    sections.push(`## KPI CORRÉLÉS (${ctx.correlated_kpis.length})\n${ctx.correlated_kpis.map(k => `- ${k.kpi_label}: avg=${k.avg.toFixed(1)} ${k.unit} (${k.breach_level}, ${k.breach_pct}%)`).join('\n')}`);
  }

  return sections.join('\n\n');
}
