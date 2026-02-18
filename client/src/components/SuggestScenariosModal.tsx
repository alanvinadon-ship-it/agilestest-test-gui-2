/**
 * SuggestScenariosModal — Modal de suggestion de scénarios IA.
 *
 * Affiche les scénarios suggérés par le moteur IA avec :
 * - Table avec checkboxes pour sélection multiple
 * - Filtre par priorité (P0/P1/P2)
 * - Preview détaillée d'un scénario (étapes, inputs, datasets)
 * - Bouton "Importer la sélection"
 */

import { useState, useMemo, useCallback } from 'react';
import {
  X, Sparkles, ChevronRight, ChevronDown, Check, Filter,
  AlertTriangle, Info, Zap, FileText, Tag, ArrowRight,
  CheckSquare, Square, Loader2,
} from 'lucide-react';
import type { TestProfile } from '../types';
import type { ScopeLevel, Priority } from '../config/scenarioTemplates';
import {
  suggestScenarios,
  bulkImportSuggestions,
  type SuggestedScenario,
  type SuggestResponse,
} from '../services/scenarioSuggestionEngine';
import { localScenarios } from '../api/localStore';

interface Props {
  profile: TestProfile;
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

// ─── Priority badge ────────────────────────────────────────────────────────

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

// ─── Scope selector ────────────────────────────────────────────────────────

const scopeOptions: Array<{ value: ScopeLevel; label: string; desc: string; icon: React.ReactNode }> = [
  { value: 'MINIMAL', label: 'Minimal', desc: 'Tests P0 essentiels uniquement', icon: <Zap className="w-4 h-4" /> },
  { value: 'STANDARD', label: 'Standard', desc: 'P0 + P1 (couverture recommandée)', icon: <Check className="w-4 h-4" /> },
  { value: 'FULL', label: 'Complet', desc: 'P0 + P1 + P2 (couverture maximale)', icon: <FileText className="w-4 h-4" /> },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function SuggestScenariosModal({ profile, projectId, projectName, open, onClose, onImported }: Props) {
  const [scope, setScope] = useState<ScopeLevel>('STANDARD');
  const [step, setStep] = useState<'scope' | 'results'>('scope');
  const [response, setResponse] = useState<SuggestResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null);

  // Générer les suggestions
  const handleGenerate = useCallback(() => {
    const result = suggestScenarios({
      profile,
      project_name: projectName,
      scope_level: scope,
    });
    setResponse(result);
    // Sélectionner tous les P0 par défaut
    const p0Ids = new Set(result.suggestions.filter(s => s.priority === 'P0').map(s => s.scenario_id));
    setSelected(p0Ids);
    setStep('results');
  }, [profile, projectName, scope]);

  // Filtrer les suggestions
  const filteredSuggestions = useMemo(() => {
    if (!response) return [];
    if (filterPriority === 'ALL') return response.suggestions;
    return response.suggestions.filter(s => s.priority === filterPriority);
  }, [response, filterPriority]);

  // Toggle sélection
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredSuggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredSuggestions.map(s => s.scenario_id)));
    }
  };

  // Import
  const handleImport = useCallback(() => {
    if (!response) return;
    setImporting(true);

    const toImport = response.suggestions.filter(s => selected.has(s.scenario_id));

    // Simuler un délai pour l'UX
    setTimeout(() => {
      const result = bulkImportSuggestions(
        toImport,
        profile.id,
        projectId,
        localScenarios.create,
      );

      setImportResult({
        imported: result.imported.length,
        errors: result.errors.length,
      });
      setImporting(false);

      // Fermer après 1.5s si succès
      if (result.errors.length === 0) {
        setTimeout(() => {
          onImported();
          onClose();
        }, 1500);
      }
    }, 800);
  }, [response, selected, profile.id, projectId, onImported, onClose]);

  // Reset on close
  const handleClose = () => {
    setStep('scope');
    setResponse(null);
    setSelected(new Set());
    setExpandedId(null);
    setFilterPriority('ALL');
    setImporting(false);
    setImportResult(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0c1829] border border-[#1e3a5f]/60 rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">

        {/* ─── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e3a5f]/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Suggérer des scénarios</h2>
              <p className="text-xs text-slate-400">
                {profile.name} — {profile.domain} · {profile.test_type}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Step 1: Scope Selection ─────────────────────────────── */}
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

            {/* Info box */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[#0a1220] border border-[#1e3a5f]/30">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <strong className="text-slate-300">Profil analysé :</strong>{' '}
                <span className="text-amber-400">{profile.domain}</span> ·{' '}
                <span className="text-amber-400">{profile.test_type}</span> ·{' '}
                <span className="text-amber-400">{profile.profile_type || 'N/A'}</span>
                <br />
                Le moteur sélectionnera les templates adaptés à cette combinaison et générera des scénarios
                avec IDs normalisés, priorités et justifications.
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 2: Results ─────────────────────────────────────── */}
        {step === 'results' && response && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#1e3a5f]/30 bg-[#0a1220]/50">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {response.suggestions.length} scénarios suggérés
                  {selected.size > 0 && (
                    <span className="text-amber-400 ml-1">· {selected.size} sélectionnés</span>
                  )}
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
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider flex-1">Scénario</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider w-16 text-center">Priorité</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider w-20 text-center">Étapes</span>
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider w-24 text-center">Datasets</span>
              </div>

              {filteredSuggestions.map(suggestion => {
                const isExpanded = expandedId === suggestion.scenario_id;
                const isSelected = selected.has(suggestion.scenario_id);

                return (
                  <div key={suggestion.scenario_id} className={`border-b border-[#1e3a5f]/15 ${isSelected ? 'bg-amber-500/5' : ''}`}>
                    {/* Row */}
                    <div className="flex items-center gap-3 px-6 py-3 hover:bg-white/[0.02] transition-colors">
                      <button
                        onClick={() => toggleSelect(suggestion.scenario_id)}
                        className="text-slate-400 hover:text-amber-400 transition-colors flex-shrink-0"
                      >
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-amber-400" />
                          : <Square className="w-4 h-4" />
                        }
                      </button>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : suggestion.scenario_id)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-amber-500/70">{suggestion.scenario_id}</span>
                            <span className="text-sm text-slate-200 truncate">{suggestion.title}</span>
                          </div>
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
                            ? suggestion.required_datasets_types.join(', ')
                            : '—'
                          }
                        </span>
                      </div>
                    </div>

                    {/* Expanded preview */}
                    {isExpanded && (
                      <div className="px-6 pb-4 pt-1 ml-7 mr-6">
                        <div className="rounded-lg border border-[#1e3a5f]/30 bg-[#0a1220] p-4 space-y-4">
                          {/* Rationale */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Justification</h4>
                            <p className="text-sm text-slate-400 leading-relaxed">{suggestion.rationale}</p>
                          </div>

                          {/* Steps */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Étapes</h4>
                            <div className="space-y-2">
                              {suggestion.steps_outline.map((step, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded bg-[#1e3a5f]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-mono text-amber-400">{i + 1}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[#1e3a5f]/30 text-cyan-400">{step.action}</span>
                                      <span className="text-sm text-slate-300">{step.description}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                      <ArrowRight className="w-3 h-3 text-green-500/60" />
                                      <span className="text-xs text-green-400/70">{step.expected_result}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Expected results */}
                          <div>
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Résultats attendus</h4>
                            <ul className="space-y-1">
                              {suggestion.expected_results_outline.map((r, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                                  <Check className="w-3 h-3 text-green-500/60 flex-shrink-0" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Required inputs & datasets */}
                          <div className="flex gap-6">
                            <div className="flex-1">
                              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Inputs requis</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {suggestion.required_inputs.map((input, i) => (
                                  <span key={i} className={`text-xs px-2 py-0.5 rounded font-mono ${
                                    input.includes('✓')
                                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                      : 'bg-[#1e3a5f]/30 text-slate-400 border border-[#1e3a5f]/40'
                                  }`}>
                                    {input}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {suggestion.required_datasets_types.length > 0 && (
                              <div className="flex-1">
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Datasets</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {suggestion.required_datasets_types.map((ds, i) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                      {ds}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Tags */}
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

            {/* Import result banner */}
            {importResult && (
              <div className={`px-6 py-3 border-t ${
                importResult.errors > 0
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-green-500/10 border-green-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  {importResult.errors > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Check className="w-4 h-4 text-green-400" />
                  )}
                  <span className={`text-sm ${importResult.errors > 0 ? 'text-red-300' : 'text-green-300'}`}>
                    {importResult.imported} scénario(s) importé(s)
                    {importResult.errors > 0 && `, ${importResult.errors} erreur(s)`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e3a5f]/40 bg-[#0a1220]/30">
          {step === 'scope' ? (
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
          ) : (
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
                  disabled={selected.size === 0 || importing || importResult !== null}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-sm hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Import en cours…
                    </>
                  ) : importResult ? (
                    <>
                      <Check className="w-4 h-4" />
                      Importé !
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Importer la sélection ({selected.size})
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
