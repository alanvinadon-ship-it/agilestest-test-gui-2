import { useState } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectorApi } from '../api/collectorApi';
import { repositoryApi } from '../api/repositoryApi';
import type { CaptureJob, CaptureStatus, Execution, CreateCaptureRequest, CaptureTargetType, CaptureType } from '../types';
import {
  Network, Loader2, X, AlertCircle, Plus, Search,
  CheckCircle2, XCircle, Clock, Ban, Play, StopCircle,
  Eye
} from 'lucide-react';

const captureStatusConfig: Record<CaptureStatus, { label: string; cls: string }> = {
  QUEUED: { label: 'En file', cls: 'text-yellow-400' },
  RUNNING: { label: 'En cours', cls: 'text-blue-400' },
  COMPLETED: { label: 'Terminé', cls: 'text-green-400' },
  FAILED: { label: 'Échoué', cls: 'text-red-400' },
  CANCELLED: { label: 'Annulé', cls: 'text-gray-400' },
};

function CreateCaptureModal({ isOpen, onClose, projectId }: {
  isOpen: boolean; onClose: () => void; projectId: string;
}) {
  const queryClient = useQueryClient();
  const [executionId, setExecutionId] = useState('');
  const [targetType, setTargetType] = useState<CaptureTargetType>('K8S');
  const [captureType, setCaptureType] = useState<CaptureType>('PCAP');
  const [duration, setDuration] = useState('60');
  const [maxSize, setMaxSize] = useState('100');
  const [namespace, setNamespace] = useState('');
  const [podSelector, setPodSelector] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: execData } = useQuery({
    queryKey: ['executions', projectId],
    queryFn: () => repositoryApi.listExecutions(projectId, { limit: 20 }),
    enabled: isOpen,
  });
  const executions = (execData?.data || []) as Execution[];

  const mutation = useMutation({
    mutationFn: (data: CreateCaptureRequest) => collectorApi.createCapture(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['captures'] });
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Erreur lors de la création.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!executionId) { setError('Sélectionnez une exécution.'); return; }

    const payload: CreateCaptureRequest = {
      execution_id: executionId,
      project_id: projectId,
      target_type: targetType,
      capture_type: captureType,
      duration_seconds: parseInt(duration) || 60,
      max_size_mb: parseInt(maxSize) || 100,
      sources: targetType === 'K8S'
        ? [{ namespace: namespace || 'default', pod_selector: podSelector || 'app=test' }]
        : [{ host: '127.0.0.1', ssh_user: 'root', ssh_port: 22, log_paths: ['/var/log/syslog'] }],
    };
    mutation.mutate(payload);
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
            <label className="block text-sm font-medium text-foreground mb-1">Exécution associée *</label>
            <select value={executionId} onChange={(e) => setExecutionId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">Sélectionner une exécution</option>
              {executions.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.id.slice(0, 8)}... — {ex.status}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type de cible</label>
              <select value={targetType} onChange={(e) => setTargetType(e.target.value as CaptureTargetType)}
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
          {targetType === 'K8S' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Namespace</label>
                <input type="text" value={namespace} onChange={(e) => setNamespace(e.target.value)}
                  placeholder="default"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Pod Selector</label>
                <input type="text" value={podSelector} onChange={(e) => setPodSelector(e.target.value)}
                  placeholder="app=my-service"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Durée (sec)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Taille max (MB)</label>
              <input type="number" value={maxSize} onChange={(e) => setMaxSize(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Lancer la capture
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CapturesPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  // We need an execution to list captures — list all executions then fetch captures for each
  const { data: execData, isLoading: loadingExec } = useQuery({
    queryKey: ['executions', currentProject?.id],
    queryFn: () => repositoryApi.listExecutions(currentProject!.id, { limit: 50 }),
    enabled: !!currentProject,
  });

  const executions = (execData?.data || []) as Execution[];
  const latestExecId = executions[0]?.id || '';

  const { data: capturesData, isLoading: loadingCaptures } = useQuery({
    queryKey: ['captures', latestExecId],
    queryFn: () => collectorApi.listCaptures(latestExecId),
    enabled: !!latestExecId,
    refetchInterval: 10000,
  });

  const captures = (capturesData?.data || []) as CaptureJob[];

  const cancelMutation = useMutation({
    mutationFn: (captureId: string) => collectorApi.cancelCapture(captureId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['captures'] }),
  });

  const isLoading = loadingExec || loadingCaptures;

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
          <h1 className="text-2xl font-heading font-bold text-foreground">Captures</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Captures réseau PCAP et collecte de logs pour <strong className="text-foreground">{currentProject.name}</strong>.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle capture
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : captures.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Network className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune capture</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {executions.length === 0
              ? 'Lancez d\'abord une exécution avant de créer une capture.'
              : 'Créez une capture PCAP ou Logs pour collecter des données.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {captures.map((cap) => {
            const status = captureStatusConfig[cap.status];
            return (
              <div key={cap.capture_id} className="flex items-center justify-between bg-card border border-border rounded-lg px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Network className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">{cap.capture_type}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-muted-foreground">{cap.target_type}</span>
                      <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {cap.capture_id.slice(0, 12)}... — {cap.duration_seconds}s max — {cap.max_size_mb}MB max
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(cap.status === 'QUEUED' || cap.status === 'RUNNING') && (
                    <button onClick={() => cancelMutation.mutate(cap.capture_id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                      <StopCircle className="w-3.5 h-3.5" /> Annuler
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateCaptureModal isOpen={showCreate} onClose={() => setShowCreate(false)} projectId={currentProject.id} />
    </div>
  );
}
