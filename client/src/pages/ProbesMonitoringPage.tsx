/**
 * ProbesMonitoringPage — Dashboard temps réel des sondes
 * Grille de cards avec indicateurs GREEN/ORANGE/RED, auto-refresh 10-15s.
 */
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Radio, Search, Loader2, Wifi, WifiOff, AlertTriangle,
  Server, Clock, Activity, RefreshCw, LayoutGrid, List,
} from 'lucide-react';
import { uiGet, uiSet } from '@/lib/uiStorage';

type ProbeType = 'LINUX_EDGE' | 'K8S_CLUSTER' | 'NETWORK_TAP';
type HealthStatus = 'GREEN' | 'ORANGE' | 'RED';

const healthConfig: Record<HealthStatus, { label: string; bg: string; border: string; dot: string; text: string }> = {
  GREEN:  { label: 'Sain',    bg: 'bg-green-500/5',  border: 'border-green-500/30', dot: 'bg-green-400',  text: 'text-green-400' },
  ORANGE: { label: 'Dégradé', bg: 'bg-yellow-500/5', border: 'border-yellow-500/30', dot: 'bg-yellow-400', text: 'text-yellow-400' },
  RED:    { label: 'Critique', bg: 'bg-red-500/5',    border: 'border-red-500/30', dot: 'bg-red-400',    text: 'text-red-400' },
};

const probeTypeLabels: Record<ProbeType, string> = {
  LINUX_EDGE:  'Linux Edge',
  K8S_CLUSTER: 'K8s Cluster',
  NETWORK_TAP: 'Network TAP',
};

const REFRESH_INTERVAL = 12_000; // 12s

function ProbeMonitorCard({ probe }: { probe: any }) {
  const health = healthConfig[probe.health as HealthStatus] || healthConfig.RED;

  return (
    <div className={`rounded-lg border ${health.border} ${health.bg} p-4 transition-all hover:shadow-md`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full ${health.dot} shrink-0 animate-pulse`} />
          <h3 className="text-sm font-semibold text-foreground truncate">{probe.name}</h3>
        </div>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${health.bg} ${health.text} border ${health.border}`}>
          {health.label}
        </span>
      </div>

      {/* Info */}
      <div className="space-y-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3 h-3 shrink-0" />
          <span className="font-mono">{probeTypeLabels[probe.probeType as ProbeType] || probe.probeType}</span>
        </div>
        {probe.host && (
          <div className="flex items-center gap-1.5">
            <Server className="w-3 h-3 shrink-0" />
            <span className="font-mono truncate">{probe.host}{probe.port ? `:${probe.port}` : ''}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {probe.status === 'ONLINE' ? (
            <Wifi className="w-3 h-3 text-green-400 shrink-0" />
          ) : probe.status === 'DEGRADED' ? (
            <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
          ) : (
            <WifiOff className="w-3 h-3 text-gray-400 shrink-0" />
          )}
          <span>{probe.status}</span>
        </div>
        {probe.lastSeenAt && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 shrink-0" />
            <span>{new Date(probe.lastSeenAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}</span>
          </div>
        )}
      </div>

      {/* ID */}
      <div className="mt-3 pt-2 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground font-mono">ID: #{probe.id}</span>
      </div>
    </div>
  );
}

function ProbeMonitorRow({ probe }: { probe: any }) {
  const health = healthConfig[probe.health as HealthStatus] || healthConfig.RED;

  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${health.dot} shrink-0`} />
          <span className={`text-xs font-medium ${health.text}`}>{health.label}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-foreground">{probe.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
          {probeTypeLabels[probe.probeType as ProbeType] || probe.probeType}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {probe.host ? `${probe.host}${probe.port ? `:${probe.port}` : ''}` : '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${
          probe.status === 'ONLINE' ? 'text-green-400' :
          probe.status === 'DEGRADED' ? 'text-yellow-400' : 'text-gray-400'
        }`}>{probe.status}</span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {probe.lastSeenAt
          ? new Date(probe.lastSeenAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
          : '—'}
      </td>
    </tr>
  );
}

export default function ProbesMonitoringPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>(() => {
    return uiGet('probesMonitorView');
  });

  const { data, isLoading, isFetching, dataUpdatedAt } = trpc.probes.monitoring.useQuery(
    {
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(typeFilter ? { probeType: typeFilter as ProbeType } : {}),
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    {
      refetchInterval: REFRESH_INTERVAL,
      refetchIntervalInBackground: false,
    },
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const stats = useMemo(() => {
    const green = items.filter((p: any) => p.health === 'GREEN').length;
    const orange = items.filter((p: any) => p.health === 'ORANGE').length;
    const red = items.filter((p: any) => p.health === 'RED').length;
    return { green, orange, red };
  }, [items]);

  const toggleView = (mode: 'grid' | 'compact') => {
    setViewMode(mode);
    uiSet('probesMonitorView', mode);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Monitoring Sondes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Surveillance temps réel des sondes de collecte. Rafraîchissement automatique toutes les {REFRESH_INTERVAL / 1000}s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          {dataUpdatedAt > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">
              MAJ: {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR')}
            </span>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {total > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 text-xs">
            <span className="text-muted-foreground font-medium">{total} sonde{total > 1 ? 's' : ''}</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 font-medium">{stats.green} sain{stats.green > 1 ? 'es' : 'e'}</span>
            </span>
            {stats.orange > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-yellow-400 font-medium">{stats.orange} dégradé{stats.orange > 1 ? 'es' : 'e'}</span>
              </span>
            )}
            {stats.red > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400 font-medium">{stats.red} critique{stats.red > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters + view toggle */}
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
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les types</option>
          <option value="LINUX_EDGE">Linux Edge</option>
          <option value="K8S_CLUSTER">K8s Cluster</option>
          <option value="NETWORK_TAP">Network TAP</option>
        </select>
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button onClick={() => toggleView('grid')}
            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Vue grille">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => toggleView('compact')}
            className={`p-2 transition-colors ${viewMode === 'compact' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            title="Vue compacte">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Radio className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune sonde</h3>
          <p className="text-sm text-muted-foreground">Enregistrez des sondes depuis la page Sondes pour les voir ici.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map((probe: any) => (
            <ProbeMonitorCard key={probe.id} probe={probe} />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Santé</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Host</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Dernier contact</th>
              </tr>
            </thead>
            <tbody>
              {items.map((probe: any) => (
                <ProbeMonitorRow key={probe.id} probe={probe} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] text-muted-foreground border-t border-border pt-3">
        <span className="font-medium uppercase tracking-wider">Légende :</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400" /> Sain (heartbeat &lt; 60s)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-yellow-400" /> Dégradé (heartbeat 60-300s)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Critique (heartbeat &gt; 300s ou hors ligne)
        </span>
      </div>
    </div>
  );
}
