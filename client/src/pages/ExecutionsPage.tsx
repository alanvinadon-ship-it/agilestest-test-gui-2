import { useState, useMemo } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApi';
import { Link } from 'wouter';
import type { Execution, ExecutionStatus, TestProfile, TestScenario } from '../types';
import {
  Play, Loader2, Search, X, AlertCircle, Eye,
  CheckCircle2, XCircle, Clock, AlertTriangle, Ban, Plus
} from 'lucide-react';

const statusConfig: Record<ExecutionStatus, { icon: typeof CheckCircle2; label: string; cls: string; ledCls: string }> = {
  PENDING: { icon: Clock, label: 'En attente', cls: 'text-yellow-400', ledCls: 'status-led-warning' },
  RUNNING: { icon: Loader2, label: 'En cours', cls: 'text-blue-400', ledCls: 'status-led-info' },
  PASSED: { icon: CheckCircle2, label: 'Réussi', cls: 'text-green-400', ledCls: 'status-led-success' },
  FAILED: { icon: XCircle, label: 'Échoué', cls: 'text-red-400', ledCls: 'status-led-error' },
  ERROR: { icon: AlertTriangle, label: 'Erreur', cls: 'text-orange-400', ledCls: 'status-led-warning' },
  CANCELLED: { icon: Ban, label: 'Annulé', cls: 'text-gray-400', ledCls: 'status-led-idle' },
};

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function LaunchExecutionModal({ isOpen, onClose, projectId }: {
  isOpen: boolean; onClose: () => void; projectId: string;
}) {
  const queryClient = useQueryClient();
  const [profileId, setProfileId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: profilesData } = useQuery({
    queryKey: ['profiles', projectId],
    queryFn: () => repositoryApi.listProfiles(projectId),
    enabled: isOpen,
  });
  const profiles = (profilesData?.data || []) as TestProfile[];

  const { data: scenariosData } = useQuery({
    queryKey: ['scenarios', profileId],
    queryFn: () => repositoryApi.listScenarios(profileId),
    enabled: !!profileId,
  });
  const scenarios = (scenariosData?.data || []) as TestScenario[];

  const mutation = useMutation({
    mutationFn: () => repositoryApi.createExecution(projectId, { profile_id: profileId, scenario_id: scenarioId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions', projectId] });
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Erreur lors du lancement.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!profileId || !scenarioId) {
      setError('Sélectionnez un profil et un scénario.');
      return;
    }
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-semibold text-foreground">Lancer une exécution</h2>
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
            <label className="block text-sm font-medium text-foreground mb-1">Profil de test *</label>
            <select value={profileId} onChange={(e) => { setProfileId(e.target.value); setScenarioId(''); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">Sélectionner un profil</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.protocol})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Scénario *</label>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}
              disabled={!profileId}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">{profileId ? 'Sélectionner un scénario' : 'Choisissez d\'abord un profil'}</option>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.name} ({s.steps?.length || 0} étapes)</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Lancer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ExecutionsPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const [showLaunch, setShowLaunch] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['executions', currentProject?.id, statusFilter],
    queryFn: () => repositoryApi.listExecutions(currentProject!.id, {
      limit: 50,
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    enabled: !!currentProject,
    refetchInterval: 10000, // Poll every 10s for running executions
  });

  const executions = (data?.data || []) as Execution[];

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
          <h1 className="text-2xl font-heading font-bold text-foreground">Exécutions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lancez et suivez les exécutions de test pour <strong className="text-foreground">{currentProject.name}</strong>.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowLaunch(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" /> Lancer une exécution
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="RUNNING">En cours</option>
          <option value="PASSED">Réussi</option>
          <option value="FAILED">Échoué</option>
          <option value="ERROR">Erreur</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : executions.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune exécution</h3>
          <p className="text-sm text-muted-foreground mb-4">Lancez votre première exécution de test.</p>
          {canWrite && (
            <button onClick={() => setShowLaunch(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Play className="w-4 h-4" /> Lancer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Durée</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Artefacts</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Incidents</th>
                <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-right px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => {
                const config = statusConfig[exec.status];
                const StatusIcon = config.icon;
                return (
                  <tr key={exec.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.cls}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${exec.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{exec.id.slice(0, 8)}...</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{formatDuration(exec.duration_ms)}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{exec.artifacts_count}</td>
                    <td className="px-5 py-3">
                      <span className={`font-mono text-xs ${exec.incidents_count > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {exec.incidents_count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {exec.started_at ? new Date(exec.started_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/executions/${exec.id}`}>
                        <span className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium cursor-pointer">
                          <Eye className="w-3.5 h-3.5" /> Détails
                        </span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LaunchExecutionModal isOpen={showLaunch} onClose={() => setShowLaunch(false)} projectId={currentProject.id} />
    </div>
  );
}
