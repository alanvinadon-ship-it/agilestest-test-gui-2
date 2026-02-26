/**
 * ExecutionsPage — Run Center
 * Sélection automatique du script ACTIVE, bundle, env, runner.
 * Bloque le lancement si aucun script ACTIVE.
 */
import { useState, useMemo, useEffect } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../hooks/usePermission';
import { PermissionKey } from '../admin/permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApiTrpc';
import { localScriptRepository } from '../ai/scriptRepository';
import { useDatasetStorage } from '../contexts/DatasetStorageContext';
import { Link } from 'wouter';
import type { Execution, ExecutionStatus, TestProfile, TestScenario, TargetEnv, DatasetBundle } from '../types';
import type { GeneratedScript } from '../ai/types';
import {
  Play, Loader2, Search, X, AlertCircle, Eye,
  CheckCircle2, XCircle, Clock, AlertTriangle, Ban, Plus,
  Code2, Database, Globe, Server, ChevronDown, Sparkles,
  RotateCcw, FileCode, Package,
} from 'lucide-react';
import { localExecutions, localCapturePolicies } from '../api/localStoreTrpc';
import { toast } from 'sonner';
import { resolveCapturePolicy, CaptureModeBadge } from '../capture';
import type { CapturePolicy, CaptureMode } from '../capture/types';
import { DEFAULT_CAPTURE_POLICY, DEFAULT_RUNNER_TCPDUMP, DEFAULT_PROBE_SPAN_TAP } from '../capture/types';
import { Shield } from 'lucide-react';

const statusConfig: Record<ExecutionStatus, { icon: typeof CheckCircle2; label: string; cls: string; ledCls: string }> = {
  PENDING: { icon: Clock, label: 'En attente', cls: 'text-yellow-400', ledCls: 'status-led-warning' },
  RUNNING: { icon: Loader2, label: 'En cours', cls: 'text-blue-400', ledCls: 'status-led-info' },
  PASSED: { icon: CheckCircle2, label: 'Réussi', cls: 'text-green-400', ledCls: 'status-led-success' },
  FAILED: { icon: XCircle, label: 'Échoué', cls: 'text-red-400', ledCls: 'status-led-error' },
  ERROR: { icon: AlertTriangle, label: 'Erreur', cls: 'text-orange-400', ledCls: 'status-led-warning' },
  CANCELLED: { icon: Ban, label: 'Annulé', cls: 'text-gray-400', ledCls: 'status-led-idle' },
};

const ENV_META: Record<TargetEnv, { label: string; color: string }> = {
  DEV:          { label: 'DEV',          color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  PROD:         { label: 'PROD',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

// ─── Launch Execution Modal (Run Center) ──────────────────────────────────

function RunCenterModal({ isOpen, onClose, projectId }: {
  isOpen: boolean; onClose: () => void; projectId: string;
}) {
  const queryClient = useQueryClient();
  const { adapter } = useDatasetStorage();
  const { can } = usePermission();
  const canWrite = can(PermissionKey.EXECUTIONS_RUN);

  const [profileId, setProfileId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [selectedEnv, setSelectedEnv] = useState<TargetEnv>('DEV');
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [runnerId, setRunnerId] = useState('local-runner-01');
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [captureOverride, setCaptureOverride] = useState<CapturePolicy | null>(null);
  const isAdmin = can(PermissionKey.ADMIN_USERS_MANAGE);

  // Active script auto-detection
  const [activeScript, setActiveScript] = useState<GeneratedScript | null>(null);
  const [scriptOverride, setScriptOverride] = useState<string>('');
  const [allVersions, setAllVersions] = useState<GeneratedScript[]>([]);
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  // Bundles for selected env
  const [bundles, setBundles] = useState<DatasetBundle[]>([]);

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

  // Auto-detect active script when scenario changes
  useEffect(() => {
    if (!scenarioId || !projectId) {
      setActiveScript(null);
      setAllVersions([]);
      return;
    }
    const active = localScriptRepository.getActive(projectId, scenarioId);
    setActiveScript(active);
    setScriptOverride('');
    const versions = localScriptRepository.listVersions(projectId, scenarioId);
    setAllVersions(versions);
  }, [scenarioId, projectId]);

  // Load bundles when env changes
  useEffect(() => {
    if (!projectId) return;
    adapter.bundles.list(projectId, { env: selectedEnv, status: 'ACTIVE' })
      .then(res => {
        setBundles(res.data as DatasetBundle[]);
        if (res.data.length > 0) setSelectedBundleId(res.data[0].bundle_id);
        else setSelectedBundleId('');
      })
      .catch(() => setBundles([]));
  }, [selectedEnv, projectId, adapter.bundles]);

  const effectiveScript = scriptOverride
    ? allVersions.find(s => s.script_id === scriptOverride) || activeScript
    : activeScript;

  // Resolve effective capture policy
  const effectiveCaptureResult = useMemo(() => {
    const projectPolicy = localCapturePolicies.get('project', projectId);
    const scenarioPolicy = scenarioId ? localCapturePolicies.get('scenario', scenarioId) : undefined;
    return resolveCapturePolicy(projectPolicy, undefined, scenarioPolicy, captureOverride || undefined);
  }, [projectId, scenarioId, captureOverride]);

  const captureBlocked = effectiveCaptureResult.validation_errors.length > 0
    ? effectiveCaptureResult.validation_errors[0]
    : null;

  const canLaunch = profileId && scenarioId && effectiveScript && !captureBlocked;

  const handleLaunch = () => {
    if (!canLaunch) {
      setError('Sélectionnez un profil, un scénario avec un script ACTIVE.');
      return;
    }
    setLaunching(true);
    setError(null);
    try {
      localExecutions.create(projectId, {
        profile_id: profileId,
        scenario_id: scenarioId,
        script_id: effectiveScript!.script_id,
        script_version: effectiveScript!.version,
        dataset_bundle_id: selectedBundleId || undefined,
        target_env: selectedEnv,
        runner_id: runnerId,
      });
      queryClient.invalidateQueries({ queryKey: ['executions', projectId] });
      toast.success('Exécution lancée');
      onClose();
    } catch (e: any) {
      setError(e.message || 'Erreur lors du lancement.');
    } finally {
      setLaunching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-2xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-heading font-semibold text-foreground">Run Center</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Profile */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Profil de test</label>
            <select value={profileId} onChange={(e) => { setProfileId(e.target.value); setScenarioId(''); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">Sélectionner un profil</option>
              {profiles.map(p => <option key={p.id} value={p.id}>[{p.test_type || 'VABF'}] {p.name} ({p.domain || p.protocol})</option>)}
            </select>
          </div>

          {/* Scenario */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Scénario</label>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}
              disabled={!profileId}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">{profileId ? 'Sélectionner un scénario' : 'Choisissez d\'abord un profil'}</option>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.scenario_code || s.name} ({s.steps?.length || 0} étapes)</option>)}
            </select>
          </div>

          {/* Script ACTIVE (auto-detected) */}
          {scenarioId && (
            <div className="bg-secondary/20 border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Script de test</span>
                </div>
                {can(PermissionKey.SCRIPTS_ACTIVATE) && allVersions.length > 1 && (
                  <button
                    onClick={() => setShowVersionPicker(!showVersionPicker)}
                    className="text-[10px] text-primary hover:text-primary/80 font-medium"
                  >
                    Changer version
                  </button>
                )}
              </div>

              {effectiveScript ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-foreground">
                    {effectiveScript.framework} v{effectiveScript.version}
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    effectiveScript.status === 'ACTIVE'
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}>
                    {effectiveScript.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{effectiveScript.files.length} fichier(s)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Aucun script ACTIVE pour ce scénario. Générez et activez un script d'abord.
                </div>
              )}

              {showVersionPicker && allVersions.length > 0 && (
                <select
                  value={scriptOverride || effectiveScript?.script_id || ''}
                  onChange={e => setScriptOverride(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-secondary/30 border border-border rounded-md text-foreground mt-1"
                >
                  {allVersions.map(s => (
                    <option key={s.script_id} value={s.script_id}>
                      {s.framework} v{s.version} [{s.status}] — {new Date(s.created_at).toLocaleDateString('fr-FR')}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Capture Policy Effective */}
          {scenarioId && (
            <div className="bg-secondary/20 border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capture (mode effectif)</span>
                </div>
                <CaptureModeBadge mode={effectiveCaptureResult.mode} />
              </div>
              {effectiveCaptureResult.mode === 'RUNNER_TCPDUMP' && (
                <div className="text-[10px] text-muted-foreground font-mono">
                  iface={effectiveCaptureResult.policy.runner_tcpdump.iface || '?'} | bpf="{effectiveCaptureResult.policy.runner_tcpdump.bpf_filter || 'any'}" | snaplen={effectiveCaptureResult.policy.runner_tcpdump.snaplen}
                </div>
              )}
              {effectiveCaptureResult.mode === 'PROBE_SPAN_TAP' && (
                <div className="text-[10px] text-muted-foreground font-mono">
                  probe={effectiveCaptureResult.policy.probe_span_tap.probe_id || '?'} | iface={effectiveCaptureResult.policy.probe_span_tap.iface || '?'} | vlan={effectiveCaptureResult.policy.probe_span_tap.vlan_filter || '*'}
                </div>
              )}
              {captureBlocked && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {captureBlocked} — lancement bloqué
                </div>
              )}
              {isAdmin && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <label className="text-[10px] text-muted-foreground">Override admin (ce run uniquement) :</label>
                  <select
                    value={captureOverride?.default_mode || ''}
                    onChange={e => {
                      const mode = e.target.value as 'NONE' | 'RUNNER_TCPDUMP' | 'PROBE_SPAN_TAP' | '';
                      if (!mode) { setCaptureOverride(null); return; }
                      setCaptureOverride({
                        default_mode: mode as CaptureMode,
                        runner_tcpdump: { ...DEFAULT_RUNNER_TCPDUMP },
                        probe_span_tap: { ...DEFAULT_PROBE_SPAN_TAP },
                        retention_days: 30,
                      });
                    }}
                    className="w-full text-xs px-3 py-1.5 bg-secondary/30 border border-border rounded-md text-foreground mt-1"
                  >
                    <option value="">Pas d'override</option>
                    <option value="NONE">NONE (désactiver)</option>
                    <option value="RUNNER_TCPDUMP">A — Runner tcpdump</option>
                    <option value="PROBE_SPAN_TAP">B — Probe SPAN/TAP</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Env + Bundle + Runner */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Globe className="w-3 h-3 inline mr-1" />Environnement
              </label>
              <select value={selectedEnv} onChange={e => setSelectedEnv(e.target.value as TargetEnv)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                {ALL_ENVS.map(e => <option key={e} value={e}>{ENV_META[e].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Package className="w-3 h-3 inline mr-1" />Bundle
              </label>
              <select value={selectedBundleId} onChange={e => setSelectedBundleId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                <option value="">Aucun</option>
                {bundles.map(b => <option key={b.bundle_id} value={b.bundle_id}>{b.name} v{b.version}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                <Server className="w-3 h-3 inline mr-1" />Runner
              </label>
              <input
                type="text"
                value={runnerId}
                onChange={e => setRunnerId(e.target.value)}
                placeholder="Runner ID"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            <button
              onClick={handleLaunch}
              disabled={launching || !canLaunch}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Lancer l'exécution
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function ExecutionsPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const { can: canPerm } = usePermission();
  const canRunExecution = canPerm(PermissionKey.EXECUTIONS_RUN);
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
    refetchInterval: 10000,
  });

  const executions = (data?.data || []) as Execution[];

  const filteredExecutions = useMemo(() => {
    if (!search.trim()) return executions;
    const q = search.toLowerCase();
    return executions.filter(e =>
      e.id.toLowerCase().includes(q) ||
      e.scenario_id.toLowerCase().includes(q) ||
      (e.script_id || '').toLowerCase().includes(q) ||
      (e.target_env || '').toLowerCase().includes(q)
    );
  }, [executions, search]);

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
          <button onClick={() => setShowLaunch(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" /> Nouvelle exécution
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
      ) : filteredExecutions.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucune exécution</h3>
          <p className="text-sm text-muted-foreground mb-4">Lancez votre première exécution de test.</p>
          {canRunExecution && (
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
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Env</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Script</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Durée</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Incidents</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Repair</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExecutions.map((exec) => {
                const config = statusConfig[exec.status];
                const StatusIcon = config.icon;
                const envMeta = exec.target_env ? ENV_META[exec.target_env] : null;

                return (
                  <tr key={exec.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.cls}`}>
                        <StatusIcon className={`w-3.5 h-3.5 ${exec.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                        {config.label}
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
                      {exec.script_id ? (
                        <span className="text-xs font-mono text-foreground">
                          v{exec.script_version || '?'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{formatDuration(exec.duration_ms)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs ${exec.incidents_count > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {exec.incidents_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {exec.started_at ? new Date(exec.started_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {exec.ai_repair_from_execution_id ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
                          <Sparkles className="w-2.5 h-2.5" /> Repaired
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
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

      <RunCenterModal isOpen={showLaunch} onClose={() => setShowLaunch(false)} projectId={currentProject.id} />
    </div>
  );
}
