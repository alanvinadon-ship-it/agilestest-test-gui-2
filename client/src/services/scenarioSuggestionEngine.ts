/**
 * scenarioSuggestionEngine.ts — Moteur de suggestion de scénarios "IA explicable".
 *
 * Le moteur :
 * 1. Sélectionne les templates compatibles avec le profil (domain + test_type + profile_type)
 * 2. Filtre par scope (MINIMAL, STANDARD, FULL)
 * 3. Adapte les titres et IDs (normalisation avec préfixe projet/profil)
 * 4. Remplit les required_inputs et datasets génériques
 * 5. Génère un rationale explicable par scénario
 */

import type { TestProfile, TestScenario, ScenarioStep } from '../types';
import {
  type ScenarioTemplate,
  type ScopeLevel,
  type Priority,
  getTemplatesForProfile,
  filterByScope,
} from '../config/scenarioTemplates';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SuggestRequest {
  profile: TestProfile;
  project_name: string;
  scope_level: ScopeLevel;
  business_entities?: string[];
  constraints?: {
    id_prefix?: string;
    numbering_start?: number;
  };
}

export interface SuggestedScenario {
  /** ID normalisé du scénario (ex: OWEB-VABF-001) */
  scenario_id: string;
  /** Titre adapté */
  title: string;
  /** Priorité P0/P1/P2 */
  priority: Priority;
  /** Justification explicable (1-2 phrases) */
  rationale: string;
  /** Étapes du scénario */
  steps_outline: Array<{
    action: string;
    description: string;
    expected_result: string;
  }>;
  /** Résultats attendus globaux */
  expected_results_outline: string[];
  /** Inputs requis */
  required_inputs: string[];
  /** Types de datasets nécessaires */
  required_datasets_types: string[];
  /** Tags */
  tags: string[];
  /** Template source (pour traçabilité) */
  source_template_id: string;
}

export interface SuggestResponse {
  suggestions: SuggestedScenario[];
  metadata: {
    profile_id: string;
    profile_name: string;
    domain: string;
    test_type: string;
    profile_type: string;
    scope_level: ScopeLevel;
    total_templates_matched: number;
    total_after_scope_filter: number;
    generated_at: string;
  };
}

// ─── Normalisation ─────────────────────────────────────────────────────────

/**
 * Génère un préfixe d'ID basé sur le nom du projet.
 * Ex: "Orange-web-001" → "OWEB"
 */
function generateIdPrefix(projectName: string): string {
  const words = projectName
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return 'TST';
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase();

  // Prendre la première lettre de chaque mot (max 4)
  return words
    .slice(0, 4)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Normalise un ID de scénario.
 * Format : {PREFIX}-{TEST_TYPE}-{NNN}
 */
function normalizeId(
  prefix: string,
  testType: string,
  index: number,
  startNumber: number,
): string {
  const num = (startNumber + index).toString().padStart(3, '0');
  return `${prefix}-${testType}-${num}`;
}

/**
 * Adapte le titre du template au contexte du profil.
 */
function adaptTitle(
  template: ScenarioTemplate,
  profile: TestProfile,
): string {
  let title = template.title;

  // Ajouter le contexte du profil si pertinent
  if (profile.config) {
    const sutUrl = profile.config.sut_url || profile.config.base_url;
    if (sutUrl && typeof sutUrl === 'string') {
      try {
        const hostname = new URL(sutUrl as string).hostname;
        // Ne pas ajouter si le titre est déjà assez long
        if (title.length < 40) {
          title = `${title} — ${hostname}`;
        }
      } catch {
        // URL invalide, on garde le titre original
      }
    }
  }

  return title;
}

/**
 * Adapte les required_inputs en fonction de la config du profil.
 */
function adaptRequiredInputs(
  template: ScenarioTemplate,
  profile: TestProfile,
): string[] {
  const inputs = [...template.required_inputs];
  const config = profile.config || {};

  // Marquer les inputs déjà fournis par la config du profil
  return inputs.map(input => {
    const configKey = input.replace('url_', 'sut_url').replace('base_url', 'base_url');
    if (config[configKey] || config[input]) {
      return `${input} ✓ (fourni par le profil)`;
    }
    return input;
  });
}

// ─── Moteur principal ──────────────────────────────────────────────────────

/**
 * Génère des suggestions de scénarios basées sur un profil de test.
 */
export function suggestScenarios(request: SuggestRequest): SuggestResponse {
  const { profile, project_name, scope_level, constraints } = request;

  const domain = profile.domain || 'WEB';
  const testType = profile.test_type || 'VABF';
  const profileType = profile.profile_type || 'UI_E2E';

  // 1. Sélectionner les templates compatibles
  const allMatched = getTemplatesForProfile(domain, testType, profileType);

  // 2. Filtrer par scope
  const scopeFiltered = filterByScope(allMatched, scope_level);

  // 3. Trier par priorité (P0 d'abord, puis P1, puis P2)
  const priorityOrder: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };
  const sorted = [...scopeFiltered].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // 4. Générer le préfixe d'ID
  const idPrefix = constraints?.id_prefix || generateIdPrefix(project_name);
  const startNumber = constraints?.numbering_start || 1;

  // 5. Adapter chaque template en suggestion
  const suggestions: SuggestedScenario[] = sorted.map((template, index) => ({
    scenario_id: normalizeId(idPrefix, testType, index, startNumber),
    title: adaptTitle(template, profile),
    priority: template.priority,
    rationale: template.rationale,
    steps_outline: template.steps_outline.map(s => ({ ...s })),
    expected_results_outline: [...template.expected_results_outline],
    required_inputs: adaptRequiredInputs(template, profile),
    required_datasets_types: [...template.required_datasets_types],
    tags: [...template.tags],
    source_template_id: template.template_id,
  }));

  return {
    suggestions,
    metadata: {
      profile_id: profile.id,
      profile_name: profile.name,
      domain,
      test_type: testType,
      profile_type: profileType,
      scope_level,
      total_templates_matched: allMatched.length,
      total_after_scope_filter: scopeFiltered.length,
      generated_at: new Date().toISOString(),
    },
  };
}

/**
 * Convertit une suggestion en TestScenario prêt à être importé.
 */
export function suggestionToScenario(
  suggestion: SuggestedScenario,
  profileId: string,
  projectId: string,
): Omit<TestScenario, 'id' | 'created_at' | 'updated_at'> {
  const steps: ScenarioStep[] = suggestion.steps_outline.map((step, index) => ({
    id: `step-${index + 1}`,
    order: index + 1,
    action: step.action,
    description: step.description,
    expected_result: step.expected_result,
    parameters: {},
  }));

  return {
    profile_id: profileId,
    project_id: projectId,
    name: `[${suggestion.scenario_id}] ${suggestion.title}`,
    description: `${suggestion.rationale}\n\nPriorité : ${suggestion.priority}\nTags : ${suggestion.tags.join(', ')}\nInputs requis : ${suggestion.required_inputs.join(', ')}\nDatasets : ${suggestion.required_datasets_types.join(', ') || 'Aucun'}`,
    steps,
  };
}

/**
 * Importe une liste de suggestions en tant que scénarios dans le localStore.
 * Gère les conflits d'ID en ajoutant un suffixe.
 */
export function bulkImportSuggestions(
  suggestions: SuggestedScenario[],
  profileId: string,
  projectId: string,
  createFn: (profileId: string, projectId: string, data: Partial<TestScenario>) => TestScenario,
): { imported: TestScenario[]; errors: Array<{ scenario_id: string; error: string }> } {
  const imported: TestScenario[] = [];
  const errors: Array<{ scenario_id: string; error: string }> = [];

  for (const suggestion of suggestions) {
    try {
      const data = suggestionToScenario(suggestion, profileId, projectId);
      const created = createFn(profileId, projectId, data);
      imported.push(created);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      if (message.includes('409') || message.includes('conflit')) {
        // Tentative avec suffixe
        try {
          const data = suggestionToScenario(suggestion, profileId, projectId);
          data.name = `${data.name} (bis)`;
          const created = createFn(profileId, projectId, data);
          imported.push(created);
        } catch (retryErr) {
          errors.push({
            scenario_id: suggestion.scenario_id,
            error: retryErr instanceof Error ? retryErr.message : 'Erreur lors du retry',
          });
        }
      } else {
        errors.push({ scenario_id: suggestion.scenario_id, error: message });
      }
    }
  }

  return { imported, errors };
}
