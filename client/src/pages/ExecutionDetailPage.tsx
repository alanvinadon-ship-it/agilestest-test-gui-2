import { useRoute, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApi';
import { collectorApi } from '../api/collectorApi';
import type { Execution, Artifact, Incident, ExecutionStatus } from '../types';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Ban, Download, FileText, Image, Video, FileCode, File,
  AlertCircle, Activity
} from 'lucide-react';

const statusConfig: Record<ExecutionStatus, { icon: typeof CheckCircle2; label: string; cls: string; bg: string }> = {
  PENDING: { icon: Clock, label: 'En attente', cls: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  RUNNING: { icon: Activity, label: 'En cours', cls: 'text-blue-400', bg: 'bg-blue-400/10' },
  PASSED: { icon: CheckCircle2, label: 'Réussi', cls: 'text-green-400', bg: 'bg-green-400/10' },
  FAILED: { icon: XCircle, label: 'Échoué', cls: 'text-red-400', bg: 'bg-red-400/10' },
  ERROR: { icon: AlertTriangle, label: 'Erreur', cls: 'text-orange-400', bg: 'bg-orange-400/10' },
  CANCELLED: { icon: Ban, label: 'Annulé', cls: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const artifactIcons: Record<string, typeof FileText> = {
  LOG: FileText,
  SCREENSHOT: Image,
  VIDEO: Video,
  HAR: FileCode,
  TRACE: FileCode,
  PCAP: FileCode,
  OTHER: File,
};

const severityStyles: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
  MAJOR: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  MINOR: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  INFO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function ExecutionDetailPage() {
  const [, params] = useRoute('/executions/:id');
  const executionId = params?.id || '';

  const { data: execution, isLoading: loadingExec } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => repositoryApi.getExecution(executionId),
    enabled: !!executionId,
    refetchInterval: (query) => {
      const data = query.state.data as Execution | undefined;
      return data?.status === 'RUNNING' ? 5000 : false;
    },
  });

  const { data: artifactsData } = useQuery({
    queryKey: ['artifacts', executionId],
    queryFn: () => collectorApi.listArtifacts(executionId),
    enabled: !!executionId,
  });

  const { data: incidentsData } = useQuery({
    queryKey: ['incidents', executionId],
    queryFn: () => collectorApi.listIncidentsByExecution(executionId),
    enabled: !!executionId,
  });

  const artifacts = (artifactsData?.data || []) as Artifact[];
  const incidents = (incidentsData?.data || []) as Incident[];

  if (loadingExec) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="max-w-5xl mx-auto text-center py-24">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Exécution introuvable.</p>
        <Link href="/executions" className="text-sm text-primary hover:underline mt-2 inline-block">
          Retour aux exécutions
        </Link>
      </div>
    );
  }

  const config = statusConfig[execution.status];
  const StatusIcon = config.icon;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/executions">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour aux exécutions
          </span>
        </Link>

        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Exécution</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">{execution.id}</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md ${config.bg}`}>
            <StatusIcon className={`w-4 h-4 ${config.cls} ${execution.status === 'RUNNING' ? 'animate-spin' : ''}`} />
            <span className={`text-sm font-medium ${config.cls}`}>{config.label}</span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Durée</p>
          <p className="text-lg font-heading font-bold text-foreground">{formatDuration(execution.duration_ms)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Artefacts</p>
          <p className="text-lg font-heading font-bold text-foreground">{artifacts.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Incidents</p>
          <p className={`text-lg font-heading font-bold ${incidents.length > 0 ? 'text-red-400' : 'text-foreground'}`}>
            {incidents.length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Démarré</p>
          <p className="text-sm font-medium text-foreground">
            {execution.started_at ? new Date(execution.started_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }) : '—'}
          </p>
        </div>
      </div>

      {/* Artifacts */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Artefacts</h2>
        {artifacts.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <File className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun artefact collecté.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Fichier</th>
                  <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Taille</th>
                  <th className="text-right px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((art) => {
                  const ArtIcon = artifactIcons[art.type] || File;
                  return (
                    <tr key={art.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <ArtIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-primary">{art.type}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-foreground">{art.filename || art.name || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground font-mono">{formatBytes(art.size_bytes)}</td>
                      <td className="px-5 py-3 text-right">
                        {(art.download_url || art.storage_url) && (
                          <a href={art.download_url || art.storage_url || '#'} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                            <Download className="w-3.5 h-3.5" /> Télécharger
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incidents */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Incidents</h2>
        {incidents.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun incident détecté.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div key={inc.id} className="bg-card border border-border rounded-lg px-5 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityStyles[inc.severity] || severityStyles.INFO}`}>
                      {inc.severity}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">{inc.title}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(inc.detected_at).toLocaleTimeString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{inc.description}</p>
                {inc.step_name && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Étape : {inc.step_name}
                  </p>
                )}
                {inc.expected_result && inc.actual_result && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="bg-green-500/5 border border-green-500/10 rounded p-2">
                      <p className="text-[10px] font-mono text-green-400 uppercase mb-0.5">Attendu</p>
                      <p className="text-xs text-foreground">{inc.expected_result}</p>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/10 rounded p-2">
                      <p className="text-[10px] font-mono text-red-400 uppercase mb-0.5">Obtenu</p>
                      <p className="text-xs text-foreground">{inc.actual_result}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
