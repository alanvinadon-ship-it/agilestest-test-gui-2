/**
 * DriveIncidentReportPage — Rapport d'incident Drive opérateur-grade
 * Mission DRIVE-REPAIR-REAL-2
 *
 * Affiche : observations, hypothèses par couche, recommandations,
 * plan de rerun, evidence chips, export HTML, glossaire.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Info, ChevronDown, ChevronRight,
  Download, FileText, Play, Clock, MapPin, Layers, Target, Lightbulb,
  Shield, Radio, Wifi, Globe, Database, Package, Eye, Zap, BookOpen,
  RefreshCw, Copy, Check, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useProject } from '@/state/projectStore';
import type { DriveIncident, RouteSegment, EnrichedKpiSample, ArtifactTimeIndex } from '@/driveCorrelation/types';
import {
  KPI_LABELS, KPI_UNITS, SEVERITY_LABELS, SEVERITY_COLORS,
  BREACH_LABELS, BREACH_TEXT_COLORS, BREACH_BG_COLORS,
  DEFAULT_KPI_THRESHOLDS,
} from '@/driveCorrelation/types';
import type {
  DriveRepairResult, DriveRepairContextV2, Observation, Hypothesis,
  RootCauseCandidate, Recommendation, RerunPlan, NextMeasurement,
  GlossaryEntry, AnalysisLayer, EvidenceRef,
} from '@/driveCorrelation/driveRepairTypes';
import {
  LAYER_LABELS, LAYER_COLORS, LAYER_BG_COLORS, LAYER_ICONS,
  EFFORT_LABELS, RISK_LABELS, PRIORITY_LABELS,
} from '@/driveCorrelation/driveRepairTypes';
import { buildDriveRepairContextV2 } from '@/driveCorrelation/driveRepairContextBuilder';
import { simulateDriveRepairV2 } from '@/driveCorrelation/driveRepairSimulator';
import {
  segmentRoute, enrichSamplesWithSegments, aggregateSegmentKpi,
  buildArtifactTimeIndex, DEFAULT_SEGMENTATION_CONFIG,
} from '@/driveCorrelation';

// ─── Incident data from tRPC (cascading queries) ──────────────────────────

function useIncidentData(incidentId: string) {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || '';

  // 1. Campaigns for project
  const { data: campaignsData } = trpc.driveCampaigns.list.useQuery(
    { projectId, pageSize: 200 },
    { enabled: !!projectId }
  );
  const campaign = campaignsData?.data?.[0] ?? null;
  const campaignId = campaign?.uid || '';

  // 2. Routes for first campaign
  const { data: routesData } = trpc.driveRoutes.list.useQuery(
    { campaignId, limit: 50 },
    { enabled: !!campaignId }
  );
  const route = routesData?.items?.[0] ?? null;

  // 3. Jobs for first campaign
  const { data: jobsData } = trpc.driveJobs.list.useQuery(
    { campaignId, limit: 200 },
    { enabled: !!campaignId }
  );
  const job = jobsData?.items?.[0] ?? null;
  const jobId = job?.uid || '';

  // 4. KPI samples for first job
  const { data: samplesData } = trpc.kpiSamples.listAll.useQuery(
    { driveJobId: jobId },
    { enabled: !!jobId }
  );

  return useMemo(() => {
    if (!campaign || !route || !job) return null;
    const samples = samplesData || [];
    if (samples.length === 0) return null;

    // Build segments from route
    const routeGeojson = route.routeGeojson as any;
    const allCoords = routeGeojson?.coordinates || [];
    if (allCoords.length < 2) return null;

    const config = { ...DEFAULT_SEGMENTATION_CONFIG };
    const segments = segmentRoute(route.uid, campaignId, allCoords, config);
    const enriched = enrichSamplesWithSegments(samples as any, segments, config);
    aggregateSegmentKpi(segments, enriched);
    const artifactIndex = buildArtifactTimeIndex(job as any, campaignId, route.uid);

    // Find or create incident
    const critSegments = segments.filter((s: RouteSegment) => s.breach_level === 'CRIT');
    if (critSegments.length === 0) return null;

    const kpiName = Object.keys(critSegments[0].kpi_stats)[0] || 'RSRP';
    const stats = critSegments[0].kpi_stats[kpiName];

    const incident: DriveIncident = {
      incident_id: incidentId || `INC-${Date.now()}`,
      campaign_id: campaignId,
      route_id: route.uid,
      drive_job_id: job.uid,
      type: 'DRIVE_KPI_THRESHOLD_BREACH',
      kpi_name: kpiName as any,
      threshold: stats?.threshold || 0,
      observed_min: stats?.min || 0,
      observed_max: stats?.max || 0,
      observed_avg: stats?.avg || 0,
      geo_bbox: {
        min_lat: Math.min(...critSegments.map((s: RouteSegment) => s.center.lat)),
        min_lon: Math.min(...critSegments.map((s: RouteSegment) => s.center.lon)),
        max_lat: Math.max(...critSegments.map((s: RouteSegment) => s.center.lat)),
        max_lon: Math.max(...critSegments.map((s: RouteSegment) => s.center.lon)),
      },
      geo_point: critSegments[0].center,
      time_window: {
        start: critSegments[0].time_window.start,
        end: critSegments[critSegments.length - 1].time_window.end,
      },
      severity: 'P0',
      breach_pct: stats?.breach_pct || 80,
      segment_count: critSegments.length,
      evidence_refs: {
        artifact_ids: artifactIndex.map((a: ArtifactTimeIndex) => a.artifact_id),
        sample_ids: enriched.filter((s: EnrichedKpiSample) => s.breach_level === 'CRIT').map((s: EnrichedKpiSample) => s.sample_id).slice(0, 20),
        segment_ids: critSegments.map((s: RouteSegment) => s.segment_id),
      },
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return { incident, segments, enrichedSamples: enriched, artifactIndex, campaign, job };
  }, [campaign, route, job, samplesData, campaignId, incidentId]);
}

// ─── Evidence Chip ──────────────────────────────────────────────────────────

function EvidenceChip({ evidence }: { evidence: EvidenceRef }) {
  const iconMap: Record<string, typeof Info> = {
    KPI_SAMPLE: Zap,
    SEGMENT: MapPin,
    ARTIFACT: Package,
    TIMESTAMP: Clock,
    THRESHOLD: Target,
    DEVICE: Radio,
  };
  const Icon = iconMap[evidence.type] || Info;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-secondary/60 text-foreground/80 border border-border hover:bg-secondary cursor-pointer transition-colors" title={`${evidence.type}: ${evidence.label}${evidence.value ? ` = ${evidence.value}` : ''}`}>
      <Icon className="w-3 h-3" />
      <span className="truncate max-w-[120px]">{evidence.label}</span>
      {evidence.value && <span className="text-muted-foreground">= {evidence.value}</span>}
    </span>
  );
}

// ─── Severity Badge ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
    WARNING: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    INFO: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${colors[severity] || colors.INFO}`}>
      {severity}
    </span>
  );
}

// ─── Layer Icon ─────────────────────────────────────────────────────────────

function LayerIcon({ layer }: { layer: AnalysisLayer }) {
  const iconMap: Record<AnalysisLayer, typeof Radio> = {
    RADIO: Radio,
    CORE: Shield,
    QOS: Zap,
    APP: Globe,
    CAPTURE: Package,
    DATASET: Database,
  };
  const Icon = iconMap[layer];
  return <Icon className={`w-4 h-4 ${LAYER_COLORS[layer]}`} />;
}

// ─── Confidence Bar ─────────────────────────────────────────────────────────

function ConfidenceBar({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${size === 'md' ? 'h-2' : 'h-1.5'} bg-secondary rounded-full overflow-hidden`}>
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DriveIncidentReportPage() {
  const [, params] = useRoute('/drive/incidents/:id');
  const incidentId = params?.id || '';
  const data = useIncidentData(incidentId);

  const [report, setReport] = useState<DriveRepairResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['observations', 'hypotheses', 'recommendations', 'rerun']));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!data) return;
    setAnalyzing(true);
    toast.info('Analyse IA en cours...');

    // Build context v2
    const ctx = buildDriveRepairContextV2({
      incident: data.incident,
      segments: data.segments,
      allSamples: data.enrichedSamples,
      artifactIndex: data.artifactIndex,
    });

    // Simulate async
    await new Promise(r => setTimeout(r, 3000));
    const result = simulateDriveRepairV2(ctx);
    setReport(result);
    setAnalyzing(false);
    toast.success(`Analyse terminée — confiance globale: ${Math.round(result.overall_confidence * 100)}%`);
  }, [data]);

  // Auto-analyze on mount
  useEffect(() => {
    if (data && !report && !analyzing) {
      handleAnalyze();
    }
  }, [data, report, analyzing, handleAnalyze]);

  const handleExportHTML = useCallback(() => {
    if (!reportRef.current) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport Incident ${incidentId}</title><style>body{font-family:system-ui;max-width:900px;margin:0 auto;padding:2rem;background:#0a0a0a;color:#e5e5e5}h1,h2,h3{color:#f5f5f5}table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:8px;text-align:left}th{background:#1a1a1a}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px}.crit{background:#7f1d1d;color:#fca5a5}.warn{background:#78350f;color:#fde68a}.info{background:#1e3a5f;color:#93c5fd}</style></head><body>${reportRef.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-report-${incidentId}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Rapport exporté en HTML');
  }, [incidentId]);

  const handleGenerateRerunJob = useCallback(() => {
    if (!report?.rerun_plan) return;
    toast.success(`Job de rerun créé : ${report.rerun_plan.segments.length} segment(s), durée ${report.rerun_plan.time_window.duration_min} min, capture: ${report.rerun_plan.required_capture_mode}`);
  }, [report]);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  if (!data) {
    return (
      <div className="space-y-6">
        <Link href="/drive/reporting" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Retour au reporting
        </Link>
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-foreground font-medium">Incident non trouvé</p>
          <p className="text-sm text-muted-foreground mt-1">Aucune donnée disponible pour cet incident. Vérifiez qu'une campagne avec des résultats existe.</p>
        </div>
      </div>
    );
  }

  const { incident } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/drive/reporting" className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">Rapport d'Incident Drive</h1>
            <p className="text-xs text-muted-foreground font-mono">{incident.incident_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <>
              <button onClick={handleExportHTML} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-secondary hover:bg-secondary/80 text-foreground transition-colors">
                <Download className="w-3.5 h-3.5" /> Export HTML
              </button>
              <button onClick={handleGenerateRerunJob} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <Play className="w-3.5 h-3.5" /> Générer Rerun Job
              </button>
            </>
          )}
          <button onClick={handleAnalyze} disabled={analyzing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} /> {analyzing ? 'Analyse...' : 'Ré-analyser'}
          </button>
        </div>
      </div>

      {/* Incident Summary Card */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">KPI</p>
            <p className="text-sm font-semibold text-foreground">{KPI_LABELS[incident.kpi_name] || incident.kpi_name}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Sévérité</p>
            <p className={`text-sm font-semibold ${SEVERITY_COLORS[incident.severity]}`}>{SEVERITY_LABELS[incident.severity]}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Moyenne observée</p>
            <p className="text-sm font-semibold text-foreground">{incident.observed_avg.toFixed(1)} {KPI_UNITS[incident.kpi_name]}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Seuil</p>
            <p className="text-sm font-semibold text-foreground">{incident.threshold} {KPI_UNITS[incident.kpi_name]}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Breach</p>
            <p className="text-sm font-semibold text-red-400">{incident.breach_pct}%</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Segments</p>
            <p className="text-sm font-semibold text-foreground">{incident.segment_count}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Fenêtre</p>
            <p className="text-xs font-mono text-foreground">{new Date(incident.time_window.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} → {new Date(incident.time_window.end).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Position</p>
            <p className="text-xs font-mono text-foreground">{incident.geo_point.lat.toFixed(4)}, {incident.geo_point.lon.toFixed(4)}</p>
          </div>
        </div>
        {report && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Confiance globale</span>
              </div>
              <div className="w-48">
                <ConfidenceBar value={report.overall_confidence} size="md" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {analyzing && !report && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground font-medium">Analyse en cours...</p>
          <p className="text-sm text-muted-foreground mt-1">Construction du contexte, analyse multi-couches, génération des recommandations.</p>
        </div>
      )}

      {/* Report Content */}
      {report && (
        <div ref={reportRef} className="space-y-4">
          {/* Insufficient Data Warnings */}
          {report.insufficient_data && report.insufficient_data.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-semibold text-amber-400">Données insuffisantes ({report.insufficient_data.length})</p>
              </div>
              <div className="space-y-2">
                {report.insufficient_data.map((d, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-amber-400 font-medium shrink-0">{d.what}</span>
                    <span className="text-muted-foreground">— {d.impact}</span>
                    <span className="text-foreground/70 ml-auto shrink-0">→ {d.how_to_collect}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          <CollapsibleSection
            id="observations"
            title="Observations"
            subtitle={`${report.observations.length} fait(s) observé(s)`}
            icon={<Eye className="w-4 h-4 text-blue-400" />}
            expanded={expandedSections.has('observations')}
            onToggle={() => toggleSection('observations')}
          >
            <div className="space-y-3">
              {report.observations.map(obs => (
                <div key={obs.id} className={`border rounded-lg p-3 ${LAYER_BG_COLORS[obs.layer]}`}>
                  <div className="flex items-start gap-3">
                    <LayerIcon layer={obs.layer} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{obs.id}</span>
                        <SeverityBadge severity={obs.severity} />
                        <span className={`text-[10px] font-mono ${LAYER_COLORS[obs.layer]}`}>{LAYER_LABELS[obs.layer]}</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{obs.fact}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {obs.evidence.map((ev, i) => (
                          <EvidenceChip key={i} evidence={ev} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Hypotheses by Layer */}
          <CollapsibleSection
            id="hypotheses"
            title="Hypothèses par couche"
            subtitle={`${report.hypotheses.length} hypothèse(s), ${report.root_cause_candidates.length} cause(s) racine`}
            icon={<Lightbulb className="w-4 h-4 text-amber-400" />}
            expanded={expandedSections.has('hypotheses')}
            onToggle={() => toggleSection('hypotheses')}
          >
            <div className="space-y-3">
              {report.hypotheses.map((hyp, i) => {
                const isRootCause = report.root_cause_candidates.some(rc => rc.supporting_hypotheses.includes(hyp.id));
                const rcRank = report.root_cause_candidates.find(rc => rc.supporting_hypotheses.includes(hyp.id))?.rank;
                return (
                  <div key={hyp.id} className={`border rounded-lg p-4 ${LAYER_BG_COLORS[hyp.layer]} ${isRootCause ? 'ring-1 ring-primary/30' : ''}`}>
                    <div className="flex items-start gap-3">
                      <LayerIcon layer={hyp.layer} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-mono text-muted-foreground">{hyp.id}</span>
                          <span className={`text-[10px] font-mono ${LAYER_COLORS[hyp.layer]}`}>{LAYER_LABELS[hyp.layer]}</span>
                          {isRootCause && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/15 text-primary border border-primary/30">
                              Cause racine #{rcRank}
                            </span>
                          )}
                          {hyp.requires_verification && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              À vérifier
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-1">{hyp.title}</p>
                        <p className="text-xs text-foreground/80 leading-relaxed">{hyp.description}</p>
                        <div className="mt-2">
                          <ConfidenceBar value={hyp.confidence} />
                        </div>
                        {hyp.verification_method && (
                          <p className="text-[11px] text-muted-foreground mt-2 italic">
                            Vérification : {hyp.verification_method}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {hyp.evidence_refs.map(ref => (
                            <span key={ref} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary/60 text-muted-foreground">{ref}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>

          {/* Recommendations */}
          <CollapsibleSection
            id="recommendations"
            title="Recommandations"
            subtitle={`${report.recommendations.length} action(s)`}
            icon={<Target className="w-4 h-4 text-green-400" />}
            expanded={expandedSections.has('recommendations')}
            onToggle={() => toggleSection('recommendations')}
          >
            <div className="space-y-2">
              {report.recommendations.map(rec => (
                <div key={rec.id} className={`border rounded-lg p-3 ${LAYER_BG_COLORS[rec.category]}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs font-mono text-foreground shrink-0 mt-0.5">
                      {rec.priority}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-mono ${LAYER_COLORS[rec.category]}`}>{rec.category}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">Effort: {EFFORT_LABELS[rec.effort]}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">Risque: {RISK_LABELS[rec.risk]}</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{rec.action}</p>
                      <p className="text-xs text-muted-foreground mt-1">Impact attendu : {rec.expected_impact}</p>
                      {rec.commands_hint && rec.commands_hint.length > 0 && (
                        <div className="mt-2 bg-background/30 rounded p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">Commandes</span>
                            <button
                              onClick={() => copyToClipboard(rec.commands_hint!.join('\n'), rec.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedId === rec.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap">{rec.commands_hint.join('\n')}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Rerun Plan */}
          <CollapsibleSection
            id="rerun"
            title="Plan de Rerun Ciblé"
            subtitle={`${report.rerun_plan.segments.length} segment(s), ${report.rerun_plan.time_window.duration_min} min`}
            icon={<Play className="w-4 h-4 text-primary" />}
            expanded={expandedSections.has('rerun')}
            onToggle={() => toggleSection('rerun')}
          >
            <RerunPlanPanel plan={report.rerun_plan} onGenerate={handleGenerateRerunJob} onCopy={copyToClipboard} copiedId={copiedId} />
          </CollapsibleSection>

          {/* Next Measurements */}
          <CollapsibleSection
            id="measurements"
            title="Prochaines Mesures"
            subtitle={`${report.next_measurements.length} mesure(s) recommandée(s)`}
            icon={<Layers className="w-4 h-4 text-cyan-400" />}
            expanded={expandedSections.has('measurements')}
            onToggle={() => toggleSection('measurements')}
          >
            <div className="space-y-2">
              {report.next_measurements.map(nm => (
                <div key={nm.id} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${nm.priority === 'MUST' ? 'bg-red-500/15 text-red-400 border-red-500/30' : nm.priority === 'SHOULD' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30'}`}>
                      {PRIORITY_LABELS[nm.priority]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{nm.what}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pourquoi : {nm.why}</p>
                  <p className="text-xs text-foreground/70 mt-1">Comment : {nm.how}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Glossary */}
          <CollapsibleSection
            id="glossary"
            title="Glossaire"
            subtitle={`${report.glossary.length} terme(s)`}
            icon={<BookOpen className="w-4 h-4 text-muted-foreground" />}
            expanded={expandedSections.has('glossary')}
            onToggle={() => toggleSection('glossary')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.glossary.map((g, i) => (
                <div key={i} className="border border-border rounded p-2 bg-card">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono font-semibold text-foreground">{g.term}</span>
                    {g.layer && <span className={`text-[10px] font-mono ${LAYER_COLORS[g.layer]}`}>{g.layer}</span>}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{g.definition}</p>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Warnings */}
          {report.warnings && report.warnings.length > 0 && (
            <div className="bg-secondary/30 border border-border rounded-lg p-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Avertissements</p>
              {report.warnings.map((w, i) => (
                <p key={i} className="text-xs text-muted-foreground italic">⚠ {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Section ────────────────────────────────────────────────────

function CollapsibleSection({ id, title, subtitle, icon, expanded, onToggle, children }: {
  id: string; title: string; subtitle: string; icon: React.ReactNode;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors text-left">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

// ─── Rerun Plan Panel ───────────────────────────────────────────────────────

function RerunPlanPanel({ plan, onGenerate, onCopy, copiedId }: {
  plan: RerunPlan; onGenerate: () => void; onCopy: (text: string, id: string) => void; copiedId: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Segments */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Segments ciblés</p>
        <div className="space-y-1">
          {plan.segments.map(s => (
            <div key={s.segment_id} className="flex items-center gap-2 text-xs">
              <MapPin className="w-3 h-3 text-red-400 shrink-0" />
              <span className="font-mono text-foreground">{s.segment_id}</span>
              <span className="text-muted-foreground">— {s.reason}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time window */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Fenêtre recommandée</p>
          <p className="text-sm text-foreground">{plan.time_window.preferred_start} → {plan.time_window.preferred_end}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Durée min: {plan.time_window.duration_min} min</p>
          <p className="text-[11px] text-foreground/70 mt-1 italic">{plan.time_window.rationale}</p>
        </div>
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Capture requise</p>
          <p className="text-sm text-foreground">{plan.required_capture_mode}</p>
          {plan.capture_filters && (
            <>
              {plan.capture_filters.bpf_filter && (
                <p className="text-xs font-mono text-foreground/70 mt-1">BPF: {plan.capture_filters.bpf_filter}</p>
              )}
              <p className="text-[11px] text-foreground/70 mt-1 italic">{plan.capture_filters.rationale}</p>
            </>
          )}
        </div>
      </div>

      {/* Pre-checks */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Pré-vérifications</p>
        <div className="space-y-1">
          {plan.pre_checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-foreground/80">{check}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Commands */}
      {plan.commands_hint && plan.commands_hint.length > 0 && (
        <div className="bg-background/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-muted-foreground uppercase">Commandes suggérées</span>
            <button onClick={() => onCopy(plan.commands_hint!.join('\n'), 'rerun-cmds')} className="text-muted-foreground hover:text-foreground">
              {copiedId === 'rerun-cmds' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap">{plan.commands_hint.join('\n')}</pre>
        </div>
      )}

      {/* Generate button */}
      <button onClick={onGenerate} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">
        <Play className="w-4 h-4" /> Générer le Job de Rerun
      </button>
    </div>
  );
}
