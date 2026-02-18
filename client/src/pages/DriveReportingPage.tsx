import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  localDriveCampaigns,
  localDriveRoutes,
  localProjects,
  localDriveJobs,
  localKpiSamples,
  localDriveRunSummaries,
} from '@/api/localStore';
import type { DriveCampaign, DriveRoute, DriveJob, KpiSample, DriveRunSummary, DriveKpi } from '@/types';
import { getThresholdLevel, THRESHOLD_COLORS, THRESHOLD_BG_COLORS } from '@/ai/kpiParsers';
import {
  BarChart3,
  Signal,
  MapPin,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Gauge,
  Wifi,
  Activity,
  Database,
  FileText,
  Loader2,
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
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function p95(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
}

function kpiValues(samples: KpiSample[], kpi: DriveKpi): number[] {
  return samples.filter(s => s.kpi_name === kpi).map(s => s.value);
}

// ─── Build report from real data ────────────────────────────────────────────

function buildRealReport(campaign: DriveCampaign, routes: DriveRoute[], jobs: DriveJob[]): CampaignReport {
  const summaries: DriveRunSummary[] = [];
  const allSamples: KpiSample[] = [];

  for (const job of jobs) {
    const s = localDriveRunSummaries.get(job.drive_job_id);
    if (s) summaries.push(s);
    const samplesResult = localKpiSamples.list({ drive_job_id: job.drive_job_id });
    allSamples.push(...samplesResult.data);
  }

  const rsrpVals = kpiValues(allSamples, 'RSRP');
  const sinrVals = kpiValues(allSamples, 'SINR');
  const dlVals = kpiValues(allSamples, 'THROUGHPUT_DL');
  const ulVals = kpiValues(allSamples, 'THROUGHPUT_UL');
  const latVals = kpiValues(allSamples, 'LATENCY');
  const lossVals = kpiValues(allSamples, 'PACKET_LOSS');
  const hoVals = kpiValues(allSamples, 'HANDOVER_SUCCESS');

  const totalViolations = summaries.reduce((sum, s) => sum + s.threshold_violations.length, 0);
  const passCount = summaries.filter(s => s.overall_pass).length;

  return {
    campaign, routes, jobs, summaries, samples: allSamples,
    dataSource: allSamples.length > 0 ? 'real' : 'simulated',
    computed: {
      total_samples: allSamples.length,
      total_jobs: jobs.length,
      avg_rsrp: avg(rsrpVals),
      avg_sinr: avg(sinrVals),
      avg_dl: avg(dlVals),
      avg_ul: avg(ulVals),
      avg_latency: avg(latVals),
      p95_latency: p95(latVals),
      avg_packet_loss: avg(lossVals),
      coverage_gaps: rsrpVals.filter(v => v < -110).length,
      handover_success_rate: hoVals.length > 0 ? avg(hoVals) : 0,
      incidents_count: totalViolations,
      violations_count: totalViolations,
      pass_rate: summaries.length > 0 ? (passCount / summaries.length) * 100 : 0,
    },
  };
}

// ─── Fallback simulated report ──────────────────────────────────────────────

function buildSimulatedReport(campaign: DriveCampaign, routes: DriveRoute[]): CampaignReport {
  const checkpoints = routes.reduce((sum, r) => sum + (r.route_geojson?.coordinates?.length || 5), 0);
  const samples: KpiSample[] = [];
  const now = new Date();

  for (let i = 0; i < Math.max(checkpoints, 10); i++) {
    const ts = new Date(now.getTime() + i * 1000).toISOString();
    const lat = 48.85 + (Math.random() - 0.5) * 0.02;
    const lon = 2.35 + (Math.random() - 0.5) * 0.02;
    const base = { drive_job_id: 'sim', campaign_id: campaign.campaign_id, route_id: routes[0]?.route_id || '', timestamp: ts, lat, lon };

    samples.push({ ...base, sample_id: `sim-${i}-rsrp`, kpi_name: 'RSRP', value: parseFloat((-70 - Math.random() * 40).toFixed(1)), unit: 'dBm' });
    samples.push({ ...base, sample_id: `sim-${i}-sinr`, kpi_name: 'SINR', value: parseFloat((5 + Math.random() * 20).toFixed(1)), unit: 'dB' });
    samples.push({ ...base, sample_id: `sim-${i}-dl`, kpi_name: 'THROUGHPUT_DL', value: parseFloat((5 + Math.random() * 95).toFixed(1)), unit: 'Mbps' });
    samples.push({ ...base, sample_id: `sim-${i}-ul`, kpi_name: 'THROUGHPUT_UL', value: parseFloat((2 + Math.random() * 48).toFixed(1)), unit: 'Mbps' });
    samples.push({ ...base, sample_id: `sim-${i}-lat`, kpi_name: 'LATENCY', value: parseFloat((10 + Math.random() * 60).toFixed(0)), unit: 'ms' });
    samples.push({ ...base, sample_id: `sim-${i}-jit`, kpi_name: 'JITTER', value: parseFloat((1 + Math.random() * 15).toFixed(1)), unit: 'ms' });
    samples.push({ ...base, sample_id: `sim-${i}-loss`, kpi_name: 'PACKET_LOSS', value: parseFloat((Math.random() * 3).toFixed(2)), unit: '%' });
  }

  const rsrpVals = kpiValues(samples, 'RSRP');
  const sinrVals = kpiValues(samples, 'SINR');
  const dlVals = kpiValues(samples, 'THROUGHPUT_DL');
  const ulVals = kpiValues(samples, 'THROUGHPUT_UL');
  const latVals = kpiValues(samples, 'LATENCY');
  const lossVals = kpiValues(samples, 'PACKET_LOSS');

  return {
    campaign, routes, jobs: [], summaries: [], samples,
    dataSource: 'simulated',
    computed: {
      total_samples: samples.length,
      total_jobs: 0,
      avg_rsrp: avg(rsrpVals),
      avg_sinr: avg(sinrVals),
      avg_dl: avg(dlVals),
      avg_ul: avg(ulVals),
      avg_latency: avg(latVals),
      p95_latency: p95(latVals),
      avg_packet_loss: avg(lossVals),
      coverage_gaps: rsrpVals.filter(v => v < -110).length,
      handover_success_rate: 95 + Math.random() * 4.5,
      incidents_count: Math.floor(Math.random() * 5),
      violations_count: 0,
      pass_rate: 0,
    },
  };
}

// ─── KPI Card Component ─────────────────────────────────────────────────────

function KpiCard({ label, value, unit, threshold, icon: Icon, inverse }: {
  label: string;
  value: number;
  unit: string;
  threshold?: number;
  icon: typeof Gauge;
  inverse?: boolean;
}) {
  const level = threshold !== undefined
    ? getThresholdLevel(inverse ? 'LATENCY' : 'RSRP', value, threshold)
    : 'good';

  const isOk = level === 'good';
  const borderColor = level === 'good' ? 'border-border' : level === 'warning' ? 'border-amber-500/50' : 'border-red-500/50';
  const bgColor = level === 'good' ? '' : level === 'warning' ? 'bg-amber-500/5' : 'bg-red-500/5';

  return (
    <div className={`border rounded-lg p-4 ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${isOk ? 'text-emerald-400' : level === 'warning' ? 'text-amber-400' : 'text-red-400'}`} />
        {isOk ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : (
          <TrendingDown className={`w-4 h-4 ${level === 'warning' ? 'text-amber-400' : 'text-red-400'}`} />
        )}
      </div>
      <div className="text-2xl font-bold">{value.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span></div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {threshold !== undefined && (
        <div className="text-xs mt-1">
          <span className={isOk ? 'text-emerald-400' : level === 'warning' ? 'text-amber-400' : 'text-red-400'}>
            Seuil: {inverse ? '≤' : '≥'} {threshold} {unit}
          </span>
        </div>
      )}
    </div>
  );
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
  a.href = url;
  a.download = `kpi_samples_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exporté');
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function DriveReportingPage() {
  const [projects] = useState(() => localProjects.list({ limit: 200 }).data);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [campaigns, setCampaigns] = useState<DriveCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string>('ALL');
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(false);

  // Read query params for direct linking from DriveCampaignsPage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cId = params.get('campaign');
    const jId = params.get('job');
    if (cId) setSelectedCampaignId(cId);
    if (jId) setSelectedJobId(jId);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const result = localDriveCampaigns.list(projectId, { limit: 200 });
    setCampaigns(result.data);
    if (result.data.length > 0 && !selectedCampaignId) {
      setSelectedCampaignId(result.data[0].campaign_id);
    }
  }, [projectId]);

  const generateReport = () => {
    if (!selectedCampaignId) return;
    setLoading(true);
    setTimeout(() => {
      try {
        const campaign = localDriveCampaigns.get(selectedCampaignId);
        const routes = localDriveRoutes.list(selectedCampaignId);
        const jobsResult = localDriveJobs.list({ campaign_id: selectedCampaignId, limit: 200 });
        const jobs = selectedJobId !== 'ALL'
          ? jobsResult.data.filter(j => j.drive_job_id === selectedJobId)
          : jobsResult.data;

        // Try real data first
        const realReport = buildRealReport(campaign, routes, jobs);
        if (realReport.samples.length > 0) {
          setReport(realReport);
          toast.success(`Rapport généré (${realReport.samples.length} échantillons réels)`);
        } else {
          // Fallback to simulated
          const simReport = buildSimulatedReport(campaign, routes);
          setReport(simReport);
          toast.info('Rapport simulé (aucune donnée réelle trouvée)');
        }
      } catch (e: any) {
        toast.error(e.message);
      }
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    if (selectedCampaignId) generateReport();
  }, [selectedCampaignId, selectedJobId]);

  // Available jobs for selected campaign
  const availableJobs = useMemo(() => {
    if (!selectedCampaignId) return [];
    try {
      return localDriveJobs.list({ campaign_id: selectedCampaignId, limit: 200 }).data;
    } catch { return []; }
  }, [selectedCampaignId]);

  // Group samples by KPI for charts
  const samplesByKpi = useMemo(() => {
    if (!report) return {};
    const map: Record<string, KpiSample[]> = {};
    for (const s of report.samples) {
      if (!map[s.kpi_name]) map[s.kpi_name] = [];
      map[s.kpi_name].push(s);
    }
    return map;
  }, [report]);

  if (!projectId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Drive Test — Reporting</h1>
        <p className="text-muted-foreground">Aucun projet disponible.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Drive Test — Reporting
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Rapport consolidé KPI, couverture et incidents</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Projet" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCampaignId} onValueChange={v => { setSelectedCampaignId(v); setSelectedJobId('ALL'); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Campagne" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map(c => (
                <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name} ({c.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableJobs.length > 0 && (
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les jobs</SelectItem>
                {availableJobs.map(j => (
                  <SelectItem key={j.drive_job_id} value={j.drive_job_id}>
                    {j.drive_job_id.slice(0, 8)} ({j.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={generateReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {!report ? (
        <div className="text-center py-16 text-muted-foreground">
          {loading ? (
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin opacity-30" />
          ) : (
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
          )}
          <p>Sélectionnez une campagne pour générer le rapport</p>
        </div>
      ) : (
        <>
          {/* Data source indicator */}
          <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-muted/10">
            <Badge variant={report.dataSource === 'real' ? 'default' : 'outline'}
              className={report.dataSource === 'real' ? 'bg-emerald-600' : 'bg-amber-600/20 text-amber-300'}>
              <Database className="w-3 h-3 mr-1" />
              {report.dataSource === 'real' ? 'Données réelles' : 'Données simulées'}
            </Badge>
            <Badge variant="outline">{report.campaign.network_type}</Badge>
            <Badge variant="outline">{report.campaign.target_env}</Badge>
            <span className="text-sm text-muted-foreground">{report.campaign.area}</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm">{report.computed.total_jobs} job(s)</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm">{report.computed.total_samples} échantillons</span>
            {report.summaries.length > 0 && (
              <>
                <span className="text-sm text-muted-foreground">·</span>
                <span className={`text-sm font-medium ${report.computed.pass_rate >= 80 ? 'text-emerald-400' : 'text-red-400'}`}>
                  Pass rate: {report.computed.pass_rate.toFixed(0)}%
                </span>
              </>
            )}
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <KpiCard label="RSRP moyen" value={report.computed.avg_rsrp} unit="dBm" threshold={-100} icon={Signal} />
            <KpiCard label="SINR moyen" value={report.computed.avg_sinr} unit="dB" threshold={5} icon={Wifi} />
            <KpiCard label="Débit DL moyen" value={report.computed.avg_dl} unit="Mbps" threshold={10} icon={TrendingUp} />
            <KpiCard label="Débit UL moyen" value={report.computed.avg_ul} unit="Mbps" threshold={5} icon={TrendingUp} />
            <KpiCard label="Latence moyenne" value={report.computed.avg_latency} unit="ms" threshold={50} icon={Activity} inverse />
            <KpiCard label="Latence P95" value={report.computed.p95_latency} unit="ms" threshold={100} icon={Activity} inverse />
            <KpiCard label="Perte paquets" value={report.computed.avg_packet_loss} unit="%" threshold={1} icon={AlertTriangle} inverse />
            {report.computed.handover_success_rate > 0 && (
              <KpiCard label="Handover success" value={report.computed.handover_success_rate} unit="%" threshold={95} icon={Gauge} />
            )}
            <KpiCard label="Zones faibles" value={report.computed.coverage_gaps} unit="" icon={MapPin} />
            <KpiCard label="Violations" value={report.computed.violations_count} unit="" icon={AlertTriangle} />
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RSRP Distribution */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Signal className="w-4 h-4 text-emerald-400" />
                Distribution RSRP ({(samplesByKpi['RSRP'] || []).length} points)
              </h3>
              <div className="h-48 flex items-end gap-1">
                {(samplesByKpi['RSRP'] || []).slice(0, 40).map((s, i) => {
                  const normalized = Math.max(0, Math.min(1, (s.value + 140) / 96));
                  const color = s.value > -90 ? 'bg-emerald-500' : s.value > -100 ? 'bg-amber-500' : s.value > -110 ? 'bg-orange-500' : 'bg-red-500';
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${color} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
                      style={{ height: `${normalized * 100}%` }}
                      title={`${s.value.toFixed(0)} dBm @ ${s.lat.toFixed(4)},${s.lon.toFixed(4)}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Début</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> &gt;-90
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> -90~-100
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> -100~-110
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;-110
                </span>
                <span>Fin</span>
              </div>
            </div>

            {/* Throughput DL/UL */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Débit DL / UL
              </h3>
              <div className="h-48 flex items-end gap-1">
                {(() => {
                  const dlSamples = (samplesByKpi['THROUGHPUT_DL'] || []).slice(0, 30);
                  const ulSamples = (samplesByKpi['THROUGHPUT_UL'] || []).slice(0, 30);
                  const count = Math.max(dlSamples.length, ulSamples.length);
                  return Array.from({ length: count }, (_, i) => {
                    const dl = dlSamples[i]?.value || 0;
                    const ul = ulSamples[i]?.value || 0;
                    const dlNorm = Math.min(1, dl / 100);
                    const ulNorm = Math.min(1, ul / 50);
                    return (
                      <div key={i} className="flex-1 flex gap-px items-end h-full">
                        <div className="flex-1 bg-blue-500 rounded-t opacity-70" style={{ height: `${dlNorm * 100}%` }} title={`DL: ${dl.toFixed(1)} Mbps`} />
                        <div className="flex-1 bg-cyan-400 rounded-t opacity-70" style={{ height: `${ulNorm * 100}%` }} title={`UL: ${ul.toFixed(1)} Mbps`} />
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Début</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> DL
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> UL
                </span>
                <span>Fin</span>
              </div>
            </div>

            {/* Latency */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                Latence ({(samplesByKpi['LATENCY'] || []).length} points)
              </h3>
              <div className="h-48 flex items-end gap-1">
                {(samplesByKpi['LATENCY'] || []).slice(0, 40).map((s, i) => {
                  const norm = Math.min(1, s.value / 80);
                  const color = s.value < 30 ? 'bg-emerald-500' : s.value < 50 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${color} rounded-t opacity-80`}
                      style={{ height: `${norm * 100}%` }}
                      title={`${s.value.toFixed(0)} ms`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Début</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> &lt;30ms
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 30-50ms
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;50ms
                </span>
                <span>Fin</span>
              </div>
            </div>

            {/* Coverage map placeholder */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                Carte de couverture
              </h3>
              <div className="h-48 bg-muted/20 rounded-lg flex items-center justify-center border border-dashed border-border">
                <div className="text-center text-muted-foreground">
                  <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Carte GeoJSON</p>
                  <p className="text-xs">Disponible avec Google Maps ou Leaflet</p>
                  <p className="text-xs mt-1">{report.routes.length} route(s) · {report.computed.coverage_gaps} zone(s) faible(s)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Summaries from real jobs */}
          {report.summaries.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  Résumés d'exécution ({report.summaries.length})
                </h3>
              </div>
              <div className="divide-y divide-border/30">
                {report.summaries.map(s => (
                  <div key={s.drive_job_id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-mono ${s.overall_pass ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.overall_pass ? 'PASS' : 'FAIL'}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.drive_job_id.slice(0, 8)}</span>
                      <span className="text-xs">{s.total_samples} samples · {s.duration_sec}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.threshold_violations.length > 0 && (
                        <Badge variant="outline" className="text-red-400 border-red-400/30">
                          {s.threshold_violations.length} violation(s)
                        </Badge>
                      )}
                      {Object.entries(s.kpi_averages).slice(0, 4).map(([kpi, val]) => (
                        <span key={kpi} className="text-xs text-muted-foreground">
                          {kpi}: {typeof val === 'number' ? val.toFixed(1) : val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample data table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-medium">Échantillons KPI ({report.samples.length})</h3>
              <Button variant="outline" size="sm" onClick={() => exportCsv(report.samples)}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">KPI</th>
                    <th className="py-2 px-3">Valeur</th>
                    <th className="py-2 px-3">Unité</th>
                    <th className="py-2 px-3">Lat</th>
                    <th className="py-2 px-3">Lon</th>
                    <th className="py-2 px-3">Cell ID</th>
                  </tr>
                </thead>
                <tbody>
                  {report.samples.slice(0, 200).map((s, i) => {
                    const level = getThresholdLevel(s.kpi_name, s.value,
                      s.kpi_name === 'RSRP' ? -100 : s.kpi_name === 'SINR' ? 5 :
                      s.kpi_name === 'THROUGHPUT_DL' ? 10 : s.kpi_name === 'LATENCY' ? 50 :
                      s.kpi_name === 'PACKET_LOSS' ? 1 : 0
                    );
                    const color = level === 'good' ? '' : level === 'warning' ? 'text-amber-400' : 'text-red-400';
                    return (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="py-1.5 px-3 font-mono text-xs">{new Date(s.timestamp).toLocaleTimeString('fr-FR')}</td>
                        <td className="py-1.5 px-3 text-xs font-medium">{s.kpi_name}</td>
                        <td className={`py-1.5 px-3 ${color}`}>{s.value.toFixed(1)}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">{s.unit}</td>
                        <td className="py-1.5 px-3 text-xs">{s.lat.toFixed(4)}</td>
                        <td className="py-1.5 px-3 text-xs">{s.lon.toFixed(4)}</td>
                        <td className="py-1.5 px-3 text-xs">{s.cell_id || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {report.samples.length > 200 && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
                Affichage limité à 200 lignes sur {report.samples.length}. Exportez en CSV pour voir toutes les données.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
