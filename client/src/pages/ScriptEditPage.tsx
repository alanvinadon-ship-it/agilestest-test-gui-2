/**
 * ScriptEditPage — Full-featured script editor with Monaco, versioning, auto-save,
 * and integrated diff viewer for comparing versions side-by-side.
 * Route: /scripts/:id/edit
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import ScriptEditor from '../components/ScriptEditor';
import MonacoDiffViewer from '../components/MonacoDiffViewer';
import {
  ArrowLeft, Save, History, RotateCcw, FileCode, Loader2, Clock,
  AlertTriangle, X, Download, Copy, Sparkles, GitCompare,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScriptFile {
  path: string;
  content: string;
  language?: string;
}

interface CodePayload {
  files: ScriptFile[];
  plan: any;
  notes: string | null;
  warnings: string[] | null;
  env: string | null;
  bundleId: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCodePayload(code: string): CodePayload {
  try {
    const parsed = JSON.parse(code);
    if (parsed.files && Array.isArray(parsed.files)) return parsed;
    return { files: [{ path: 'script.ts', content: code }], plan: null, notes: null, warnings: null, env: null, bundleId: null };
  } catch {
    return { files: [{ path: 'script.ts', content: code }], plan: null, notes: null, warnings: null, env: null, bundleId: null };
  }
}

function serializeCodePayload(payload: CodePayload): string {
  return JSON.stringify(payload);
}

function getLanguageFromPath(path: string): string {
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  if (path.endsWith('.robot')) return 'robotframework';
  if (path.endsWith('.py')) return 'python';
  return 'typescript';
}

const FRAMEWORK_META: Record<string, { label: string; color: string }> = {
  playwright:     { label: 'Playwright',     color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  robotframework: { label: 'RobotFramework', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  cypress:        { label: 'Cypress',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  selenium:       { label: 'Selenium',       color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  k6:             { label: 'K6',             color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  custom:         { label: 'Custom',         color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:      { label: 'Brouillon',  color: 'text-slate-400' },
  VALIDATED:  { label: 'Validé',     color: 'text-green-400' },
  DEPRECATED: { label: 'Déprécié',   color: 'text-amber-400' },
};

// ─── Auto-save hook ─────────────────────────────────────────────────────────

function useAutoSave(scriptId: number | null, code: string, enabled: boolean) {
  const autoSaveMutation = trpc.scripts.autoSave.useMutation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(code);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!enabled || !scriptId || code === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setIsSaving(true);
      autoSaveMutation.mutate(
        { scriptId, code },
        {
          onSuccess: (res) => {
            lastSavedRef.current = code;
            setLastSavedAt(res.savedAt);
            setIsSaving(false);
          },
          onError: () => setIsSaving(false),
        },
      );
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, scriptId, enabled]);

  return { lastSavedAt, isSaving };
}

// ─── View modes ─────────────────────────────────────────────────────────────

type ViewMode = 'editor' | 'diff';

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ScriptEditPage() {
  const [, params] = useRoute('/scripts/:id/edit');
  const [, navigate] = useLocation();
  const scriptId = params?.id ? Number(params.id) : null;

  // State
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [payload, setPayload] = useState<CodePayload | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showPlanPanel, setShowPlanPanel] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');

  // Diff state
  const [diffLeftVersionId, setDiffLeftVersionId] = useState<number | null>(null);
  const [diffRightVersionId, setDiffRightVersionId] = useState<number | null>(null);
  const [diffFileIdx, setDiffFileIdx] = useState(0);

  // Queries
  const { data: script, isLoading, refetch } = trpc.scripts.get.useQuery(
    { scriptId: scriptId! },
    { enabled: scriptId !== null },
  );

  const { data: versionHistory, refetch: refetchVersions } = trpc.scripts.getVersionHistory.useQuery(
    { scriptId: scriptId! },
    { enabled: scriptId !== null && (showVersionPanel || viewMode === 'diff') },
  );

  // Mutations
  const saveVersionMutation = trpc.scripts.saveVersion.useMutation();
  const restoreVersionMutation = trpc.scripts.restoreVersion.useMutation();
  const updateMutation = trpc.scripts.update.useMutation();

  // Initialize payload from script data
  useEffect(() => {
    if (script?.code && !payload) {
      setPayload(parseCodePayload(script.code));
    }
  }, [script]);

  // Serialize current payload for auto-save
  const serializedCode = useMemo(() => {
    if (!payload) return '';
    return serializeCodePayload(payload);
  }, [payload]);

  // Auto-save
  const { lastSavedAt, isSaving } = useAutoSave(scriptId, serializedCode, isDirty);

  // Auto-select diff versions when entering diff mode
  useEffect(() => {
    if (viewMode === 'diff' && versionHistory?.data?.length) {
      const versions = versionHistory.data;
      if (diffLeftVersionId === null && versions.length >= 2) {
        setDiffLeftVersionId(versions[1].id);  // second most recent (older)
        setDiffRightVersionId(versions[0].id); // most recent (newer)
      } else if (diffLeftVersionId === null && versions.length === 1) {
        setDiffLeftVersionId(versions[0].id);
        setDiffRightVersionId(versions[0].id);
      }
    }
  }, [viewMode, versionHistory]);

  // ─── Diff data ──────────────────────────────────────────────────────────

  const diffLeftVersion = useMemo(() => {
    if (!versionHistory?.data || !diffLeftVersionId) return null;
    return versionHistory.data.find((v: any) => v.id === diffLeftVersionId) || null;
  }, [versionHistory, diffLeftVersionId]);

  const diffRightVersion = useMemo(() => {
    if (!versionHistory?.data || !diffRightVersionId) return null;
    return versionHistory.data.find((v: any) => v.id === diffRightVersionId) || null;
  }, [versionHistory, diffRightVersionId]);

  const diffLeftPayload = useMemo(() => {
    if (!diffLeftVersion?.code) return null;
    return parseCodePayload(diffLeftVersion.code);
  }, [diffLeftVersion]);

  const diffRightPayload = useMemo(() => {
    if (!diffRightVersion?.code) return null;
    return parseCodePayload(diffRightVersion.code);
  }, [diffRightVersion]);

  // Union of all file paths in both versions
  const diffFilePaths = useMemo(() => {
    const set = new Set<string>();
    diffLeftPayload?.files.forEach(f => set.add(f.path));
    diffRightPayload?.files.forEach(f => set.add(f.path));
    return Array.from(set);
  }, [diffLeftPayload, diffRightPayload]);

  const diffCurrentPath = diffFilePaths[diffFileIdx] || diffFilePaths[0] || '';
  const diffLeftContent = diffLeftPayload?.files.find(f => f.path === diffCurrentPath)?.content || '';
  const diffRightContent = diffRightPayload?.files.find(f => f.path === diffCurrentPath)?.content || '';

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleFileChange = useCallback((newContent: string) => {
    if (!payload) return;
    const newFiles = [...payload.files];
    newFiles[activeFileIdx] = { ...newFiles[activeFileIdx], content: newContent };
    setPayload({ ...payload, files: newFiles });
    setIsDirty(true);
  }, [payload, activeFileIdx]);

  const handleSaveVersion = useCallback(() => {
    if (!scriptId) return;
    saveVersionMutation.mutate(
      { scriptId, changeSummary: 'Sauvegarde manuelle' },
      {
        onSuccess: (res) => {
          toast.success(`Version ${res.version} sauvegardée`);
          setIsDirty(false);
          refetch();
          if (showVersionPanel || viewMode === 'diff') refetchVersions();
        },
        onError: (err) => toast.error(`Erreur: ${err.message}`),
      },
    );
  }, [scriptId, showVersionPanel, viewMode]);

  const handleRestoreVersion = useCallback((versionId: number, versionNum: number) => {
    if (!scriptId) return;
    restoreVersionMutation.mutate(
      { scriptId, versionId },
      {
        onSuccess: () => {
          toast.success(`Version ${versionNum} restaurée`);
          refetch().then(({ data }) => {
            if (data?.code) {
              setPayload(parseCodePayload(data.code));
              setIsDirty(false);
            }
          });
          refetchVersions();
        },
        onError: (err) => toast.error(`Erreur: ${err.message}`),
      },
    );
  }, [scriptId]);

  const handleStatusChange = useCallback((status: string) => {
    if (!scriptId) return;
    updateMutation.mutate(
      { scriptId, status: status as any },
      {
        onSuccess: () => {
          toast.success(`Statut changé: ${STATUS_META[status]?.label || status}`);
          refetch();
        },
        onError: (err) => toast.error(`Erreur: ${err.message}`),
      },
    );
  }, [scriptId]);

  const handleCopyFile = useCallback(() => {
    if (!payload?.files[activeFileIdx]) return;
    navigator.clipboard.writeText(payload.files[activeFileIdx].content);
    toast.success('Contenu copié');
  }, [payload, activeFileIdx]);

  const handleDownloadAll = useCallback(() => {
    if (!payload || !script) return;
    const content = payload.files.map(f => `// === ${f.path} ===\n${f.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.framework}_v${script.version}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Téléchargement lancé');
  }, [payload, script]);

  const handleCtrlS = useCallback(() => {
    handleSaveVersion();
  }, [handleSaveVersion]);

  const toggleDiffMode = useCallback(() => {
    if (viewMode === 'diff') {
      setViewMode('editor');
    } else {
      setViewMode('diff');
    }
  }, [viewMode]);

  // ─── Loading / Error ────────────────────────────────────────────────────

  if (!scriptId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Script introuvable.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement du script...</span>
      </div>
    );
  }

  if (!script || !payload) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <AlertTriangle className="w-5 h-5 mr-2" />
        <p>Script introuvable ou données invalides.</p>
      </div>
    );
  }

  const fwMeta = FRAMEWORK_META[script.framework ?? 'custom'] || FRAMEWORK_META.custom;
  const activeFile = payload.files[activeFileIdx];
  const hasVersions = (versionHistory?.data?.length ?? 0) >= 2;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/80 shrink-0">
        {/* Back */}
        <button
          onClick={() => navigate('/scripts')}
          className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Retour aux scripts"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Script info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileCode className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-mono text-muted-foreground">
            {script.uid?.slice(0, 8)}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${fwMeta.color}`}>
            {fwMeta.label}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">v{script.version}</span>

          {/* Status dropdown */}
          <select
            value={script.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded border border-border bg-transparent cursor-pointer ${STATUS_META[script.status]?.color || 'text-slate-400'}`}
          >
            <option value="DRAFT">Brouillon</option>
            <option value="VALIDATED">Validé</option>
            <option value="DEPRECATED">Déprécié</option>
          </select>

          {/* Dirty indicator */}
          {isDirty && viewMode === 'editor' && (
            <span className="text-[10px] text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Modifié
            </span>
          )}

          {/* Auto-save indicator */}
          {isSaving && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Sauvegarde...
            </span>
          )}
          {lastSavedAt && !isSaving && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(lastSavedAt).toLocaleTimeString('fr-FR')}
            </span>
          )}

          {/* View mode indicator */}
          {viewMode === 'diff' && (
            <span className="text-[10px] text-cyan-400 flex items-center gap-1 bg-cyan-500/10 px-2 py-0.5 rounded">
              <GitCompare className="w-3 h-3" />
              Mode Diff
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyFile}
            className="h-7 text-xs gap-1"
            disabled={viewMode === 'diff'}
          >
            <Copy className="w-3 h-3" />
            Copier
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            className="h-7 text-xs gap-1"
          >
            <Download className="w-3 h-3" />
            Télécharger
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowVersionPanel(!showVersionPanel); if (viewMode === 'diff') setViewMode('editor'); }}
            className={`h-7 text-xs gap-1 ${showVersionPanel && viewMode !== 'diff' ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}
          >
            <History className="w-3 h-3" />
            Versions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDiffMode}
            className={`h-7 text-xs gap-1 ${viewMode === 'diff' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : ''}`}
          >
            <GitCompare className="w-3 h-3" />
            Diff
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPlanPanel(!showPlanPanel)}
            className={`h-7 text-xs gap-1 ${showPlanPanel ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : ''}`}
          >
            <Sparkles className="w-3 h-3" />
            Plan IA
          </Button>
          <Button
            size="sm"
            onClick={handleSaveVersion}
            disabled={saveVersionMutation.isPending || viewMode === 'diff'}
            className="h-7 text-xs gap-1"
          >
            {saveVersionMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Sauvegarder
          </Button>
        </div>
      </div>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Editor / Diff Area ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {viewMode === 'editor' ? (
            <>
              {/* File tabs */}
              <div className="flex border-b border-border overflow-x-auto bg-[#252526] shrink-0">
                {payload.files.map((f, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFileIdx(idx)}
                    className={`px-4 py-2 text-xs font-mono whitespace-nowrap border-r border-[#3c3c3c] transition-colors flex items-center gap-1.5 ${
                      activeFileIdx === idx
                        ? 'bg-[#1e1e1e] text-foreground'
                        : 'bg-[#2d2d2d] text-muted-foreground hover:text-foreground hover:bg-[#2a2a2a]'
                    }`}
                  >
                    <FileCode className="w-3 h-3" />
                    {f.path}
                  </button>
                ))}
              </div>

              {/* Monaco Editor */}
              <div className="flex-1">
                {activeFile && (
                  <ScriptEditor
                    value={activeFile.content}
                    language={activeFile.language || getLanguageFromPath(activeFile.path)}
                    onChange={handleFileChange}
                    onSave={handleCtrlS}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              {/* ─── Diff Mode ─────────────────────────────────────────── */}
              {/* Version selectors */}
              <div className="flex items-center gap-3 px-4 py-2 bg-[#252526] border-b border-[#3c3c3c] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Ancien</span>
                  <select
                    value={diffLeftVersionId ?? ''}
                    onChange={(e) => setDiffLeftVersionId(Number(e.target.value))}
                    className="text-xs px-2 py-1 bg-red-500/5 border border-red-500/20 rounded text-foreground"
                  >
                    {!versionHistory?.data?.length && <option value="">Aucune version</option>}
                    {versionHistory?.data?.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} — {new Date(v.createdAt).toLocaleString('fr-FR')} {v.changeSummary ? `(${v.changeSummary})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-muted-foreground text-xs">→</span>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">Nouveau</span>
                  <select
                    value={diffRightVersionId ?? ''}
                    onChange={(e) => setDiffRightVersionId(Number(e.target.value))}
                    className="text-xs px-2 py-1 bg-green-500/5 border border-green-500/20 rounded text-foreground"
                  >
                    {!versionHistory?.data?.length && <option value="">Aucune version</option>}
                    {versionHistory?.data?.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} — {new Date(v.createdAt).toLocaleString('fr-FR')} {v.changeSummary ? `(${v.changeSummary})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1" />

                {/* Diff file tabs */}
                {diffFilePaths.length > 1 && (
                  <div className="flex items-center gap-1">
                    {diffFilePaths.map((path, idx) => {
                      const inLeft = diffLeftPayload?.files.some(f => f.path === path);
                      const inRight = diffRightPayload?.files.some(f => f.path === path);
                      let badge = '';
                      let badgeColor = '';
                      if (!inLeft) { badge = 'NEW'; badgeColor = 'text-green-400 bg-green-500/10'; }
                      else if (!inRight) { badge = 'DEL'; badgeColor = 'text-red-400 bg-red-500/10'; }

                      return (
                        <button
                          key={path}
                          onClick={() => setDiffFileIdx(idx)}
                          className={`px-2 py-1 text-[10px] font-mono whitespace-nowrap rounded transition-colors flex items-center gap-1 ${
                            diffFileIdx === idx
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {path.split('/').pop()}
                          {badge && (
                            <span className={`text-[8px] px-1 rounded font-bold ${badgeColor}`}>{badge}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Monaco Diff Editor */}
              <div className="flex-1">
                {!hasVersions ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-[#1e1e1e]">
                    <GitCompare className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Pas assez de versions</p>
                    <p className="text-xs mt-1 text-muted-foreground/60">
                      Sauvegardez au moins 2 versions pour utiliser le diff viewer.
                    </p>
                  </div>
                ) : diffLeftVersionId === diffRightVersionId ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-[#1e1e1e]">
                    <GitCompare className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Même version sélectionnée</p>
                    <p className="text-xs mt-1 text-muted-foreground/60">
                      Sélectionnez deux versions différentes pour voir les différences.
                    </p>
                  </div>
                ) : (
                  <MonacoDiffViewer
                    original={diffLeftContent}
                    modified={diffRightContent}
                    language={getLanguageFromPath(diffCurrentPath)}
                    originalLabel={`v${diffLeftVersion?.version ?? '?'}`}
                    modifiedLabel={`v${diffRightVersion?.version ?? '?'}`}
                  />
                )}
              </div>
            </>
          )}

          {/* Warnings bar */}
          {payload.warnings && payload.warnings.length > 0 && (
            <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/10 shrink-0">
              {payload.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Version History Panel ────────────────────────────────────── */}
        {showVersionPanel && viewMode === 'editor' && (
          <div className="w-72 border-l border-border bg-card/50 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Historique</span>
              </div>
              <button
                onClick={() => setShowVersionPanel(false)}
                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!versionHistory?.data?.length ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <History className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">Aucune version sauvegardée</p>
                  <p className="text-[10px] mt-1">Cliquez "Sauvegarder" pour créer la première version</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {versionHistory.data.map((v: any) => (
                    <div key={v.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-foreground">
                          v{v.version}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => {
                              // Quick diff: compare this version with the most recent
                              const latest = versionHistory.data[0];
                              if (latest && latest.id !== v.id) {
                                setDiffLeftVersionId(v.id);
                                setDiffRightVersionId(latest.id);
                                setViewMode('diff');
                              }
                            }}
                            className="p-1 rounded hover:bg-cyan-500/10 text-muted-foreground hover:text-cyan-400 transition-all"
                            title="Comparer avec la dernière version"
                          >
                            <GitCompare className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRestoreVersion(v.id, v.version)}
                            disabled={restoreVersionMutation.isPending}
                            className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
                            title="Restaurer cette version"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {v.changeSummary || 'Pas de description'}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {new Date(v.createdAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Plan IA Panel ────────────────────────────────────────────── */}
        {showPlanPanel && payload.plan && (
          <div className="w-80 border-l border-border bg-card/50 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-foreground">Plan IA</span>
              </div>
              <button
                onClick={() => setShowPlanPanel(false)}
                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">
                {typeof payload.plan === 'string' ? payload.plan : JSON.stringify(payload.plan, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
