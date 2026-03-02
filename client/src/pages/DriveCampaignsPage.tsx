import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '@/auth/AuthContext';
import { usePermission, PermissionKey } from '@/security';
import { trpc } from '@/lib/trpc';
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
import type {
  NetworkType,
  TargetEnv,
  DeviceType,
  DriveToolName,
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
  Activity,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { CapturePolicyEditor, CaptureModeBadge } from '@/capture';
import type { CapturePolicy } from '@/capture/types';
import { DEFAULT_CAPTURE_POLICY } from '@/capture/types';

// ─── Constants ────────────────────────────────────────────────────────────

const NETWORK_TYPES: NetworkType[] = ['4G', '5G_SA', '5G_NSA', 'IMS', 'IP'];
const ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];
type DBCampaignStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
const CAMPAIGN_STATUSES: DBCampaignStatus[] = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
const DEVICE_TYPES: DeviceType[] = ['ANDROID', 'MODEM', 'CPE', 'LAPTOP'];
const TOOL_NAMES: DriveToolName[] = ['GNetTrack', 'NSG', 'QXDM', 'Wireshark', 'iperf3', 'ping', 'traceroute', 'tcpdump'];

const STATUS_COLORS: Record<DBCampaignStatus, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-300',
  ACTIVE: 'bg-emerald-500/20 text-emerald-300',
  COMPLETED: 'bg-blue-500/20 text-blue-300',
  CANCELLED: 'bg-red-500/20 text-red-300',
};

const STATUS_ICONS: Record<DBCampaignStatus, typeof Clock> = {
  DRAFT: FileText,
  ACTIVE: Play,
  COMPLETED: CheckCircle2,
  CANCELLED: Clock,
};

const JOB_STATUS_COLORS: Record<string, string> = {
  QUEUED: 'text-gray-400',
  RUNNING: 'text-amber-400',
  COMPLETED: 'text-emerald-400',
  FAILED: 'text-red-400',
  CANCELED: 'text-gray-500',
};

// ─── Display campaign type ──────────────────────────────────────────────

interface DisplayCampaign {
  campaign_id: string;
  project_id: string;
  name: string;
  description: string;
  target_env: string;
  network_type: string;
  area: string;
  start_date: string;
  end_date: string;
  status: DBCampaignStatus;
  created_by: string;
}

function mapCampaignRow(row: any): DisplayCampaign {
  return {
    campaign_id: row.uid ?? '',
    project_id: row.projectId ?? row.project_id ?? '',
    name: row.name ?? '',
    description: row.description ?? '',
    target_env: row.targetEnv ?? row.target_env ?? 'DEV',
    network_type: row.networkType ?? row.network_type ?? '4G',
    area: row.area ?? '',
    start_date: row.startDate ?? row.start_date ?? '',
    end_date: row.endDate ?? row.end_date ?? '',
    status: (row.status ?? 'DRAFT') as DBCampaignStatus,
    created_by: row.createdBy ?? row.created_by ?? '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function DriveCampaignsPage() {
  const { currentProject } = useProject();
  const { hasRole } = useAuth();
  const { can } = usePermission();
  const canCreateCampaign = can(PermissionKey.DRIVE_CAMPAIGNS_CREATE);
  const canUpdateCampaign = can(PermissionKey.DRIVE_CAMPAIGNS_UPDATE);
  const canDeleteCampaign = can(PermissionKey.DRIVE_CAMPAIGNS_DELETE);
  const canRunCampaign = can(PermissionKey.DRIVE_CAMPAIGNS_UPDATE);
  const utils = trpc.useUtils();

  const projectId = currentProject?.id || '';

  // Campaigns from tRPC
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterNetwork, setFilterNetwork] = useState<string>('ALL');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const CAMPAIGN_PAGE_SIZE = 30;
  const [campaignCursor, setCampaignCursor] = useState<number | undefined>(undefined);
  const [allCampaignItems, setAllCampaignItems] = useState<any[]>([]);

  const { data: campaignsData, isLoading: campaignsLoading, isFetching: campaignsFetching } = trpc.driveCampaigns.list.useQuery(
    {
      projectId,
      status: filterStatus !== 'ALL' ? filterStatus as any : undefined,
      pageSize: CAMPAIGN_PAGE_SIZE,
      cursor: campaignCursor,
    },
    { enabled: !!projectId },
  );

  // Accumulate campaign items as cursor changes
  useEffect(() => {
    if (campaignsData?.data) {
      if (campaignCursor === undefined) {
        setAllCampaignItems(campaignsData.data);
      } else {
        setAllCampaignItems(prev => {
          const ids = new Set(prev.map((r: any) => r.uid || r.id));
          const fresh = campaignsData.data.filter((r: any) => !ids.has(r.uid || r.id));
          return [...prev, ...fresh];
        });
      }
    }
  }, [campaignsData, campaignCursor]);

  // Reset accumulator when filters change
  useEffect(() => {
    setCampaignCursor(undefined);
    setAllCampaignItems([]);
  }, [filterStatus, projectId]);

  const campaignsHasMore = campaignsData?.hasMore ?? false;
  const campaignsNextCursor = campaignsData?.nextCursor;

  const campaigns = useMemo(() => allCampaignItems.map(mapCampaignRow), [allCampaignItems]);

  const filtered = useMemo(() => {
    let list = campaigns;
    if (filterNetwork !== 'ALL') list = list.filter(c => c.network_type === filterNetwork);
    return list;
  }, [campaigns, filterNetwork]);

  // Campaign modal
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<DisplayCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: '', description: '', network_type: '4G' as NetworkType, target_env: 'DEV' as TargetEnv,
    area: '', start_date: '', end_date: '',
  });

  // Route modal
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeParentId, setRouteParentId] = useState('');
  const [routeForm, setRouteForm] = useState({ name: '', expected_duration_min: 30, route_geojson_str: '' });

  // Device modal
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    type: 'ANDROID' as DeviceType, model: '', os_version: '', diag_capable: false,
    tools_enabled: [] as DriveToolName[], notes: '',
  });

  // Active tab
  const [activeTab, setActiveTab] = useState<'campaigns' | 'devices' | 'probes' | 'templates'>('campaigns');

  // Run Campaign
  const [showRunModal, setShowRunModal] = useState(false);
  const [runCampaignData, setRunCampaignData] = useState<DisplayCampaign | null>(null);
  const [runRouteId, setRunRouteId] = useState('');
  const [runDeviceId, setRunDeviceId] = useState('');
  const [runCapturePcap, setRunCapturePcap] = useState(false);

  // ─── tRPC Queries: Routes per campaign ──────────────────────────────────

  const { data: routesData } = trpc.driveRoutes.list.useQuery(
    { campaignId: expandedCampaign || '', limit: 100 },
    { enabled: !!expandedCampaign },
  );
  const campaignRoutes = routesData?.items || [];

  // ─── tRPC Queries: Devices per campaign (all devices for the expanded campaign) ─

  // Devices are now per-campaign (not per-project)
  // For the devices tab, we show devices for all campaigns (we use a special "all" query or the expanded one)
  // Actually, devices in the DB are per-campaign. For the "Devices" tab we need to pick a campaign.
  // Let's use a project-level approach: list devices for all campaigns of the project.
  // For simplicity, we'll list devices for the expanded campaign in the campaigns tab,
  // and for the devices tab, we'll show a message to select a campaign or list all.

  // For the run modal, we need devices for the selected campaign
  const { data: runDevicesData } = trpc.driveDevices.list.useQuery(
    { campaignId: runCampaignData?.campaign_id || expandedCampaign || '', limit: 100 },
    { enabled: !!(runCampaignData?.campaign_id || expandedCampaign) },
  );
  const availableDevices = runDevicesData?.items || [];

  // ─── tRPC Queries: Probe links per campaign ────────────────────────────

  const { data: probeLinksData } = trpc.driveProbeLinks.list.useQuery(
    { campaignId: expandedCampaign || '' },
    { enabled: !!expandedCampaign },
  );
  const campaignProbeLinks = probeLinksData?.items || [];

  // ─── tRPC Queries: Capture policy per expanded campaign ─────────────────

  const { data: campaignPolicyRow } = trpc.capturePolicies.getByScope.useQuery(
    { scope: 'campaign', scopeId: expandedCampaign || '' },
    { enabled: !!expandedCampaign },
  );
  const campaignCapturePolicy = (campaignPolicyRow?.policyJson as any) || null;

  const upsertPolicyMutation = trpc.capturePolicies.upsert.useMutation({
    onSuccess: () => {
      utils.capturePolicies.getByScope.invalidate();
      toast.success('Capture policy mise à jour pour cette campagne');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removePolicyMutation = trpc.capturePolicies.remove.useMutation({
    onSuccess: () => {
      utils.capturePolicies.getByScope.invalidate();
      toast.info('Override capture supprimé — retour au défaut projet');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── tRPC Queries: Jobs per campaign ────────────────────────────────────

  const { data: jobsData } = trpc.driveJobs.list.useQuery(
    { campaignId: expandedCampaign || '', limit: 100 },
    { enabled: !!expandedCampaign },
  );
  const campaignJobs = jobsData?.items || [];

  // ─── tRPC Mutations: Campaigns ──────────────────────────────────────────

  const createCampaignMutation = trpc.driveCampaigns.create.useMutation({
    onSuccess: () => {
      utils.driveCampaigns.list.invalidate();
      setShowCampaignModal(false);
      toast.success('Campagne créée');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCampaignMutation = trpc.driveCampaigns.update.useMutation({
    onSuccess: () => {
      utils.driveCampaigns.list.invalidate();
      setShowCampaignModal(false);
      toast.success('Campagne mise à jour');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCampaignMutation = trpc.driveCampaigns.delete.useMutation({
    onSuccess: () => {
      utils.driveCampaigns.list.invalidate();
      toast.success('Campagne supprimée');
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── tRPC Mutations: Routes ─────────────────────────────────────────────

  const createRouteMutation = trpc.driveRoutes.create.useMutation({
    onSuccess: () => {
      utils.driveRoutes.list.invalidate();
      setShowRouteModal(false);
      toast.success('Route ajoutée');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteRouteMutation = trpc.driveRoutes.delete.useMutation({
    onSuccess: () => {
      utils.driveRoutes.list.invalidate();
      toast.success('Route supprimée');
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── tRPC Mutations: Devices ────────────────────────────────────────────

  const createDeviceMutation = trpc.driveDevices.create.useMutation({
    onSuccess: () => {
      utils.driveDevices.list.invalidate();
      setShowDeviceModal(false);
      toast.success('Équipement ajouté');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDeviceMutation = trpc.driveDevices.delete.useMutation({
    onSuccess: () => {
      utils.driveDevices.list.invalidate();
      toast.success('Équipement supprimé');
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── tRPC Mutations: Jobs ──────────────────────────────────────────────

  const createJobMutation = trpc.driveJobs.create.useMutation({
    onSuccess: (data) => {
      utils.driveJobs.list.invalidate();
      toast.success(`Job ${data.jobId.slice(0, 8)} créé (QUEUED)`);
      setShowRunModal(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Campaign CRUD ────────────────────────────────────────────────────

  const openNewCampaign = () => {
    setEditingCampaign(null);
    setCampaignForm({ name: '', description: '', network_type: '4G', target_env: 'DEV', area: '', start_date: '', end_date: '' });
    setShowCampaignModal(true);
  };

  const openEditCampaign = (c: DisplayCampaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name, description: c.description, network_type: c.network_type as NetworkType,
      target_env: c.target_env as TargetEnv, area: c.area, start_date: c.start_date, end_date: c.end_date,
    });
    setShowCampaignModal(true);
  };

  const saveCampaign = () => {
    if (editingCampaign) {
      updateCampaignMutation.mutate({
        campaignId: editingCampaign.campaign_id,
        name: campaignForm.name || undefined,
        description: campaignForm.description || undefined,
        targetEnv: campaignForm.target_env as any || undefined,
        networkType: campaignForm.network_type || undefined,
        area: campaignForm.area || undefined,
        startDate: campaignForm.start_date || undefined,
        endDate: campaignForm.end_date || undefined,
      });
    } else {
      createCampaignMutation.mutate({
        projectId,
        name: campaignForm.name,
        description: campaignForm.description || undefined,
        targetEnv: campaignForm.target_env as any || undefined,
        networkType: campaignForm.network_type || undefined,
        area: campaignForm.area || undefined,
        startDate: campaignForm.start_date || undefined,
        endDate: campaignForm.end_date || undefined,
      });
    }
  };

  const deleteCampaign = (id: string) => {
    deleteCampaignMutation.mutate({ campaignId: id });
  };

  const updateCampaignStatus = (id: string, status: DBCampaignStatus) => {
    updateCampaignMutation.mutate({ campaignId: id, status: status as any });
    toast.success(`Statut → ${status}`);
  };

  // ─── Route CRUD (tRPC) ────────────────────────────────────────────────

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
      createRouteMutation.mutate({
        campaignId: routeParentId,
        name: routeForm.name,
        expectedDurationMin: routeForm.expected_duration_min,
        routeGeojson: geojson,
      });
    } catch (e: any) {
      toast.error(e.message || 'GeoJSON invalide');
    }
  };

  const deleteRoute = (routeId: string) => {
    deleteRouteMutation.mutate({ routeId });
  };

  // ─── Device CRUD (tRPC) ──────────────────────────────────────────────

  const [deviceCampaignId, setDeviceCampaignId] = useState('');

  const openNewDevice = (campaignId?: string) => {
    setDeviceCampaignId(campaignId || expandedCampaign || '');
    setDeviceForm({ type: 'ANDROID', model: '', os_version: '', diag_capable: false, tools_enabled: [], notes: '' });
    setShowDeviceModal(true);
  };

  const saveDevice = () => {
    if (!deviceCampaignId) {
      toast.error('Aucune campagne sélectionnée');
      return;
    }
    createDeviceMutation.mutate({
      campaignId: deviceCampaignId,
      name: `${deviceForm.model} (${deviceForm.type})`,
      deviceType: deviceForm.type,
      model: deviceForm.model || undefined,
      osVersion: deviceForm.os_version || undefined,
      diagCapable: deviceForm.diag_capable,
      toolsEnabled: deviceForm.tools_enabled,
      notes: deviceForm.notes || undefined,
    });
  };

  const deleteDevice = (deviceId: string) => {
    deleteDeviceMutation.mutate({ deviceId });
  };

  // ─── Run Campaign (tRPC) ──────────────────────────────────────────────

  const openRunCampaign = (c: DisplayCampaign) => {
    setRunCampaignData(c);
    setExpandedCampaign(c.campaign_id); // ensure routes/devices are loaded
    setRunRouteId('');
    setRunDeviceId('');
    setRunCapturePcap(false);
    setShowRunModal(true);
  };

  const executeRun = () => {
    if (!runCampaignData || !runRouteId || !runDeviceId) {
      toast.error('Sélectionnez une route et un équipement');
      return;
    }
    createJobMutation.mutate({
      campaignId: runCampaignData.campaign_id,
      routeId: runRouteId,
      deviceId: runDeviceId,
    });
  };

  // ─── Toggle expand ────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
    } else {
      setExpandedCampaign(id);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  if (!projectId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Drive Test — Campagnes</h1>
        <p className="text-muted-foreground">Aucun projet sélectionné. Sélectionnez un projet dans la barre latérale.</p>
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
          <p className="text-muted-foreground text-sm mt-1">
            Campagnes de test terrain pour <strong className="text-foreground">{currentProject?.name}</strong>
          </p>
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
            {canCreateCampaign && (
              <Button onClick={openNewCampaign} size="sm" className="ml-auto">
                <Plus className="w-4 h-4 mr-1" /> Nouvelle campagne
              </Button>
            )}
          </div>

          {/* Campaign list */}
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Navigation className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Aucune campagne drive test</p>
              {canCreateCampaign && <p className="text-sm mt-1">Cliquez sur "Nouvelle campagne" pour commencer</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => {
                const StatusIcon = STATUS_ICONS[c.status];
                const isExpanded = expandedCampaign === c.campaign_id;

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
                        {canUpdateCampaign && c.status === 'DRAFT' && (
                          <Button size="sm" variant="ghost" onClick={() => updateCampaignStatus(c.campaign_id, 'ACTIVE')}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Activer
                          </Button>
                        )}
                        {canRunCampaign && c.status === 'ACTIVE' && (
                          <Button size="sm" variant="ghost" className="text-emerald-400" onClick={() => openRunCampaign(c)}>
                            <Play className="w-3.5 h-3.5 mr-1" /> Run
                          </Button>
                        )}
                        {canUpdateCampaign && (
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

                    {/* Expanded: Routes + Jobs + Devices + Probes */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-3">
                        {/* Routes */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            Routes ({campaignRoutes.length})
                          </h3>
                          {canUpdateCampaign && (
                            <Button size="sm" variant="outline" onClick={() => openNewRoute(c.campaign_id)}>
                              <Plus className="w-3.5 h-3.5 mr-1" /> Route
                            </Button>
                          )}
                        </div>
                        {campaignRoutes.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Aucune route définie</p>
                        ) : (
                          <div className="space-y-1">
                            {campaignRoutes.map((r: any) => (
                              <div key={r.uid} className="flex items-center justify-between px-3 py-2 rounded bg-background/50">
                                <div>
                                  <span className="text-sm font-medium">{r.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">~{r.expectedDurationMin ?? 30} min</span>
                                  {r.geojsonJson && (
                                    <Badge variant="outline" className="ml-2 text-xs">GeoJSON</Badge>
                                  )}
                                  {r.distanceKm && (
                                    <span className="text-xs text-muted-foreground ml-2">{r.distanceKm} km</span>
                                  )}
                                </div>
                                {canDeleteCampaign && (
                                  <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteRoute(r.uid)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Devices for this campaign */}
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium flex items-center gap-1.5">
                              <Smartphone className="w-4 h-4 text-blue-400" />
                              Équipements ({availableDevices.length})
                            </h3>
                            {canUpdateCampaign && (
                              <Button size="sm" variant="outline" onClick={() => openNewDevice(c.campaign_id)}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> Équipement
                              </Button>
                            )}
                          </div>
                          {availableDevices.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Aucun équipement rattaché</p>
                          ) : (
                            <div className="space-y-1">
                              {availableDevices.map((d: any) => (
                                <div key={d.uid} className="flex items-center justify-between px-3 py-2 rounded bg-background/50">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{d.deviceType}</Badge>
                                    <span className="text-sm font-medium">{d.model || d.name || 'Sans nom'}</span>
                                    {d.osVersion && <span className="text-xs text-muted-foreground">{d.osVersion}</span>}
                                    {d.diagCapable && <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">Diag</Badge>}
                                  </div>
                                  {canDeleteCampaign && (
                                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteDevice(d.uid)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Probe Links */}
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium flex items-center gap-1.5">
                              <Radio className="w-4 h-4 text-purple-400" />
                              Sondes liées ({campaignProbeLinks.length})
                            </h3>
                          </div>
                          {campaignProbeLinks.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Aucune sonde liée. Utilisez l'onglet Sondes pour gérer les sondes système.</p>
                          ) : (
                            <div className="space-y-1">
                              {campaignProbeLinks.map((pl: any) => (
                                <div key={pl.uid} className="flex items-center justify-between px-3 py-2 rounded bg-background/50">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{pl.probeName || `Probe #${pl.probeId}`}</span>
                                    <Badge variant="outline">{pl.probeType || 'N/A'}</Badge>
                                    <Badge variant="outline">{pl.role}</Badge>
                                    {pl.probeStatus && (
                                      <Badge className={
                                        pl.probeStatus === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-300' :
                                        pl.probeStatus === 'DEGRADED' ? 'bg-amber-500/20 text-amber-300' :
                                        'bg-red-500/20 text-red-300'
                                      }>{pl.probeStatus}</Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

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
                              Exécutions ({campaignJobs.length})
                            </h3>
                            <Button size="sm" variant="ghost" onClick={() => utils.driveJobs.list.invalidate()}>
                              Rafraîchir
                            </Button>
                          </div>
                          {campaignJobs.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Aucune exécution. Cliquez sur Run pour lancer.</p>
                          ) : (
                            <div className="space-y-1">
                              {campaignJobs.map((j: any) => {
                                const jobStatusColor = JOB_STATUS_COLORS[j.status] || 'text-gray-400';
                                return (
                                  <div key={j.uid} className="flex items-center justify-between px-3 py-2 rounded bg-background/50">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-mono ${jobStatusColor}`}>{j.status}</span>
                                      <span className="text-xs text-muted-foreground">{j.uid.slice(0, 8)}</span>
                                      <Badge variant="outline" className="text-xs">{j.jobType}</Badge>
                                      <span className="text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleString('fr-FR')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {j.progress > 0 && j.progress < 100 && (
                                        <span className="text-xs text-amber-400">{j.progress}%</span>
                                      )}
                                      {j.status === 'COMPLETED' && (
                                        <Button size="sm" variant="ghost" onClick={() => window.location.href = `/drive-reporting?campaign=${c.campaign_id}&job=${j.uid}`}>
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

                        {/* Capture Policy Override */}
                        <div className="border-t border-border pt-3">
                          <CapturePolicyEditor
                            value={expandedCampaign === c.campaign_id ? campaignCapturePolicy : null}
                            onChange={(p: CapturePolicy) => {
                              upsertPolicyMutation.mutate({
                                scope: 'campaign',
                                scopeId: c.campaign_id,
                                policyJson: p,
                              });
                            }}
                            showRemoveOverride={expandedCampaign === c.campaign_id && !!campaignCapturePolicy}
                            onRemoveOverride={() => {
                              removePolicyMutation.mutate({
                                scope: 'campaign',
                                scopeId: c.campaign_id,
                              });
                            }}
                            scopeLabel="Campagne"
                            readOnly={!canUpdateCampaign}
                            compact
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Charger plus */}
              {campaignsHasMore && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={campaignsFetching}
                    onClick={() => campaignsNextCursor && setCampaignCursor(campaignsNextCursor)}
                  >
                    {campaignsFetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Charger plus
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Devices ═══ */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Les équipements sont rattachés par campagne. Sélectionnez une campagne dans l'onglet Campagnes pour voir et gérer ses équipements.
          </div>
          {campaigns.length > 0 && (
            <div className="space-y-2">
              {campaigns.map(c => {
                const isExpanded = expandedCampaign === c.campaign_id;
                return (
                  <div key={c.campaign_id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(c.campaign_id)}>
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="font-medium text-sm">{c.name}</span>
                        <Badge className={STATUS_COLORS[c.status]}>{c.status}</Badge>
                      </div>
                      {canCreateCampaign && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openNewDevice(c.campaign_id); }}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Équipement
                        </Button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 space-y-1">
                        {availableDevices.length === 0 ? (
                          <p className="text-xs text-muted-foreground pl-6">Aucun équipement</p>
                        ) : (
                          availableDevices.map((d: any) => (
                            <div key={d.uid} className="flex items-center justify-between px-3 py-2 rounded bg-muted/20 ml-6">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{d.deviceType}</Badge>
                                <span className="text-sm">{d.model || d.name || 'Sans nom'}</span>
                                {d.osVersion && <span className="text-xs text-muted-foreground">{d.osVersion}</span>}
                                {d.diagCapable && <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">Diag</Badge>}
                                {Array.isArray(d.toolsEnabled) && d.toolsEnabled.map((t: string) => (
                                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                                ))}
                              </div>
                              {canDeleteCampaign && (
                                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteDevice(d.uid)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: Probes ═══ */}
      {activeTab === 'probes' && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Les sondes sont gérées dans la page <a href="/probes" className="text-primary hover:underline">Sondes</a> et peuvent être liées aux campagnes Drive via l'onglet Campagnes.
          </div>
          {expandedCampaign && campaignProbeLinks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Sondes liées à la campagne sélectionnée</h3>
              {campaignProbeLinks.map((pl: any) => (
                <div key={pl.uid} className="border border-border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pl.probeName || `Probe #${pl.probeId}`}</span>
                    <Badge variant="outline">{pl.probeType || 'N/A'}</Badge>
                    <Badge variant="outline">{pl.role}</Badge>
                    {pl.probeStatus && (
                      <Badge className={
                        pl.probeStatus === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-300' :
                        pl.probeStatus === 'DEGRADED' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-red-500/20 text-red-300'
                      }>{pl.probeStatus}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!expandedCampaign && (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Sélectionnez une campagne dans l'onglet Campagnes pour voir ses sondes liées</p>
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
            <Button onClick={saveCampaign} disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}>
              {(createCampaignMutation.isPending || updateCampaignMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingCampaign ? 'Enregistrer' : 'Créer'}
            </Button>
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
            <Button onClick={saveRoute} disabled={createRouteMutation.isPending}>
              {createRouteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Ajouter
            </Button>
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
            <Button onClick={saveDevice} disabled={createDeviceMutation.isPending}>
              {createDeviceMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Ajouter
            </Button>
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
          {runCampaignData && (
            <div className="space-y-4">
              <div className="p-3 rounded bg-muted/30 text-sm">
                <div className="font-medium">{runCampaignData.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {runCampaignData.network_type} · {runCampaignData.target_env} · {runCampaignData.area}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Route</label>
                <Select value={runRouteId} onValueChange={setRunRouteId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une route" /></SelectTrigger>
                  <SelectContent>
                    {campaignRoutes.map((r: any) => (
                      <SelectItem key={r.uid} value={r.uid}>{r.name} (~{r.expectedDurationMin ?? 30} min)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Équipement</label>
                <Select value={runDeviceId} onValueChange={setRunDeviceId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un équipement" /></SelectTrigger>
                  <SelectContent>
                    {availableDevices.map((d: any) => (
                      <SelectItem key={d.uid} value={d.uid}>{d.model || d.name || 'Sans nom'} ({d.deviceType})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={runCapturePcap} onChange={e => setRunCapturePcap(e.target.checked)} />
                Capturer PCAP (tcpdump)
              </label>

              {createJobMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création du job...
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunModal(false)} disabled={createJobMutation.isPending}>Annuler</Button>
            <Button onClick={executeRun} disabled={createJobMutation.isPending || !runRouteId || !runDeviceId} className="bg-emerald-600 hover:bg-emerald-700">
              {createJobMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Création...</> : <><Play className="w-4 h-4 mr-1" /> Lancer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
