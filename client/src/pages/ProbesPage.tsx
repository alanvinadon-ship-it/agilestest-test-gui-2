/**
 * ProbesPage — Gestion complète des sondes de collecte
 * Données réelles via tRPC (MySQL) — CRUD complet + liaison captures.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { usePermission, PermissionKey } from '../security';
import { trpc } from '@/lib/trpc';
import {
  Radio, Plus, Loader2, Trash2, X, AlertCircle, Search,
  Wifi, WifiOff, AlertTriangle, RefreshCw, Edit2, Save,
  Activity, Clock, ChevronDown, ChevronUp,
  Shield, Globe, Server, Network, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'wouter';

type ProbeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';
type ProbeType = 'LINUX_EDGE' | 'K8S_CLUSTER' | 'NETWORK_TAP';

const probeStatusConfig: Record<ProbeStatus, { icon: typeof Wifi; label: string; cls: string }> = {
  ONLINE:   { icon: Wifi,          label: 'En ligne',   cls: 'text-green-400' },
  OFFLINE:  { icon: WifiOff,       label: 'Hors ligne', cls: 'text-gray-400' },
  DEGRADED: { icon: AlertTriangle, label: 'Dégradé',    cls: 'text-yellow-400' },
};

const probeTypeLabels: Record<ProbeType, string> = {
  LINUX_EDGE:   'Linux Edge',
  K8S_CLUSTER:  'K8s Cluster',
  NETWORK_TAP:  'Network TAP',
};

// ─── Create Probe Modal ─────────────────────────────────────────────────

function CreateProbeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [probeType, setProbeType] = useState<ProbeType>('LINUX_EDGE');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.probes.create.useMutation({
    onSuccess: () => {
      toast.success('Sonde créée');
      utils.probes.list.invalidate();
      setName(''); setHost(''); setPort(''); setProbeType('LINUX_EDGE'); setError(null);
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Nom requis.'); return; }
    createMutation.mutate({
      name: name.trim(),
      probeType,
      host: host.trim() || undefined,
      port: port ? Number(port) : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-semibold text-foreground">Nouvelle sonde</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nom de la sonde *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="probe-paris-edge-01"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Type</label>
            <select value={probeType} onChange={(e) => setProbeType(e.target.value as ProbeType)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="LINUX_EDGE">Linux Edge</option>
              <option value="K8S_CLUSTER">K8s Cluster</option>
              <option value="NETWORK_TAP">Network TAP</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Host</label>
              <input type="text" value={host} onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.10"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Port</label>
              <input type="number" value={port} onChange={(e) => setPort(e.target.value)}
                placeholder="8443"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
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
      </div>
    </div>
  );
}

// ─── Edit Probe Inline ──────────────────────────────────────────────────

function EditProbeInline({ probe, onDone }: { probe: any; onDone: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(probe.name);
  const [host, setHost] = useState(probe.host || '');
  const [port, setPort] = useState(probe.port ? String(probe.port) : '');

  const updateMutation = trpc.probes.update.useMutation({
    onSuccess: () => {
      toast.success('Sonde mise à jour');
      utils.probes.list.invalidate();
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground w-40 focus:outline-none focus:ring-2 focus:ring-ring/30" />
      <input type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="host"
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground w-32 focus:outline-none focus:ring-2 focus:ring-ring/30" />
      <input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="port"
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground w-20 focus:outline-none focus:ring-2 focus:ring-ring/30" />
      <button onClick={() => updateMutation.mutate({
        probeId: probe.id,
        name: name.trim() || undefined,
        host: host.trim() || undefined,
        port: port ? Number(port) : undefined,
      })} disabled={updateMutation.isPending}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
        {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Sauver
      </button>
      <button onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Probe Card ─────────────────────────────────────────────────────────

function ProbeCard({ probe, canManage }: { probe: any; canManage: boolean }) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const deleteMutation = trpc.probes.delete.useMutation({
    onSuccess: () => {
      toast.success('Sonde supprimée');
      utils.probes.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.probes.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Statut mis à jour');
      utils.probes.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Fetch linked captures when expanded
  const { data: probeDetail } = trpc.probes.get.useQuery(
    { probeId: probe.id },
    { enabled: expanded },
  );

  const status = probeStatusConfig[probe.status as ProbeStatus] || probeStatusConfig.OFFLINE;
  const StatusIcon = status.icon;
  const typeLabel = probeTypeLabels[probe.probeType as ProbeType] || probe.probeType;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            {editing ? (
              <EditProbeInline probe={probe} onDone={() => setEditing(false)} />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">{probe.name}</h3>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${status.cls}`}>
                    <StatusIcon className="w-3 h-3" /> {status.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono bg-secondary px-1.5 py-0.5 rounded">
                    {typeLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {probe.host && (
                    <><Server className="w-3 h-3 inline mr-1" />{probe.host}{probe.port ? `:${probe.port}` : ''} — </>
                  )}
                  ID: #{probe.id}
                </p>
                {probe.lastSeenAt && (
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    <Clock className="w-2.5 h-2.5 inline mr-1" />
                    Vu : {new Date(probe.lastSeenAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canManage && !editing && (
            <>
              {/* Quick status toggle */}
              {probe.status !== 'ONLINE' && (
                <button onClick={() => updateStatusMutation.mutate({ probeId: probe.id, status: 'ONLINE' })}
                  disabled={updateStatusMutation.isPending}
                  className="text-muted-foreground hover:text-green-400 p-1.5 transition-colors" title="Mettre en ligne">
                  <Activity className={`w-4 h-4 ${updateStatusMutation.isPending ? 'animate-pulse' : ''}`} />
                </button>
              )}
              {probe.status === 'ONLINE' && (
                <button onClick={() => updateStatusMutation.mutate({ probeId: probe.id, status: 'OFFLINE' })}
                  disabled={updateStatusMutation.isPending}
                  className="text-muted-foreground hover:text-yellow-400 p-1.5 transition-colors" title="Mettre hors ligne">
                  <WifiOff className={`w-4 h-4 ${updateStatusMutation.isPending ? 'animate-pulse' : ''}`} />
                </button>
              )}
              <button onClick={() => setEditing(true)}
                className="text-muted-foreground hover:text-primary p-1.5 transition-colors" title="Modifier">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => {
                if (confirm(`Supprimer la sonde "${probe.name}" ?`)) {
                  deleteMutation.mutate({ probeId: probe.id });
                }
              }}
                className="text-muted-foreground hover:text-destructive p-1.5 transition-colors" title="Supprimer">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-1.5 transition-colors" title="Détails & captures">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded: config + linked captures */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-border pt-3 space-y-4">
          {/* Config JSON */}
          {probe.config && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Configuration</p>
              <pre className="text-xs text-muted-foreground bg-background rounded-md p-2 border border-border overflow-x-auto max-h-32">
                {typeof probe.config === 'string' ? probe.config : JSON.stringify(probe.config, null, 2)}
              </pre>
            </div>
          )}

          {/* Capabilities JSON */}
          {probe.capabilities && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Capacités</p>
              <pre className="text-xs text-muted-foreground bg-background rounded-md p-2 border border-border overflow-x-auto max-h-24">
                {typeof probe.capabilities === 'string' ? probe.capabilities : JSON.stringify(probe.capabilities, null, 2)}
              </pre>
            </div>
          )}

          {/* Linked captures */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Network className="w-3 h-3" /> Captures liées
            </p>
            {probeDetail?.captures && probeDetail.captures.length > 0 ? (
              <div className="space-y-1">
                {probeDetail.captures.map((cap: any) => (
                  <div key={cap.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 border border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground">#{cap.id}</span>
                      <span className="text-sm text-foreground">{cap.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{cap.captureType}</span>
                      <span className={`text-[10px] font-medium ${
                        cap.status === 'COMPLETED' ? 'text-green-400' :
                        cap.status === 'RUNNING' ? 'text-blue-400' :
                        cap.status === 'FAILED' ? 'text-red-400' : 'text-muted-foreground'
                      }`}>{cap.status}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {cap.createdAt ? new Date(cap.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Aucune capture liée à cette sonde.</p>
            )}
          </div>

          {/* Sonde hors ligne warning */}
          {probe.status !== 'ONLINE' && (
            <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-md p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-yellow-400">
                <p className="font-medium mb-0.5">Sonde hors ligne</p>
                <p className="text-muted-foreground">
                  Cliquez sur <Activity className="w-3 h-3 inline" /> pour mettre la sonde en ligne,
                  ou vérifiez la connectivité réseau de l'agent probe.
                </p>
              </div>
            </div>
          )}

          {/* Security info */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Informations</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              <span><Shield className="w-3 h-3 inline mr-1" />Type : {typeLabel}</span>
              <span><Globe className="w-3 h-3 inline mr-1" />Host : {probe.host || 'Non configuré'}</span>
              <span>Port : {probe.port || '—'}</span>
              <span>Créé : {new Date(probe.createdAt).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function ProbesPage() {
  const { can } = usePermission();
  const canManageProbes = can(PermissionKey.EXECUTIONS_RUN);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [cursorStack, setCursorStack] = useState<(number | undefined)[]>([undefined]);
  const pageSize = 30;
  const currentCursor = cursorStack[cursorStack.length - 1];

  const { data, isLoading, isFetching } = trpc.probes.list.useQuery(
    {
      page: 1,
      pageSize,
      cursor: currentCursor,
      ...(statusFilter ? { status: statusFilter as ProbeStatus } : {}),
      ...(typeFilter ? { probeType: typeFilter as ProbeType } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    },
    { refetchInterval: 15000 },
  );

  // Accumulate results across pages
  const [allProbes, setAllProbes] = useState<any[]>([]);
  useEffect(() => {
    if (data?.data) {
      if (cursorStack.length === 1) {
        setAllProbes(data.data);
      } else {
        setAllProbes(prev => {
          const ids = new Set(prev.map((p: any) => p.id));
          const newItems = data.data.filter((p: any) => !ids.has(p.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [data?.data, cursorStack.length]);

  // Reset on filter change
  const resetCursor = useCallback(() => {
    setCursorStack([undefined]);
    setAllProbes([]);
  }, []);

  const probes = allProbes;
  const pagination = data?.pagination;
  const hasMore = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor;

  const onlineCount = useMemo(() => probes.filter((p: any) => p.status === 'ONLINE').length, [probes]);
  const offlineCount = useMemo(() => probes.filter((p: any) => p.status === 'OFFLINE').length, [probes]);
  const degradedCount = useMemo(() => probes.filter((p: any) => p.status === 'DEGRADED').length, [probes]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Radio className="w-6 h-6 text-primary" />
            Sondes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les sondes de collecte déployées. Diagnostics, captures liées et monitoring.
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
          <span className="text-muted-foreground">{pagination?.total ?? probes.length} sonde{(pagination?.total ?? probes.length) > 1 ? 's' : ''}</span>
          <span className="text-green-400">{onlineCount} en ligne</span>
          {degradedCount > 0 && <span className="text-yellow-400">{degradedCount} dégradé{degradedCount > 1 ? 'es' : ''}</span>}
          {offlineCount > 0 && <span className="text-gray-400">{offlineCount} hors ligne</span>}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); resetCursor(); }}
            placeholder="Rechercher une sonde..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetCursor(); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les statuts</option>
          <option value="ONLINE">En ligne</option>
          <option value="OFFLINE">Hors ligne</option>
          <option value="DEGRADED">Dégradé</option>
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); resetCursor(); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les types</option>
          <option value="LINUX_EDGE">Linux Edge</option>
          <option value="K8S_CLUSTER">K8s Cluster</option>
          <option value="NETWORK_TAP">Network TAP</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : probes.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Radio className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune sonde</h3>
          <p className="text-sm text-muted-foreground mb-4">Enregistrez une sonde pour commencer la collecte.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {probes.map((probe: any) => (
            <ProbeCard key={probe.id} probe={probe} canManage={canManageProbes} />
          ))}
        </div>
      )}

      {/* Charger plus */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {probes.length}{pagination?.total ? ` / ${pagination.total}` : ''} sonde(s)
        </p>
        {hasMore && (
          <button
            onClick={() => { if (nextCursor) setCursorStack(prev => [...prev, nextCursor]); }}
            disabled={isFetching}
            className="rounded-md border border-border px-4 py-1.5 text-xs text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            {isFetching ? 'Chargement…' : 'Charger plus'}
          </button>
        )}
      </div>

      <CreateProbeModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
