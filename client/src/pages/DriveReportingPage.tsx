/**
 * DriveReportingPage — Reporting Drive Test avec corrélation KPI ↔ route ↔ artefacts
 * Mission DRIVE-CORRELATION-1
 * - Vue segments colorés (OK/WARN/CRIT)
 * - Drill-down segment (stats, violations, artefacts, incidents)
 * - Timeline KPI avec marqueurs breach
 * - Auto-incidents Drive + lien IA REPAIR
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useProject } from '@/state/projectStore';
import type { DriveCampaign, DriveRoute, DriveJob, KpiSample, DriveRunSummary, DriveKpi } from '@/types';
import { getThresholdLevel } from '@/ai/kpiParsers';
import {
  segmentRoute, enrichSamplesWithSegments, aggregateSegmentKpi,
  buildArtifactTimeIndex, findArtifactsForSegment,
  generateDriveIncidents, deduplicateIncidents, mergeContiguousIncidents,
} from '@/driveCorrelation';
import type {
  RouteSegment, EnrichedKpiSample, ArtifactTimeIndex, DriveIncident,
  BreachLevel, WindowSize, SegmentDrillDown,
} from '@/driveCorrelation/types';
import {
  BREACH_COLORS, BREACH_TEXT_COLORS, BREACH_BG_COLORS, BREACH_LABELS,
  SEVERITY_LABELS, SEVERITY_COLORS, KPI_LABELS, KPI_UNITS,
  DEFAULT_KPI_THRESHOLDS, DEFAULT_SEGMENTATION_CONFIG, DEFAULT_AUTO_INCIDENT_CONFIG,
} from '@/driveCorrelation/types';
import {
  BarChart3, Signal, MapPin, AlertTriangle, TrendingUp, TrendingDown,
  Download, RefreshCw, Gauge, Wifi, Activity, Database, FileText,
  Loader2, ChevronRight, X, FileCode, Zap, Eye, Clock, Target,
  ArrowRight, Shield, Radio,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CampaignReport {
  campaign: DriveCampaign;
  routes: DriveRoute[];
  jobs: DriveJob[];
  summaries: DriveRunSummary[];
  samples: KpiSample[];
  dataSource: 'real' | 'simulated';
  segments: RouteSegment[];
  enrichedSamples: EnrichedKpiSample[];
  artifactIndex: ArtifactTimeIndex[];
  incidents: DriveIncident[];
  computed: {
    total_samples: number;
    total_jobs: number;
    avg_rsrp: number;
    avg_sinr: number;
    avg_dl: number;
    avg_ul: number;
    avg_latency: number;
    p95_latency: number;
    avg_packet_loss: number;
    coverage_gaps: number;
    handover_success_rate: number;
    incidents_count: number;
    violations_count: number;
    pass_rate: number;
    segments_ok: number;
    segments_warn: number;
    segments_crit: number;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function p95fn(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
}
function kpiValues(samples: KpiSample[], kpi: DriveKpi): number[] {
  return samples.filter(s => s.kpi_name === kpi).map(s => s.value);
}

// ─── Build Report ───────────────────────────────────────────────────────────

function buildReport(
  campaign: DriveCampaign,
  routes: DriveRoute[],
  jobs: DriveJob[],
  windowSize: WindowSize,
  selectedKpi: string,
  allSamples: KpiSample[],
  summaries: DriveRunSummary[],
): CampaignReport {

  // If no real data, simulate
  let samples = allSamples;
  let dataSource: 'real' | 'simulated' = 'real';
  if (samples.length === 0) {
    dataSource = 'simulated';
    samples = simulateSamples(campaign, routes);
  }

  // Segmentation
  const allCoords = routes.flatMap(r => r.route_geojson?.coordinates || []);
  const config = { ...DEFAULT_SEGMENTATION_CONFIG, window_size: windowSize };
  const segments = segmentRoute(routes[0]?.route_id || 'default', campaign.campaign_id, allCoords, config);

  // Enrichment
  const enrichedSamples = enrichSamplesWithSegments(samples, segments, config);
  aggregateSegmentKpi(segments, enrichedSamples);

  // Artifact index
  let artifactIndex: ArtifactTimeIndex[] = [];
  for (const job of jobs) {
    artifactIndex.push(...buildArtifactTimeIndex(job, campaign.campaign_id, routes[0]?.route_id || ''));
  }

  // Auto-incidents
  const rawIncidents = generateDriveIncidents(
    segments, enrichedSamples, artifactIndex,
    campaign.campaign_id, routes[0]?.route_id || '',
    jobs[0]?.drive_job_id,
    DEFAULT_AUTO_INCIDENT_CONFIG,
  );
  const incidents = mergeContiguousIncidents(deduplicateIncidents(rawIncidents, []));

  // Compute stats
  const rsrpVals = kpiValues(samples, 'RSRP');
  const sinrVals = kpiValues(samples, 'SINR');
  const dlVals = kpiValues(samples, 'THROUGHPUT_DL');
  const ulVals = kpiValues(samples, 'THROUGHPUT_UL');
  const latVals = kpiValues(samples, 'LATENCY');
  const lossVals = kpiValues(samples, 'PACKET_LOSS');
  const hoVals = kpiValues(samples, 'HANDOVER_SUCCESS');
  const totalViolations = summaries.reduce((sum, s) => sum + s.threshold_violations.length, 0);
  const passCount = summaries.filter(s => s.overall_pass).length;

  return {
    campaign, routes, jobs, summaries, samples, dataSource,
    segments, enrichedSamples, artifactIndex, incidents,
    computed: {
      total_samples: samples.length,
      total_jobs: jobs.length,
      avg_rsrp: avg(rsrpVals),
      avg_sinr: avg(sinrVals),
      avg_dl: avg(dlVals),
      avg_ul: avg(ulVals),
      avg_latency: avg(latVals),
      p95_latency: p95fn(latVals),
      avg_packet_loss: avg(lossVals),
      coverage_gaps: rsrpVals.filter(v => v < -110).length,
      handover_success_rate: hoVals.length > 0 ? avg(hoVals) : 0,
      incidents_count: incidents.length,
      violations_count: totalViolations + incidents.length,
      pass_rate: summaries.length > 0 ? (passCount / summaries.length) * 100 : 0,
      segments_ok: segments.filter(s => s.breach_level === 'OK').length,
      segments_warn: segments.filter(s => s.breach_level === 'WARN').length,
      segments_crit: segments.filter(s => s.breach_level === 'CRIT').length,
    },
  };
}

function simulateSamples(campaign: DriveCampaign, routes: DriveRoute[]): KpiSample[] {
  const checkpoints = routes.reduce((sum, r) => sum + (r.route_geojson?.coordinates?.length || 5), 0);
  const samples: KpiSample[] = [];
  const now = new Date();
  for (let i = 0; i < Math.max(checkpoints, 20); i++) {
    const ts = new Date(now.getTime() + i * 1000).toISOString();
    const lat = 5.32 + (Math.random() - 0.5) * 0.02;
    const lon = -4.01 + (Math.random() - 0.5) * 0.02;
    const base = { drive_job_id: 'sim', campaign_id: campaign.campaign_id, route_id: routes[0]?.route_id || '', timestamp: ts, lat, lon };
    samples.push({ ...base, sample_id: `sim-${i}-rsrp`, kpi_name: 'RSRP', value: parseFloat((-70 - Math.random() * 50).toFixed(1)), unit: 'dBm' });
    samples.push({ ...base, sample_id: `sim-${i}-sinr`, kpi_name: 'SINR', value: parseFloat((-2 + Math.random() * 25).toFixed(1)), unit: 'dB' });
    samples.push({ ...base, sample_id: `sim-${i}-dl`, kpi_name: 'THROUGHPUT_DL', value: parseFloat((2 + Math.random() * 80).toFixed(1)), unit: 'Mbps' });
    samples.push({ ...base, sample_id: `sim-${i}-ul`, kpi_name: 'THROUGHPUT_UL', value: parseFloat((1 + Math.random() * 40).toFixed(1)), unit: 'Mbps' });
    samples.push({ ...base, sample_id: `sim-${i}-lat`, kpi_name: 'LATENCY', value: parseFloat((8 + Math.random() * 120).toFixed(0)), unit: 'ms' });
    samples.push({ ...base, sample_id: `sim-${i}-jit`, kpi_name: 'JITTER', value: parseFloat((1 + Math.random() * 30).toFixed(1)), unit: 'ms' });
    samples.push({ ...base, sample_id: `sim-${i}-loss`, kpi_name: 'PACKET_LOSS', value: parseFloat((Math.random() * 5).toFixed(2)), unit: '%' });
  }
  return samples;
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

function exportCsv(samples: KpiSample[]) {
  const headers = ['timestamp', 'kpi_name', 'value', 'unit', 'lat', 'lon', 'cell_id', 'technology'];
  const rows = samples.map(s => [
    s.timestamp, s.kpi_name, s.value.toString(), s.unit,
    s.lat.toString(), s.lon.toString(), s.cell_id || '', s.technology || '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `kpi_samples_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast.success('CSV exporté');
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, threshold, icon: Icon, inverse }: {
  label: string; value: number; unit: string; threshold?: number; icon: typeof Gauge; inverse?: boolean;
}) {
  const level = threshold !== undefined
    ? getThresholdLevel(inverse ? 'LATENCY' : 'RSRP', value, threshold)
    : 'good';
  const borderColor = level === 'good' ? 'border-border' : level === 'warning' ? 'border-amber-500/50' : 'border-red-500/50';
  const bgColor = level === 'good' ? '' : level === 'warning' ? 'bg-amber-500/5' : 'bg-red-500/5';
  return (
    <div className={`border rounded-lg p-3 ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between mb-1">
        <Icon className={`w-4 h-4 ${level === 'good' ? 'text-emerald-400' : level === 'warning' ? 'text-amber-400' : 'text-red-400'}`} />
        {level === 'good' ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className={`w-3 h-3 ${level === 'warning' ? 'text-amber-400' : 'text-red-400'}`} />}
      </div>
      <div className="text-xl font-bold">{value.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span></div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      {threshold !== undefined && (
        <div className="text-[10px] mt-0.5">
          <span className={level === 'good' ? 'text-emerald-400' : level === 'warning' ? 'text-amber-400' : 'text-red-400'}>
            Seuil: {inverse ? '≤' : '≥'} {threshold} {unit}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Segment Bar ────────────────────────────────────────────────────────────

function SegmentBar({ segments, selectedKpi, onSelect, selectedId }: {
  segments: RouteSegment[];
  selectedKpi: string;
  onSelect: (seg: RouteSegment) => void;
  selectedId: string | null;
}) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Segments de route ({segments.length})
        </h3>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> OK</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> WARN</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> CRIT</span>
        </div>
      </div>
      <div className="flex gap-0.5 h-10 rounded overflow-hidden">
        {segments.map(seg => {
          const kpiStat = seg.kpi_stats[selectedKpi];
          const level = kpiStat?.breach_level || seg.breach_level;
          const isSelected = seg.segment_id === selectedId;
          return (
            <button
              key={seg.segment_id}
              onClick={() => onSelect(seg)}
              className={`flex-1 transition-all relative group ${isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-background z-10' : 'hover:brightness-125'}`}
              style={{ backgroundColor: BREACH_COLORS[level], opacity: isSelected ? 1 : 0.8 }}
              title={`Segment ${seg.index + 1} — ${BREACH_LABELS[level]}${kpiStat ? ` — ${selectedKpi}: ${kpiStat.avg.toFixed(1)} ${kpiStat.unit}` : ''}`}
            >
              {seg.sample_count > 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  {seg.index + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>Début</span>
        <span>{segments.length} segments · {segments.reduce((s, seg) => s + seg.length_m, 0)}m</span>
        <span>Fin</span>
      </div>
    </div>
  );
}

// ─── Timeline KPI ───────────────────────────────────────────────────────────

function KpiTimeline({ enrichedSamples, selectedKpi, onMarkerClick }: {
  enrichedSamples: EnrichedKpiSample[];
  selectedKpi: string;
  onMarkerClick: (sample: EnrichedKpiSample) => void;
}) {
  const kpiSamples = enrichedSamples.filter(s => s.kpi_name === selectedKpi);
  if (kpiSamples.length === 0) return null;

  const values = kpiSamples.map(s => s.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const t = DEFAULT_KPI_THRESHOLDS[selectedKpi];

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        Timeline {KPI_LABELS[selectedKpi] || selectedKpi} ({kpiSamples.length} points)
      </h3>
      <div className="relative h-40">
        {/* Threshold lines */}
        {t && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-amber-500/50"
              style={{ bottom: `${((t.warn - minVal) / range) * 100}%` }}
            >
              <span className="absolute right-0 -top-3 text-[9px] text-amber-400">WARN {t.warn}</span>
            </div>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-red-500/50"
              style={{ bottom: `${((t.crit - minVal) / range) * 100}%` }}
            >
              <span className="absolute right-0 -top-3 text-[9px] text-red-400">CRIT {t.crit}</span>
            </div>
          </>
        )}
        {/* Data points */}
        <div className="flex items-end h-full gap-px">
          {kpiSamples.slice(0, 80).map((s, i) => {
            const norm = Math.max(0.02, (s.value - minVal) / range);
            return (
              <button
                key={i}
                onClick={() => onMarkerClick(s)}
                className={`flex-1 rounded-t transition-all hover:brightness-125 ${
                  s.breach_level === 'CRIT' ? 'bg-red-500' :
                  s.breach_level === 'WARN' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ height: `${norm * 100}%`, opacity: 0.85 }}
                title={`${s.value.toFixed(1)} ${KPI_UNITS[selectedKpi] || ''} @ ${new Date(s.timestamp).toLocaleTimeString('fr-FR')}`}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{new Date(kpiSamples[0]?.timestamp).toLocaleTimeString('fr-FR')}</span>
        <span>{KPI_UNITS[selectedKpi] || ''} — min: {minVal.toFixed(1)} / max: {maxVal.toFixed(1)}</span>
        <span>{new Date(kpiSamples[kpiSamples.length - 1]?.timestamp).toLocaleTimeString('fr-FR')}</span>
      </div>
    </div>
  );
}

// ─── Drill-Down Panel ───────────────────────────────────────────────────────

function DrillDownPanel({ drillDown, onClose, onCreateIncident, onRepair }: {
  drillDown: SegmentDrillDown;
  onClose: () => void;
  onCreateIncident: (seg: RouteSegment) => void;
  onRepair: (incident: DriveIncident) => void;
}) {
  const { segment, samples, artifacts, incidents, top_violations } = drillDown;
  return (
    <div className="border border-primary/30 bg-card rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Segment {segment.index + 1}</span>
          <Badge className={`text-[10px] ${BREACH_BG_COLORS[segment.breach_level]} ${BREACH_TEXT_COLORS[segment.breach_level]}`}>
            {BREACH_LABELS[segment.breach_level]}
          </Badge>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Longueur</p>
            <p className="font-medium">{segment.length_m}m</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Samples</p>
            <p className="font-medium">{segment.sample_count}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Fenêtre</p>
            <p className="font-mono text-[10px]">
              {segment.time_window.start ? new Date(segment.time_window.start).toLocaleTimeString('fr-FR') : '—'}
              {' → '}
              {segment.time_window.end ? new Date(segment.time_window.end).toLocaleTimeString('fr-FR') : '—'}
            </p>
          </div>
        </div>

        {/* KPI Stats */}
        {Object.keys(segment.kpi_stats).length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-2">KPI du segment</p>
            <div className="space-y-1">
              {Object.entries(segment.kpi_stats).map(([kpi, stats]) => (
                <div key={kpi} className={`flex items-center justify-between text-xs rounded px-2 py-1 ${BREACH_BG_COLORS[stats.breach_level]}`}>
                  <span className="font-medium">{KPI_LABELS[kpi] || kpi}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">min: {stats.min.toFixed(1)}</span>
                    <span className="font-semibold">{stats.avg.toFixed(1)} {stats.unit}</span>
                    <span className="text-muted-foreground">max: {stats.max.toFixed(1)}</span>
                    <span className={`font-mono text-[10px] ${BREACH_TEXT_COLORS[stats.breach_level]}`}>
                      {stats.breach_pct}% breach
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Violations */}
        {top_violations.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-2">Violations principales</p>
            <div className="space-y-1">
              {top_violations.map((v, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-red-500/5 rounded px-2 py-1">
                  <span className="font-medium">{KPI_LABELS[v.kpi_name] || v.kpi_name}</span>
                  <div className="flex items-center gap-2">
                    <span className={BREACH_TEXT_COLORS[v.breach_level]}>{v.avg.toFixed(1)}</span>
                    <span className="text-muted-foreground">seuil: {v.threshold}</span>
                    <span className="text-muted-foreground">{v.breach_pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-2">
              Artefacts liés ({artifacts.length})
            </p>
            <div className="space-y-1">
              {artifacts.map(art => (
                <div key={art.artifact_id} className="flex items-center justify-between text-xs bg-secondary/20 rounded px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3 h-3 text-primary" />
                    <span className="font-mono">{art.filename}</span>
                    <Badge variant="outline" className="text-[9px]">{art.source}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{(art.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                    {art.download_url && (
                      <a href={art.download_url} className="text-primary hover:underline"><Download className="w-3 h-3" /></a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incidents */}
        {incidents.length > 0 ? (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase mb-2">Incidents ({incidents.length})</p>
            <div className="space-y-1">
              {incidents.map(inc => (
                <div key={inc.incident_id} className="flex items-center justify-between text-xs bg-red-500/5 border border-red-500/20 rounded px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-3 h-3 ${SEVERITY_COLORS[inc.severity]}`} />
                    <span className={`font-semibold ${SEVERITY_COLORS[inc.severity]}`}>{SEVERITY_LABELS[inc.severity]}</span>
                    <span>{KPI_LABELS[inc.kpi_name] || inc.kpi_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">avg: {inc.observed_avg.toFixed(1)}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary" onClick={() => onRepair(inc)}>
                      <Zap className="w-3 h-3 mr-1" /> Analyze & Repair
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => onCreateIncident(segment)}>
              <AlertTriangle className="w-3 h-3 mr-1" /> Créer incident manuellement
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Incidents Summary ──────────────────────────────────────────────────────

function IncidentsSummary({ incidents, onRepair }: {
  incidents: DriveIncident[];
  onRepair: (incident: DriveIncident) => void;
}) {
  if (incidents.length === 0) return null;
  const p0 = incidents.filter(i => i.severity === 'P0').length;
  const p1 = incidents.filter(i => i.severity === 'P1').length;
  const p2 = incidents.filter(i => i.severity === 'P2').length;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" />
          Incidents Drive auto-générés ({incidents.length})
        </h3>
        <div className="flex items-center gap-2 text-xs">
          {p0 > 0 && <Badge className="bg-red-500/20 text-red-400">P0: {p0}</Badge>}
          {p1 > 0 && <Badge className="bg-orange-500/20 text-orange-400">P1: {p1}</Badge>}
          {p2 > 0 && <Badge className="bg-yellow-500/20 text-yellow-400">P2: {p2}</Badge>}
        </div>
      </div>
      <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
        {incidents.map(inc => (
          <div key={inc.incident_id} className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/10">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-4 h-4 ${SEVERITY_COLORS[inc.severity]}`} />
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${SEVERITY_COLORS[inc.severity]}`}>{SEVERITY_LABELS[inc.severity]}</span>
                  <span className="text-xs font-medium">{KPI_LABELS[inc.kpi_name] || inc.kpi_name}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  avg: {inc.observed_avg.toFixed(1)} · seuil: {inc.threshold} · {inc.segment_count} seg · {inc.breach_pct}% breach
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{inc.evidence_refs.artifact_ids.length} artefact(s)</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRepair(inc)}>
                <Zap className="w-3 h-3 mr-1" /> Repair IA
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DriveReportingPage() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || '';

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string>('ALL');
  const [selectedKpi, setSelectedKpi] = useState<string>('RSRP');
  const [windowSize, setWindowSize] = useState<WindowSize>('5s');
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<RouteSegment | null>(null);
  const [autoIncidents, setAutoIncidents] = useState(true);

  // URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cId = params.get('campaign');
    const jId = params.get('job');
    if (cId) setSelectedCampaignId(cId);
    if (jId) setSelectedJobId(jId);
  }, []);

  // tRPC: campaigns for project
  const { data: campaignsData } = trpc.driveCampaigns.list.useQuery(
    { projectId, pageSize: 200 },
    { enabled: !!projectId }
  );
  const campaigns = (campaignsData?.data || []) as unknown as DriveCampaign[];

  // Auto-select first campaign
  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].campaign_id || (campaigns[0] as any).uid || '');
    }
  }, [campaigns, selectedCampaignId]);

  // tRPC: routes for selected campaign
  const { data: routesData } = trpc.driveRoutes.list.useQuery(
    { campaignId: selectedCampaignId, limit: 100 },
    { enabled: !!selectedCampaignId }
  );
  const routes = (routesData?.items || []) as unknown as DriveRoute[];

  // tRPC: jobs for selected campaign
  const { data: jobsData } = trpc.driveJobs.list.useQuery(
    { campaignId: selectedCampaignId, limit: 200 },
    { enabled: !!selectedCampaignId }
  );
  const allJobs = (jobsData?.items || []) as unknown as DriveJob[];
  const availableJobs = allJobs;

  // tRPC: summaries for selected campaign
  const { data: summariesData } = trpc.driveRunSummaries.list.useQuery(
    { campaignId: selectedCampaignId, pageSize: 100 },
    { enabled: !!selectedCampaignId }
  );
  const allSummaries = (summariesData?.data || []) as unknown as DriveRunSummary[];

  // tRPC: KPI samples for all jobs in campaign
  const { data: samplesData } = trpc.kpiSamples.list.useQuery(
    { campaignId: selectedCampaignId, pageSize: 500 },
    { enabled: !!selectedCampaignId }
  );
  const allSamples = (samplesData?.data || []) as unknown as KpiSample[];

  // Generate report from tRPC data
  const generateReport = useCallback(() => {
    if (!selectedCampaignId || campaigns.length === 0) return;
    setLoading(true);
    setSelectedSegment(null);
    setTimeout(() => {
      try {
        const campaign = campaigns.find((c: any) => (c.campaign_id || c.uid) === selectedCampaignId);
        if (!campaign) { toast.error('Campagne introuvable'); setLoading(false); return; }
        const jobs = selectedJobId !== 'ALL'
          ? allJobs.filter((j: any) => (j.drive_job_id || j.uid) === selectedJobId)
          : allJobs;
        const r = buildReport(campaign, routes, jobs, windowSize, selectedKpi, allSamples, allSummaries);
        setReport(r);
        const label = r.dataSource === 'real' ? 'r\u00e9els' : 'simul\u00e9s';
        toast.success(`Rapport g\u00e9n\u00e9r\u00e9 : ${r.segments.length} segments, ${r.incidents.length} incidents (${label})`);
      } catch (e: any) {
        toast.error(e.message);
      }
      setLoading(false);
    }, 200);
  }, [selectedCampaignId, selectedJobId, windowSize, selectedKpi, campaigns, routes, allJobs, allSamples, allSummaries]);

  useEffect(() => {
    if (selectedCampaignId && campaigns.length > 0) generateReport();
  }, [selectedCampaignId, selectedJobId, windowSize, generateReport]);

  // Drill-down data
  const drillDown: SegmentDrillDown | null = useMemo(() => {
    if (!selectedSegment || !report) return null;
    const segSamples = report.enrichedSamples.filter(s => s.segment_id === selectedSegment.segment_id);
    const segArtifacts = findArtifactsForSegment(report.artifactIndex, selectedSegment);
    const segIncidents = report.incidents.filter(inc =>
      inc.evidence_refs.segment_ids.includes(selectedSegment.segment_id)
    );
    const topViolations = Object.entries(selectedSegment.kpi_stats)
      .filter(([, s]) => s.breach_level !== 'OK')
      .map(([kpi, s]) => ({
        kpi_name: kpi as DriveKpi,
        breach_level: s.breach_level,
        breach_pct: s.breach_pct,
        avg: s.avg,
        threshold: s.threshold,
        direction: DEFAULT_KPI_THRESHOLDS[kpi]?.direction || 'higher_better' as const,
      }))
      .sort((a, b) => (b.breach_level === 'CRIT' ? 1 : 0) - (a.breach_level === 'CRIT' ? 1 : 0) || b.breach_pct - a.breach_pct);

    return { segment: selectedSegment, samples: segSamples, artifacts: segArtifacts, incidents: segIncidents, top_violations: topViolations };
  }, [selectedSegment, report]);

  const [, navigate] = useLocation();

  const handleRepair = useCallback((incident: DriveIncident) => {
    navigate(`/drive/incidents/${incident.incident_id}`);
  }, [navigate]);

  const handleCreateIncident = useCallback((seg: RouteSegment) => {
    toast.success(`Incident créé manuellement pour le segment ${seg.index + 1}`);
  }, []);

  const KPI_OPTIONS: { value: string; label: string }[] = [
    { value: 'RSRP', label: 'RSRP (dBm)' },
    { value: 'SINR', label: 'SINR (dB)' },
    { value: 'THROUGHPUT_DL', label: 'Débit DL (Mbps)' },
    { value: 'THROUGHPUT_UL', label: 'Débit UL (Mbps)' },
    { value: 'LATENCY', label: 'Latence (ms)' },
    { value: 'JITTER', label: 'Jitter (ms)' },
    { value: 'PACKET_LOSS', label: 'Perte paquets (%)' },
  ];

  if (!projectId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Drive Test — Reporting</h1>
        <p className="text-muted-foreground">Aucun projet disponible.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Drive Test — Corrélation & Reporting
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Segments route, drill-down KPI, artefacts et incidents automatiques</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2">
            {currentProject?.name || 'Aucun projet'}
          </div>
          <Select value={selectedCampaignId} onValueChange={v => { setSelectedCampaignId(v); setSelectedJobId('ALL'); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Campagne" /></SelectTrigger>
            <SelectContent>{campaigns.map(c => <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          {availableJobs.length > 0 && (
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Job" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les jobs</SelectItem>
                {availableJobs.map(j => <SelectItem key={j.drive_job_id} value={j.drive_job_id}>{j.drive_job_id.slice(0, 8)} ({j.status})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedKpi} onValueChange={v => setSelectedKpi(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="KPI" /></SelectTrigger>
            <SelectContent>{KPI_OPTIONS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={windowSize} onValueChange={v => setWindowSize(v as WindowSize)}>
            <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5s">5s</SelectItem>
              <SelectItem value="10s">10s</SelectItem>
              <SelectItem value="30s">30s</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={generateReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>
      </div>

      {!report ? (
        <div className="text-center py-16 text-muted-foreground">
          {loading ? <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin opacity-30" /> : <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />}
          <p>Sélectionnez une campagne pour générer le rapport</p>
        </div>
      ) : (
        <>
          {/* Data source + summary badges */}
          <div className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg bg-muted/10 flex-wrap">
            <Badge variant={report.dataSource === 'real' ? 'default' : 'outline'}
              className={report.dataSource === 'real' ? 'bg-emerald-600' : 'bg-amber-600/20 text-amber-300'}>
              <Database className="w-3 h-3 mr-1" />
              {report.dataSource === 'real' ? 'Données réelles' : 'Données simulées'}
            </Badge>
            <Badge variant="outline">{report.campaign.network_type}</Badge>
            <Badge variant="outline">{report.campaign.target_env}</Badge>
            <span className="text-xs text-muted-foreground">{report.campaign.area}</span>
            <span className="text-xs">{report.computed.total_samples} échantillons</span>
            <span className="text-xs">{report.segments.length} segments</span>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-green-400">{report.computed.segments_ok} OK</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-amber-400">{report.computed.segments_warn} WARN</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-400">{report.computed.segments_crit} CRIT</span>
            </div>
            {report.incidents.length > 0 && (
              <Badge className="bg-red-500/20 text-red-400">
                <AlertTriangle className="w-3 h-3 mr-1" /> {report.incidents.length} incident(s)
              </Badge>
            )}
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            <KpiCard label="RSRP moyen" value={report.computed.avg_rsrp} unit="dBm" threshold={-100} icon={Signal} />
            <KpiCard label="SINR moyen" value={report.computed.avg_sinr} unit="dB" threshold={5} icon={Wifi} />
            <KpiCard label="Débit DL" value={report.computed.avg_dl} unit="Mbps" threshold={10} icon={TrendingUp} />
            <KpiCard label="Débit UL" value={report.computed.avg_ul} unit="Mbps" threshold={5} icon={TrendingUp} />
            <KpiCard label="Latence" value={report.computed.avg_latency} unit="ms" threshold={50} icon={Activity} inverse />
            <KpiCard label="Latence P95" value={report.computed.p95_latency} unit="ms" threshold={100} icon={Activity} inverse />
            <KpiCard label="Perte paquets" value={report.computed.avg_packet_loss} unit="%" threshold={1} icon={AlertTriangle} inverse />
            <KpiCard label="Zones faibles" value={report.computed.coverage_gaps} unit="" icon={MapPin} />
            <KpiCard label="Violations" value={report.computed.violations_count} unit="" icon={AlertTriangle} />
            {report.computed.handover_success_rate > 0 && (
              <KpiCard label="Handover" value={report.computed.handover_success_rate} unit="%" threshold={95} icon={Gauge} />
            )}
          </div>

          {/* Segment Bar */}
          <SegmentBar
            segments={report.segments}
            selectedKpi={selectedKpi}
            onSelect={setSelectedSegment}
            selectedId={selectedSegment?.segment_id || null}
          />

          {/* Drill-down + Timeline side by side */}
          <div className={`grid gap-4 ${drillDown ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Timeline */}
            <KpiTimeline
              enrichedSamples={report.enrichedSamples}
              selectedKpi={selectedKpi}
              onMarkerClick={(sample) => {
                const seg = report.segments.find(s => s.segment_id === sample.segment_id);
                if (seg) setSelectedSegment(seg);
              }}
            />

            {/* Drill-down panel */}
            {drillDown && (
              <DrillDownPanel
                drillDown={drillDown}
                onClose={() => setSelectedSegment(null)}
                onCreateIncident={handleCreateIncident}
                onRepair={handleRepair}
              />
            )}
          </div>

          {/* Auto-incidents */}
          <IncidentsSummary incidents={report.incidents} onRepair={handleRepair} />

          {/* Export */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCsv(report.samples)}>
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
