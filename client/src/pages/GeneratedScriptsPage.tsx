/**
 * GeneratedScriptsPage — Liste et gestion des scripts générés par l'IA.
 * Filtres par scénario, framework, env, status. Visualisation des fichiers.
 */
import { useState, useMemo } from 'react';
import { useProject } from '../state/projectStore';
import { usePermission, PermissionKey } from '../security';
import { localScriptRepository } from '../ai/scriptRepository';
import type { GeneratedScript, ScriptFramework, ScriptStatus } from '../ai/types';
import type { TargetEnv } from '../types';
import {
  Code2, FileCode, Trash2, CheckCircle2, Archive, Eye, Download,
  Filter, Search, ChevronDown, ChevronRight, Copy, X, Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Metadata ─────────────────────────────────────────────────────────────

const FRAMEWORK_META: Record<string, { label: string; color: string }> = {
  playwright:     { label: 'Playwright',     color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  robotframework: { label: 'RobotFramework', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  cypress:        { label: 'Cypress',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  selenium:       { label: 'Selenium',       color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  k6:             { label: 'K6',             color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  custom:         { label: 'Custom',         color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

const STATUS_META: Record<ScriptStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
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

export default function GeneratedScriptsPage() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id || '';
  const { can } = usePermission();
  const canActivateScript = can(PermissionKey.SCRIPTS_ACTIVATE);
  const canDeleteScript = can(PermissionKey.SCRIPTS_DELETE);

  // Filters
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState<ScriptFramework | ''>('');
  const [filterStatus, setFilterStatus] = useState<ScriptStatus | ''>('');
  const [filterEnv, setFilterEnv] = useState<TargetEnv | ''>('');

  // Expanded script (view files)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewFileIdx, setViewFileIdx] = useState(0);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  const scripts = useMemo(() => {
    if (!projectId) return [];
    const result = localScriptRepository.list(projectId, {
      framework: filterFramework || undefined,
      status: filterStatus || undefined,
      env: filterEnv || undefined,
    });
    let data = result.data;
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(s =>
        s.scenario_id.toLowerCase().includes(q) ||
        s.framework.toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
      );
    }
    return data;
  }, [projectId, filterFramework, filterStatus, filterEnv, search, refreshKey]);

  const handleActivate = (scriptId: string) => {
    try {
      localScriptRepository.activate(scriptId);
      toast.success('Script activé');
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = (scriptId: string) => {
    localScriptRepository.delete(scriptId);
    toast.success('Script supprimé');
    if (expandedId === scriptId) setExpandedId(null);
    setRefreshKey(k => k + 1);
  };

  const handleCopyFile = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Contenu copié');
  };

  const handleDownloadAll = (script: GeneratedScript) => {
    // Simple download as concatenated text
    const content = script.files.map(f => `// === ${f.path} ===\n${f.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.scenario_id}_${script.framework}_v${script.version}.txt`;
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
            placeholder="Rechercher (scénario, framework, notes)..."
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
          onChange={e => setFilterStatus(e.target.value as ScriptStatus | '')}
          className="text-xs px-3 py-2 bg-secondary/30 border border-border rounded-md text-foreground"
        >
          <option value="">Tous statuts</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>

        <select
          value={filterEnv}
          onChange={e => setFilterEnv(e.target.value as TargetEnv | '')}
          className="text-xs px-3 py-2 bg-secondary/30 border border-border rounded-md text-foreground"
        >
          <option value="">Tous env</option>
          {ALL_ENVS.map(e => (
            <option key={e} value={e}>{ENV_META[e].label}</option>
          ))}
        </select>
      </div>

      {/* Scripts List */}
      {scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Sparkles className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Aucun script généré.</p>
          <p className="text-xs mt-1">Utilisez le bouton "Générer Script" depuis un scénario.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scripts.map(script => {
            const isExpanded = expandedId === script.script_id;
            const fwMeta = FRAMEWORK_META[script.framework] || FRAMEWORK_META.custom;
            const stMeta = STATUS_META[script.status];
            const envMeta = ENV_META[script.env];
            const StIcon = stMeta.icon;

            return (
              <div key={script.script_id} className="border border-border rounded-lg bg-card/50 overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => { setExpandedId(isExpanded ? null : script.script_id); setViewFileIdx(0); }}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}

                  <Code2 className="w-4 h-4 text-primary shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-semibold text-foreground truncate">
                        {script.scenario_id}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${fwMeta.color}`}>
                        {fwMeta.label}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${envMeta.color}`}>
                        {envMeta.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${stMeta.color}`}>
                        <StIcon className="w-3 h-3" />{stMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">v{script.version}</span>
                      <span className="text-[10px] text-muted-foreground">{script.files.length} fichier(s)</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(script.created_at).toLocaleDateString('fr-FR')}</span>
                      {script.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{script.notes}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {canActivateScript && script.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleActivate(script.script_id)}
                        className="p-1.5 rounded hover:bg-green-500/10 text-muted-foreground hover:text-green-400 transition-colors"
                        title="Activer cette version"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDownloadAll(script)}
                      className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Télécharger"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canDeleteScript && (
                      <button
                        onClick={() => handleDelete(script.script_id)}
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
                    {script.warnings && script.warnings.length > 0 && (
                      <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/10">
                        {script.warnings.map((w, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {w}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* File tabs */}
                    <div className="flex border-b border-border overflow-x-auto">
                      {script.files.map((f, idx) => (
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
                    {script.files[viewFileIdx] && (
                      <div className="relative">
                        <button
                          onClick={() => handleCopyFile(script.files[viewFileIdx].content)}
                          className="absolute top-2 right-2 p-1.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors z-10"
                          title="Copier"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <pre className="p-4 text-xs font-mono text-foreground/90 overflow-x-auto max-h-[400px] overflow-y-auto bg-black/20">
                          <code>{script.files[viewFileIdx].content}</code>
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
    </div>
  );
}
