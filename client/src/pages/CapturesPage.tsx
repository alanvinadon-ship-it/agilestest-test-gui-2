/**
 * CapturesPage — Captures réseau PCAP et collecte de logs
 * Données réelles via tRPC (MySQL) — branchement direct sur le backend.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useProject } from '../state/projectStore';
import { usePermission, PermissionKey } from '../security';
import { trpc } from '@/lib/trpc';
import type { CaptureStatus, CaptureTargetType, CaptureType } from '../types';
import {
  Network, Loader2, X, AlertCircle, Plus, Search,
  CheckCircle2, XCircle, Clock, Ban, Play, StopCircle,
  Trash2, Radio, Filter, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearch, useLocation } from 'wouter';

// ─── Collector Start/Stop Buttons ──────────────────────────────────────────

function CollectorStartButton({ captureId, probeId }: { captureId: number; probeId?: number | null }) {
  const utils = trpc.useUtils();
  const startMutation = trpc.collector.start.useMutation({
    onSuccess: (result) => {
      toast.success(result.created ? 'Collecte démarrée' : 'Session déjà active');
      utils.captures.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!probeId) return null;

  return (
    <button
      onClick={() => startMutation.mutate({ captureId, probeId })}
      disabled={startMutation.isPending}
      className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
    >
      {startMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
      Démarrer
    </button>
  );
}

function CollectorStopButton({ captureId }: { captureId: number }) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.collector.status.useQuery(
    { captureId },
    { refetchInterval: 10000 },
  );
  const activeSession = statusQuery.data?.activeSession;

  const stopMutation = trpc.collector.stop.useMutation({
    onSuccess: (result) => {
      toast.success(result.alreadyStopped ? 'Session déjà arrêtée' : 'Collecte arrêtée');
      utils.captures.list.invalidate();
      utils.collector.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!activeSession) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> En cours...
      </span>
    );
  }

  return (
    <button
      onClick={() => stopMutation.mutate({ sessionUid: activeSession.uid })}
      disabled={stopMutation.isPending}
      className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
    >
      {stopMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
      Arrêter
    </button>
  );
}

const captureStatusConfig: Record<CaptureStatus, { icon: typeof CheckCircle2; label: string; cls: string }> = {
  QUEUED:    { icon: Clock,        label: 'En file',   cls: 'text-yellow-400' },
  RUNNING:   { icon: Loader2,      label: 'En cours',  cls: 'text-blue-400' },
  COMPLETED: { icon: CheckCircle2, label: 'Terminé',   cls: 'text-green-400' },
  FAILED:    { icon: XCircle,      label: 'Échoué',    cls: 'text-red-400' },
  CANCELLED: { icon: Ban,          label: 'Annulé',    cls: 'text-gray-400' },
};

// ─── Create Capture Modal ────────────────────────────────────────────────
function CreateCaptureModal({ isOpen, onClose, projectId }: {
  isOpen: boolean; onClose: () => void; projectId: string;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [executionId, setExecutionId] = useState<string>('');
  const [targetType, setTargetType] = useState<CaptureTargetType>('K8S');
  const [captureType, setCaptureType] = useState<CaptureType>('PCAP');
  const [probeId, setProbeId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Fetch active probes for PROBE target type
  const { data: probesData, isLoading: probesLoading } = trpc.probes.listLite.useQuery(
    { status: 'ONLINE' },
    { enabled: isOpen && targetType === 'PROBE' },
  );
  const availableProbes = probesData ?? [];

  // Fetch executions for the project to link capture
  const { data: execData } = trpc.executions.list.useQuery(
    { projectId: String(projectId), page: 1, pageSize: 20 },
    { enabled: isOpen },
  );
  const executions = execData?.data ?? [];

  const createMutation = trpc.captures.create.useMutation({
    onSuccess: () => {
      toast.success('Capture créée');
      utils.captures.list.invalidate();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Nom requis.'); return; }
    if (targetType === 'PROBE' && !probeId) { setError('Sonde requise quand la cible est PROBE.'); return; }

    createMutation.mutate({
      projectId: String(projectId),
      name: name.trim(),
      executionId: executionId ? Number(executionId) : undefined,
      captureType,
      targetType,
      ...(targetType === 'PROBE' && probeId ? { probeId: Number(probeId) } : {}),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-semibold text-foreground">Nouvelle capture</h2>
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
            <label className="block text-sm font-medium text-foreground mb-1">Nom de la capture *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Capture PCAP IMS..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Exécution associée</label>
            <select value={executionId} onChange={(e) => setExecutionId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">Aucune (capture indépendante)</option>
              {executions.map((ex: any) => (
                <option key={ex.id} value={ex.id}>#{ex.id} — {ex.status} — {ex.targetEnv || 'N/A'}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type de cible</label>
              <select value={targetType} onChange={(e) => { setTargetType(e.target.value as CaptureTargetType); if (e.target.value !== 'PROBE') setProbeId(''); }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                <option value="K8S">Kubernetes</option>
                <option value="SSH">SSH</option>
                <option value="PROBE">Sonde</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type de capture</label>
              <select value={captureType} onChange={(e) => setCaptureType(e.target.value as CaptureType)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                <option value="PCAP">PCAP</option>
                <option value="LOGS">Logs</option>
              </select>
            </div>
          </div>
          {/* Probe selector — visible only when targetType=PROBE */}
          {targetType === 'PROBE' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                <Radio className="w-3.5 h-3.5 inline mr-1" />Sonde *
              </label>
              {probesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Chargement des sondes...
                </div>
              ) : availableProbes.length === 0 ? (
                <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2.5">
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                  <p className="text-xs text-yellow-400">Aucune sonde en ligne. Mettez une sonde en ligne depuis la page Sondes.</p>
                </div>
              ) : (
                <select value={probeId} onChange={(e) => setProbeId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                  <option value="">Sélectionner une sonde...</option>
                  {availableProbes.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.probeType}) — {p.status}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Lancer la capture
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

// ─── URL query param helpers ────────────────────────────────────────────
function useUrlParams() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const setParams = useCallback((updater: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchStr);
    updater(next);
    // Always reset to page 1 when filters change
    const path = window.location.pathname;
    const qs = next.toString();
    navigate(qs ? `${path}?${qs}` : path, { replace: true });
  }, [searchStr, navigate]);
  return { params, setParams };
}

export default function CapturesPage() {
  const { currentProject } = useProject();
  const { can } = usePermission();
  const canCreateCapture = can(PermissionKey.EXECUTIONS_RUN);
  const [showCreate, setShowCreate] = useState(false);
  const { params, setParams } = useUrlParams();

  // Read filters from URL
  const statusFilter = params.get('status') || '';
  const probeIdFilter = params.get('probeId') || '';
  const searchQuery = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = 25;

  const CAPTURE_PAGE_SIZE = 30;
  const [captureCursor, setCaptureCursor] = useState<number | undefined>(undefined);
  const [allCaptureItems, setAllCaptureItems] = useState<any[]>([]);

  // Local search input (debounced)
  const [searchInput, setSearchInput] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        setParams(p => {
          if (searchInput.trim()) p.set('q', searchInput.trim());
          else p.delete('q');
          p.set('page', '1');
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const setPage = (newPage: number) => setParams(p => p.set('page', String(newPage)));

  const utils = trpc.useUtils();

  // Fetch probes for dropdown filter
  const { data: probesLiteData } = trpc.probes.listLite.useQuery(
    {},
    { enabled: !!currentProject },
  );
  const probesLite = probesLiteData ?? [];

  const { data, isLoading, isFetching } = trpc.captures.list.useQuery(
    {
      projectId: String(currentProject?.id || ''),
      page: 1,
      pageSize: CAPTURE_PAGE_SIZE,
      cursor: captureCursor,
      ...(statusFilter ? { status: statusFilter as CaptureStatus } : {}),
      ...(probeIdFilter ? { probeId: Number(probeIdFilter) } : {}),
      ...(searchQuery ? { q: searchQuery } : {}),
    },
    {
      enabled: !!currentProject,
      refetchInterval: 15000,
    },
  );

  // Accumulate capture items as cursor changes
  useEffect(() => {
    if (data?.data) {
      if (captureCursor === undefined) {
        setAllCaptureItems(data.data);
      } else {
        setAllCaptureItems(prev => {
          const ids = new Set(prev.map((r: any) => r.id));
          const fresh = data.data.filter((r: any) => !ids.has(r.id));
          return [...prev, ...fresh];
        });
      }
    }
  }, [data, captureCursor]);

  // Reset accumulator when filters change
  useEffect(() => {
    setCaptureCursor(undefined);
    setAllCaptureItems([]);
  }, [statusFilter, probeIdFilter, searchQuery, currentProject?.id]);

  const capturesHasMore = data?.hasMore ?? false;
  const capturesNextCursor = data?.nextCursor;
  const captures = allCaptureItems;
  const pagination = data?.pagination;

  const deleteMutation = trpc.captures.delete.useMutation({
    onSuccess: () => {
      toast.success('Capture supprim\u00e9e');
      utils.captures.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const hasActiveFilters = !!(statusFilter || probeIdFilter || searchQuery);
  const resetFilters = () => {
    setSearchInput('');
    setParams(p => { p.delete('status'); p.delete('probeId'); p.delete('q'); p.set('page', '1'); });
  };

  // No client-side filtering — all server-side
  const filteredCaptures = captures;

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Network className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour voir les captures.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            Captures
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Captures réseau PCAP et collecte de logs pour <strong className="text-foreground">{currentProject.name}</strong>.
          </p>
        </div>
        {canCreateCapture && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle capture
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher par nom..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setParams(p => { if (e.target.value) p.set('status', e.target.value); else p.delete('status'); p.set('page', '1'); })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les statuts</option>
          <option value="QUEUED">En file</option>
          <option value="RUNNING">En cours</option>
          <option value="COMPLETED">Termin\u00e9</option>
          <option value="FAILED">\u00c9chou\u00e9</option>
          <option value="CANCELLED">Annul\u00e9</option>
        </select>
        <select value={probeIdFilter} onChange={(e) => setParams(p => { if (e.target.value) p.set('probeId', e.target.value); else p.delete('probeId'); p.set('page', '1'); })}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Toutes les sondes</option>
          {probesLite.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name} ({p.probeType})</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-2 rounded-md border border-border hover:bg-secondary">
            <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
          </button>
        )}
        {isFetching && !isLoading && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredCaptures.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Network className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune capture</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Créez une capture PCAP ou Logs pour collecter des données réseau.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Cible</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Exécution</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCaptures.map((cap: any) => {
                const statusCfg = captureStatusConfig[cap.status as CaptureStatus];
                const StatusIcon = statusCfg?.icon || Clock;

                return (
                  <tr key={cap.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusCfg?.cls || 'text-gray-400'}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${cap.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                        {statusCfg?.label || cap.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{cap.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">{cap.captureType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">{cap.targetType}</span>
                    </td>
                    <td className="px-4 py-3">
                      {cap.executionId ? (
                        <span className="text-xs font-mono text-foreground">#{cap.executionId}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {cap.createdAt ? new Date(cap.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {['QUEUED', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(cap.status) && (
                          <button
                            onClick={() => deleteMutation.mutate({ captureId: cap.id })}
                            disabled={deleteMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer
                          </button>
                        )}
                        {cap.status === 'QUEUED' && cap.targetType === 'PROBE' && (
                          <CollectorStartButton captureId={cap.id} probeId={cap.probeId} />
                        )}
                        {cap.status === 'RUNNING' && (
                          <CollectorStopButton captureId={cap.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Charger plus */}
          {capturesHasMore && (
            <div className="flex justify-center py-3 border-t border-border">
              <button
                onClick={() => capturesNextCursor && setCaptureCursor(capturesNextCursor)}
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
              {captures.length} capture(s) affichée(s) sur {pagination.total}
            </div>
          )}
        </div>
      )}

      <CreateCaptureModal isOpen={showCreate} onClose={() => setShowCreate(false)} projectId={String(currentProject.id)} />
    </div>
  );
}
