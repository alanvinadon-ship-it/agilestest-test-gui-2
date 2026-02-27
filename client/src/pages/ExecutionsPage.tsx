/**
 * ExecutionsPage — Run Center
 * Données réelles via tRPC (MySQL) — branchement direct sur le backend.
 * Boutons Analyser IA + Parser JMeter intégrés.
 */
import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { PermissionKey } from '../admin/permissions';
import { trpc } from '@/lib/trpc';
import { Link } from 'wouter';
import type { ExecutionStatus, TargetEnv } from '../types';
import {
  Play, Loader2, Search, Eye,
  CheckCircle2, XCircle, Clock, AlertTriangle, Ban,
  Sparkles, Brain, FileCode, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

const statusConfig: Record<ExecutionStatus, { icon: typeof CheckCircle2; label: string; cls: string }> = {
  PENDING: { icon: Clock, label: 'En attente', cls: 'text-yellow-400' },
  RUNNING: { icon: Activity, label: 'En cours', cls: 'text-blue-400' },
  PASSED: { icon: CheckCircle2, label: 'Réussi', cls: 'text-green-400' },
  FAILED: { icon: XCircle, label: 'Échoué', cls: 'text-red-400' },
  ERROR: { icon: AlertTriangle, label: 'Erreur', cls: 'text-orange-400' },
  CANCELLED: { icon: Ban, label: 'Annulé', cls: 'text-gray-400' },
};

const ENV_META: Record<TargetEnv, { label: string; color: string }> = {
  DEV:          { label: 'DEV',          color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  PROD:         { label: 'PROD',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

// ─── Job Status Badge ────────────────────────────────────────────────────
const jobStatusStyles: Record<string, { label: string; cls: string }> = {
  QUEUED:    { label: 'En file', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  RUNNING:   { label: 'Analyse...', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  COMPLETED: { label: 'Terminé', cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  FAILED:    { label: 'Échoué', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

function JobStatusBadge({ executionId }: { executionId: number }) {
  const { data: jobs } = trpc.jobs.listByRun.useQuery(
    { runId: executionId },
    { refetchInterval: (query) => {
      const items = query.state.data;
      if (!items || !Array.isArray(items)) return false;
      const hasActive = items.some((j: any) => j.status === 'QUEUED' || j.status === 'RUNNING');
      return hasActive ? 5000 : false;
    }},
  );

  if (!jobs || jobs.length === 0) return null;

  // Show latest job status
  const latest = jobs[0];
  const style = jobStatusStyles[latest.status] || jobStatusStyles.QUEUED;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${style.cls}`}>
      {latest.status === 'RUNNING' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {latest.name === 'aiAnalyzeRun' ? <Brain className="w-2.5 h-2.5" /> : <FileCode className="w-2.5 h-2.5" />}
      {style.label}
    </span>
  );
}

// ─── Action Buttons (Analyser IA / Parser JTL) ──────────────────────────
function ExecutionActions({ executionId, status }: { executionId: number; status: string }) {
  const utils = trpc.useUtils();
  const { can } = usePermission();
  const canAnalyze = can(PermissionKey.EXECUTIONS_RUN); // QA_MANAGER or TEST_ENGINEER

  const enqueueAi = trpc.jobs.enqueueAiAnalysis.useMutation({
    onSuccess: (data) => {
      toast.success('Analyse IA lancée');
      utils.jobs.listByRun.invalidate({ runId: executionId });
    },
    onError: (err) => toast.error(err.message),
  });

  const enqueueJtl = trpc.jobs.enqueueParseJtl.useMutation({
    onSuccess: () => {
      toast.success('Parsing JTL lancé');
      utils.jobs.listByRun.invalidate({ runId: executionId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (!canAnalyze) return null;

  const isTerminal = ['PASSED', 'FAILED', 'ERROR'].includes(status);
  if (!isTerminal) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); enqueueAi.mutate({ runId: executionId }); }}
        disabled={enqueueAi.isPending}
        title="Analyser avec IA"
        className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-1.5 py-0.5 rounded border border-violet-500/20 transition-colors disabled:opacity-50"
      >
        {enqueueAi.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
        IA
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); enqueueJtl.mutate({ runId: executionId, artifactId: 0 }); }}
        disabled={enqueueJtl.isPending}
        title="Parser les résultats JMeter"
        className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/20 transition-colors disabled:opacity-50"
      >
        {enqueueJtl.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <FileCode className="w-2.5 h-2.5" />}
        JTL
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ExecutionsPage() {
  const { currentProject } = useProject();
  const { can: canPerm } = usePermission();
  const canRunExecution = canPerm(PermissionKey.EXECUTIONS_RUN);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [scenarioFilter, setScenarioFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const EXEC_PAGE_SIZE = 30;
  const [execCursor, setExecCursor] = useState<number | undefined>(undefined);
  const [allExecItems, setAllExecItems] = useState<any[]>([]);

  // Fetch scenarios for filter dropdown
  const { data: scenariosData } = trpc.scenarios.list.useQuery(
    { projectId: String(currentProject?.id || ''), page: 1, pageSize: 100 },
    { enabled: !!currentProject },
  );
  const scenariosList = scenariosData?.data ?? [];

  const { data, isLoading, isFetching } = trpc.executions.list.useQuery(
    {
      projectId: String(currentProject?.id || ''),
      page: 1,
      pageSize: EXEC_PAGE_SIZE,
      cursor: execCursor,
      ...(statusFilter ? { status: statusFilter as ExecutionStatus } : {}),
      ...(scenarioFilter ? { scenarioId: String(scenarioFilter) } : {}),
    },
    {
      enabled: !!currentProject,
      refetchInterval: 15000,
    },
  );

  // Accumulate execution items as cursor changes
  useEffect(() => {
    if (data?.data) {
      if (execCursor === undefined) {
        setAllExecItems(data.data);
      } else {
        setAllExecItems(prev => {
          const ids = new Set(prev.map((r: any) => r.id));
          const fresh = data.data.filter((r: any) => !ids.has(r.id));
          return [...prev, ...fresh];
        });
      }
    }
  }, [data, execCursor]);

  // Reset accumulator when filters change
  useEffect(() => {
    setExecCursor(undefined);
    setAllExecItems([]);
  }, [statusFilter, scenarioFilter, currentProject?.id]);

  const execHasMore = data?.hasMore ?? false;
  const execNextCursor = data?.nextCursor;
  const executions = allExecItems;
  const pagination = data?.pagination;

  const filteredExecutions = useMemo(() => {
    if (!search.trim()) return executions;
    const q = search.toLowerCase();
    return executions.filter((e: any) =>
      String(e.id).includes(q) ||
      String(e.scenarioId || '').toLowerCase().includes(q) ||
      (e.scriptId || '').toLowerCase().includes(q) ||
      (e.targetEnv || '').toLowerCase().includes(q)
    );
  }, [executions, search]);

  // Create execution mutation
  const utils = trpc.useUtils();
  const createExecution = trpc.executions.create.useMutation({
    onSuccess: () => {
      toast.success('Exécution créée');
      utils.executions.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour voir ses exécutions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Play className="w-6 h-6 text-primary" />
            Run Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lancez et suivez les exécutions de test pour <strong className="text-foreground">{currentProject.name}</strong>.
          </p>
        </div>
        {canRunExecution && (
          <button
            onClick={() => {
              createExecution.mutate({
                projectId: String(currentProject.id),
                targetEnv: 'DEV',
              });
            }}
            disabled={createExecution.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createExecution.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Nouvelle exécution
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (ID, scénario, script, env)..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="RUNNING">En cours</option>
          <option value="PASSED">Réussi</option>
          <option value="FAILED">Échoué</option>
          <option value="ERROR">Erreur</option>
          <option value="CANCELLED">Annulé</option>
        </select>
        <select value={scenarioFilter} onChange={(e) => { setScenarioFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 max-w-[200px] truncate">
          <option value="">Tous les scénarios</option>
          {scenariosList.map((sc: any) => (
            <option key={sc.id} value={String(sc.id)}>{sc.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredExecutions.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune exécution</h3>
          <p className="text-sm text-muted-foreground mb-4">Lancez votre première exécution de test.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Env</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Script</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Durée</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Incidents</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Jobs</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExecutions.map((exec: any) => {
                const config = statusConfig[exec.status as ExecutionStatus];
                const StatusIcon = config?.icon || Clock;
                const envMeta = exec.targetEnv ? ENV_META[exec.targetEnv as TargetEnv] : null;

                return (
                  <tr key={exec.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config?.cls || 'text-gray-400'}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${exec.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                        {config?.label || exec.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {envMeta ? (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${envMeta.color}`}>
                          {envMeta.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {exec.scriptId ? (
                        <span className="text-xs font-mono text-foreground">
                          v{exec.scriptVersion || '?'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDuration(exec.durationMs)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs ${exec.incidentsCount > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {exec.incidentsCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {exec.startedAt ? new Date(exec.startedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 
                       exec.createdAt ? new Date(exec.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge executionId={exec.id} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ExecutionActions executionId={exec.id} status={exec.status} />
                        <Link href={`/executions/${exec.id}`}>
                          <span className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium cursor-pointer">
                            <Eye className="w-3.5 h-3.5" /> Détails
                          </span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Charger plus */}
          {execHasMore && (
            <div className="flex justify-center py-3 border-t border-border">
              <button
                onClick={() => execNextCursor && setExecCursor(execNextCursor)}
                disabled={isFetching}
                className="rounded-md border border-border px-4 py-1.5 text-xs text-foreground hover:bg-secondary disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {isFetching && <Loader2 className="w-3 h-3 animate-spin" />}
                Charger plus
              </button>
            </div>
          )}
          {pagination && (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              {executions.length} exécution(s) affichée(s) sur {pagination.total}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
