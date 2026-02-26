import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import {
  useProbes, useCreateProbe, useDeleteProbe, useRegenerateProbeToken,
  useProbeHealth, useProbeHeartbeat, useTestProbeCapture,
} from '../hooks/useProbeQueries';
import type { Probe, ProbeType, ProbeCapability, ProbeStatus, CreateProbeRequest } from '../types';
import {
  Radio, Plus, Loader2, Trash2, X, AlertCircle, Search,
  Wifi, WifiOff, AlertTriangle, RefreshCw, Copy, Check, Key,
  Activity, HardDrive, Cpu, Clock, Zap, Play, ChevronDown, ChevronUp,
  Shield, Globe, Server,
} from 'lucide-react';
import { toast } from 'sonner';

const probeStatusConfig: Record<ProbeStatus, { icon: typeof Wifi; label: string; cls: string }> = {
  ONLINE: { icon: Wifi, label: 'En ligne', cls: 'text-green-400' },
  OFFLINE: { icon: WifiOff, label: 'Hors ligne', cls: 'text-gray-400' },
  DEGRADED: { icon: AlertTriangle, label: 'Dégradé', cls: 'text-yellow-400' },
};

const healthStatusConfig: Record<string, { label: string; cls: string }> = {
  healthy: { label: 'Sain', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  degraded: { label: 'Dégradé', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  unhealthy: { label: 'Critique', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const probeTypeLabels: Record<ProbeType, string> = {
  LINUX_EDGE: 'Linux Edge',
  K8S_CLUSTER: 'K8s Cluster',
  NETWORK_TAP: 'Network TAP',
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`;
  return `${Math.floor(seconds / 86400)}j ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

// ─── Probe Health Panel ─────────────────────────────────────────────────

function ProbeHealthPanel({ probeId }: { probeId: string }) {
  const { data: health, isLoading } = useProbeHealth(probeId);

  if (isLoading) return (
    <div className="flex items-center gap-2 py-3 text-muted-foreground text-xs">
      <Loader2 className="w-3 h-3 animate-spin" /> Chargement diagnostics...
    </div>
  );

  if (!health) return null;

  const hConfig = healthStatusConfig[health.status] || healthStatusConfig.unhealthy;

  return (
    <div className="mt-3 space-y-3">
      {/* Health badge + version */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${hConfig.cls}`}>
          <Activity className="w-3 h-3" /> {hConfig.label}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">v{health.version}</span>
        <span className="text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3 inline mr-1" />Uptime : {formatUptime(health.uptime_seconds)}
        </span>
      </div>

      {/* Métriques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-background rounded-md px-3 py-2 border border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
            <Cpu className="w-3 h-3" /> CPU
          </div>
          <div className={`text-sm font-semibold ${health.cpu_percent > 80 ? 'text-red-400' : health.cpu_percent > 60 ? 'text-yellow-400' : 'text-foreground'}`}>
            {health.cpu_percent}%
          </div>
        </div>
        <div className="bg-background rounded-md px-3 py-2 border border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
            <HardDrive className="w-3 h-3" /> Disque libre
          </div>
          <div className={`text-sm font-semibold ${health.disk_free_mb < 1000 ? 'text-red-400' : health.disk_free_mb < 5000 ? 'text-yellow-400' : 'text-foreground'}`}>
            {(health.disk_free_mb / 1024).toFixed(1)} GB
          </div>
        </div>
        <div className="bg-background rounded-md px-3 py-2 border border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
            <Zap className="w-3 h-3" /> Sessions actives
          </div>
          <div className="text-sm font-semibold text-foreground">{health.active_sessions}</div>
        </div>
        <div className="bg-background rounded-md px-3 py-2 border border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-0.5">
            <Activity className="w-3 h-3" /> Captures totales
          </div>
          <div className="text-sm font-semibold text-foreground">{health.total_captures}</div>
        </div>
      </div>

      {/* Interfaces */}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Interfaces réseau</p>
        <div className="flex flex-wrap gap-1.5">
          {health.interfaces.map((iface: any) => (
            <span key={iface.name}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${
                iface.up
                  ? iface.promisc
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
              <Globe className="w-2.5 h-2.5" />
              {iface.name}
              {iface.speed_mbps && <span className="text-muted-foreground">({iface.speed_mbps}Mbps)</span>}
              {iface.promisc && <span className="text-primary font-medium">PROMISC</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Dernière erreur */}
      {health.last_error && (
        <div className="flex items-start gap-2 bg-destructive/5 border border-destructive/20 rounded-md p-2.5">
          <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive">{health.last_error}</p>
        </div>
      )}
    </div>
  );
}

// ─── Test Capture Button ────────────────────────────────────────────────

function TestCaptureButton({ probeId, interfaces }: { probeId: string; interfaces?: string[] }) {
  const [iface, setIface] = useState(interfaces?.[0] || 'eth0');
  const testMutation = useTestProbeCapture();

  const handleTest = () => {
    testMutation.mutate({ probeId, iface }, {
      onSuccess: (result: any) => {
        if (result.success) {
          toast.success(`Test capture réussi : ${result.packets_captured} paquets, ${formatBytes(result.bytes_captured)} en ${result.duration_sec}s`);
        } else {
          toast.error(`Test capture échoué : ${result.error_message || result.reason_code}`);
        }
      },
      onError: () => {
        toast.error('Erreur lors du test de capture');
      },
    });
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <select value={iface} onChange={(e) => setIface(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
        {(interfaces && interfaces.length > 0 ? interfaces : ['eth0', 'mirror0']).map(i => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
      <button onClick={handleTest} disabled={testMutation.isPending}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors">
        {testMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
        Test capture (30s)
      </button>
      {testMutation.data && (
        <span className={`text-xs ${testMutation.data.success ? 'text-green-400' : 'text-red-400'}`}>
          {testMutation.data.success
            ? `${testMutation.data.packets_captured} paquets`
            : testMutation.data.reason_code || 'Échec'}
        </span>
      )}
    </div>
  );
}

// ─── Create Probe Modal ─────────────────────────────────────────────────

function CreateProbeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [probeId, setProbeId] = useState('');
  const [site, setSite] = useState('');
  const [zone, setZone] = useState('');
  const [type, setType] = useState<ProbeType>('LINUX_EDGE');
  const [capabilities, setCapabilities] = useState<ProbeCapability[]>(['PCAP']);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useCreateProbe();

  const toggleCap = (cap: ProbeCapability) => {
    setCapabilities(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!probeId.trim() || !site.trim() || !zone.trim()) {
      setError('Tous les champs sont requis.');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        probe_id: probeId.trim(),
        site: site.trim(),
        zone: zone.trim(),
        type,
        capabilities,
      });
      setCreatedToken((result as unknown as { auth_token: string }).auth_token || null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Erreur lors de la création.');
    }
  };

  const handleCopy = () => {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setProbeId(''); setSite(''); setZone(''); setType('LINUX_EDGE');
    setCapabilities(['PCAP']); setCreatedToken(null); setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            {createdToken ? 'Sonde créée' : 'Nouvelle sonde'}
          </h2>
          <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdToken ? (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-green-500/5 border border-green-500/20 rounded-md p-4">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-green-400" />
                <p className="text-sm font-medium text-green-400">Token d'authentification (X-PROBE-TOKEN)</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Copiez ce token maintenant. Il ne sera plus affiché. Configurez-le dans la variable <code className="text-primary">PROBE_AUTH_TOKEN</code> de l'agent.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background rounded px-3 py-2 text-xs font-mono text-foreground break-all">
                  {createdToken}
                </code>
                <button onClick={handleCopy}
                  className="shrink-0 text-muted-foreground hover:text-foreground p-2">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
              <p className="text-xs text-muted-foreground">
                <Shield className="w-3 h-3 inline mr-1 text-primary" />
                La sonde doit envoyer ce token dans le header <code className="text-primary">X-PROBE-TOKEN</code> pour s'authentifier.
                Configurez également les CIDR autorisés dans les paramètres de la sonde.
              </p>
            </div>
            <button onClick={handleClose}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Identifiant de la sonde *</label>
              <input type="text" value={probeId} onChange={(e) => setProbeId(e.target.value)}
                placeholder="probe-abj-dc1-01"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Site *</label>
                <input type="text" value={site} onChange={(e) => setSite(e.target.value)}
                  placeholder="Abidjan"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Zone *</label>
                <input type="text" value={zone} onChange={(e) => setZone(e.target.value)}
                  placeholder="DC-1"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type de sonde</label>
              <select value={type} onChange={(e) => setType(e.target.value as ProbeType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                <option value="LINUX_EDGE">Linux Edge</option>
                <option value="K8S_CLUSTER">Kubernetes Cluster</option>
                <option value="NETWORK_TAP">Network TAP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Capacités</label>
              <div className="flex gap-3">
                {(['PCAP', 'LOGS'] as ProbeCapability[]).map(cap => (
                  <label key={cap} className="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={capabilities.includes(cap)}
                      onChange={() => toggleCap(cap)}
                      className="rounded border-input" />
                    <span className="text-sm text-foreground">{cap}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={handleClose}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Créer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Probe Card ─────────────────────────────────────────────────────────

function ProbeCard({ probe, canManage }: { probe: Probe; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const deleteMutation = useDeleteProbe();
  const regenerateMutation = useRegenerateProbeToken();
  const heartbeatMutation = useProbeHeartbeat();

  const status = probeStatusConfig[probe.status];
  const StatusIcon = status.icon;

  const handleSimulateHeartbeat = () => {
    heartbeatMutation.mutate({
      probeId: probe.probe_id,
      payload: {
        status: 'healthy',
        version: probe.version || '1.2.0',
        cpu_percent: Math.floor(Math.random() * 40) + 5,
        disk_free_mb: Math.floor(Math.random() * 50000) + 10000,
        interfaces: ['eth0', 'mirror0', 'bond0'],
        active_sessions: 0,
      },
    }, {
      onSuccess: () => toast.success(`Heartbeat simulé pour ${probe.probe_id} — sonde en ligne`),
      onError: () => toast.error('Erreur lors du heartbeat'),
    });
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground font-mono">{probe.probe_id}</h3>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.cls}`}>
                <StatusIcon className="w-3 h-3" /> {status.label}
              </span>
              {probe.version && (
                <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                  v{probe.version}
                </span>
              )}
              {probe.tls_enabled && (
                <span className="text-[10px] text-green-400 font-medium bg-green-500/10 px-1.5 py-0.5 rounded">
                  <Shield className="w-2.5 h-2.5 inline mr-0.5" />TLS
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <Server className="w-3 h-3 inline mr-1" />
              {probe.site} / {probe.zone} — {probeTypeLabels[probe.type]} — {probe.capabilities.join(', ')}
            </p>
            {probe.last_seen_at && (
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                <Clock className="w-2.5 h-2.5 inline mr-1" />
                Vu : {new Date(probe.last_seen_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}
                {probe.uptime_seconds != null && probe.uptime_seconds > 0 && (
                  <span className="ml-2">Uptime : {formatUptime(probe.uptime_seconds)}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canManage && (
            <>
              <button onClick={handleSimulateHeartbeat}
                disabled={heartbeatMutation.isPending}
                className="text-muted-foreground hover:text-green-400 p-1.5 transition-colors" title="Simuler heartbeat (online)">
                <Activity className={`w-4 h-4 ${heartbeatMutation.isPending ? 'animate-pulse' : ''}`} />
              </button>
              <button onClick={() => regenerateMutation.mutate(probe.probe_id)}
                className="text-muted-foreground hover:text-primary p-1.5 transition-colors" title="Régénérer le token">
                <RefreshCw className={`w-4 h-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => {
                if (confirm(`Supprimer la sonde ${probe.probe_id} ?`)) {
                  deleteMutation.mutate(probe.probe_id);
                }
              }}
                className="text-muted-foreground hover:text-destructive p-1.5 transition-colors" title="Supprimer">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-1.5 transition-colors" title="Diagnostics">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded diagnostics */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-border pt-3">
          <ProbeHealthPanel probeId={probe.probe_id} />
          {canManage && probe.status === 'ONLINE' && (
            <TestCaptureButton probeId={probe.probe_id} interfaces={probe.interfaces} />
          )}
          {probe.status !== 'ONLINE' && (
            <div className="mt-3 flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-md p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-yellow-400">
                <p className="font-medium mb-0.5">Sonde hors ligne</p>
                <p className="text-muted-foreground">
                  Cliquez sur <Activity className="w-3 h-3 inline" /> pour simuler un heartbeat et mettre la sonde en ligne,
                  ou vérifiez la connectivité réseau de l'agent probe.
                </p>
              </div>
            </div>
          )}
          {/* Sécurité */}
          <div className="mt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Sécurité</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>
                <Shield className="w-3 h-3 inline mr-1" />
                Auth : {probe.auth_token_hash ? 'Token configuré' : 'Aucun token'}
              </span>
              <span>
                <Globe className="w-3 h-3 inline mr-1" />
                CIDR : {(probe.allowlist_cidrs || ['0.0.0.0/0']).join(', ')}
              </span>
              <span>
                TLS : {probe.tls_enabled ? 'Activé' : 'Désactivé'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function ProbesPage() {
  const { canWrite } = useAuth();
  const { can } = usePermission();
  const canManageProbes = can(PermissionKey.EXECUTIONS_RUN);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useProbes({
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const probes = (data?.data || []) as Probe[];
  const filtered = search
    ? probes.filter(p => p.probe_id.toLowerCase().includes(search.toLowerCase()) || p.site.toLowerCase().includes(search.toLowerCase()))
    : probes;

  const onlineCount = probes.filter(p => p.status === 'ONLINE').length;
  const offlineCount = probes.filter(p => p.status === 'OFFLINE').length;
  const degradedCount = probes.filter(p => p.status === 'DEGRADED').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Sondes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les sondes de collecte déployées sur vos sites. Diagnostics, test capture et monitoring.
          </p>
        </div>
        {canManageProbes && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle sonde
          </button>
        )}
      </div>

      {/* Stats */}
      {probes.length > 0 && (
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">{probes.length} sonde{probes.length > 1 ? 's' : ''}</span>
          <span className="text-green-400">{onlineCount} en ligne</span>
          {degradedCount > 0 && <span className="text-yellow-400">{degradedCount} dégradé{degradedCount > 1 ? 'es' : ''}</span>}
          {offlineCount > 0 && <span className="text-gray-400">{offlineCount} hors ligne</span>}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une sonde..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les statuts</option>
          <option value="ONLINE">En ligne</option>
          <option value="OFFLINE">Hors ligne</option>
          <option value="DEGRADED">Dégradé</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Radio className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune sonde</h3>
          <p className="text-sm text-muted-foreground mb-4">Enregistrez une sonde pour commencer la collecte.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((probe) => (
            <ProbeCard key={probe.probe_id} probe={probe} canManage={canManageProbes} />
          ))}
        </div>
      )}

      <CreateProbeModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
