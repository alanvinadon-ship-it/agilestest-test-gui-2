/**
 * ExecutionDetailPage — Détail d'une exécution avec :
 * - Infos script/bundle/env/runner
 * - Si FAILED : bouton "Repair from failure"
 * - Diff viewer + Save as new version + Activate & Rerun
 */
import { useState, useEffect } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApi';
import { collectorApi } from '../api/collectorApi';
import { localScriptRepository } from '../ai/scriptRepository';
import { localExecutions } from '../api/localStore';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import type { Execution, Artifact, Incident, ExecutionStatus, TargetEnv, RunnerJob } from '../types';
import type { GeneratedScript, RepairResult } from '../ai/types';
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Ban, Download, FileText, Image, Video, FileCode, File,
  AlertCircle, Activity, Wrench, Sparkles, Play, RotateCcw,
  Code2, Globe, Package, Server, ChevronDown, ChevronRight,
  Save, Zap, Eye, FileDiff, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { resolveCapturePolicy, CaptureModeBadge, captureModeLabel, captureSourceLabel, REASON_CODE_LABELS, REASON_CODE_SEVERITY } from '../capture';
import type { ProbeReasonCode } from '../capture/types';
import { localCapturePolicies, localCaptureSessions } from '../api/localStore';
import type { CaptureSession } from '../capture/types';

const statusConfig: Record<ExecutionStatus, { icon: typeof CheckCircle2; label: string; cls: string; bg: string }> = {
  PENDING: { icon: Clock, label: 'En attente', cls: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  RUNNING: { icon: Activity, label: 'En cours', cls: 'text-blue-400', bg: 'bg-blue-400/10' },
  PASSED: { icon: CheckCircle2, label: 'Réussi', cls: 'text-green-400', bg: 'bg-green-400/10' },
  FAILED: { icon: XCircle, label: 'Échoué', cls: 'text-red-400', bg: 'bg-red-400/10' },
  ERROR: { icon: AlertTriangle, label: 'Erreur', cls: 'text-orange-400', bg: 'bg-orange-400/10' },
  CANCELLED: { icon: Ban, label: 'Annulé', cls: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const ENV_META: Record<TargetEnv, { label: string; color: string }> = {
  DEV:          { label: 'DEV',          color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  PROD:         { label: 'PROD',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
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

// ─── Simulated Repair ────────────────────────────────────────────────────

function simulateRepair(script: GeneratedScript, incidents: Incident[]): RepairResult {
  const errorMsg = incidents[0]?.description || 'Unknown error';
  const mainFile = script.files[0];
  return {
    patches: [{
      file_path: mainFile?.path || 'test.spec.ts',
      original_snippet: '  await page.locator(selector).waitFor({ timeout: 30000 });',
      patched_snippet: '  await page.locator(selector).waitFor({ state: "visible", timeout: 60000 });\n  await page.waitForLoadState("networkidle");',
      explanation: `Fix timeout issue: increased timeout to 60s and added networkidle wait to handle slow page loads. Root cause: ${errorMsg.slice(0, 100)}`,
    }],
    root_cause: `The test failed because the page did not fully load before the assertion. ${errorMsg}`,
    suggested_fix: 'Increase timeout and add explicit wait for network idle state before interacting with elements.',
    confidence: 0.82,
    warnings: ['This is a simulated repair. In production, the IA model would analyze the actual logs and screenshots.'],
  };
}

// ─── Repair Panel Component ──────────────────────────────────────────────

function RepairPanel({ execution, script, incidents, onRepairComplete }: {
  execution: Execution;
  script: GeneratedScript;
  incidents: Incident[];
  onRepairComplete: (newScript: GeneratedScript) => void;
}) {
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [showDiff, setShowDiff] = useState(true);

  const handleRepair = async () => {
    setRepairing(true);
    // Simulate AI repair call
    await new Promise(r => setTimeout(r, 2000));
    const result = simulateRepair(script, incidents);
    setRepairResult(result);
    setRepairing(false);
  };

  const handleSaveNewVersion = () => {
    // Apply patches to create new files
    const newFiles = script.files.map(f => {
      const patch = repairResult?.patches.find(p => p.file_path === f.path);
      if (patch) {
        return {
          ...f,
          content: f.content.replace(patch.original_snippet, patch.patched_snippet),
        };
      }
      return f;
    });

    const newScript = localScriptRepository.create({
      project_id: script.project_id,
      scenario_id: script.scenario_id,
      bundle_id: script.bundle_id,
      env: script.env,
      framework: script.framework,
      code_language: script.code_language,
      files: newFiles,
      notes: `Repair from execution ${execution.id.slice(0, 8)} — ${repairResult?.root_cause.slice(0, 100)}`,
      warnings: repairResult?.warnings,
    });

    toast.success(`Script v${newScript.version} créé (repair)`);
    onRepairComplete(newScript);
  };

  const handleActivateAndRerun = () => {
    // Apply patches to create new files
    const newFiles = script.files.map(f => {
      const patch = repairResult?.patches.find(p => p.file_path === f.path);
      if (patch) {
        return {
          ...f,
          content: f.content.replace(patch.original_snippet, patch.patched_snippet),
        };
      }
      return f;
    });

    const newScript = localScriptRepository.create({
      project_id: script.project_id,
      scenario_id: script.scenario_id,
      bundle_id: script.bundle_id,
      env: script.env,
      framework: script.framework,
      code_language: script.code_language,
      files: newFiles,
      notes: `Repair from execution ${execution.id.slice(0, 8)} — ${repairResult?.root_cause.slice(0, 100)}`,
      warnings: repairResult?.warnings,
    });

    // Activate
    localScriptRepository.activate(newScript.script_id);

    // Rerun with new script
    localExecutions.create(execution.project_id, {
      profile_id: execution.profile_id,
      scenario_id: execution.scenario_id,
      script_id: newScript.script_id,
      script_version: newScript.version,
      dataset_bundle_id: execution.dataset_bundle_id,
      target_env: execution.target_env,
      runner_id: execution.runner_id,
      ai_repair_from_execution_id: execution.id,
    });

    toast.success(`Script v${newScript.version} activé + exécution relancée`);
    onRepairComplete(newScript);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-red-500/5">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-heading font-semibold text-foreground">Repair from Failure</h3>
        </div>
        {!repairResult && (
          <button
            onClick={handleRepair}
            disabled={repairing}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
          >
            {repairing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {repairing ? 'Analyse IA en cours...' : 'Lancer le repair IA'}
          </button>
        )}
      </div>

      {repairing && (
        <div className="px-5 py-8 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Analyse des artefacts et logs d'échec...</p>
          <p className="text-xs text-muted-foreground mt-1">Le modèle IA identifie la cause racine et génère des patches.</p>
        </div>
      )}

      {repairResult && (
        <div className="px-5 py-4 space-y-4">
          {/* Root cause */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Cause racine identifiée</p>
            <p className="text-sm text-foreground bg-secondary/20 rounded-md p-3">{repairResult.root_cause}</p>
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Confiance :</span>
            <div className="flex-1 h-2 bg-secondary/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${repairResult.confidence * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-foreground">{Math.round(repairResult.confidence * 100)}%</span>
          </div>

          {/* Suggested fix */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Correction suggérée</p>
            <p className="text-sm text-foreground">{repairResult.suggested_fix}</p>
          </div>

          {/* Patches diff */}
          <div>
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 mb-2"
            >
              {showDiff ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <FileDiff className="w-3 h-3" />
              {repairResult.patches.length} patch(es) — {repairResult.patches.map(p => p.file_path).join(', ')}
            </button>

            {showDiff && repairResult.patches.map((patch, i) => (
              <div key={i} className="bg-secondary/10 rounded-md border border-border overflow-hidden mb-2">
                <div className="px-3 py-1.5 bg-secondary/20 border-b border-border flex items-center gap-2">
                  <FileCode className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-mono text-foreground">{patch.file_path}</span>
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-mono text-red-400 uppercase mb-0.5">— Original</p>
                    <pre className="text-xs text-red-300/80 bg-red-500/5 rounded p-2 overflow-x-auto whitespace-pre-wrap">{patch.original_snippet}</pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-green-400 uppercase mb-0.5">+ Patched</p>
                    <pre className="text-xs text-green-300/80 bg-green-500/5 rounded p-2 overflow-x-auto whitespace-pre-wrap">{patch.patched_snippet}</pre>
                  </div>
                  <p className="text-xs text-muted-foreground italic">{patch.explanation}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {repairResult.warnings && repairResult.warnings.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-md p-3">
              {repairResult.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  {w}
                </p>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              onClick={handleSaveNewVersion}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save as new version
            </button>
            <button
              onClick={handleActivateAndRerun}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Activate & Rerun
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ExecutionDetailPage() {
  const [, params] = useRoute('/executions/:id');
  const [, navigate] = useLocation();
  const executionId = params?.id || '';
  const queryClient = useQueryClient();
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const { can } = usePermission();
  const canRerunExecution = can(PermissionKey.EXECUTIONS_RERUN);
  const canRepairScript = can(PermissionKey.SCRIPTS_CREATE);

  const [repairScript, setRepairScript] = useState<GeneratedScript | null>(null);

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

  const { data: jobData } = useQuery({
    queryKey: ['job-by-execution', executionId],
    queryFn: () => repositoryApi.getJobByExecution(executionId),
    enabled: !!executionId,
  });

  const artifacts = (artifactsData?.data || []) as Artifact[];
  const incidents = (incidentsData?.data || []) as Incident[];
  const runnerJob = jobData as RunnerJob | null;

  // Load script info
  const [script, setScript] = useState<GeneratedScript | null>(null);
  useEffect(() => {
    if (execution?.script_id) {
      const s = localScriptRepository.get(execution.script_id);
      setScript(s);
    }
  }, [execution?.script_id]);

  const handleRerun = () => {
    if (!execution) return;
    localExecutions.rerun(execution.id);
    queryClient.invalidateQueries({ queryKey: ['executions'] });
    toast.success('Exécution relancée');
    navigate('/executions');
  };

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
  const envMeta = execution.target_env ? ENV_META[execution.target_env] : null;
  const isFailed = execution.status === 'FAILED' || execution.status === 'ERROR';

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
            <h1 className="text-2xl font-heading font-bold text-foreground">Exécution</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">{execution.id}</p>
            {execution.ai_repair_from_execution_id && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                <Sparkles className="w-2.5 h-2.5" /> Repair de {execution.ai_repair_from_execution_id.slice(0, 8)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canRerunExecution && (execution.status === 'PASSED' || execution.status === 'FAILED') && (
              <button
                onClick={handleRerun}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Rerun
              </button>
            )}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md ${config.bg}`}>
              <StatusIcon className={`w-4 h-4 ${config.cls} ${execution.status === 'RUNNING' ? 'animate-spin' : ''}`} />
              <span className={`text-sm font-medium ${config.cls}`}>{config.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Execution context cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Durée</p>
          <p className="text-lg font-heading font-bold text-foreground">{formatDuration(execution.duration_ms)}</p>
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
            <Code2 className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Script</p>
          </div>
          {script ? (
            <div>
              <p className="text-sm font-medium text-foreground">{script.framework} v{script.version}</p>
              <p className="text-[10px] text-muted-foreground">{script.files.length} fichier(s)</p>
            </div>
          ) : execution.script_id ? (
            <p className="text-xs font-mono text-muted-foreground">v{execution.script_version || '?'}</p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1 mb-1">
            <Package className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Bundle</p>
          </div>
          <p className="text-xs font-mono text-foreground">{execution.dataset_bundle_id ? execution.dataset_bundle_id.slice(0, 12) : '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-1 mb-1">
            <Server className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Runner</p>
          </div>
          <p className="text-xs font-mono text-foreground">{execution.runner_id || '—'}</p>
        </div>
      </div>

      {/* Runner Job info */}
      {runnerJob && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-heading font-semibold text-foreground">Runner Job</h3>
            </div>
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${
              runnerJob.status === 'DONE' ? 'bg-green-500/10 text-green-400' :
              runnerJob.status === 'RUNNING' ? 'bg-blue-500/10 text-blue-400' :
              runnerJob.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
              'bg-yellow-500/10 text-yellow-400'
            }`}>{runnerJob.status}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Job ID</p>
              <p className="text-xs font-mono text-foreground">{runnerJob.job_id}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Runner</p>
              <p className="text-xs font-mono text-foreground">{runnerJob.runner_id || 'Non assigné'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Upload Policy</p>
              <p className="text-xs text-foreground">{runnerJob.artifact_upload_policy.join(', ')}</p>
            </div>
            {runnerJob.metrics && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Tests</p>
                <p className="text-xs text-foreground">
                  <span className="text-green-400">{runnerJob.metrics.passed} passed</span>
                  {runnerJob.metrics.failed > 0 && <span className="text-red-400 ml-1">{runnerJob.metrics.failed} failed</span>}
                  {runnerJob.metrics.skipped > 0 && <span className="text-gray-400 ml-1">{runnerJob.metrics.skipped} skipped</span>}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Capture Policy & Session */}
      {execution && (() => {
        const pid = currentProject?.id || execution.project_id || '';
        const projectPolicy = localCapturePolicies.get('project', pid);
        const captureResult = resolveCapturePolicy(projectPolicy);
        const captureSessions = localCaptureSessions.list({ project_id: pid }).data.filter(
          (s: CaptureSession) => s.execution_id === execution.id
        );
        const pcapArtifacts = artifacts.filter(a => a.type === 'PCAP');
        
        return (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-heading font-semibold text-foreground">Capture Réseau</h3>
              </div>
              <CaptureModeBadge mode={captureResult.mode} />
            </div>
            <div className="px-5 py-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Mode</p>
                  <p className="text-xs text-foreground">{captureModeLabel(captureResult.mode)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Source</p>
                  <p className="text-xs text-foreground">{captureSourceLabel(captureResult.source)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Rétention</p>
                  <p className="text-xs text-foreground">{captureResult.policy.retention_days} jours</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">PCAP</p>
                  <p className="text-xs text-foreground">{pcapArtifacts.length} fichier(s)</p>
                </div>
              </div>

              {captureResult.validation_errors.length > 0 && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-md p-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-400">
                    {captureResult.validation_errors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                </div>
              )}

              {captureResult.warnings.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-400">
                    {captureResult.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              )}

              {/* Capture Sessions (Mode B) — enrichi PROBE-HARDEN-1 */}
              {captureSessions.length > 0 && (
                <div className="border-t border-border/50 pt-3">
                  <p className="text-[10px] text-muted-foreground uppercase mb-2">Sessions de capture probe</p>
                  <div className="space-y-2">
                    {captureSessions.map((sess: CaptureSession) => {
                      const reasonLabel = sess.reason_code ? REASON_CODE_LABELS[sess.reason_code as ProbeReasonCode] : null;
                      const reasonSeverity = sess.reason_code ? REASON_CODE_SEVERITY[sess.reason_code as ProbeReasonCode] : null;
                      return (
                        <div key={sess.session_id} className="bg-secondary/20 rounded-md px-3 py-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-foreground">{sess.session_id.slice(0, 12)}...</span>
                              <span className="text-muted-foreground">probe={sess.probe_id}</span>
                              <span className="text-muted-foreground">iface={sess.iface}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {sess.packets_captured != null && (
                                <span className="text-muted-foreground">{sess.packets_captured} paquets</span>
                              )}
                              {sess.bytes_captured != null && sess.bytes_captured > 0 && (
                                <span className="text-muted-foreground">{(sess.bytes_captured / 1024 / 1024).toFixed(1)} MB</span>
                              )}
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                sess.status === 'COMPLETED' ? 'text-green-400 bg-green-500/10' :
                                sess.status === 'RUNNING' ? 'text-blue-400 bg-blue-500/10' :
                                sess.status === 'FAILED' ? 'text-red-400 bg-red-500/10' :
                                sess.status === 'TIMEOUT' ? 'text-orange-400 bg-orange-500/10' :
                                'text-yellow-400 bg-yellow-500/10'
                              }`}>{sess.status}</span>
                              {sess.artifacts.length > 0 && (
                                <span className="text-muted-foreground">{sess.artifacts.length} pcap(s)</span>
                              )}
                            </div>
                          </div>
                          {/* Reason code diagnostic */}
                          {sess.reason_code && (
                            <div className={`mt-1.5 flex items-start gap-1.5 text-[11px] rounded px-2 py-1 ${
                              reasonSeverity === 'critical' ? 'bg-red-500/10 text-red-400' :
                              reasonSeverity === 'error' ? 'bg-orange-500/10 text-orange-400' :
                              'bg-yellow-500/10 text-yellow-400'
                            }`}>
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold font-mono">{sess.reason_code}</span>
                                {reasonLabel && <span className="ml-1.5">{reasonLabel}</span>}
                                {sess.error_message && <p className="text-muted-foreground mt-0.5">{sess.error_message}</p>}
                              </div>
                            </div>
                          )}
                          {sess.is_test_capture && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              Test capture (dry run)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PCAP artifacts quick links */}
              {pcapArtifacts.length > 0 && (
                <div className="border-t border-border/50 pt-3">
                  <p className="text-[10px] text-muted-foreground uppercase mb-2">Fichiers PCAP</p>
                  <div className="space-y-1">
                    {pcapArtifacts.map(art => (
                      <div key={art.id} className="flex items-center justify-between text-xs bg-secondary/20 rounded px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-3 h-3 text-primary" />
                          <span className="font-mono text-foreground">{art.filename}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{(art.size_bytes / 1024 / 1024).toFixed(1)} MB</span>
                          {art.download_url && (
                            <a href={art.download_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              <Download className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Repair Panel — only for FAILED executions with a script */}
      {isFailed && script && canRepairScript && (
        <RepairPanel
          execution={execution}
          script={script}
          incidents={incidents}
          onRepairComplete={(newScript) => {
            setRepairScript(newScript);
            queryClient.invalidateQueries({ queryKey: ['executions'] });
          }}
        />
      )}

      {/* Repair result info */}
      {repairScript && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-5 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Script v{repairScript.version} créé par repair
            </p>
            <p className="text-xs text-muted-foreground">
              {repairScript.framework} — {repairScript.files.length} fichier(s) — {repairScript.status}
            </p>
          </div>
          <Link href="/scripts" className="ml-auto text-xs text-primary hover:underline">
            Voir les scripts
          </Link>
        </div>
      )}

      {/* Artifacts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-heading font-semibold text-foreground">Artefacts</h2>
          {artifacts.some(a => a.s3_uri) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              <Server className="w-2.5 h-2.5" /> MinIO/S3
            </span>
          )}
        </div>
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
                  <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Stockage</th>
                  <th className="text-left px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Taille</th>
                  <th className="text-right px-5 py-3 text-xs font-mono font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {artifacts.map((art) => {
                  const ArtIcon = artifactIcons[art.type] || File;
                  const isS3 = !!art.s3_uri;
                  const isScreenshot = art.type === 'SCREENSHOT' && (art.download_url || art.storage_url);
                  return (
                    <tr key={art.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <ArtIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-primary">{art.type}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-foreground">{art.filename || art.name || '—'}</p>
                        {art.checksum && (
                          <p className="text-[9px] font-mono text-muted-foreground mt-0.5">sha256:{art.checksum.slice(0, 16)}…</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {isS3 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-sky-400">
                            <Server className="w-2.5 h-2.5" />
                            <span className="font-mono">{art.s3_uri?.replace('s3://agilestest-artifacts/', '').slice(0, 30)}…</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-mono">local</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{formatBytes(art.size_bytes)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isScreenshot && (
                            <button
                              onClick={() => window.open(art.download_url || art.storage_url || '', '_blank')}
                              className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                            >
                              <Eye className="w-3.5 h-3.5" /> Preview
                            </button>
                          )}
                          {(art.download_url || art.storage_url) && (
                            <a href={art.download_url || art.storage_url || '#'} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                              <Download className="w-3.5 h-3.5" /> {isS3 ? 'S3' : 'DL'}
                            </a>
                          )}
                        </div>
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
