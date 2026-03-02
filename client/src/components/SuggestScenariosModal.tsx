/**
 * SuggestScenariosModal — Modal de suggestion de scénarios IA (durci industriel).
 *
 * - Normalisation IDs : TESTTYPE-DOMAINCODE-NNN-SLUG
 * - Breakdown par priorité (P0/P1/P2)
 * - Import modes : SKIP | RENAME | OVERWRITE
 * - Rapport d'import détaillé
 * - Audit log
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  X, Sparkles, ChevronRight, ChevronDown, Check, Filter,
  AlertTriangle, Info, Zap, FileText, Tag, ArrowRight,
  CheckSquare, Square, Loader2, Shield, RefreshCw, SkipForward,
  ClipboardList, Download,
} from 'lucide-react';
import type { TestProfile, ImportMode, ImportReport } from '../types';
import type { ScopeLevel, Priority } from '../config/scenarioTemplates';
import {
  suggestScenarios,
  bulkImportSuggestions,
  type SuggestedScenario,
  type SuggestResponse,
  type ScenarioStore,
  type AuditStore,
} from '../services/scenarioSuggestionEngine';
import { trpc } from '@/lib/trpc';

interface Props {
  profile: TestProfile;
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

// ─── Priority badge ─────────────────────────────────────────────────────

const priorityConfig: Record<Priority, { label: string; color: string; bg: string }> = {
  P0: { label: 'P0 — Bloquant', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
  P1: { label: 'P1 — Majeur', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  P2: { label: 'P2 — Mineur', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = priorityConfig[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold rounded border ${cfg.bg} ${cfg.color}`}>
      {priority}
    </span>
  );
}

// ─── Scope selector ─────────────────────────────────────────────────────

const scopeOptions: Array<{ value: ScopeLevel; label: string; desc: string; icon: React.ReactNode }> = [
  { value: 'MINIMAL', label: 'Minimal', desc: 'Tests P0 essentiels uniquement', icon: <Zap className="w-4 h-4" /> },
  { value: 'STANDARD', label: 'Standard', desc: 'P0 + P1 (couverture recommandée)', icon: <Check className="w-4 h-4" /> },
  { value: 'FULL', label: 'Complet', desc: 'P0 + P1 + P2 (couverture maximale)', icon: <FileText className="w-4 h-4" /> },
];

// ─── Import mode config ─────────────────────────────────────────────────

const importModeConfig: Record<ImportMode, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  SKIP: { label: 'Ignorer', desc: 'Les doublons sont ignorés', icon: <SkipForward className="w-4 h-4" />, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  RENAME: { label: 'Renommer', desc: 'Auto-génère un nouvel ID', icon: <RefreshCw className="w-4 h-4" />, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  OVERWRITE: { label: 'Écraser', desc: 'Remplace les existants (Admin)', icon: <Shield className="w-4 h-4" />, color: 'text-red-400 border-red-500/30 bg-red-500/10' },
};

// ─── Component ──────────────────────────────────────────────────────────

type ModalStep = 'scope' | 'results' | 'report';

export default function SuggestScenariosModal({ profile, projectId, projectName, open, onClose, onImported }: Props) {
  const [scope, setScope] = useState<ScopeLevel>('STANDARD');
  const [step, setStep] = useState<ModalStep>('scope');
  const [response, setResponse] = useState<SuggestResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL');
  const [importMode, setImportMode] = useState<ImportMode>('RENAME');
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  // Fetch scenarios for the project to build the ScenarioStore
  const { data: scenariosData } = trpc.scenarios.list.useQuery(
    { projectId, pageSize: 1000 },
    { enabled: !!projectId && open }
  );
  const createMutation = trpc.scenarios.create.useMutation();
  const updateMutation = trpc.scenarios.update.useMutation();
  const utils = trpc.useUtils();

  // Build a synchronous ScenarioStore adapter from tRPC data
  // NOTE: create/update are fire-and-forget (async) but the engine expects sync returns.
  // We generate a temporary UID client-side and let the mutation resolve in background.
  const scenarioStoreRef = useRef<ScenarioStore>(null);
  const allScenarios = useMemo(() => scenariosData?.data ?? [], [scenariosData]);

  scenarioStoreRef.current = {
    nextId(pid: string, testType: string, domain: string) {
      const prefix = `${testType}-`;
      const existing = allScenarios
        .filter((s: any) => (s.scenarioCode || s.scenario_code || '').startsWith(prefix))
        .map((s: any) => {
          const parts = (s.scenarioCode || s.scenario_code || '').split('-');
          return parseInt(parts[2] || '0', 10);
        })
        .filter((n: number) => !isNaN(n));
      const maxN = existing.length > 0 ? Math.max(...existing) : 0;
      return { nnn: maxN + 1 };
    },
    codeExists(pid: string, code: string) {
      return allScenarios.some((s: any) => (s.scenarioCode || s.scenario_code) === code);
    },
    generateCode(pid: string, testType: string, domain: string, title: string) {
      const { nnn } = this.nextId(pid, testType, domain);
      const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      const DOMAIN_MAP: Record<string, string> = { WEB:'WEB', API:'API', MOBILE:'MOB', DESKTOP:'DESK', TELECOM_IMS:'IMS', TELECOM_RAN:'RAN', TELECOM_EPC:'EPC4', TELECOM_5GC_SA:'5GSA', TELECOM_5GC_NSA:'5GNSA', IOT:'DRIVE', IMS:'IMS', RAN:'RAN', EPC:'EPC4', '5GC':'5GSA' };
      const dc = DOMAIN_MAP[domain] || domain.slice(0, 4).toUpperCase();
      return `${testType}-${dc}-${nnn.toString().padStart(3, '0')}-${slug}`;
    },
    create(_profileId: string, _projectId: string, data: any) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Fire-and-forget mutation
      createMutation.mutateAsync({
        projectId: _projectId,
        profileId: _profileId,
        name: data.name,
        description: data.description,
        scenarioCode: data.scenario_code,
        status: data.status || 'DRAFT',
        steps: data.steps || [],
        requiredDatasetTypes: data.required_dataset_types || [],
      }).then(() => utils.scenarios.list.invalidate());
      return { id: tempId };
    },
    update(id: string, data: any) {
      updateMutation.mutateAsync({
        scenarioId: Number(id),
        name: data.name,
        description: data.description,
        status: data.status,
        steps: data.steps || undefined,
        requiredDatasetTypes: data.required_dataset_types || undefined,
      }).then(() => utils.scenarios.list.invalidate());
    },
    listByProject(_pid: string) {
      return { data: allScenarios as any[] };
    },
  };

  const auditStoreRef = useRef<AuditStore>(null);
  auditStoreRef.current = {
    add(entry: any) {
      // Audit log is informational — just return a stub
      return { id: `audit-${Date.now()}`, timestamp: new Date().toISOString() };
    },
  };

  // Générer les suggestions
  const handleGenerate = useCallback(() => {
    const result = suggestScenarios({
      profile,
      project_id: projectId,
      project_name: projectName,
      scope_level: scope,
    }, scenarioStoreRef.current!);
    setResponse(result);
    const p0Ids = new Set(result.suggestions.filter(s => s.priority === 'P0').map(s => s.scenario_code));
    setSelected(p0Ids);
    setStep('results');
  }, [profile, projectId, projectName, scope]);

  // Filtrer les suggestions
  const filteredSuggestions = useMemo(() => {
    if (!response) return [];
    if (filterPriority === 'ALL') return response.suggestions;
    return response.suggestions.filter(s => s.priority === filterPriority);
  }, [response, filterPriority]);

  // Toggle sélection
  const toggleSelect = (code: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredSuggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSuggestions.map(s => s.scenario_code)));
    }
  };

  // Import avec mode
  const handleImport = useCallback(() => {
    if (!response) return;
    setImporting(true);

    const toImport = response.suggestions.filter(s => selected.has(s.scenario_code));

    setTimeout(() => {
      const report = bulkImportSuggestions(toImport, profile.id, projectId, importMode, scenarioStoreRef.current!, auditStoreRef.current!);
      setImportReport(report);
      setImporting(false);
      setStep('report');
    }, 800);
  }, [response, selected, profile.id, projectId, importMode]);

  // Reset on close
  const handleClose = () => {
    setStep('scope');
    setResponse(null);
    setSelected(new Set());
    setExpandedId(null);
    setFilterPriority('ALL');
    setImportMode('RENAME');
    setImporting(false);
    setImportReport(null);
    onClose();
  };

  const handleFinishImport = () => {
    onImported();
    handleClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0c1829] border border-[#1e3a5f]/60 rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">

        {/* ─── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f]/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {step === 'report' ? 'Rapport d\'import' : 'Suggérer des scénarios'}
              </h2>
              <p className="text-xs text-slate-400">
                {profile.name} — {profile.domain} · {profile.test_type}
                {response && step !== 'scope' && (
                  <span className="ml-2 text-amber-400/70">
                    ID format: {response.metadata.test_type}-{response.metadata.domain_code}-NNN-SLUG
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Step 1: Scope Selection ─────────────────────────── */}
        {step === 'scope' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Niveau de couverture</h3>
              <p className="text-xs text-slate-400">
                Choisissez le niveau de couverture pour les scénarios suggérés.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {scopeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                    scope === opt.value
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-[#1e3a5f]/40 bg-[#0a1220] hover:border-[#1e3a5f]/60'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    scope === opt.value ? 'bg-amber-500/20 text-amber-400' : 'bg-[#1e3a5f]/30 text-slate-400'
                  }`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-200">{opt.label}</div>
                    <div className="text-xs text-slate-400">{opt.desc}</div>
                  </div>
                  {scope === opt.value && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Import mode selector */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Mode d'import (collision)</h3>
              <p className="text-xs text-slate-400 mb-3">
                Comportement si un scénario avec le même code existe déjà.
              </p>
              <div className="flex gap-2">
                {(Object.keys(importModeConfig) as ImportMode[]).map(mode => {
                  const cfg = importModeConfig[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => setImportMode(mode)}
                      className={`flex-1 flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                        importMode === mode
                          ? cfg.color + ' border-opacity-100'
                          : 'border-[#1e3a5f]/40 bg-[#0a1220] hover:border-[#1e3a5f]/60 text-slate-400'
                      }`}
                    >
                      {cfg.icon}
                      <div>
                        <div className="text-xs font-semibold">{cfg.label}</div>
                        <div className="text-[10px] opacity-70">{cfg.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info box */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[#0a1220] border border-[#1e3a5f]/30">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <strong className="text-slate-300">Profil analysé :</strong>{' '}
                <span className="text-amber-400">{profile.domain}</span> ·{' '}
                <span className="text-amber-400">{profile.test_type}</span> ·{' '}
                <span className="text-amber-400">{profile.profile_type || 'N/A'}</span>
                <br />
                IDs normalisés : <code className="text-cyan-400">{profile.test_type}-{'{DOMAINCODE}'}-NNN-SLUG</code>
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 2: Results ─────────────────────────────────── */}
        {step === 'results' && response && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Toolbar with breakdown */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e3a5f]/30 bg-[#0a1220]/50">
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400">
                  {response.suggestions.length} scénarios
                  {selected.size > 0 && (
                    <span className="text-amber-400 ml-1">· {selected.size} sélectionnés</span>
                  )}
                </span>
                {/* Breakdown badges */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-mono">
                    P0: {response.metadata.breakdown.P0}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-mono">
                    P1: {response.metadata.breakdown.P1}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 font-mono">
                    P2: {response.metadata.breakdown.P2}
                  </span>
                </div>
                {/* Import mode badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${importModeConfig[importMode].color}`}>
                  Mode: {importMode}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                {(['ALL', 'P0', 'P1', 'P2'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterPriority(p)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                      filterPriority === p
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {p === 'ALL' ? 'Tous' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {/* Select all header */}
              <div className="flex items-center gap-3 px-6 py-2 border-b border-[#1e3a5f]/20 bg-[#0a1220]/30 sticky top-0">
                <button onClick={toggleAll} className="text-slate-400 hover:text-amber-400 transition-colors">
                  {selected.size === filteredSuggestions.length && filteredSuggestions.length > 0
                    ? <CheckSquare className="w-4 h-4 text-amber-400" />
                    : <Square className="w-4 h-4" />
                  }
                </button>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider flex-1">Scénario (code normalisé)</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider w-16 text-center">Priorité</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider w-20 text-center">Étapes</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider w-24 text-center">Datasets</span>
              </div>

              {filteredSuggestions.map(suggestion => {
                const isExpanded = expandedId === suggestion.scenario_code;
                const isSelected = selected.has(suggestion.scenario_code);

                return (
                  <div key={suggestion.scenario_code} className={`border-b border-[#1e3a5f]/15 ${isSelected ? 'bg-amber-500/5' : ''}`}>
                    {/* Row */}
                    <div className="flex items-center gap-3 px-6 py-3 hover:bg-white/[0.02] transition-colors">
                      <button
                        onClick={() => toggleSelect(suggestion.scenario_code)}
                        className="text-slate-400 hover:text-amber-400 transition-colors flex-shrink-0"
                      >
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-amber-400" />
                          : <Square className="w-4 h-4" />
                        }
                      </button>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : suggestion.scenario_code)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-cyan-400/80">{suggestion.scenario_code}</span>
                          </div>
                          <span className="text-sm text-slate-200 truncate block">{suggestion.title}</span>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{suggestion.rationale}</p>
                        </div>
                      </button>

                      <div className="w-16 text-center flex-shrink-0">
                        <PriorityBadge priority={suggestion.priority} />
                      </div>

                      <div className="w-20 text-center flex-shrink-0">
                        <span className="text-xs text-slate-400">{suggestion.steps_outline.length}</span>
                      </div>

                      <div className="w-24 text-center flex-shrink-0">
                        <span className="text-xs text-slate-400">
                          {suggestion.required_datasets_types.length > 0
                            ? suggestion.required_datasets_types.length
                            : '—'
                          }
                        </span>
                      </div>
                    </div>

                    {/* Expanded preview */}
                    {isExpanded && (
                      <div className="px-6 pb-4 pt-1 ml-7 mr-6">
                        <div className="rounded-lg border border-[#1e3a5f]/30 bg-[#0a1220] p-4 space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Justification</h4>
                            <p className="text-sm text-slate-400 leading-relaxed">{suggestion.rationale}</p>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Étapes</h4>
                            <div className="space-y-2">
                              {suggestion.steps_outline.map((s, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded bg-[#1e3a5f]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-mono text-amber-400">{i + 1}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#1e3a5f]/30 text-cyan-400">{s.action}</span>
                                      <span className="text-sm text-slate-300">{s.description}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                      <ArrowRight className="w-3 h-3 text-green-500/60" />
                                      <span className="text-xs text-green-400/70">{s.expected_result}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Résultats attendus</h4>
                            <ul className="space-y-1">
                              {suggestion.expected_results_outline.map((r, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                  <Check className="w-3 h-3 text-green-500/60 flex-shrink-0" />{r}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="flex gap-6">
                            <div className="flex-1">
                              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Inputs requis</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {suggestion.required_inputs.map((input, i) => (
                                  <span key={i} className={`text-xs px-2 py-0.5 rounded font-mono ${
                                    input.includes('✓')
                                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                      : 'bg-[#1e3a5f]/30 text-slate-400 border border-[#1e3a5f]/40'
                                  }`}>{input}</span>
                                ))}
                              </div>
                            </div>
                            {suggestion.required_datasets_types.length > 0 && (
                              <div className="flex-1">
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Datasets</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {suggestion.required_datasets_types.map((ds, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">{ds}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Tags</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {suggestion.tags.map((tag, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[#1e3a5f]/20 text-slate-400 border border-[#1e3a5f]/30">
                                  <Tag className="w-2.5 h-2.5" />{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredSuggestions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <AlertTriangle className="w-8 h-8 mb-2 text-slate-600" />
                  <p className="text-sm">Aucun scénario pour ce filtre.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Step 3: Import Report ──────────────────────────── */}
        {step === 'report' && importReport && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                <div className="text-2xl font-bold text-green-400 font-mono">{importReport.imported_count}</div>
                <div className="text-xs text-green-400/70 mt-1">Importés</div>
              </div>
              <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                <div className="text-2xl font-bold text-blue-400 font-mono">{importReport.skipped_count}</div>
                <div className="text-xs text-blue-400/70 mt-1">Ignorés</div>
              </div>
              <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <div className="text-2xl font-bold text-amber-400 font-mono">{importReport.renamed_count}</div>
                <div className="text-xs text-amber-400/70 mt-1">Renommés</div>
              </div>
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                <div className="text-2xl font-bold text-red-400 font-mono">{importReport.overwritten_count}</div>
                <div className="text-xs text-red-400/70 mt-1">Écrasés</div>
              </div>
            </div>

            {/* Audit info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a1220] border border-[#1e3a5f]/30 mb-4">
              <ClipboardList className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="text-xs text-slate-400">
                <strong className="text-slate-300">Audit :</strong>{' '}
                <code className="text-cyan-400">{importReport.audit_log_id}</code>{' '}
                — {new Date(importReport.timestamp).toLocaleString('fr-FR')}
              </div>
            </div>

            {/* Details table */}
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Détail des opérations</h3>
            <div className="rounded-lg border border-[#1e3a5f]/30 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_2fr] gap-0 text-xs">
                {/* Header */}
                <div className="px-3 py-2 bg-[#0a1220] border-b border-[#1e3a5f]/30 text-slate-500 font-medium uppercase tracking-wider">Code</div>
                <div className="px-3 py-2 bg-[#0a1220] border-b border-[#1e3a5f]/30 text-slate-500 font-medium uppercase tracking-wider text-center">Action</div>
                <div className="px-3 py-2 bg-[#0a1220] border-b border-[#1e3a5f]/30 text-slate-500 font-medium uppercase tracking-wider">Message</div>

                {/* Rows */}
                {importReport.details.map((d, i) => {
                  const actionColors: Record<string, string> = {
                    IMPORTED: 'text-green-400 bg-green-500/10',
                    SKIPPED: 'text-blue-400 bg-blue-500/10',
                    RENAMED: 'text-amber-400 bg-amber-500/10',
                    OVERWRITTEN: 'text-red-400 bg-red-500/10',
                  };
                  return (
                    <div key={i} className="contents">
                      <div className="px-3 py-2 border-b border-[#1e3a5f]/15 font-mono text-cyan-400/80 truncate">
                        {d.scenario_code}
                      </div>
                      <div className="px-3 py-2 border-b border-[#1e3a5f]/15 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${actionColors[d.action] || 'text-slate-400'}`}>
                          {d.action}
                        </span>
                      </div>
                      <div className="px-3 py-2 border-b border-[#1e3a5f]/15 text-slate-400 truncate">
                        {d.message}
                        {d.old_id && <span className="ml-1 text-slate-500">(ancien: {d.old_id})</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── Footer ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e3a5f]/40 bg-[#0a1220]/30">
          {step === 'scope' && (
            <>
              <button onClick={handleClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
                Annuler
              </button>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Générer les suggestions
              </button>
            </>
          )}

          {step === 'results' && (
            <>
              <button
                onClick={() => { setStep('scope'); setResponse(null); setSelected(new Set()); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Retour
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {selected.size} / {response?.suggestions.length || 0} sélectionnés
                </span>
                <button
                  onClick={handleImport}
                  disabled={selected.size === 0 || importing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Import en cours…
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Importer ({selected.size}) — mode {importMode}
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'report' && (
            <>
              <div className="text-xs text-slate-500">
                {importReport && `${importReport.imported_count} scénario(s) importé(s) en statut DRAFT`}
              </div>
              <button
                onClick={handleFinishImport}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all"
              >
                <Check className="w-4 h-4" />
                Terminer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
