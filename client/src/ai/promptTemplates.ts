/**
 * Prompt Templates — 3 templates versionnés pour la génération de scripts IA.
 *
 * 1) PROMPT_SCRIPT_PLAN_v1   → Plan de génération (framework, fichiers, mapping)
 * 2) PROMPT_SCRIPT_GEN_v1    → Génération du ScriptPackage (fichiers complets)
 * 3) PROMPT_SCRIPT_REPAIR_v1 → Réparation à partir de logs/artefacts
 *
 * Chaque template produit un prompt déterministe à partir d'un AiScriptContext.
 */
import type { AiScriptContext, PromptTemplate, ScriptPlanResult } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function jsonBlock(obj: unknown): string {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}

function formatSteps(steps: AiScriptContext['scenario']['steps']): string {
  return steps.map(s => {
    const parts = [`  ${s.order}. [${s.action}]`];
    if (s.target) parts.push(`target="${s.target}"`);
    if (s.locator_strategy) parts.push(`locator=${s.locator_strategy}`);
    if (s.input_binding) parts.push(`binding=${s.input_binding}`);
    if (s.description) parts.push(s.description);
    const line1 = parts.join(' ');
    const line2 = `     Expected: ${s.expected_result || 'N/A'}`;
    return `${line1}\n${line2}`;
  }).join('\n');
}

function formatDatasetKeys(merged: Record<string, unknown>, maskedKeys: string[]): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    const isMasked = maskedKeys.some(mk => key.includes(mk) || mk.includes(key));
    if (isMasked) {
      lines.push(`  ${key}: ***MASKED***`);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Afficher les objets avec leurs sous-clés détaillées
      const obj = value as Record<string, unknown>;
      const subKeys = Object.keys(obj).join(', ');
      lines.push(`  ${key}: {${subKeys}} (object with ${Object.keys(obj).length} fields)`);
    } else {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }
  return lines.join('\n');
}

// ─── PROMPT_SCRIPT_PLAN_v1 ────────────────────────────────────────────────

export const PROMPT_SCRIPT_PLAN_v1: PromptTemplate = {
  id: 'PROMPT_SCRIPT_PLAN_v1',
  version: '1.0.0',
  name: 'Script Plan Generator',
  description: 'Génère un plan de fichiers et un mapping étapes→fonctions pour un scénario de test.',
  buildPrompt: (ctx: AiScriptContext) => `You are an expert test automation architect.

## TASK
Analyze the following test scenario and produce a **ScriptPlanResult** JSON object.

## CONTEXT

### Project
- Name: ${ctx.project.name}
- ID: ${ctx.project.id}

### Profile
- Domain: ${ctx.profile.domain}
- Test Type: ${ctx.profile.test_type}
- Profile Type: ${ctx.profile.profile_type}
- Runner Type: ${ctx.profile.runner_type}

### Scenario
- Title: ${ctx.scenario.title}
- Code: ${ctx.scenario.scenario_code || 'N/A'}
- Required Dataset Types: ${ctx.scenario.required_dataset_types.join(', ') || 'none'}
- Steps:
${formatSteps(ctx.scenario.steps)}

### Dataset (${ctx.dataset.env})
- Bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}
- Available keys:
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

### Generation Constraints
- Preferred Language: ${ctx.generation_constraints.code_language}
- Preferred Frameworks: ${ctx.generation_constraints.framework_preferences.join(', ')}
- Style Rules: ${ctx.generation_constraints.style_rules.join('; ')}
- Artifact Policy: ${ctx.generation_constraints.artifact_policy.join(', ')}

## RULES
1. Choose ONE framework from the preferred list.
2. Plan files following the framework's conventions.
3. Map EVERY scenario step to a specific file and function/keyword.
4. Reference dataset keys by their exact names — NEVER invent selectors or values.
5. If a step already has an input_binding (e.g. binding=username), that key is ALREADY mapped to the dataset — do NOT report it as missing. Only add to missing_inputs (severity WARNING) if a FILL/SELECT/UPLOAD step has NO input_binding AND the required key is not found in the available dataset keys. Object-type keys (e.g. user_info, address) contain nested fields also available as flattened keys (e.g. user_info.firstName, address.city).
6. Secret keys (${ctx.dataset.secrets_policy.masked_keys.join(', ') || 'none'}) must be referenced via environment variables, NEVER hardcoded.

## OUTPUT FORMAT
Return ONLY a valid JSON object matching this schema:
${jsonBlock({
  framework_choice: 'string',
  code_language: 'string',
  file_plan: [{ path: 'string', purpose: 'string', dependencies: ['string'] }],
  step_mapping: [{ step_id: 'string', step_order: 0, action: 'string', target_file: 'string', target_function: 'string', dataset_keys_used: ['string'] }],
  missing_inputs: [{ key: 'string', reason: 'string', severity: 'BLOCKING|WARNING' }],
  notes: 'string (optional)',
  warnings: ['string (optional)'],
})}

Return ONLY the JSON, no markdown fences, no explanation.`,
};

// ─── PROMPT_SCRIPT_GEN_v1 ─────────────────────────────────────────────────

export const PROMPT_SCRIPT_GEN_v1: PromptTemplate = {
  id: 'PROMPT_SCRIPT_GEN_v1',
  version: '1.0.0',
  name: 'Script Generator',
  description: 'Génère un ScriptPackage complet (fichiers de test) à partir du plan et du contexte.',
  buildPrompt: (ctx: AiScriptContext, extra?: Record<string, unknown>) => {
    const plan = extra?.plan as ScriptPlanResult | undefined;
    const planSection = plan
      ? `### Approved Plan\n${jsonBlock(plan)}`
      : '### Plan\nNo plan provided — generate files based on scenario steps directly.';

    return `You are an expert test automation engineer.

## TASK
Generate complete, production-ready test script files for the following scenario.

## CONTEXT

### Project: ${ctx.project.name}
### Profile
- Domain: ${ctx.profile.domain} | Test Type: ${ctx.profile.test_type}
- Runner: ${ctx.profile.runner_type}

### Scenario: ${ctx.scenario.title} (${ctx.scenario.scenario_code || ctx.scenario.id})
Steps:
${formatSteps(ctx.scenario.steps)}

### Dataset (${ctx.dataset.env}) — Bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}
Available keys:
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

${planSection}

### Generation Constraints
- Language: ${ctx.generation_constraints.code_language}
- Framework: ${plan?.framework_choice || ctx.generation_constraints.framework_preferences[0]}
- Style Rules: ${ctx.generation_constraints.style_rules.join('; ')}
- Artifacts: ${ctx.generation_constraints.artifact_policy.join(', ')}

## RULES
1. Generate ALL files listed in the plan (or infer from steps if no plan).
2. NEVER hardcode selectors — import from selectors.ts or use dataset keys (selectors_*).
3. NEVER hardcode business values — use dataset keys via import or config.
4. When a step has an input_binding (e.g. binding=username), use that exact dataset key in the generated code. The binding is already resolved to the dataset.
5. Secret values (${ctx.dataset.secrets_policy.masked_keys.join(', ') || 'none'}) → use process.env or %{ENV_VAR} syntax.
6. For RobotFramework: produce reusable keywords, centralized variables.
7. For Playwright: produce spec.ts + helpers + selectors.ts imports.
8. Include proper error handling and assertion messages referencing step context.
9. Each file must be complete and runnable.

## OUTPUT FORMAT
Return ONLY a valid JSON object:
${jsonBlock({
  files: [{ path: 'string', content: 'string (full file content)', language: 'string' }],
  notes: 'string (optional)',
  warnings: ['string (optional)'],
  metadata: {
    framework: 'string',
    code_language: 'string',
    scenario_id: ctx.scenario.id,
    bundle_id: ctx.dataset.bundle.id,
    generated_at: 'ISO string',
    prompt_version: 'PROMPT_SCRIPT_GEN_v1',
  },
})}

Return ONLY the JSON, no markdown fences, no explanation.`;
  },
};

// ─── PROMPT_SCRIPT_REPAIR_v1 ──────────────────────────────────────────────

export const PROMPT_SCRIPT_REPAIR_v1: PromptTemplate = {
  id: 'PROMPT_SCRIPT_REPAIR_v1',
  version: '1.0.0',
  name: 'Script Repair',
  description: 'Analyse les logs/artefacts d\'échec et propose des patches de correction.',
  buildPrompt: (ctx: AiScriptContext, extra?: Record<string, unknown>) => {
    const errorLogs = (extra?.error_logs as string) || 'No logs provided.';
    const currentFiles = (extra?.current_files as Array<{ path: string; content: string }>) || [];
    const filesSection = currentFiles.length > 0
      ? currentFiles.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')
      : 'No current files provided.';

    return `You are an expert test automation debugger.

## TASK
Analyze the error logs and current script files, then produce patches to fix the failing test.

## CONTEXT

### Scenario: ${ctx.scenario.title} (${ctx.scenario.scenario_code || ctx.scenario.id})
### Framework: ${ctx.generation_constraints.framework_preferences[0]}
### Dataset (${ctx.dataset.env}): ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}

### Error Logs
\`\`\`
${errorLogs}
\`\`\`

### Current Script Files
${filesSection}

### Available Dataset Keys
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

## RULES
1. Follow the analysis pattern: Observation → Hypotheses → Root Cause → Fix.
2. NEVER invent selectors or values — only use dataset keys.
3. Patches must be minimal and targeted.
4. Provide confidence score (0-1).

## OUTPUT FORMAT
Return ONLY a valid JSON object:
${jsonBlock({
  patches: [{ file_path: 'string', original_snippet: 'string', patched_snippet: 'string', explanation: 'string' }],
  root_cause: 'string',
  suggested_fix: 'string',
  confidence: 0.85,
  warnings: ['string (optional)'],
})}

Return ONLY the JSON, no markdown fences, no explanation.`;
  },
};

// ─── Drive Test Templates (imported) ─────────────────────────────────────

import { DRIVE_PROMPT_TEMPLATES } from './driveTestTemplates';

// ─── Registry ─────────────────────────────────────────────────────────────

export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  PROMPT_SCRIPT_PLAN_v1,
  PROMPT_SCRIPT_GEN_v1,
  PROMPT_SCRIPT_REPAIR_v1,
  ...DRIVE_PROMPT_TEMPLATES,
};

export function getPromptTemplate(id: string): PromptTemplate | undefined {
  return PROMPT_TEMPLATES[id];
}

export function listPromptTemplates(): PromptTemplate[] {
  return Object.values(PROMPT_TEMPLATES);
}
