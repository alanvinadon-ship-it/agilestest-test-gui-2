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
import { localDriveCampaigns, localDriveRoutes, localProjects } from '@/api/localStore';
import type { DriveCampaign, DriveRoute, TargetEnv, NetworkType } from '@/types';
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
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Simulated KPI data (would come from real executions in production) ──

interface KpiSample {
  checkpoint: string;
  rsrp: number;
  sinr: number;
  throughput_dl: number;
  throughput_ul: number;
  latency: number;
  jitter: number;
  packet_loss: number;
}

interface CampaignReport {
  campaign: DriveCampaign;
  routes: DriveRoute[];
  samples: KpiSample[];
  summary: {
    total_checkpoints: number;
    avg_rsrp: number;
    avg_sinr: number;
    avg_dl: number;
    avg_ul: number;
    avg_latency: number;
    p95_latency: number;
    avg_packet_loss: number;
    coverage_gaps: number;
    handover_events: number;
    handover_success_rate: number;
    incidents_count: number;
  };
}

function generateSimulatedReport(campaign: DriveCampaign, routes: DriveRoute[]): CampaignReport {
  const checkpoints = routes.reduce((sum, r) => sum + (r.route_geojson?.coordinates?.length || 5), 0);
  const samples: KpiSample[] = [];
  for (let i = 0; i < Math.max(checkpoints, 10); i++) {
    samples.push({
      checkpoint: `CP-${(i + 1).toString().padStart(3, '0')}`,
      rsrp: -70 - Math.random() * 40,
      sinr: 5 + Math.random() * 20,
      throughput_dl: 5 + Math.random() * 95,
      throughput_ul: 2 + Math.random() * 48,
      latency: 10 + Math.random() * 60,
      jitter: 1 + Math.random() * 15,
      packet_loss: Math.random() * 3,
    });
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const p95 = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  };

  return {
    campaign,
    routes,
    samples,
    summary: {
      total_checkpoints: samples.length,
      avg_rsrp: avg(samples.map(s => s.rsrp)),
      avg_sinr: avg(samples.map(s => s.sinr)),
      avg_dl: avg(samples.map(s => s.throughput_dl)),
      avg_ul: avg(samples.map(s => s.throughput_ul)),
      avg_latency: avg(samples.map(s => s.latency)),
      p95_latency: p95(samples.map(s => s.latency)),
      avg_packet_loss: avg(samples.map(s => s.packet_loss)),
      coverage_gaps: samples.filter(s => s.rsrp < -110).length,
      handover_events: Math.floor(samples.length * 0.3),
      handover_success_rate: 95 + Math.random() * 4.5,
      incidents_count: Math.floor(Math.random() * 5),
    },
  };
}

// ─── KPI Card Component ─────────────────────────────────────────────────

function KpiCard({ label, value, unit, threshold, icon: Icon, inverse }: {
  label: string;
  value: number;
  unit: string;
  threshold?: number;
  icon: typeof Gauge;
  inverse?: boolean;
}) {
  const isOk = threshold !== undefined
    ? (inverse ? value <= threshold : value >= threshold)
    : true;

  return (
    <div className={`border rounded-lg p-4 ${isOk ? 'border-border' : 'border-red-500/50 bg-red-500/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${isOk ? 'text-emerald-400' : 'text-red-400'}`} />
        {isOk ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-400" />
        )}
      </div>
      <div className="text-2xl font-bold">{value.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span></div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {threshold !== undefined && (
        <div className="text-xs mt-1">
          <span className={isOk ? 'text-emerald-400' : 'text-red-400'}>
            Seuil: {inverse ? '≤' : '≥'} {threshold} {unit}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function DriveReportingPage() {
  const [projects] = useState(() => localProjects.list({ limit: 200 }).data);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [campaigns, setCampaigns] = useState<DriveCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [loading, setLoading] = useState(false);

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
        const r = generateSimulatedReport(campaign, routes);
        setReport(r);
        toast.success('Rapport généré');
      } catch (e: any) {
        toast.error(e.message);
      }
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    if (selectedCampaignId) generateReport();
  }, [selectedCampaignId]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Drive Test — Reporting
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Rapport consolidé KPI, couverture et incidents</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Projet" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Campagne" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map(c => (
                <SelectItem key={c.campaign_id} value={c.campaign_id}>{c.name} ({c.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={generateReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {!report ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>Sélectionnez une campagne pour générer le rapport</p>
        </div>
      ) : (
        <>
          {/* Campaign info bar */}
          <div className="flex items-center gap-3 px-4 py-3 border border-border rounded-lg bg-muted/10">
            <Badge variant="outline">{report.campaign.network_type}</Badge>
            <Badge variant="outline">{report.campaign.target_env}</Badge>
            <span className="text-sm text-muted-foreground">{report.campaign.area}</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{report.campaign.start_date} → {report.campaign.end_date}</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm">{report.routes.length} route(s)</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm">{report.summary.total_checkpoints} checkpoints</span>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <KpiCard label="RSRP moyen" value={report.summary.avg_rsrp} unit="dBm" threshold={-100} icon={Signal} />
            <KpiCard label="SINR moyen" value={report.summary.avg_sinr} unit="dB" threshold={5} icon={Wifi} />
            <KpiCard label="Débit DL moyen" value={report.summary.avg_dl} unit="Mbps" threshold={10} icon={TrendingUp} />
            <KpiCard label="Débit UL moyen" value={report.summary.avg_ul} unit="Mbps" threshold={5} icon={TrendingUp} />
            <KpiCard label="Latence moyenne" value={report.summary.avg_latency} unit="ms" threshold={50} icon={Activity} inverse />
            <KpiCard label="Latence P95" value={report.summary.p95_latency} unit="ms" threshold={100} icon={Activity} inverse />
            <KpiCard label="Perte paquets" value={report.summary.avg_packet_loss} unit="%" threshold={1} icon={AlertTriangle} inverse />
            <KpiCard label="Handover success" value={report.summary.handover_success_rate} unit="%" threshold={95} icon={Gauge} />
            <KpiCard label="Zones faibles" value={report.summary.coverage_gaps} unit="" icon={MapPin} />
            <KpiCard label="Incidents" value={report.summary.incidents_count} unit="" icon={AlertTriangle} />
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* RSRP Distribution */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Signal className="w-4 h-4 text-emerald-400" />
                Distribution RSRP par checkpoint
              </h3>
              <div className="h-48 flex items-end gap-1">
                {report.samples.slice(0, 30).map((s, i) => {
                  const normalized = Math.max(0, Math.min(1, (s.rsrp + 140) / 96));
                  const color = s.rsrp > -90 ? 'bg-emerald-500' : s.rsrp > -100 ? 'bg-amber-500' : s.rsrp > -110 ? 'bg-orange-500' : 'bg-red-500';
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${color} rounded-t opacity-80 hover:opacity-100 transition-opacity`}
                      style={{ height: `${normalized * 100}%` }}
                      title={`${s.checkpoint}: ${s.rsrp.toFixed(0)} dBm`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>CP-001</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> &gt;-90
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> -90~-100
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> -100~-110
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;-110
                </span>
                <span>CP-{Math.min(30, report.samples.length).toString().padStart(3, '0')}</span>
              </div>
            </div>

            {/* Throughput DL/UL */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Débit DL / UL par checkpoint
              </h3>
              <div className="h-48 flex items-end gap-1">
                {report.samples.slice(0, 30).map((s, i) => {
                  const dlNorm = Math.min(1, s.throughput_dl / 100);
                  const ulNorm = Math.min(1, s.throughput_ul / 50);
                  return (
                    <div key={i} className="flex-1 flex gap-px items-end h-full">
                      <div
                        className="flex-1 bg-blue-500 rounded-t opacity-70"
                        style={{ height: `${dlNorm * 100}%` }}
                        title={`DL: ${s.throughput_dl.toFixed(1)} Mbps`}
                      />
                      <div
                        className="flex-1 bg-cyan-400 rounded-t opacity-70"
                        style={{ height: `${ulNorm * 100}%` }}
                        title={`UL: ${s.throughput_ul.toFixed(1)} Mbps`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>CP-001</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> DL
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> UL
                </span>
                <span>CP-{Math.min(30, report.samples.length).toString().padStart(3, '0')}</span>
              </div>
            </div>

            {/* Latency */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                Latence par checkpoint
              </h3>
              <div className="h-48 flex items-end gap-1">
                {report.samples.slice(0, 30).map((s, i) => {
                  const norm = Math.min(1, s.latency / 80);
                  const color = s.latency < 30 ? 'bg-emerald-500' : s.latency < 50 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div
                      key={i}
                      className={`flex-1 ${color} rounded-t opacity-80`}
                      style={{ height: `${norm * 100}%` }}
                      title={`${s.checkpoint}: ${s.latency.toFixed(0)} ms`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>CP-001</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> &lt;30ms
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 30-50ms
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &gt;50ms
                </span>
                <span>CP-{Math.min(30, report.samples.length).toString().padStart(3, '0')}</span>
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
                  <p className="text-xs mt-1">{report.routes.length} route(s) · {report.summary.coverage_gaps} zone(s) faible(s)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sample data table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-medium">Échantillons KPI ({report.samples.length})</h3>
              <Button variant="outline" size="sm" onClick={() => toast.info('Export CSV — fonctionnalité à venir')}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
              </Button>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 px-3">Checkpoint</th>
                    <th className="py-2 px-3">RSRP (dBm)</th>
                    <th className="py-2 px-3">SINR (dB)</th>
                    <th className="py-2 px-3">DL (Mbps)</th>
                    <th className="py-2 px-3">UL (Mbps)</th>
                    <th className="py-2 px-3">Latence (ms)</th>
                    <th className="py-2 px-3">Jitter (ms)</th>
                    <th className="py-2 px-3">Loss (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.samples.map((s, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                      <td className="py-1.5 px-3 font-mono text-xs">{s.checkpoint}</td>
                      <td className={`py-1.5 px-3 ${s.rsrp < -110 ? 'text-red-400' : s.rsrp < -100 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {s.rsrp.toFixed(0)}
                      </td>
                      <td className={`py-1.5 px-3 ${s.sinr < 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {s.sinr.toFixed(1)}
                      </td>
                      <td className={`py-1.5 px-3 ${s.throughput_dl < 10 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {s.throughput_dl.toFixed(1)}
                      </td>
                      <td className={`py-1.5 px-3 ${s.throughput_ul < 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {s.throughput_ul.toFixed(1)}
                      </td>
                      <td className={`py-1.5 px-3 ${s.latency > 50 ? 'text-red-400' : s.latency > 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {s.latency.toFixed(0)}
                      </td>
                      <td className={`py-1.5 px-3 ${s.jitter > 10 ? 'text-red-400' : ''}`}>
                        {s.jitter.toFixed(1)}
                      </td>
                      <td className={`py-1.5 px-3 ${s.packet_loss > 1 ? 'text-red-400' : ''}`}>
                        {s.packet_loss.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
