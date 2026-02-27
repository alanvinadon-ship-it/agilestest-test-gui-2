/**
 * GenerateScriptModal — Génère un script de test via l'IA (simulation locale)
 * et permet de sauvegarder dans le ScriptRepository.
 *
 * Flow: Sélection env+bundle → Plan → Génération → Affichage fichiers → Save to Repo
 */
import { useState, useEffect } from 'react';
import { X, Sparkles, AlertTriangle, CheckCircle2, Copy, Save, Loader2, FileCode, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useProject } from '../state/projectStore';
import { trpc } from '@/lib/trpc';
import { buildAiScriptContext } from '../ai/buildContext';
import { PROMPT_SCRIPT_PLAN_v1, PROMPT_SCRIPT_GEN_v1 } from '../ai/promptTemplates';
import { localScriptRepository } from '../ai/scriptRepository';
import { ScriptPlanResultSchema, ScriptPackageSchema } from '../ai/types';
import type { TestProfile, TestScenario, TargetEnv, DatasetInstance, DatasetSecretKey } from '../types';
import type { AiScriptContext, ScriptPlanResult, ScriptPackage, ScriptFramework, CodeLanguage } from '../ai/types';

const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];

type Step = 'config' | 'planning' | 'generating' | 'result';

interface Props {
  scenario: TestScenario;
  profile: TestProfile;
  onClose: () => void;
  onSaved?: () => void;
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

  /** Simulate AI plan generation (in production, this calls the API) */
  const simulatePlan = (ctx: AiScriptContext): ScriptPlanResult => {
    const fw = ctx.generation_constraints.framework_preferences[0] || 'playwright';
    const lang = ctx.generation_constraints.code_language;
    const isRobot = fw === 'robotframework';

    const files = isRobot
      ? [
          { path: `tests/${scenario.scenario_code || scenario.id}.robot`, purpose: 'Main test suite' },
          { path: 'resources/keywords.robot', purpose: 'Reusable keywords' },
          { path: 'resources/variables.robot', purpose: 'Centralized variables from dataset' },
        ]
      : [
          { path: `tests/${(scenario.scenario_code || scenario.id).toLowerCase().replace(/[^a-z0-9]/g, '-')}.spec.ts`, purpose: 'Main test spec' },
          { path: 'helpers/selectors.ts', purpose: 'Selector constants from dataset' },
          { path: 'helpers/test-data.ts', purpose: 'Test data from dataset bundle' },
          { path: 'helpers/utils.ts', purpose: 'Shared utility functions' },
        ];

    const stepMapping = ctx.scenario.steps.map(s => ({
      step_id: s.id,
      step_order: s.order,
      action: s.action,
      target_file: files[0].path,
      target_function: isRobot
        ? s.action.replace(/\s+/g, ' ').trim()
        : `step${s.order}_${s.action.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`,
      dataset_keys_used: Object.keys(s.parameters),
    }));

    // Check missing inputs
    const availableKeys = new Set(Object.keys(ctx.dataset.resolved.merged_json));
    const missingInputs: ScriptPlanResult['missing_inputs'] = [];
    for (const s of ctx.scenario.steps) {
      for (const key of Object.keys(s.parameters)) {
        if (!availableKeys.has(key) && !availableKeys.has(`${key}`)) {
          missingInputs.push({ key, reason: `Key "${key}" not found in bundle dataset`, severity: 'WARNING' });
        }
      }
    }

    return {
      framework_choice: fw,
      code_language: lang,
      file_plan: files,
      step_mapping: stepMapping,
      missing_inputs: missingInputs,
      notes: `Plan generated for ${ctx.scenario.title} using ${fw}`,
      warnings: missingInputs.length > 0 ? [`${missingInputs.length} input(s) potentially missing from dataset`] : [],
    };
  };

  /** Simulate AI script generation (in production, this calls the API) */
  const simulateGenerate = (ctx: AiScriptContext, plan: ScriptPlanResult): ScriptPackage => {
    const isRobot = plan.framework_choice === 'robotframework';
    const dataKeys = Object.entries(ctx.dataset.resolved.merged_json);
    const maskedKeys = new Set(ctx.dataset.secrets_policy.masked_keys);

    if (isRobot) {
      const variables = dataKeys.map(([k, v]) =>
        maskedKeys.has(k) ? `\${${k}}    %{${k.toUpperCase()}}` : `\${${k}}    ${JSON.stringify(v)}`
      ).join('\n');

      const keywords = ctx.scenario.steps.map(s =>
        `${s.action}\n    [Documentation]    ${s.description}\n    Log    Executing: ${s.action}\n    # Expected: ${s.expected_result}`
      ).join('\n\n');

      const testCases = ctx.scenario.steps.map(s => `    ${s.action}`).join('\n');

      return {
        files: [
          {
            path: plan.file_plan[0]?.path || 'tests/test.robot',
            content: `*** Settings ***\nDocumentation    ${ctx.scenario.title}\nResource    ../resources/keywords.robot\nResource    ../resources/variables.robot\n\n*** Test Cases ***\n${ctx.scenario.title}\n    [Documentation]    ${ctx.scenario.scenario_code || ctx.scenario.id}\n    [Tags]    ${ctx.profile.test_type}    ${ctx.dataset.env}\n${testCases}\n`,
            language: 'robot',
          },
          {
            path: 'resources/keywords.robot',
            content: `*** Settings ***\nDocumentation    Reusable keywords for ${ctx.scenario.title}\nLibrary    Browser\nResource    variables.robot\n\n*** Keywords ***\n${keywords}\n`,
            language: 'robot',
          },
          {
            path: 'resources/variables.robot',
            content: `*** Variables ***\n# Generated from bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}\n# Environment: ${ctx.dataset.env}\n${variables}\n`,
            language: 'robot',
          },
        ],
        notes: `Generated RobotFramework scripts for ${ctx.scenario.title}`,
        warnings: plan.warnings,
        metadata: {
          framework: plan.framework_choice,
          code_language: plan.code_language,
          scenario_id: ctx.scenario.id,
          bundle_id: ctx.dataset.bundle.id,
          generated_at: new Date().toISOString(),
          prompt_version: 'PROMPT_SCRIPT_GEN_v1',
        },
      };
    }

    // Playwright TypeScript
    const selectorsContent = dataKeys
      .filter(([k]) => k.includes('selector'))
      .map(([k, v]) => `export const ${k.replace(/\./g, '_').toUpperCase()} = ${JSON.stringify(v)};`)
      .join('\n') || '// No selectors found in dataset';

    const testDataContent = dataKeys
      .filter(([k]) => !k.includes('selector'))
      .map(([k, v]) => {
        if (maskedKeys.has(k)) return `export const ${k.replace(/\./g, '_')} = process.env.${k.toUpperCase().replace(/\./g, '_')} || '';`;
        return `export const ${k.replace(/\./g, '_')} = ${JSON.stringify(v)};`;
      })
      .join('\n');

    const testSteps = ctx.scenario.steps.map(s =>
      `  test('Step ${s.order}: ${s.action}', async ({ page }) => {\n    // ${s.description}\n    // Expected: ${s.expected_result}\n    // TODO: Implement step using dataset keys\n  });`
    ).join('\n\n');

    return {
      files: [
        {
          path: plan.file_plan[0]?.path || 'tests/test.spec.ts',
          content: `import { test, expect } from '@playwright/test';\nimport * as selectors from '../helpers/selectors';\nimport * as data from '../helpers/test-data';\n\ntest.describe('${ctx.scenario.title}', () => {\n  test.beforeEach(async ({ page }) => {\n    // Setup: navigate to SUT\n  });\n\n${testSteps}\n});\n`,
          language: 'typescript',
        },
        {
          path: 'helpers/selectors.ts',
          content: `/**\n * Selectors extracted from dataset bundle: ${ctx.dataset.bundle.name}\n * Environment: ${ctx.dataset.env}\n */\n${selectorsContent}\n`,
          language: 'typescript',
        },
        {
          path: 'helpers/test-data.ts',
          content: `/**\n * Test data from bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}\n * Environment: ${ctx.dataset.env}\n * Secret keys use process.env\n */\n${testDataContent}\n`,
          language: 'typescript',
        },
        {
          path: 'helpers/utils.ts',
          content: `/**\n * Shared utilities for ${ctx.scenario.title}\n */\nexport async function waitForLoad(page: any) {\n  await page.waitForLoadState('networkidle');\n}\n\nexport function formatDate(date: Date): string {\n  return date.toISOString().split('T')[0];\n}\n`,
          language: 'typescript',
        },
      ],
      notes: `Generated Playwright TypeScript scripts for ${ctx.scenario.title}`,
      warnings: plan.warnings,
      metadata: {
        framework: plan.framework_choice,
        code_language: plan.code_language,
        scenario_id: ctx.scenario.id,
        bundle_id: ctx.dataset.bundle.id,
        generated_at: new Date().toISOString(),
        prompt_version: 'PROMPT_SCRIPT_GEN_v1',
      },
    };
  };

  const handleStartGeneration = async () => {
    setError('');
    setStep('planning');
    try {
      const ctx = await buildContext();
      setContext(ctx);

      // Check missing inputs blocking
      const missingTypes = scenario.required_dataset_types || [];
      // Simulate plan
      await new Promise(r => setTimeout(r, 600));
      const generatedPlan = simulatePlan(ctx);

      // Validate plan with Zod
      const planResult = ScriptPlanResultSchema.safeParse(generatedPlan);
      if (!planResult.success) {
        setError('Plan invalide: ' + planResult.error.message);
        setStep('config');
        return;
      }
      setPlan(planResult.data);

      // Check blocking missing inputs
      const blocking = planResult.data.missing_inputs.filter(m => m.severity === 'BLOCKING');
      if (blocking.length > 0) {
        setError(`Inputs manquants bloquants: ${blocking.map(b => b.key).join(', ')}`);
        setStep('config');
        return;
      }

      // Generate scripts
      setStep('generating');
      await new Promise(r => setTimeout(r, 800));
      const pkg = simulateGenerate(ctx, planResult.data);

      // Validate package with Zod
      const pkgResult = ScriptPackageSchema.safeParse(pkg);
      if (!pkgResult.success) {
        setError('Package invalide: ' + pkgResult.error.message);
        setStep('config');
        return;
      }
      setScriptPackage(pkgResult.data);
      setStep('result');
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la génération');
      setStep('config');
    }
  };

  const handleSaveToRepo = () => {
    if (!currentProject || !scriptPackage || !context || !plan) return;
    try {
      localScriptRepository.create({
        project_id: currentProject.id,
        scenario_id: scenario.id,
        bundle_id: selectedBundleId,
        env: selectedEnv,
        framework: plan.framework_choice as ScriptFramework,
        code_language: plan.code_language as CodeLanguage,
        files: scriptPackage.files,
        plan,
        notes: scriptPackage.notes,
        warnings: scriptPackage.warnings,
      });
      setSaved(true);
      toast.success('Script sauvegardé dans le repository');
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCopyFile = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Contenu copié');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-heading font-semibold text-foreground">Générer Script</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {scenario.scenario_code || scenario.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-2 text-xs">
          {(['config', 'planning', 'generating', 'result'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <span className={step === s ? 'text-primary font-semibold' : s < step ? 'text-green-400' : 'text-muted-foreground'}>
                {s === 'config' ? 'Configuration' : s === 'planning' ? 'Plan' : s === 'generating' ? 'Génération' : 'Résultat'}
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

              <button
                onClick={handleStartGeneration}
                disabled={!selectedBundleId}
                className="px-6 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Lancer la génération
              </button>
            </div>
          )}

          {/* Planning step */}
          {step === 'planning' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Analyse du scénario et planification des fichiers...</p>
            </div>
          )}

          {/* Generating step */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-muted-foreground">Génération des scripts de test...</p>
              {plan && (
                <p className="text-xs text-muted-foreground mt-2">
                  Framework: {plan.framework_choice} | {plan.file_plan.length} fichier(s) planifié(s)
                </p>
              )}
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
                    {scriptPackage.files.length} fichier(s) générés
                  </span>
                  {plan && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {plan.framework_choice} / {plan.code_language}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSaveToRepo}
                  disabled={saved}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {saved ? 'Sauvegardé' : 'Save to Repo'}
                </button>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
