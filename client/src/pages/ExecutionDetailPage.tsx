/**
 * ExecutionDetailPage — Détail d'une exécution (tRPC backend).
 * - Infos scénario/profil/env/runner
 * - Artefacts (avec téléchargement S3)
 * - Incidents (sévérité, attendu/obtenu)
 * - Analyse IA (résumé, recommandations)
 * - Boutons Analyser IA / Parser JMeter / Rerun
 */
import { useState, useMemo, useEffect } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import type { ExecutionStatus, TargetEnv } from '../types';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Ban, Download, FileText, Image, Video, FileCode, File,
  AlertCircle, Activity, Wrench, Sparkles, Play, RotateCcw,
  Code2, Globe, Package, Server, Brain,
  Eye, Shield, Beaker, Tag, Hash, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Status config ───────────────────────────────────────────────────────
const statusConfig: Record<ExecutionStatus, { icon: typeof CheckCircle2; label: string; cls: string; bg: string }> = {
  PENDING:   { icon: Clock,          label: 'En attente', cls: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  RUNNING:   { icon: Activity,       label: 'En cours',   cls: 'text-blue-400',   bg: 'bg-blue-400/10' },
  PASSED:    { icon: CheckCircle2,   label: 'Réussi',     cls: 'text-green-400',  bg: 'bg-green-400/10' },
  FAILED:    { icon: XCircle,        label: 'Échoué',     cls: 'text-red-400',    bg: 'bg-red-400/10' },
  ERROR:     { icon: AlertTriangle,  label: 'Erreur',     cls: 'text-orange-400', bg: 'bg-orange-400/10' },
  CANCELLED: { icon: Ban,            label: 'Annulé',     cls: 'text-gray-400',   bg: 'bg-gray-400/10' },
};

const ENV_META: Record<TargetEnv, { label: string; color: string }> = {
  DEV:          { label: 'DEV',          color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  PROD:         { label: 'PROD',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const artifactIcons: Record<string, typeof FileText> = {
  LOG: FileText, SCREENSHOT: Image, VIDEO: Video, HAR: FileCode,
  TRACE: FileCode, PCAP: FileCode, OTHER: File,
};

const severityStyles: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
  MAJOR:    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  MINOR:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  INFO:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

function formatDuration(ms: number | null | undefined): string {
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

// ─── Job Status Badge ────────────────────────────────────────────────────
const jobStatusStyles: Record<string, { label: string; cls: string }> = {
  QUEUED:  { label: 'En file',    cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  RUNNING: { label: 'Analyse...', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  DONE:    { label: 'Terminé',    cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  FAILED:  { label: 'Échoué',     cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

function JobsPanel({ executionId }: { executionId: number }) {
  const { data: jobs } = trpc.jobs.listByRun.useQuery(
    { runId: executionId },
    {
      refetchInterval: (query) => {
        const items = query.state.data;
        if (!items || !Array.isArray(items)) return false;
        return items.some((j: any) => j.status === 'QUEUED' || j.status === 'RUNNING') ? 5000 : false;
      },
    },
  );

  if (!jobs || jobs.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <Server className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-heading font-semibold text-foreground">Jobs</h3>
        <span className="text-xs text-muted-foreground ml-auto">{jobs.length} job(s)</span>
      </div>
      <div className="divide-y divide-border">
        {jobs.map((job: any) => {
          const style = jobStatusStyles[job.status] || jobStatusStyles.QUEUED;
          return (
            <div key={job.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {job.name === 'aiAnalyzeRun' ? <Brain className="w-4 h-4 text-violet-400" /> : <FileCode className="w-4 h-4 text-cyan-400" />}
                <div>
                  <p className="text-sm font-medium text-foreground">{job.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Job #{job.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {job.status === 'RUNNING' && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${style.cls}`}>
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Action Buttons ──────────────────────────────────────────────────────
function ExecutionDetailActions({ executionId, status }: { executionId: number; status: string }) {
  const utils = trpc.useUtils();
  const { can } = usePermission();
  const canAnalyze = can(PermissionKey.EXECUTIONS_RUN);

  const enqueueAi = trpc.jobs.enqueueAiAnalysis.useMutation({
    onSuccess: () => {
      toast.success('Analyse IA lancée');
      utils.jobs.listByRun.invalidate({ runId: executionId });
      utils.executions.get.invalidate({ executionId });
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
    <div className="flex items-center gap-2">
      <button
        onClick={() => enqueueAi.mutate({ runId: executionId })}
        disabled={enqueueAi.isPending}
        className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1.5 rounded-md border border-violet-500/20 transition-colors disabled:opacity-50"
      >
        {enqueueAi.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        Analyser IA
      </button>
      <button
        onClick={() => enqueueJtl.mutate({ runId: executionId, artifactId: 0 })}
        disabled={enqueueJtl.isPending}
        className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-md border border-cyan-500/20 transition-colors disabled:opacity-50"
      >
        {enqueueJtl.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCode className="w-3 h-3" />}
        Parser JMeter
      </button>
    </div>
  );
}// ─── Export PDF Button ───────────────────────────────────────────────────────
function ExportPdfButton({ executionId }: { executionId: number }) {
  const [reportId, setReportId] = useState<number | null>(null);

  const requestPdf = trpc.reports.requestPdf.useMutation({
    onSuccess: (data) => {
      setReportId(data.reportId);
      toast.success(data.message);
    },
    onError: (err) => toast.error(err.message),
  });

  // Poll report status when we have a reportId
  const { data: report } = trpc.reports.getReport.useQuery(
    { reportId: reportId! },
    {
      enabled: !!reportId,
      refetchInterval: (query) => {
        const r = query.state.data;
        if (!r) return 2000;
        if (r.status === 'PENDING' || r.status === 'GENERATING') return 2000;
        return false;
      },
    },
  );

  // Auto-download when done
  const downloadTriggered = useMemo(() => {
    if (report?.status === 'DONE' && report.downloadUrl) {
      window.open(report.downloadUrl, '_blank');
      return true;
    }
    return false;
  }, [report?.status, report?.downloadUrl]);

  const isPending = requestPdf.isPending || (reportId && report && ['PENDING', 'GENERATING'].includes(report.status));

  if (report?.status === 'FAILED') {
    return (
      <button
        onClick={() => { setReportId(null); requestPdf.mutate({ executionId }); }}
        className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-md border border-red-500/20 transition-colors"
      >
        <AlertTriangle className="w-3 h-3" />
        Réessayer PDF
      </button>
    );
  }

  if (report?.status === 'DONE' && report.downloadUrl) {
    return (
      <a
        href={report.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-md border border-green-500/20 transition-colors"
      >
        <FileDown className="w-3 h-3" />
        Télécharger PDF
      </a>
    );
  }

  return (
    <button
      onClick={() => requestPdf.mutate({ executionId })}
      disabled={!!isPending}
      className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-md border border-emerald-500/20 transition-colors disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
      {isPending ? 'Génération...' : 'Export PDF'}
    </button>
  );
}

// ─── AI Analysis Panel ───────────────────────────────────────────────────
function AiAnalysisPanel({ analyses }: { analyses: any[] }) {
  if (!analyses || analyses.length === 0) return null;

  const latest = analyses[0];
  const recommendations = (() => {
    try {
      if (typeof latest.recommendations === 'string') return JSON.parse(latest.recommendations);
      if (Array.isArray(latest.recommendations)) return latest.recommendations;
      return [];
    } catch { return []; }
  })();

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-violet-500/5">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-heading font-semibold text-foreground">Analyse IA</h3>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
          latest.status === 'DONE' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
          latest.status === 'PENDING' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
          'text-red-400 bg-red-500/10 border-red-500/20'
        }`}>{latest.status}</span>
      </div>
      {latest.summary && (
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Résumé</p>
            <p className="text-sm text-foreground bg-secondary/20 rounded-md p-3">{latest.summary}</p>
          </div>
          {recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Recommandations</p>
              <ul className="space-y-1">
                {recommendations.map((rec: string, i: number) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-violet-400 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {latest.status === 'PENDING' && (
        <div className="px-5 py-6 text-center">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Analyse en cours...</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ExecutionDetailPage() {
  const [, params] = useRoute('/executions/:id');
  const [, navigate] = useLocation();
  const executionId = Number(params?.id) || 0;
  const { currentProject } = useProject();
  const { can } = usePermission();
  const canRerunExecution = can(PermissionKey.EXECUTIONS_RERUN);
  const utils = trpc.useUtils();

  // ─── tRPC queries ──────────────────────────────────────────────────────
  const { data: execData, isLoading: loadingExec } = trpc.executions.get.useQuery(
    { executionId },
    {
      enabled: executionId > 0,
      refetchInterval: (query) => {
        const d = query.state.data;
        return d?.status === 'RUNNING' || d?.status === 'PENDING' ? 5000 : false;
      },
    },
  );

  // Rerun mutation
  const createExecution = trpc.executions.create.useMutation({
    onSuccess: () => {
      toast.success('Exécution relancée');
      utils.executions.list.invalidate();
      navigate('/executions');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRerun = () => {
    if (!execData || !currentProject) return;
    createExecution.mutate({
      projectId: String(currentProject.id),
      profileId: execData.profileId ?? undefined,
      scenarioId: execData.scenarioId ?? undefined,
      scriptId: execData.scriptId ?? undefined,
      targetEnv: (execData.targetEnv as TargetEnv) || 'DEV',
    });
  };

  // ─── Loading / Not found ───────────────────────────────────────────────
  if (loadingExec) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!execData) {
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

  const config = statusConfig[execData.status as ExecutionStatus] || statusConfig.PENDING;
  const StatusIcon = config.icon;
  const envMeta = execData.targetEnv ? ENV_META[execData.targetEnv as TargetEnv] : null;
  const artsList = execData.artifacts ?? [];
  const incidentsList = execData.incidents ?? [];
  const analysesList = execData.analyses ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/executions">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour au Run Center
          </span>
        </Link>

        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Exécution #{execData.id}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Créée le {new Date(execData.createdAt).toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExecutionDetailActions executionId={executionId} status={execData.status} />
            <ExportPdfButton executionId={executionId} />
            {canRerunExecution && ['PASSED', 'FAILED', 'ERROR'].includes(execData.status) && (
              <button
                onClick={handleRerun}
                disabled={createExecution.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {createExecution.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Rerun
              </button>
            )}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md ${config.bg}`}>
              <StatusIcon className={`w-4 h-4 ${config.cls} ${execData.status === 'RUNNING' ? 'animate-spin' : ''}`} />
              <span className={`text-sm font-medium ${config.cls}`}>{config.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Execution context cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Durée</p>
          <p className="text-lg font-heading font-bold text-foreground">{formatDuration(execData.durationMs)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1 mb-1">
            <Globe className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Env</p>
          </div>
          {envMeta ? (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${envMeta.color}`}>
              {envMeta.label}
            </span>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1 mb-1">
            <Beaker className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Scénario</p>
          </div>
          {execData.scenario ? (
            <div>
              <p className="text-sm font-medium text-foreground truncate">{execData.scenario.name}</p>
              <p className="text-[10px] text-muted-foreground">{execData.scenario.testType} — {execData.scenario.status}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1 mb-1">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Profil</p>
          </div>
          {execData.profile ? (
            <div>
              <p className="text-sm font-medium text-foreground truncate">{execData.profile.name}</p>
              <p className="text-[10px] text-muted-foreground">{execData.profile.profileType}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1 mb-1">
            <Server className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Runner</p>
          </div>
          <p className="text-xs font-mono text-foreground">{execData.runnerId || '—'}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-heading font-bold text-foreground">{artsList.length}</p>
          <p className="text-xs text-muted-foreground">Artefacts</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className={`text-2xl font-heading font-bold ${incidentsList.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {incidentsList.length}
          </p>
          <p className="text-xs text-muted-foreground">Incidents</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <p className="text-2xl font-heading font-bold text-violet-400">{analysesList.length}</p>
          <p className="text-xs text-muted-foreground">Analyses IA</p>
        </div>
      </div>

      {/* Jobs Panel */}
      <JobsPanel executionId={executionId} />

      {/* AI Analysis */}
      <AiAnalysisPanel analyses={analysesList} />

      {/* Artifacts */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Artefacts</h2>
        {artsList.length === 0 ? (
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
                {artsList.map((art: any) => {
                  const ArtIcon = artifactIcons[art.type] || File;
                  return (
                    <tr key={art.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <ArtIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-primary">{art.type}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-foreground">{art.filename || '—'}</p>
                        {art.checksum && (
                          <p className="text-[9px] font-mono text-muted-foreground mt-0.5">sha256:{art.checksum.slice(0, 16)}…</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{formatBytes(art.sizeBytes)}</td>
                      <td className="px-5 py-3 text-right">
                        <ArtifactDownloadButton artifactId={art.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reports History */}
      <ReportsHistoryPanel executionId={executionId} />

      {/* Incidents */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Incidents</h2>
        {incidentsList.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-400/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun incident détecté.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidentsList.map((inc: any) => (
              <div key={inc.id} className="bg-card border border-border rounded-lg px-5 py-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityStyles[inc.severity] || severityStyles.INFO}`}>
                      {inc.severity}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">{inc.title}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {inc.createdAt ? new Date(inc.createdAt).toLocaleTimeString('fr-FR') : ''}
                  </span>
                </div>
                {inc.description && (
                  <p className="text-sm text-muted-foreground">{inc.description}</p>
                )}
                {inc.stepIndex != null && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Étape : #{inc.stepIndex}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reports History Panel ──────────────────────────────────────────────
function ReportsHistoryPanel({ executionId }: { executionId: number }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.reports.listByExecution.useQuery(
    { executionId, page, pageSize: 10 },
    { refetchInterval: 15000 },
  );
  const reports = data?.data ?? [];
  const pagination = data?.pagination;

  if (isLoading && reports.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Rapports PDF</h2>
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Rapports PDF</h2>
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <FileDown className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucun rapport généré. Cliquez sur "Export PDF" pour en créer un.</p>
        </div>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'DONE': return <span className="inline-flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3 h-3" /> Prêt</span>;
      case 'PENDING': return <span className="inline-flex items-center gap-1 text-xs text-yellow-400"><Clock className="w-3 h-3" /> En attente</span>;
      case 'GENERATING': return <span className="inline-flex items-center gap-1 text-xs text-blue-400"><Loader2 className="w-3 h-3 animate-spin" /> Génération</span>;
      case 'FAILED': return <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3 h-3" /> Échoué</span>;
      default: return <span className="text-xs text-muted-foreground">{status}</span>;
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <h2 className="text-lg font-heading font-semibold text-foreground mb-3">Rapports PDF</h2>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Statut</th>
              <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Fichier</th>
              <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Taille</th>
              <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Demandé par</th>
              <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Date</th>
              <th className="text-right px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r: any) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                <td className="px-5 py-3">{statusBadge(r.status)}</td>
                <td className="px-5 py-3">
                  <span className="text-foreground font-mono text-xs">{r.filename || '—'}</span>
                </td>
                <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{formatBytes(r.sizeBytes)}</td>
                <td className="px-5 py-3 text-sm text-foreground">{r.requestedByName || '—'}</td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  {r.status === 'DONE' && r.downloadUrl ? (
                    <a href={r.downloadUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                      <Download className="w-3.5 h-3.5" /> Télécharger
                    </a>
                  ) : r.status === 'FAILED' && r.error ? (
                    <span className="text-xs text-red-400" title={r.error}>Erreur</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} / {pagination.totalPages} — {pagination.total} rapport(s)
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-secondary disabled:opacity-50 transition-colors">Précédent</button>
              <button onClick={() => setPage(Math.min(pagination.totalPages, page + 1))} disabled={page >= pagination.totalPages}
                className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-secondary disabled:opacity-50 transition-colors">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Artifact Download Button ────────────────────────────────────────────
function ArtifactDownloadButton({ artifactId }: { artifactId: number }) {
  const { data, isLoading, refetch } = trpc.artifacts.getDownloadUrl.useQuery(
    { artifactId },
    { enabled: false }, // manual trigger
  );

  const handleDownload = async () => {
    const result = await refetch();
    if (result.data?.downloadUrl) {
      window.open(result.data.downloadUrl, '_blank');
    } else {
      toast.error('URL de téléchargement indisponible');
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
    >
      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      Télécharger
    </button>
  );
}
