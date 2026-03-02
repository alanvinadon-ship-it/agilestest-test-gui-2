/**
 * GenerateScriptModal — Génère un script de test via l'IA réelle (LLM server-side)
 * avec streaming SSE pour la phase de génération de code.
 *
 * Flow: Sélection env+bundle → Plan (LLM) → Revue du plan → Génération (LLM streaming) → Résultat
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle2, Copy, Save, Loader2, FileCode, ChevronRight, Brain, Zap, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '../state/projectStore';
import { trpc } from '@/lib/trpc';
import { buildAiScriptContext } from '../ai/buildContext';
import type { TestProfile, TestScenario, TargetEnv, DatasetInstance, DatasetSecretKey } from '../types';
import type { AiScriptContext, ScriptPlanResult, ScriptPackage } from '../ai/types';

const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];

type Step = 'config' | 'planning' | 'plan_review' | 'generating' | 'result';

interface Props {
  scenario: TestScenario;
  profile: TestProfile;
  onClose: () => void;
  onSaved?: () => void;
}

/** Parse SSE stream and call onChunk/onDone/onError */
async function consumeSSEStream(
  response: Response,
  onChunk: (text: string) => void,
  onDone: (fullContent: string) => void,
  onError: (msg: string) => void,
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      try {
        const evt = JSON.parse(trimmed.slice(6));
        if (evt.type === 'chunk') onChunk(evt.data);
        else if (evt.type === 'done') onDone(evt.data);
        else if (evt.type === 'error') onError(evt.data);
      } catch { /* skip */ }
    }
  }
}

export default function GenerateScriptModal({ scenario, profile, onClose, onSaved }: Props) {
  const { currentProject } = useProject();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<Step>('config');
  const [selectedEnv, setSelectedEnv] = useState<TargetEnv>('DEV');
  const [bundles, setBundles] = useState<any[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [error, setError] = useState('');
  const [context, setContext] = useState<AiScriptContext | null>(null);
  const [plan, setPlan] = useState<ScriptPlanResult | null>(null);
  const [scriptPackage, setScriptPackage] = useState<ScriptPackage | null>(null);
  const [viewFileIdx, setViewFileIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [planUsage, setPlanUsage] = useState<{ prompt_tokens: number; completion_tokens: number } | null>(null);

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingChars, setStreamingChars] = useState(0);
  const streamRef = useRef<string>('');
  const codeViewRef = useRef<HTMLPreElement>(null);

  // tRPC mutations
  const planMutation = trpc.aiGeneration.planScript.useMutation();
  const saveMutation = trpc.aiGeneration.saveScript.useMutation();

  // Load bundles via tRPC
  const { data: bundlesData } = trpc.bundles.list.useQuery(
    {
      projectId: String(currentProject?.id || ''),
      env: selectedEnv,
      status: 'ACTIVE' as any,
    },
    { enabled: !!currentProject?.id },
  );

  useEffect(() => {
    if (bundlesData?.data) {
      setBundles(bundlesData.data);
      if (bundlesData.data.length > 0 && !selectedBundleId) {
        setSelectedBundleId(bundlesData.data[0].uid);
      }
    }
  }, [bundlesData]);

  const buildContext = async (): Promise<AiScriptContext> => {
    if (!currentProject || !selectedBundleId) throw new Error('Bundle requis');
    const bundle = await utils.bundles.get.fetch({ bundleId: selectedBundleId });
    const itemsResult = await utils.bundleItems.list.fetch({ bundleId: selectedBundleId });
    const items = itemsResult.data;
    const datasets: DatasetInstance[] = [];
    const allSecrets: DatasetSecretKey[] = [];
    for (const item of items) {
      try {
        const ds = await utils.datasetInstances.get.fetch({ datasetId: item.datasetId });
        datasets.push(ds as any);
        const secretsResult = await utils.datasetSecrets.list.fetch({ datasetId: item.datasetId });
        allSecrets.push(...(secretsResult.data as any[]));
      } catch { /* skip */ }
    }
    return buildAiScriptContext({
      project: currentProject as any,
      profile,
      scenario,
      bundle: bundle as any,
      bundleDatasets: datasets,
      secrets: allSecrets,
    });
  };

  /** Phase 1: Call LLM to generate the plan (non-streaming, structured JSON) */
  const handleStartPlanning = async () => {
    setError('');
    setStep('planning');
    try {
      const ctx = await buildContext();
      setContext(ctx);

      const result = await planMutation.mutateAsync({ context: ctx });
      setPlan(result.plan);
      setPlanUsage(result.usage as any);

      const blocking = result.plan.missing_inputs.filter((m: any) => m.severity === 'BLOCKING');
      if (blocking.length > 0) {
        setError(`Inputs manquants bloquants: ${blocking.map((b: any) => b.key).join(', ')}`);
        setStep('config');
        return;
      }

      setStep('plan_review');
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la planification IA');
      setStep('config');
    }
  };

  /** Phase 2: Call LLM with SSE streaming for code generation */
  const handleStartGeneration = useCallback(async () => {
    if (!context || !plan) return;
    setError('');
    setStep('generating');
    setStreamingContent('');
    setStreamingChars(0);
    streamRef.current = '';

    try {
      const response = await fetch('/api/ai/stream-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ context, plan }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erreur serveur: ${response.status} ${errText}`);
      }

      if (!response.body) {
        throw new Error('Pas de body dans la réponse SSE');
      }

      await consumeSSEStream(
        response,
        // onChunk
        (chunk) => {
          streamRef.current += chunk;
          setStreamingContent(streamRef.current);
          setStreamingChars(prev => prev + chunk.length);
          // Auto-scroll
          if (codeViewRef.current) {
            codeViewRef.current.scrollTop = codeViewRef.current.scrollHeight;
          }
        },
        // onDone
        (fullContent) => {
          // Parse the final JSON
          try {
            let cleaned = fullContent.trim();
            if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
            }
            const parsed = JSON.parse(cleaned);
            setScriptPackage(parsed);
            setStep('result');
          } catch (parseErr: any) {
            setError(`Erreur de parsing JSON: ${parseErr.message}`);
            setStep('plan_review');
          }
        },
        // onError
        (errMsg) => {
          setError(errMsg);
          setStep('plan_review');
        },
      );
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la génération streaming');
      setStep('plan_review');
    }
  }, [context, plan]);

  /** Save to DB via tRPC */
  const handleSaveToRepo = async () => {
    if (!currentProject || !scriptPackage || !context || !plan) return;
    try {
      await saveMutation.mutateAsync({
        projectId: currentProject.id,
        scenarioId: scenario.id,
        bundleId: selectedBundleId,
        env: selectedEnv,
        framework: plan.framework_choice,
        codeLanguage: plan.code_language,
        files: scriptPackage.files.map(f => ({
          path: f.path,
          content: f.content,
          language: f.language,
        })),
        plan,
        notes: scriptPackage.notes,
        warnings: scriptPackage.warnings,
      });
      setSaved(true);
      toast.success('Script sauvegardé en base de données');
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleCopyFile = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Contenu copié');
  };

  const stepLabels: Record<Step, string> = {
    config: 'Configuration',
    planning: 'Plan IA',
    plan_review: 'Revue du plan',
    generating: 'Génération IA',
    result: 'Résultat',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-heading font-semibold text-foreground">Générer Script IA</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {scenario.scenario_code || scenario.name}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">LLM</span>
            {step === 'generating' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-semibold flex items-center gap-1">
                <Radio className="w-2.5 h-2.5" />
                STREAMING
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-2 text-xs">
          {(['config', 'planning', 'plan_review', 'generating', 'result'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <span className={step === s ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                {stepLabels[s]}
              </span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Config step */}
          {step === 'config' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Environnement</label>
                  <select
                    value={selectedEnv}
                    onChange={e => { setSelectedEnv(e.target.value as TargetEnv); setSelectedBundleId(''); }}
                    className="text-xs px-3 py-1.5 bg-secondary/30 border border-border rounded-md text-foreground"
                  >
                    {ALL_ENVS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Bundle (ACTIVE)</label>
                  <select
                    value={selectedBundleId}
                    onChange={e => setSelectedBundleId(e.target.value)}
                    className="text-xs px-3 py-1.5 bg-secondary/30 border border-border rounded-md text-foreground min-w-[200px]"
                  >
                    <option value="">-- Sélectionner --</option>
                    {bundles.map((b: any) => <option key={b.uid} value={b.uid}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/5 p-3 rounded-md">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}

              {bundles.length === 0 && (
                <div className="text-xs text-amber-400 bg-amber-500/5 p-3 rounded-md flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Aucun bundle ACTIVE trouvé pour l'environnement {selectedEnv}. Créez et activez un bundle d'abord.
                </div>
              )}

              <div className="bg-primary/5 border border-primary/10 rounded-md p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 mb-1 text-primary font-semibold">
                  <Brain className="w-3.5 h-3.5" />
                  Génération IA avec streaming
                </div>
                Le script sera généré par un modèle de langage (LLM) en 2 étapes : planification puis génération de code en temps réel (streaming SSE).
                Les fichiers produits sont complets et exécutables.
              </div>

              <button
                onClick={handleStartPlanning}
                disabled={!selectedBundleId || planMutation.isPending}
                className="px-6 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Lancer la planification IA
              </button>
            </div>
          )}

          {/* Planning step (loading) */}
          {step === 'planning' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Analyse du scénario par l'IA...</p>
              <p className="text-xs text-muted-foreground/60 mt-2">Le LLM planifie les fichiers et le mapping des étapes</p>
            </div>
          )}

          {/* Plan review step */}
          {step === 'plan_review' && plan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-semibold text-foreground">Plan de génération prêt</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {plan.framework_choice} / {plan.code_language}
                  </span>
                </div>
                {planUsage && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {planUsage.prompt_tokens + planUsage.completion_tokens} tokens
                  </span>
                )}
              </div>

              {/* File plan */}
              <div className="bg-secondary/10 rounded-md p-3">
                <h4 className="text-xs font-semibold text-foreground mb-2">Fichiers planifiés ({plan.file_plan.length})</h4>
                <div className="space-y-1">
                  {plan.file_plan.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <FileCode className="w-3 h-3 text-primary shrink-0" />
                      <span className="font-mono text-foreground">{f.path}</span>
                      <span className="text-muted-foreground">— {f.purpose}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step mapping */}
              <div className="bg-secondary/10 rounded-md p-3">
                <h4 className="text-xs font-semibold text-foreground mb-2">Mapping étapes ({plan.step_mapping.length})</h4>
                <div className="space-y-1">
                  {plan.step_mapping.map((m, i) => (
                    <div key={i} className="text-xs flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                        {m.step_order}
                      </span>
                      <div>
                        <span className="text-foreground font-medium">{m.action}</span>
                        <span className="text-muted-foreground"> → {m.target_file}::{m.target_function}</span>
                        {m.dataset_keys_used.length > 0 && (
                          <span className="text-muted-foreground/60"> [{m.dataset_keys_used.join(', ')}]</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings */}
              {plan.warnings && plan.warnings.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-md p-3">
                  {plan.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                      <AlertTriangle className="w-3 h-3 shrink-0" />{w}
                    </div>
                  ))}
                </div>
              )}

              {/* Missing inputs */}
              {plan.missing_inputs.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-md p-3">
                  <h4 className="text-xs font-semibold text-red-400 mb-1">Inputs manquants</h4>
                  {plan.missing_inputs.map((m, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-red-400/80">
                      <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${m.severity === 'BLOCKING' ? 'bg-red-500/20' : 'bg-amber-500/20 text-amber-400'}`}>
                        {m.severity}
                      </span>
                      <span className="font-mono">{m.key}</span> — {m.reason}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/5 p-3 rounded-md">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep('config'); setPlan(null); setError(''); }}
                  className="px-4 py-2 text-xs font-semibold rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={handleStartGeneration}
                  className="px-6 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Générer les scripts (streaming)
                </button>
              </div>
            </div>
          )}

          {/* Generating step — streaming live view */}
          {step === 'generating' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-green-400 animate-pulse" />
                  <span className="text-sm font-semibold text-foreground">Génération en cours...</span>
                  {plan && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {plan.framework_choice} / {plan.code_language}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                  <span>{streamingChars.toLocaleString()} caractères reçus</span>
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                </div>
              </div>

              {/* Live streaming code view */}
              <pre
                ref={codeViewRef}
                className="p-4 text-xs font-mono text-green-300/90 overflow-x-auto max-h-[400px] overflow-y-auto bg-black/40 rounded-lg border border-green-500/10"
              >
                <code>{streamingContent || 'En attente du premier chunk...'}</code>
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
              </pre>

              <p className="text-[10px] text-muted-foreground text-center">
                Le code est généré en temps réel par le LLM. Le résultat final sera parsé et affiché par fichier.
              </p>
            </div>
          )}

          {/* Result step */}
          {step === 'result' && scriptPackage && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-semibold text-foreground">
                    {scriptPackage.files.length} fichier(s) générés par l'IA
                  </span>
                  {plan && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {plan.framework_choice} / {plan.code_language}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {streamingChars.toLocaleString()} caractères
                  </span>
                  <button
                    onClick={handleSaveToRepo}
                    disabled={saved || saveMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : saved ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {saved ? 'Sauvegardé' : saveMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder en DB'}
                  </button>
                </div>
              </div>

              {/* Warnings */}
              {scriptPackage.warnings && scriptPackage.warnings.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-md p-3">
                  {scriptPackage.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                      <AlertTriangle className="w-3 h-3 shrink-0" />{w}
                    </div>
                  ))}
                </div>
              )}

              {/* File tabs */}
              <div className="flex border-b border-border overflow-x-auto">
                {scriptPackage.files.map((f, idx) => (
                  <button
                    key={idx}
                    onClick={() => setViewFileIdx(idx)}
                    className={`px-3 py-2 text-xs font-mono whitespace-nowrap border-b-2 transition-colors ${
                      viewFileIdx === idx
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileCode className="w-3 h-3 inline mr-1" />
                    {f.path}
                  </button>
                ))}
              </div>

              {/* File content */}
              {scriptPackage.files[viewFileIdx] && (
                <div className="relative">
                  <button
                    onClick={() => handleCopyFile(scriptPackage.files[viewFileIdx].content)}
                    className="absolute top-2 right-2 p-1.5 rounded bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors z-10"
                    title="Copier"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <pre className="p-4 text-xs font-mono text-foreground/90 overflow-x-auto max-h-[350px] overflow-y-auto bg-black/20 rounded-lg">
                    <code>{scriptPackage.files[viewFileIdx].content}</code>
                  </pre>
                </div>
              )}

              {/* Notes */}
              {scriptPackage.notes && (
                <div className="text-xs text-muted-foreground bg-secondary/10 rounded-md p-3">
                  <span className="font-semibold text-foreground">Notes IA :</span> {scriptPackage.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
