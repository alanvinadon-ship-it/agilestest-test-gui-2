import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  localDriveCampaigns,
  localDriveRoutes,
  localTestDevices,
  localDriveProbeConfigs,
  localProjects,
  localDriveJobs,
  localDriveRunSummaries,
} from '@/api/localStore';
import type {
  DriveCampaign,
  DriveRoute,
  TestDevice,
  DriveProbeConfig,
  DriveJob,
  DriveRunSummary,
  CampaignStatus,
  NetworkType,
  TargetEnv,
  DeviceType,
  DriveToolName,
  ProbeLocation,
  DriveCaptureType,
  ProbeOutputTarget,
} from '@/types';
import { DRIVE_SCENARIO_TEMPLATES } from '@/config/driveTestCatalog';
import {
  Plus,
  Trash2,
  Edit,
  MapPin,
  Smartphone,
  Radio,
  ChevronRight,
  ChevronDown,
  Play,
  CheckCircle2,
  Clock,
  FileText,
  Signal,
  Navigation,
  Copy,
  Activity,
  BarChart3,
  Loader2,
  AlertTriangle,
  Download,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────

const NETWORK_TYPES: NetworkType[] = ['4G', '5G_SA', '5G_NSA', 'IMS', 'IP'];
const ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];
const CAMPAIGN_STATUSES: CampaignStatus[] = ['DRAFT', 'READY', 'RUNNING', 'DONE'];
const DEVICE_TYPES: DeviceType[] = ['ANDROID', 'MODEM', 'CPE', 'LAPTOP'];
const TOOL_NAMES: DriveToolName[] = ['GNetTrack', 'NSG', 'QXDM', 'Wireshark', 'iperf3', 'ping', 'traceroute', 'tcpdump'];
const PROBE_LOCATIONS: ProbeLocation[] = ['RUNNER_HOST', 'EDGE_VM', 'K8S_NODE', 'SPAN_PORT', 'MIRROR_TAP'];
const CAPTURE_TYPES: DriveCaptureType[] = ['PCAP', 'SIP_TRACE', 'DIAMETER', 'GTPU', 'NGAP', 'NAS', 'HTTP', 'DNS', 'SYSLOG'];
const OUTPUT_TARGETS: ProbeOutputTarget[] = ['MINIO', 'LOCAL', 'BOTH'];

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-300',
  READY: 'bg-blue-500/20 text-blue-300',
  RUNNING: 'bg-amber-500/20 text-amber-300',
  DONE: 'bg-emerald-500/20 text-emerald-300',
};

const STATUS_ICONS: Record<CampaignStatus, typeof Clock> = {
  DRAFT: FileText,
  READY: CheckCircle2,
  RUNNING: Play,
  DONE: CheckCircle2,
};

// ─── Component ────────────────────────────────────────────────────────────

export default function DriveCampaignsPage() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('MANAGER') || hasRole('ADMIN');

  // Project selection
  const [projects] = useState(() => localProjects.list({ limit: 200 }).data);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');

  // Campaigns
  const [campaigns, setCampaigns] = useState<DriveCampaign[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterNetwork, setFilterNetwork] = useState<string>('ALL');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  // Campaign modal
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<DriveCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '', description: '', network_type: '4G' as NetworkType, target_env: 'DEV' as TargetEnv,
    area: '', start_date: '', end_date: '',
  });

  // Routes
  const [routes, setRoutes] = useState<Record<string, DriveRoute[]>>({});
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeParentId, setRouteParentId] = useState('');
  const [routeForm, setRouteForm] = useState({ name: '', expected_duration_min: 30, route_geojson_str: '' });

  // Devices
  const [devices, setDevices] = useState<TestDevice[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    type: 'ANDROID' as DeviceType, model: '', os_version: '', diag_capable: false,
    tools_enabled: [] as DriveToolName[], notes: '',
  });

  // Probe configs
  const [probeConfigs, setProbeConfigs] = useState<DriveProbeConfig[]>([]);
  const [showProbeModal, setShowProbeModal] = useState(false);
  const [probeForm, setProbeForm] = useState({
    name: '', location: 'RUNNER_HOST' as ProbeLocation, capture_type: 'PCAP' as DriveCaptureType,
    retention_days: 30, max_size_mb: 500, rotation: true, output_target: 'MINIO' as ProbeOutputTarget, enabled: true,
  });

  // Active tab
  const [activeTab, setActiveTab] = useState<'campaigns' | 'devices' | 'probes' | 'templates'>('campaigns');

  // Run Campaign
  const [showRunModal, setShowRunModal] = useState(false);
  const [runCampaign, setRunCampaign] = useState<DriveCampaign | null>(null);
  const [runRouteId, setRunRouteId] = useState('');
  const [runDeviceId, setRunDeviceId] = useState('');
  const [runCapturePcap, setRunCapturePcap] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Drive Jobs
  const [driveJobs, setDriveJobs] = useState<Record<string, DriveJob[]>>({});
  const [jobSummaries, setJobSummaries] = useState<Record<string, DriveRunSummary | null>>({});

  // ─── Load data ────────────────────────────────────────────────────────

  const loadCampaigns = () => {
    if (!projectId) return;
    const result = localDriveCampaigns.list(projectId, { limit: 200 });
    setCampaigns(result.data);
  };

  const loadRoutes = (campaignId: string) => {
    const r = localDriveRoutes.list(campaignId);
    setRoutes(prev => ({ ...prev, [campaignId]: r }));
  };

  const loadDevices = () => {
    if (!projectId) return;
    const result = localTestDevices.list(projectId, { limit: 200 });
    setDevices(result.data);
  };

  const loadProbeConfigs = () => {
    if (!projectId) return;
    const p = localDriveProbeConfigs.list(projectId);
    setProbeConfigs(p);
  };

  const loadDriveJobs = (campaignId: string) => {
    const result = localDriveJobs.list({ campaign_id: campaignId, limit: 200 });
    setDriveJobs(prev => ({ ...prev, [campaignId]: result.data }));
    // Load summaries for each job
    for (const j of result.data) {
      const s = localDriveRunSummaries.get(j.drive_job_id);
      setJobSummaries(prev => ({ ...prev, [j.drive_job_id]: s }));
    }
  };

  const openRunCampaign = (c: DriveCampaign) => {
    setRunCampaign(c);
    const cRoutes = routes[c.campaign_id] || localDriveRoutes.list(c.campaign_id);
    if (Array.isArray(cRoutes) && cRoutes.length > 0) setRunRouteId(cRoutes[0].route_id);
    if (devices.length > 0) setRunDeviceId(devices[0].device_id);
    setRunCapturePcap(false);
    setShowRunModal(true);
  };

  const executeRun = () => {
    if (!runCampaign || !runRouteId || !runDeviceId) {
      toast.error('Sélectionnez une route et un équipement');
      return;
    }
    try {
      setIsRunning(true);
      // Créer le job
      const job = localDriveJobs.create({
        campaign_id: runCampaign.campaign_id,
        route_id: runRouteId,
        device_id: runDeviceId,
        target_env: runCampaign.target_env,
      });
      setRunningJobId(job.drive_job_id);
      toast.info(`Job ${job.drive_job_id.slice(0, 8)} créé (PENDING)`);

      // Simuler l'exécution
      const route = localDriveRoutes.list(runCampaign.campaign_id).find(r => r.route_id === runRouteId);
      if (!route) throw new Error('Route introuvable');

      // Seuils par défaut
      const thresholds: Record<string, number> = {
        RSRP: -100, RSRQ: -12, SINR: 5,
        THROUGHPUT_DL: 20, THROUGHPUT_UL: 5,
        LATENCY: 50, JITTER: 20, PACKET_LOSS: 1,
      };

      const result = localDriveJobs.simulateExecution(job.drive_job_id, route, thresholds);
      toast.success(`Exécution terminée : ${result.status}`);

      // Refresh
      loadCampaigns();
      loadDriveJobs(runCampaign.campaign_id);
      setShowRunModal(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsRunning(false);
      setRunningJobId(null);
    }
  };

  useEffect(() => {
    loadCampaigns();
    loadDevices();
    loadProbeConfigs();
  }, [projectId]);

  // ─── Filtered campaigns ───────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = campaigns;
    if (filterStatus !== 'ALL') list = list.filter(c => c.status === filterStatus);
    if (filterNetwork !== 'ALL') list = list.filter(c => c.network_type === filterNetwork);
    return list;
  }, [campaigns, filterStatus, filterNetwork]);

  // ─── Campaign CRUD ────────────────────────────────────────────────────

  const openNewCampaign = () => {
    setEditingCampaign(null);
    setCampaignForm({ name: '', description: '', network_type: '4G', target_env: 'DEV', area: '', start_date: '', end_date: '' });
    setShowCampaignModal(true);
  };

  const openEditCampaign = (c: DriveCampaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name, description: c.description, network_type: c.network_type,
      target_env: c.target_env, area: c.area, start_date: c.start_date, end_date: c.end_date,
    });
    setShowCampaignModal(true);
  };

  const saveCampaign = () => {
    try {
      if (editingCampaign) {
        localDriveCampaigns.update(editingCampaign.campaign_id, campaignForm);
        toast.success('Campagne mise à jour');
      } else {
        localDriveCampaigns.create(projectId, campaignForm);
        toast.success('Campagne créée');
      }
      setShowCampaignModal(false);
      loadCampaigns();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteCampaign = (id: string) => {
    localDriveCampaigns.delete(id);
    toast.success('Campagne supprimée');
    loadCampaigns();
  };

  const updateCampaignStatus = (id: string, status: CampaignStatus) => {
    localDriveCampaigns.updateStatus(id, status);
    toast.success(`Statut → ${status}`);
    loadCampaigns();
  };

  // ─── Route CRUD ───────────────────────────────────────────────────────

  const openNewRoute = (campaignId: string) => {
    setRouteParentId(campaignId);
    setRouteForm({ name: '', expected_duration_min: 30, route_geojson_str: '' });
    setShowRouteModal(true);
  };

  const saveRoute = () => {
    try {
      let geojson = null;
      if (routeForm.route_geojson_str.trim()) {
        geojson = JSON.parse(routeForm.route_geojson_str);
      }
      localDriveRoutes.create(routeParentId, {
        name: routeForm.name,
        expected_duration_min: routeForm.expected_duration_min,
        route_geojson: geojson,
      });
      toast.success('Route ajoutée');
      setShowRouteModal(false);
      loadRoutes(routeParentId);
    } catch (e: any) {
      toast.error(e.message || 'GeoJSON invalide');
    }
  };

  const deleteRoute = (routeId: string, campaignId: string) => {
    localDriveRoutes.delete(routeId);
    toast.success('Route supprimée');
    loadRoutes(campaignId);
  };

  // ─── Device CRUD ──────────────────────────────────────────────────────

  const openNewDevice = () => {
    setDeviceForm({ type: 'ANDROID', model: '', os_version: '', diag_capable: false, tools_enabled: [], notes: '' });
    setShowDeviceModal(true);
  };

  const saveDevice = () => {
    try {
      localTestDevices.create(projectId, deviceForm);
      toast.success('Équipement ajouté');
      setShowDeviceModal(false);
      loadDevices();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteDevice = (id: string) => {
    localTestDevices.delete(id);
    toast.success('Équipement supprimé');
    loadDevices();
  };

  // ─── Probe Config CRUD ────────────────────────────────────────────────

  const openNewProbe = () => {
    setProbeForm({ name: '', location: 'RUNNER_HOST', capture_type: 'PCAP', retention_days: 30, max_size_mb: 500, rotation: true, output_target: 'MINIO', enabled: true });
    setShowProbeModal(true);
  };

  const saveProbe = () => {
    try {
      localDriveProbeConfigs.create(projectId, probeForm);
      toast.success('Sonde ajoutée');
      setShowProbeModal(false);
      loadProbeConfigs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteProbe = (id: string) => {
    localDriveProbeConfigs.delete(id);
    toast.success('Sonde supprimée');
    loadProbeConfigs();
  };

  // ─── Toggle expand ────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
    } else {
      setExpandedCampaign(id);
      if (!routes[id]) loadRoutes(id);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (!projectId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Drive Test — Campagnes</h1>
        <p className="text-muted-foreground">Aucun projet disponible. Créez d'abord un projet avec le domaine DRIVE_TEST.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Signal className="w-6 h-6 text-emerald-400" />
            Drive Test
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Campagnes de test terrain, routes, équipements et sondes</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Projet" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: 'campaigns' as const, label: 'Campagnes', icon: Navigation },
          { key: 'devices' as const, label: 'Équipements', icon: Smartphone },
          { key: 'probes' as const, label: 'Sondes', icon: Radio },
          { key: 'templates' as const, label: 'Scénarios Templates', icon: FileText },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Campaigns ═══ */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                {CAMPAIGN_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterNetwork} onValueChange={setFilterNetwork}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Réseau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                {NETWORK_TYPES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            {canWrite && (
              <Button onClick={openNewCampaign} size="sm" className="ml-auto">
                <Plus className="w-4 h-4 mr-1" /> Nouvelle campagne
              </Button>
            )}
          </div>

          {/* Campaign list */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Navigation className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Aucune campagne drive test</p>
              {canWrite && <p className="text-sm mt-1">Cliquez sur "Nouvelle campagne" pour commencer</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const StatusIcon = STATUS_ICONS[c.status];
                const isExpanded = expandedCampaign === c.campaign_id;
                const campaignRoutes = routes[c.campaign_id] || [];

                return (
                  <div key={c.campaign_id} className="border border-border rounded-lg overflow-hidden">
                    {/* Campaign header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(c.campaign_id)}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <StatusIcon className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{c.name}</span>
                          <Badge className={STATUS_COLORS[c.status]}>{c.status}</Badge>
                          <Badge variant="outline">{c.network_type}</Badge>
                          <Badge variant="outline">{c.target_env}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {c.area && <span>{c.area} · </span>}
                          {c.start_date} → {c.end_date}
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {canWrite && c.status === 'DRAFT' && (
                          <Button size="sm" variant="ghost" onClick={() => updateCampaignStatus(c.campaign_id, 'READY')}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ready
                          </Button>
                        )}
                        {canWrite && (c.status === 'READY' || c.status === 'DONE') && (
                          <Button size="sm" variant="ghost" className="text-emerald-400" onClick={() => openRunCampaign(c)}>
                            <Play className="w-3.5 h-3.5 mr-1" /> {c.status === 'DONE' ? 'Relancer' : 'Run'}
                          </Button>
                        )}
                        {c.status === 'RUNNING' && (
                          <Badge className="bg-amber-500/20 text-amber-300 animate-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> En cours</Badge>
                        )}
                        {canWrite && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEditCampaign(c)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteCampaign(c.campaign_id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded: Routes */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            Routes ({campaignRoutes.length})
                          </h3>
                          {canWrite && (
                            <Button size="sm" variant="outline" onClick={() => openNewRoute(c.campaign_id)}>
                              <Plus className="w-3.5 h-3.5 mr-1" /> Route
                            </Button>
                          )}
                        </div>
                        {campaignRoutes.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Aucune route définie</p>
                        ) : (
                          <div className="space-y-1">
                            {campaignRoutes.map(r => (
                              <div key={r.route_id} className="flex items-center justify-between px-3 py-2 rounded bg-background/50">
                                <div>
                                  <span className="text-sm font-medium">{r.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">~{r.expected_duration_min} min</span>
                                  {r.route_geojson && (
                                    <Badge variant="outline" className="ml-2 text-xs">GeoJSON</Badge>
                                  )}
                                </div>
                                {canWrite && (
                                  <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteRoute(r.route_id, c.campaign_id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Campaign description */}
                        {c.description && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground">{c.description}</p>
                          </div>
                        )}

                        {/* Drive Jobs */}
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-blue-400" />
                              Exécutions ({(driveJobs[c.campaign_id] || []).length})
                            </h3>
                            <Button size="sm" variant="ghost" onClick={() => loadDriveJobs(c.campaign_id)}>
                              Rafraîchir
                            </Button>
                          </div>
                          {(driveJobs[c.campaign_id] || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">Aucune exécution. Cliquez sur Run pour lancer.</p>
                          ) : (
                            <div className="space-y-1">
                              {(driveJobs[c.campaign_id] || []).map(j => {
                                const summary = jobSummaries[j.drive_job_id];
                                const jobStatusColor = j.status === 'DONE' ? 'text-emerald-400' : j.status === 'FAILED' ? 'text-red-400' : j.status === 'RUNNING' ? 'text-amber-400' : 'text-gray-400';
                                return (
                                  <div key={j.drive_job_id} className="flex items-center justify-between px-3 py-2 rounded bg-background/50">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-mono ${jobStatusColor}`}>{j.status}</span>
                                      <span className="text-xs text-muted-foreground">{j.drive_job_id.slice(0, 8)}</span>
                                      <span className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString('fr-FR')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {summary && (
                                        <span className={`text-xs ${summary.overall_pass ? 'text-emerald-400' : 'text-red-400'}`}>
                                          {summary.overall_pass ? 'PASS' : `${summary.threshold_violations.length} violation(s)`}
                                        </span>
                                      )}
                                      {j.artifacts_manifest.length > 0 && (
                                        <Badge variant="outline" className="text-xs">{j.artifacts_manifest.length} artefacts</Badge>
                                      )}
                                      {summary && (
                                        <Button size="sm" variant="ghost" onClick={() => window.location.href = `/drive-reporting?campaign=${c.campaign_id}&job=${j.drive_job_id}`}>
                                          <BarChart3 className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Devices ═══ */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{devices.length} équipement(s) enregistré(s)</p>
            {canWrite && (
              <Button size="sm" onClick={openNewDevice}>
                <Plus className="w-4 h-4 mr-1" /> Nouvel équipement
              </Button>
            )}
          </div>
          {devices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Aucun équipement de test</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {devices.map(d => (
                <div key={d.device_id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{d.type}</Badge>
                    {canWrite && (
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteDevice(d.device_id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="font-medium">{d.model}</div>
                  <div className="text-xs text-muted-foreground">{d.os_version}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.diag_capable && <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">Diag</Badge>}
                    {d.tools_enabled.map(t => (
                      <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                  {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Probes ═══ */}
      {activeTab === 'probes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{probeConfigs.length} sonde(s) configurée(s)</p>
            {canWrite && (
              <Button size="sm" onClick={openNewProbe}>
                <Plus className="w-4 h-4 mr-1" /> Nouvelle sonde
              </Button>
            )}
          </div>
          {probeConfigs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Aucune sonde configurée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 px-3">Nom</th>
                    <th className="py-2 px-3">Emplacement</th>
                    <th className="py-2 px-3">Type capture</th>
                    <th className="py-2 px-3">Rétention</th>
                    <th className="py-2 px-3">Max</th>
                    <th className="py-2 px-3">Sortie</th>
                    <th className="py-2 px-3">État</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {probeConfigs.map(p => (
                    <tr key={p.probe_id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium">{p.name}</td>
                      <td className="py-2 px-3"><Badge variant="outline">{p.location}</Badge></td>
                      <td className="py-2 px-3"><Badge variant="outline">{p.capture_type}</Badge></td>
                      <td className="py-2 px-3">{p.retention_days}j</td>
                      <td className="py-2 px-3">{p.max_size_mb} MB</td>
                      <td className="py-2 px-3">{p.output_target}</td>
                      <td className="py-2 px-3">
                        <Badge className={p.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}>
                          {p.enabled ? 'ON' : 'OFF'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        {canWrite && (
                          <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteProbe(p.probe_id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Templates ═══ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {DRIVE_SCENARIO_TEMPLATES.length} templates de scénarios Drive Test disponibles pour import dans vos profils.
          </p>
          <div className="space-y-2">
            {DRIVE_SCENARIO_TEMPLATES.map(t => (
              <div key={t.template_id} className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="font-mono text-xs">{t.scenario_code}</Badge>
                  <Badge className={
                    t.test_type === 'VABF' ? 'bg-blue-500/20 text-blue-300' :
                    t.test_type === 'VSR' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-purple-500/20 text-purple-300'
                  }>{t.test_type}</Badge>
                  <span className="font-medium">{t.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{t.steps.length} étapes ·</span>
                  <span className="text-xs text-muted-foreground">Datasets requis :</span>
                  {t.required_dataset_types.map(dt => (
                    <Badge key={dt} variant="outline" className="text-xs">{dt}</Badge>
                  ))}
                </div>
                {Object.keys(t.kpi_thresholds).length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-xs text-muted-foreground">KPI :</span>
                    {Object.entries(t.kpi_thresholds).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-xs font-mono">{k}: {v}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Campaign Modal */}
      <Dialog open={showCampaignModal} onOpenChange={setShowCampaignModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom de la campagne" value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} />
            <Textarea placeholder="Description" value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={campaignForm.network_type} onValueChange={v => setCampaignForm(f => ({ ...f, network_type: v as NetworkType }))}>
                <SelectTrigger><SelectValue placeholder="Réseau" /></SelectTrigger>
                <SelectContent>
                  {NETWORK_TYPES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={campaignForm.target_env} onValueChange={v => setCampaignForm(f => ({ ...f, target_env: v as TargetEnv }))}>
                <SelectTrigger><SelectValue placeholder="Env" /></SelectTrigger>
                <SelectContent>
                  {ENVS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Zone / Ville" value={campaignForm.area} onChange={e => setCampaignForm(f => ({ ...f, area: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(f => ({ ...f, start_date: e.target.value }))} />
              <Input type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignModal(false)}>Annuler</Button>
            <Button onClick={saveCampaign}>{editingCampaign ? 'Enregistrer' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Modal */}
      <Dialog open={showRouteModal} onOpenChange={setShowRouteModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle route</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom du parcours" value={routeForm.name} onChange={e => setRouteForm(f => ({ ...f, name: e.target.value }))} />
            <Input type="number" placeholder="Durée estimée (min)" value={routeForm.expected_duration_min} onChange={e => setRouteForm(f => ({ ...f, expected_duration_min: parseInt(e.target.value) || 0 }))} />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">GeoJSON LineString (optionnel)</label>
              <Textarea
                placeholder='{"type":"LineString","coordinates":[[-3.99,5.32],[-3.98,5.34]]}'
                value={routeForm.route_geojson_str}
                onChange={e => setRouteForm(f => ({ ...f, route_geojson_str: e.target.value }))}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRouteModal(false)}>Annuler</Button>
            <Button onClick={saveRoute}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Device Modal */}
      <Dialog open={showDeviceModal} onOpenChange={setShowDeviceModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel équipement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={deviceForm.type} onValueChange={v => setDeviceForm(f => ({ ...f, type: v as DeviceType }))}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                {DEVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Modèle (ex: Samsung Galaxy S24)" value={deviceForm.model} onChange={e => setDeviceForm(f => ({ ...f, model: e.target.value }))} />
            <Input placeholder="Version OS (ex: Android 15)" value={deviceForm.os_version} onChange={e => setDeviceForm(f => ({ ...f, os_version: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deviceForm.diag_capable} onChange={e => setDeviceForm(f => ({ ...f, diag_capable: e.target.checked }))} />
              Capable de diagnostic radio
            </label>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Outils installés</label>
              <div className="flex flex-wrap gap-2">
                {TOOL_NAMES.map(t => (
                  <label key={t} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={deviceForm.tools_enabled.includes(t)}
                      onChange={e => {
                        if (e.target.checked) {
                          setDeviceForm(f => ({ ...f, tools_enabled: [...f.tools_enabled, t] }));
                        } else {
                          setDeviceForm(f => ({ ...f, tools_enabled: f.tools_enabled.filter(x => x !== t) }));
                        }
                      }}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <Textarea placeholder="Notes" value={deviceForm.notes} onChange={e => setDeviceForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeviceModal(false)}>Annuler</Button>
            <Button onClick={saveDevice}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Campaign Modal */}
      <Dialog open={showRunModal} onOpenChange={setShowRunModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-400" />
              Lancer une exécution Drive
            </DialogTitle>
          </DialogHeader>
          {runCampaign && (
            <div className="space-y-4">
              <div className="p-3 rounded bg-muted/30 text-sm">
                <div className="font-medium">{runCampaign.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {runCampaign.network_type} · {runCampaign.target_env} · {runCampaign.area}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Route</label>
                <Select value={runRouteId} onValueChange={setRunRouteId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une route" /></SelectTrigger>
                  <SelectContent>
                    {(routes[runCampaign.campaign_id] || localDriveRoutes.list(runCampaign.campaign_id)).map(r => (
                      <SelectItem key={r.route_id} value={r.route_id}>{r.name} (~{r.expected_duration_min} min)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Équipement</label>
                <Select value={runDeviceId} onValueChange={setRunDeviceId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un équipement" /></SelectTrigger>
                  <SelectContent>
                    {devices.map(d => (
                      <SelectItem key={d.device_id} value={d.device_id}>{d.model} ({d.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={runCapturePcap} onChange={e => setRunCapturePcap(e.target.checked)} />
                Capturer PCAP (tcpdump)
              </label>

              {isRunning && (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exécution en cours...
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunModal(false)} disabled={isRunning}>Annuler</Button>
            <Button onClick={executeRun} disabled={isRunning || !runRouteId || !runDeviceId} className="bg-emerald-600 hover:bg-emerald-700">
              {isRunning ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Exécution...</> : <><Play className="w-4 h-4 mr-1" /> Lancer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Probe Modal */}
      <Dialog open={showProbeModal} onOpenChange={setShowProbeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle sonde</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom de la sonde" value={probeForm.name} onChange={e => setProbeForm(f => ({ ...f, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={probeForm.location} onValueChange={v => setProbeForm(f => ({ ...f, location: v as ProbeLocation }))}>
                <SelectTrigger><SelectValue placeholder="Emplacement" /></SelectTrigger>
                <SelectContent>
                  {PROBE_LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={probeForm.capture_type} onValueChange={v => setProbeForm(f => ({ ...f, capture_type: v as DriveCaptureType }))}>
                <SelectTrigger><SelectValue placeholder="Type capture" /></SelectTrigger>
                <SelectContent>
                  {CAPTURE_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Rétention (jours)" value={probeForm.retention_days} onChange={e => setProbeForm(f => ({ ...f, retention_days: parseInt(e.target.value) || 0 }))} />
              <Input type="number" placeholder="Max taille (MB)" value={probeForm.max_size_mb} onChange={e => setProbeForm(f => ({ ...f, max_size_mb: parseInt(e.target.value) || 0 }))} />
            </div>
            <Select value={probeForm.output_target} onValueChange={v => setProbeForm(f => ({ ...f, output_target: v as ProbeOutputTarget }))}>
              <SelectTrigger><SelectValue placeholder="Cible sortie" /></SelectTrigger>
              <SelectContent>
                {OUTPUT_TARGETS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={probeForm.rotation} onChange={e => setProbeForm(f => ({ ...f, rotation: e.target.checked }))} />
                Rotation
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={probeForm.enabled} onChange={e => setProbeForm(f => ({ ...f, enabled: e.target.checked }))} />
                Activée
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProbeModal(false)}>Annuler</Button>
            <Button onClick={saveProbe}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
