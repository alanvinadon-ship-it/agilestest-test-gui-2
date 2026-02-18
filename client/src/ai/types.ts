/**
 * IA-SCRIPT-1 — Types et schémas Zod pour la génération de scripts IA.
 *
 * Contrats de sortie stricts pour :
 *   - ScriptPlanResult (plan de génération)
 *   - ScriptPackage (fichiers générés)
 *   - RepairResult (patches de correction)
 *   - AiScriptContext (données d'entrée normalisées)
 */
import { z } from 'zod';
import type { TargetEnv, TestType, BundleStatus } from '../types';

// ─── Enums ────────────────────────────────────────────────────────────────

export type CodeLanguage = 'TypeScript' | 'Robot' | 'Python';
export type ScriptFramework = 'playwright' | 'robotframework' | 'cypress' | 'selenium' | 'k6' | 'custom';
export type ScriptStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';

// ─── AiScriptContext (données d'entrée normalisées) ───────────────────────

export interface AiScriptContext {
  project: {
    id: string;
    name: string;
  };
  profile: {
    id: string;
    domain: string;
    test_type: TestType;
    profile_type: string;
    runner_type: string;
    config: Record<string, unknown>;
  };
  scenario: {
    id: string;
    title: string;
    scenario_code?: string;
    steps: Array<{
      id: string;
      order: number;
      action: string;
      description: string;
      expected_result: string;
      parameters: Record<string, unknown>;
    }>;
    expected_results: string[];
    required_inputs: string[];
    required_dataset_types: string[];
    tags: string[];
  };
  dataset: {
    env: TargetEnv;
    bundle: {
      id: string;
      name: string;
      version: number;
    };
    resolved: {
      merged_json: Record<string, unknown>;
    };
    secrets_policy: {
      masked_keys: string[];
    };
  };
  generation_constraints: {
    code_language: CodeLanguage;
    framework_preferences: ScriptFramework[];
    style_rules: string[];
    artifact_policy: string[];
  };
}

// ─── Zod Schemas — Contrats de sortie IA ──────────────────────────────────

/** ScriptPlanResult — Sortie de PROMPT_SCRIPT_PLAN_v1 */
export const ScriptPlanResultSchema = z.object({
  framework_choice: z.string().describe('Framework choisi (playwright, robotframework, etc.)'),
  code_language: z.string().describe('Langage de code (TypeScript, Robot, Python)'),
  file_plan: z.array(z.object({
    path: z.string().describe('Chemin relatif du fichier à générer'),
    purpose: z.string().describe('Rôle du fichier'),
    dependencies: z.array(z.string()).optional().describe('Dépendances du fichier'),
  })).describe('Plan des fichiers à générer'),
  step_mapping: z.array(z.object({
    step_id: z.string(),
    step_order: z.number(),
    action: z.string(),
    target_file: z.string().describe('Fichier qui implémentera cette étape'),
    target_function: z.string().describe('Nom de la fonction/keyword'),
    dataset_keys_used: z.array(z.string()).describe('Clés du dataset utilisées'),
  })).describe('Mapping étapes scénario → fichiers/fonctions'),
  missing_inputs: z.array(z.object({
    key: z.string(),
    reason: z.string(),
    severity: z.enum(['BLOCKING', 'WARNING']),
  })).describe('Inputs manquants détectés'),
  notes: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});
export type ScriptPlanResult = z.infer<typeof ScriptPlanResultSchema>;

/** ScriptPackage — Sortie de PROMPT_SCRIPT_GEN_v1 */
export const ScriptPackageSchema = z.object({
  files: z.array(z.object({
    path: z.string().describe('Chemin relatif du fichier'),
    content: z.string().describe('Contenu complet du fichier'),
    language: z.string().optional().describe('Langage du fichier (ts, robot, py, json, etc.)'),
  })).min(1).describe('Fichiers générés'),
  notes: z.string().optional().describe('Notes de génération'),
  warnings: z.array(z.string()).optional().describe('Avertissements'),
  metadata: z.object({
    framework: z.string(),
    code_language: z.string(),
    scenario_id: z.string(),
    bundle_id: z.string(),
    generated_at: z.string(),
    prompt_version: z.string(),
  }).optional(),
});
export type ScriptPackage = z.infer<typeof ScriptPackageSchema>;

/** RepairResult — Sortie de PROMPT_SCRIPT_REPAIR_v1 */
export const RepairResultSchema = z.object({
  patches: z.array(z.object({
    file_path: z.string().describe('Fichier à patcher'),
    original_snippet: z.string().describe('Extrait original'),
    patched_snippet: z.string().describe('Extrait corrigé'),
    explanation: z.string().describe('Explication du patch'),
  })).describe('Patches de correction'),
  root_cause: z.string().describe('Cause racine identifiée'),
  suggested_fix: z.string().describe('Correction suggérée (résumé)'),
  confidence: z.number().min(0).max(1).describe('Score de confiance'),
  warnings: z.array(z.string()).optional(),
});
export type RepairResult = z.infer<typeof RepairResultSchema>;

// ─── GeneratedScript (entité stockée) ─────────────────────────────────────

export interface GeneratedScript {
  script_id: string;
  project_id: string;
  scenario_id: string;
  bundle_id: string;
  env: TargetEnv;
  framework: ScriptFramework;
  code_language: CodeLanguage;
  version: number;
  status: ScriptStatus;
  files: Array<{ path: string; content: string; language?: string }>;
  plan?: ScriptPlanResult;
  notes?: string;
  warnings?: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Prompt template metadata ─────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  buildPrompt: (context: AiScriptContext, extra?: Record<string, unknown>) => string;
}
