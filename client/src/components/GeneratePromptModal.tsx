/**
 * GeneratePromptModal — Affiche le prompt IA généré à partir de
 * Profile + Scenario + Bundle, prêt à copier.
 */
import { useState, useEffect } from 'react';
import { X, Copy, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '../state/projectStore';
import { trpc } from '@/lib/trpc';
import { buildAiScriptContext } from '../ai/buildContext';
import { PROMPT_SCRIPT_PLAN_v1, PROMPT_SCRIPT_GEN_v1 } from '../ai/promptTemplates';
import type { TestProfile, TestScenario, TargetEnv, DatasetInstance, DatasetSecretKey } from '../types';
import type { AiScriptContext } from '../ai/types';

const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];

const TEMPLATES = [
  { id: 'PROMPT_SCRIPT_PLAN_v1', label: 'Plan de génération', template: PROMPT_SCRIPT_PLAN_v1 },
  { id: 'PROMPT_SCRIPT_GEN_v1', label: 'Génération de script', template: PROMPT_SCRIPT_GEN_v1 },
];

interface Props {
  scenario: TestScenario;
  profile: TestProfile;
  onClose: () => void;
}

export default function GeneratePromptModal({ scenario, profile, onClose }: Props) {
  const { currentProject } = useProject();
  const utils = trpc.useUtils();
  const [selectedEnv, setSelectedEnv] = useState<TargetEnv>('DEV');
  const [selectedTemplateId, setSelectedTemplateId] = useState('PROMPT_SCRIPT_PLAN_v1');
  const [copied, setCopied] = useState(false);

  // Load bundles for selected env
  const [bundles, setBundles] = useState<any[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');
  const [context, setContext] = useState<AiScriptContext | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load bundles when env changes via tRPC
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

  const handleGenerate = async () => {
    if (!currentProject || !selectedBundleId) {
      setError('Sélectionnez un bundle.');
      return;
    }
    setLoading(true);
    setError('');
    try {
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

      const ctx = buildAiScriptContext({
        project: currentProject as any,
        profile,
        scenario,
        bundle: bundle as any,
        bundleDatasets: datasets,
        secrets: allSecrets,
      });
      setContext(ctx);

      const tmpl = TEMPLATES.find(t => t.id === selectedTemplateId)?.template;
      if (tmpl) {
        setPrompt(tmpl.buildPrompt(ctx));
      }
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la construction du contexte');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success('Prompt copié dans le presse-papier');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-heading font-semibold text-foreground">Générer Prompt IA</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Config */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground w-20">Scénario :</span>
            <span className="font-mono text-foreground">{scenario.scenario_code || scenario.name}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Environnement</label>
              <select
                value={selectedEnv}
                onChange={e => { setSelectedEnv(e.target.value as TargetEnv); setSelectedBundleId(''); setPrompt(''); }}
                className="text-xs px-3 py-1.5 bg-secondary/30 border border-border rounded-md text-foreground"
              >
                {ALL_ENVS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Bundle</label>
              <select
                value={selectedBundleId}
                onChange={e => { setSelectedBundleId(e.target.value); setPrompt(''); }}
                className="text-xs px-3 py-1.5 bg-secondary/30 border border-border rounded-md text-foreground min-w-[180px]"
              >
                <option value="">-- Sélectionner --</option>
                {bundles.map((b: any) => <option key={b.uid} value={b.uid}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Template</label>
              <select
                value={selectedTemplateId}
                onChange={e => { setSelectedTemplateId(e.target.value); setPrompt(''); }}
                className="text-xs px-3 py-1.5 bg-secondary/30 border border-border rounded-md text-foreground"
              >
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={loading || !selectedBundleId}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Construction...' : 'Construire le prompt'}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />{error}
            </div>
          )}
        </div>

        {/* Prompt output */}
        <div className="flex-1 overflow-y-auto p-6">
          {prompt ? (
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-foreground/90 bg-black/20 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {prompt}
              </pre>
              <div className="mt-3 text-[10px] text-muted-foreground">
                Template: {selectedTemplateId} | Env: {selectedEnv} | Bundle: {bundles.find((b: any) => b.uid === selectedBundleId)?.name || '?'}
                {context && ` | Framework: ${context.generation_constraints.framework_preferences.join(', ')}`}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Sparkles className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">Sélectionnez un environnement et un bundle, puis cliquez "Construire le prompt".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
