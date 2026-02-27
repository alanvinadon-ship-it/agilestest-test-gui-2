/**
 * GeneratedScriptsPage — Liste et gestion des scripts générés par l'IA.
 * Filtres par scénario, framework, env, status. Visualisation des fichiers.
 * Utilise tRPC scripts.* pour la persistance DB.
 */
import { useState, useMemo } from 'react';
import { useProject } from '../state/projectStore';
import { usePermission, PermissionKey } from '../security';
import { trpc } from '@/lib/trpc';
import type { TargetEnv } from '../types';
import type { ScriptFramework, ScriptStatus } from '../ai/types';
import {
  Code2, FileCode, Trash2, CheckCircle2, Archive, Download,
  Search, ChevronDown, ChevronRight, Copy, Sparkles,
  AlertTriangle, Loader2, GitCompare, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import ScriptDiffViewer from '../components/ScriptDiffViewer';

// ─── Metadata ─────────────────────────────────────────────────────────────

const FRAMEWORK_META: Record<string, { label: string; color: string }> = {
  playwright:     { label: 'Playwright',     color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  robotframework: { label: 'RobotFramework', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  cypress:        { label: 'Cypress',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  selenium:       { label: 'Selenium',       color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  k6:             { label: 'K6',             color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  custom:         { label: 'Custom',         color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  DRAFT:      { label: 'Brouillon',  color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', icon: FileCode },
  ACTIVE:     { label: 'Actif',      color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
  DEPRECATED: { label: 'Déprécié',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Archive },
};

const ENV_META: Record<TargetEnv, { label: string; color: string }> = {
  DEV:          { label: 'DEV',          color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  PROD:         { label: 'PROD',         color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

const ALL_FRAMEWORKS: ScriptFramework[] = ['playwright', 'robotframework', 'cypress', 'k6', 'custom'];
const ALL_STATUSES: ScriptStatus[] = ['DRAFT', 'ACTIVE', 'DEPRECATED'];
const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];

/** Parse the JSON-encoded `code` column back into files/plan/metadata */
function parseCodePayload(code: string): {
  files: Array<{ path: string; content: string; language?: string }>;
  plan: any;
  notes: string | null;
  warnings: string[] | null;
  env: string | null;
  bundleId: string | null;
} {
  try {
    const parsed = JSON.parse(code);
    if (parsed.files && Array.isArray(parsed.files)) {
      return parsed;
    }
    // Fallback: single-file code stored as plain text
    return { files: [{ path: 'script.ts', content: code }], plan: null, notes: null, warnings: null, env: null, bundleId: null };
  } catch {
    return { files: [{ path: 'script.ts', content: code }], plan: null, notes: null, warnings: null, env: null, bundleId: null };
  }
}

export default function GeneratedScriptsPage() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || '';
  const { can } = usePermission();
  const canActivateScript = can(PermissionKey.SCRIPTS_ACTIVATE);
  const canDeleteScript = can(PermissionKey.SCRIPTS_DELETE);
  const [, navigate] = useLocation();

  // Filters
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState<ScriptFramework | ''>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Expanded script (view files)
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewFileIdx, setViewFileIdx] = useState(0);

  // Diff viewer state
  const [diffScenarioId, setDiffScenarioId] = useState<number | null>(null);
  const [diffFramework, setDiffFramework] = useState<string | null>(null);

  // Execute mutation
  const executeMutation = trpc.executions.create.useMutation();

  // tRPC queries
  const { data: scriptsData, isLoading, refetch } = trpc.scripts.list.useQuery(
    {
      projectId: String(projectId),
      search: search.trim() || undefined,
    },
    { enabled: !!projectId },
  );

  const updateMutation = trpc.scripts.update.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteMutation = trpc.scripts.delete.useMutation({
    onSuccess: () => refetch(),
  });

  // Client-side filtering for framework and status (server already handles search)
  const scripts = useMemo(() => {
    if (!scriptsData?.data) return [];
    let data = scriptsData.data;
    if (filterFramework) {
      data = data.filter((s: any) => s.framework === filterFramework);
    }
    if (filterStatus) {
      data = data.filter((s: any) => s.status === filterStatus);
    }
    return data;
  }, [scriptsData, filterFramework, filterStatus]);

  const handleActivate = (scriptId: number) => {
    updateMutation.mutate(
      { scriptId, status: 'ACTIVE' },
      { onSuccess: () => toast.success('Script activé') },
    );
  };

  const handleDelete = (scriptId: number) => {
    deleteMutation.mutate(
      { scriptId },
      {
        onSuccess: () => {
          toast.success('Script supprimé');
          if (expandedId === scriptId) setExpandedId(null);
        },
      },
    );
  };

  // Diff viewer: load versions for the selected scenario+framework
  const { data: versionsData } = trpc.scripts.listVersions.useQuery(
    {
      projectId: String(projectId),
      scenarioId: diffScenarioId!,
      framework: diffFramework || undefined,
    },
    { enabled: !!projectId && diffScenarioId !== null },
  );

  const handleOpenDiff = (script: any) => {
    if (!script.scenarioId) {
      toast.error('Ce script n\'a pas de scénario associé — comparaison impossible');
      return;
    }
    setDiffScenarioId(script.scenarioId);
    setDiffFramework(script.framework);
  };

  /** Create an execution from a generated script and navigate to executions page */
  const handleExecute = (script: any) => {
    const payload = parseCodePayload(script.code || '');
    const env = payload.env || 'DEV';
    executeMutation.mutate(
      {
        projectId: String(projectId),
        scenarioId: script.scenarioId ? String(script.scenarioId) : undefined,
        scriptId: String(script.id),
        targetEnv: env as any,
        runnerType: script.framework,
      },
      {
        onSuccess: (result) => {
          toast.success(`Exécution #${result.executionId} créée`);
          navigate('/executions');
        },
        onError: (err) => {
          toast.error(`Erreur : ${err.message}`);
        },
      },
    );
  };

  const handleCopyFile = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Contenu copié');
  };

  const handleDownloadAll = (script: any, files: Array<{ path: string; content: string }>) => {
    const content = files.map(f => `// === ${f.path} ===\n${f.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.name}_${script.framework}_v${script.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Téléchargement lancé');
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Sélectionnez un projet pour voir les scripts générés.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" />
            Scripts Générés
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scripts de test générés par l'IA à partir des scénarios et datasets
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
          {scripts.length} script(s)
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher (nom, framework)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/30 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={filterFramework}
          onChange={e => setFilterFramework(e.target.value as ScriptFramework | '')}
          className="text-xs px-3 py-2 bg-secondary/30 border border-border rounded-md text-foreground"
        >
          <option value="">Tous frameworks</option>
          {ALL_FRAMEWORKS.map(f => (
            <option key={f} value={f}>{FRAMEWORK_META[f]?.label || f}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs px-3 py-2 bg-secondary/30 border border-border rounded-md text-foreground"
        >
          <option value="">Tous statuts</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}

      {/* Scripts List */}
      {!isLoading && scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Sparkles className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Aucun script généré.</p>
          <p className="text-xs mt-1">Utilisez le bouton "Générer Script" depuis un scénario.</p>
        </div>
      ) : !isLoading && (
        <div className="space-y-2">
          {scripts.map((script: any) => {
            const isExpanded = expandedId === script.id;
            const payload = parseCodePayload(script.code || '');
            const fwMeta = FRAMEWORK_META[script.framework] || FRAMEWORK_META.custom;
            const stMeta = STATUS_META[script.status] || STATUS_META.DRAFT;
            const envLabel = payload.env ? (ENV_META[payload.env as TargetEnv]?.label || payload.env) : null;
            const envColor = payload.env ? (ENV_META[payload.env as TargetEnv]?.color || 'text-slate-400 bg-slate-500/10 border-slate-500/20') : null;
            const StIcon = stMeta.icon;

            return (
              <div key={script.id} className="border border-border rounded-lg bg-card/50 overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => { setExpandedId(isExpanded ? null : script.id); setViewFileIdx(0); }}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}

                  <Code2 className="w-4 h-4 text-primary shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-semibold text-foreground truncate">
                        {script.name}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${fwMeta.color}`}>
                        {fwMeta.label}
                      </span>
                      {envLabel && envColor && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${envColor}`}>
                          {envLabel}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${stMeta.color}`}>
                        <StIcon className="w-3 h-3" />{stMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">v{script.version}</span>
                      <span className="text-[10px] text-muted-foreground">{payload.files.length} fichier(s)</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(script.createdAt).toLocaleDateString('fr-FR')}</span>
                      {payload.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{payload.notes}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {canActivateScript && script.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleActivate(script.id)}
                        disabled={updateMutation.isPending}
                        className="p-1.5 rounded hover:bg-green-500/10 text-muted-foreground hover:text-green-400 transition-colors"
                        title="Activer cette version"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleExecute(script)}
                      disabled={executeMutation.isPending}
                      className="p-1.5 rounded hover:bg-sky-500/10 text-muted-foreground hover:text-sky-400 transition-colors"
                      title="Exécuter ce script"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenDiff(script)}
                      className="p-1.5 rounded hover:bg-violet-500/10 text-muted-foreground hover:text-violet-400 transition-colors"
                      title="Comparer les versions"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDownloadAll(script, payload.files)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Télécharger"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canDeleteScript && (
                      <button
                        onClick={() => handleDelete(script.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: File viewer */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Warnings */}
                    {payload.warnings && payload.warnings.length > 0 && (
                      <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/10">
                        {payload.warnings.map((w, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {w}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* File tabs */}
                    <div className="flex border-b border-border overflow-x-auto">
                      {payload.files.map((f, idx) => (
                        <button
                          key={idx}
                          onClick={() => setViewFileIdx(idx)}
                          className={`px-3 py-2 text-xs font-mono whitespace-nowrap border-b-2 transition-colors ${
                            viewFileIdx === idx
                              ? 'border-primary text-primary bg-primary/5'
                              : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {f.path}
                        </button>
                      ))}
                    </div>

                    {/* File content */}
                    {payload.files[viewFileIdx] && (
                      <div className="relative">
                        <button
                          onClick={() => handleCopyFile(payload.files[viewFileIdx].content)}
                          className="absolute top-2 right-2 p-1.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors z-10"
                          title="Copier"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <pre className="p-4 text-xs font-mono text-foreground/90 overflow-x-auto max-h-[400px] overflow-y-auto bg-black/20">
                          <code>{payload.files[viewFileIdx].content}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Diff Viewer Modal */}
      {diffScenarioId !== null && versionsData?.data && versionsData.data.length >= 2 && (
        <ScriptDiffViewer
          versions={versionsData.data as any}
          onClose={() => { setDiffScenarioId(null); setDiffFramework(null); }}
        />
      )}
      {diffScenarioId !== null && versionsData?.data && versionsData.data.length < 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setDiffScenarioId(null); setDiffFramework(null); }} />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl p-8 mx-4 text-center">
            <GitCompare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
            <p className="text-sm text-muted-foreground">Il faut au moins 2 versions du même scénario pour comparer.</p>
            <button
              onClick={() => { setDiffScenarioId(null); setDiffFramework(null); }}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
