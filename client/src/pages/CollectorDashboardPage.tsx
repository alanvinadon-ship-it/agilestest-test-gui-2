/**
 * CollectorDashboardPage — Real-time monitoring of collector sessions.
 * Shows: KPI cards, status breakdown, active sessions table, stale alerts, recent events feed, events per probe chart.
 */
import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Activity, Radio, AlertTriangle, Zap, Clock, Server,
  RefreshCw, Loader2, ChevronDown, ChevronRight,
  Wifi, WifiOff, Pause, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Status metadata ────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Activity }> = {
  RUNNING:  { label: 'En cours',   color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: Activity },
  QUEUED:   { label: 'En attente', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  STOPPED:  { label: 'Arrêtée',    color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: Pause },
  FAILED:   { label: 'Échouée',    color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertTriangle },
};

const EVENT_LEVEL_COLOR: Record<string, string> = {
  INFO:  'text-sky-400',
  WARN:  'text-amber-400',
  ERROR: 'text-red-400',
};

function timeAgo(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}j`;
}

export default function CollectorDashboardPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = trpc.collector.dashboard.useQuery(
    {},
    {
      refetchInterval: autoRefresh ? 10_000 : false,
      staleTime: 5_000,
    },
  );

  // Session events (expanded)
  const { data: sessionEvents } = trpc.collector.listEvents.useQuery(
    { sessionUid: expandedSession ?? '', pageSize: 20 },
    { enabled: !!expandedSession },
  );

  const statusMap = useMemo(() => {
    const map: Record<string, number> = { RUNNING: 0, QUEUED: 0, STOPPED: 0, FAILED: 0 };
    data?.statusBreakdown?.forEach(r => { map[r.status] = r.count; });
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Collector Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoring temps réel des sessions de collecte
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
              autoRefresh
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : 'border-border bg-secondary/30 text-muted-foreground'
            }`}
          >
            <Wifi className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-secondary/30 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Rafraîchir
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Server className="w-5 h-5 text-primary" />}
          label="Sessions totales"
          value={data?.totals.sessions ?? 0}
        />
        <KpiCard
          icon={<Activity className="w-5 h-5 text-green-400" />}
          label="Sessions actives"
          value={data?.totals.active ?? 0}
          accent="green"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
          label="Sessions stale"
          value={data?.totals.stale ?? 0}
          accent={data?.totals.stale ? 'amber' : undefined}
        />
        <KpiCard
          icon={<Zap className="w-5 h-5 text-sky-400" />}
          label="Événements totaux"
          value={data?.totals.events ?? 0}
        />
      </div>

      {/* Status Breakdown */}
      <div className="bg-card/50 border border-border rounded-lg p-4">
        <h2 className="text-sm font-heading font-semibold text-foreground mb-3">Répartition par statut</h2>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(statusMap).map(([status, count]) => {
            const meta = STATUS_META[status] || STATUS_META.STOPPED;
            const Icon = meta.icon;
            return (
              <div key={status} className={`flex items-center gap-2 px-3 py-2 rounded-md border ${meta.color}`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{count}</span>
                <span className="text-xs opacity-80">{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stale Sessions Alert */}
      {data?.staleSessions && data.staleSessions.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-heading font-semibold text-amber-400">
              Sessions sans heartbeat ({data.staleSessions.length})
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Ces sessions n'ont pas reçu de heartbeat depuis plus de 5 minutes.
          </p>
          <div className="space-y-1">
            {data.staleSessions.map(s => (
              <div key={s.sessionUid} className="flex items-center gap-3 text-xs bg-amber-500/5 rounded px-3 py-2">
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono text-foreground">{s.sessionUid.slice(0, 8)}...</span>
                <span className="text-muted-foreground">Sonde: {s.probeName ?? `#${s.probeId}`}</span>
                <span className="text-muted-foreground">Capture: {s.captureName ?? `#${s.captureId}`}</span>
                <span className="text-amber-400 ml-auto">
                  Dernier heartbeat: {timeAgo(s.lastHeartbeatAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions Table */}
      <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-heading font-semibold text-foreground">
            Sessions actives ({data?.activeSessions?.length ?? 0})
          </h2>
        </div>
        {(!data?.activeSessions || data.activeSessions.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Pause className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Aucune session active.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.activeSessions.map(session => {
              const isExpanded = expandedSession === session.sessionUid;
              const isStale = data.staleSessions?.some(s => s.sessionUid === session.sessionUid);
              const meta = STATUS_META[session.status] || STATUS_META.RUNNING;
              const Icon = meta.icon;

              return (
                <div key={session.sessionUid}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                    onClick={() => setExpandedSession(isExpanded ? null : session.sessionUid)}
                  >
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    }

                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${meta.color}`}>
                      <Icon className="w-3 h-3" />{meta.label}
                    </span>

                    {isStale && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/20">
                        <WifiOff className="w-3 h-3" />STALE
                      </span>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-foreground truncate">
                          {session.sessionUid.slice(0, 12)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span>Sonde: <span className="text-foreground/80">{session.probeName ?? `#${session.probeId}`}</span></span>
                        <span>Capture: <span className="text-foreground/80">{session.captureName ?? `#${session.captureId}`}</span></span>
                        <span>Démarré: {timeAgo(session.startedAt)}</span>
                        <span>Heartbeat: {timeAgo(session.lastHeartbeatAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: session events */}
                  {isExpanded && (
                    <div className="border-t border-border bg-black/10 px-4 py-3">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2">Événements récents</h3>
                      {!sessionEvents?.data || sessionEvents.data.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucun événement.</p>
                      ) : (
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                          {sessionEvents.data.map(evt => (
                            <div key={evt.id} className="flex items-center gap-2 text-[11px]">
                              <span className={`font-semibold ${EVENT_LEVEL_COLOR[evt.level] || 'text-slate-400'}`}>
                                {evt.level}
                              </span>
                              <span className="text-muted-foreground font-mono">{evt.eventType}</span>
                              <span className="text-foreground/80 truncate flex-1">{evt.message}</span>
                              <span className="text-muted-foreground shrink-0">
                                {evt.createdAt ? new Date(evt.createdAt).toLocaleTimeString('fr-FR') : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Events per Probe (last 24h) */}
      {data?.eventsPerProbe && data.eventsPerProbe.length > 0 && (
        <div className="bg-card/50 border border-border rounded-lg p-4">
          <h2 className="text-sm font-heading font-semibold text-foreground mb-3">
            Événements par sonde (24h)
          </h2>
          <div className="space-y-2">
            {data.eventsPerProbe.map((probe, idx) => {
              const maxCount = data.eventsPerProbe[0]?.eventCount || 1;
              const pct = Math.max(5, (probe.eventCount / maxCount) * 100);
              return (
                <div key={probe.probeId ?? idx} className="flex items-center gap-3">
                  <Radio className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-xs text-foreground w-32 truncate">
                    {probe.probeName ?? `Sonde #${probe.probeId}`}
                  </span>
                  <div className="flex-1 h-5 bg-secondary/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                    {probe.eventCount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Events Feed */}
      <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-heading font-semibold text-foreground">
            Flux d'événements récents
          </h2>
        </div>
        {(!data?.recentEvents || data.recentEvents.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Zap className="w-6 h-6 mb-2 opacity-30" />
            <p className="text-xs">Aucun événement récent.</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {data.recentEvents.map(evt => (
              <div key={evt.eventId} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className={`font-semibold w-10 ${EVENT_LEVEL_COLOR[evt.level] || 'text-slate-400'}`}>
                  {evt.level}
                </span>
                <span className="font-mono text-muted-foreground w-16">{evt.eventType}</span>
                <span className="text-foreground/80 flex-1 truncate">{evt.message}</span>
                <span className="text-muted-foreground shrink-0 font-mono">
                  {evt.createdAt ? new Date(evt.createdAt).toLocaleTimeString('fr-FR') : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* In-memory metrics */}
      <div className="bg-card/50 border border-border rounded-lg p-4">
        <h2 className="text-sm font-heading font-semibold text-foreground mb-3">Métriques serveur (in-memory)</h2>
        <div className="flex gap-6 text-xs">
          <div>
            <span className="text-muted-foreground">Sessions démarrées: </span>
            <span className="font-mono text-foreground">{data?.metrics?.sessionsStarted ?? 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Heartbeats reçus: </span>
            <span className="font-mono text-foreground">{data?.metrics?.heartbeats ?? 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Événements ajoutés: </span>
            <span className="font-mono text-foreground">{data?.metrics?.events ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: 'green' | 'amber' | 'red';
}) {
  const accentBorder = accent === 'green' ? 'border-green-500/20' : accent === 'amber' ? 'border-amber-500/20' : accent === 'red' ? 'border-red-500/20' : 'border-border';
  return (
    <div className={`bg-card/50 border ${accentBorder} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-heading font-bold text-foreground">{value}</span>
    </div>
  );
}
