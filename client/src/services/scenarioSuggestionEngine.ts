/**
 * scenarioSuggestionEngine.ts — Moteur de suggestion de scénarios "IA explicable".
 *
 * Durcissement industriel (Orange) :
 * - Normalisation IDs : TESTTYPE-DOMAINCODE-NNN-SLUG
 * - Import modes : SKIP | RENAME | OVERWRITE
 * - Rapport d'import détaillé
 * - Audit log
 * - Versioning (status DRAFT par défaut)
 *
 * NOTE: Ce module n'importe plus localStore.
 * Les opérations CRUD sont injectées via l'interface ScenarioStore.
 */

import type { TestProfile, TestScenario, ScenarioStep, ImportMode, ImportReport, AuditLogEntry } from '../types';
import {
  type ScenarioTemplate,
  type ScopeLevel,
  type Priority,
  getTemplatesForProfile,
  filterByScope,
} from '../config/scenarioTemplates';

// ─── Dependency Injection Interface ──────────────────────────────────────

/**
 * Interface abstraite pour les opérations scénario.
 * L'appelant (SuggestScenariosModal) fournit une implémentation
 * basée sur tRPC ou tout autre backend.
 */
export interface ScenarioStore {
  /** Retourne le prochain NNN disponible pour le triplet (projectId, testType, domain) */
  nextId(projectId: string, testType: string, domain: string): { nnn: number };
  /** Vérifie si un scenario_code existe déjà dans le projet */
  codeExists(projectId: string, code: string): boolean;
  /** Génère un code unique (testType-domainCode-NNN-slug) */
  generateCode(projectId: string, testType: string, domain: string, title: string): string;
  /** Crée un scénario et retourne l'objet créé (avec id) */
  create(profileId: string, projectId: string, data: any): { id: string };
  /** Met à jour un scénario existant */
  update(id: string, data: any): void;
  /** Liste tous les scénarios d'un projet */
  listByProject(projectId: string): { data: TestScenario[] };
}

export interface AuditStore {
  /** Ajoute une entrée d'audit */
  add(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): { id: string; timestamp: string };
}

// ─── Domain Code Mapping ──────────────────────────────────────────────────

const DOMAIN_CODE_MAP: Record<string, string> = {
  WEB: 'WEB', API: 'API', MOBILE: 'MOB', DESKTOP: 'DESK',
  TELECOM_IMS: 'IMS', TELECOM_RAN: 'RAN', TELECOM_EPC: 'EPC4',
  TELECOM_5GC_SA: '5GSA', TELECOM_5GC_NSA: '5GNSA',
  IOT: 'DRIVE', IMS: 'IMS', RAN: 'RAN', EPC: 'EPC4', '5GC': '5GSA',
};

function getDomainCode(domain: string): string {
  return DOMAIN_CODE_MAP[domain] || domain.slice(0, 4).toUpperCase();
}

function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface SuggestRequest {
  profile: TestProfile;
  project_id: string;
  project_name: string;
  scope_level: ScopeLevel;
  business_entities?: string[];
  constraints?: {
    id_prefix?: string;
    numbering_start?: number;
  };
}

export interface SuggestedScenario {
  /** Code normalisé : TESTTYPE-DOMAINCODE-NNN-SLUG */
  scenario_code: string;
  /** Ancien format d'ID (pour rétrocompatibilité) */
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
    domain_code: string;
    test_type: string;
    profile_type: string;
    scope_level: ScopeLevel;
    total_templates_matched: number;
    total_after_scope_filter: number;
    generated_at: string;
    breakdown: { P0: number; P1: number; P2: number };
  };
}

// ─── Normalisation IDs ────────────────────────────────────────────────────

/**
 * Génère un scenario_code normalisé : TESTTYPE-DOMAINCODE-NNN-SLUG
 * Le NNN est incrémenté par (project_id, test_type, domain_code) via store.nextId
 */
function generateScenarioCode(
  store: ScenarioStore,
  projectId: string,
  testType: string,
  domain: string,
  title: string,
  offset: number = 0,
): string {
  const domainCode = getDomainCode(domain);
  const prefix = `${testType}-${domainCode}`;
  const slug = slugify(title);

  // Récupérer le prochain NNN disponible
  const { nnn } = store.nextId(projectId, testType, domain);
  const num = (nnn + offset).toString().padStart(3, '0');
  return `${prefix}-${num}-${slug}`;
}

/**
 * Adapte le titre du template au contexte du profil.
 */
function adaptTitle(template: ScenarioTemplate, profile: TestProfile): string {
  let title = template.title;
  if (profile.config) {
    const sutUrl = profile.config.sut_url || profile.config.base_url;
    if (sutUrl && typeof sutUrl === 'string') {
      try {
        const hostname = new URL(sutUrl as string).hostname;
        if (title.length < 40) {
          title = `${title} — ${hostname}`;
        }
      } catch { /* URL invalide */ }
    }
  }
  return title;
}

/**
 * Adapte les required_inputs en fonction de la config du profil.
 */
function adaptRequiredInputs(template: ScenarioTemplate, profile: TestProfile): string[] {
  const inputs = [...template.required_inputs];
  const config = profile.config || {};
  return inputs.map(input => {
    const configKey = input.replace('url_', 'sut_url').replace('base_url', 'base_url');
    if (config[configKey] || config[input]) {
      return `${input} ✓ (fourni par le profil)`;
    }
    return input;
  });
}

// ─── Moteur principal ─────────────────────────────────────────────────────

/**
 * Génère des suggestions de scénarios basées sur un profil de test.
 * IDs normalisés : TESTTYPE-DOMAINCODE-NNN-SLUG
 *
 * @param request - Paramètres de la requête
 * @param store - Implémentation ScenarioStore (pour nextId)
 */
export function suggestScenarios(request: SuggestRequest, store: ScenarioStore): SuggestResponse {
  const { profile, project_id, project_name, scope_level, constraints } = request;

  const domain = profile.domain || 'WEB';
  const testType = profile.test_type || 'VABF';
  const profileType = profile.profile_type || 'UI_E2E';
  const domainCode = getDomainCode(domain);

  // 1. Sélectionner les templates compatibles
  const allMatched = getTemplatesForProfile(domain, testType, profileType);

  // 2. Filtrer par scope
  const scopeFiltered = filterByScope(allMatched, scope_level);

  // 3. Trier par priorité (P0 d'abord, puis P1, puis P2)
  const priorityOrder: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };
  const sorted = [...scopeFiltered].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // 4. Breakdown par priorité
  const breakdown = { P0: 0, P1: 0, P2: 0 };
  sorted.forEach(t => { breakdown[t.priority]++; });

  // 5. Adapter chaque template en suggestion avec IDs normalisés
  const suggestions: SuggestedScenario[] = sorted.map((template, index) => {
    const title = adaptTitle(template, profile);
    const code = generateScenarioCode(store, project_id, testType, domain, title, index);

    return {
      scenario_code: code,
      scenario_id: code, // Rétrocompatibilité
      title,
      priority: template.priority,
      rationale: template.rationale,
      steps_outline: template.steps_outline.map(s => ({ ...s })),
      expected_results_outline: [...template.expected_results_outline],
      required_inputs: adaptRequiredInputs(template, profile),
      required_datasets_types: [...template.required_datasets_types],
      tags: [...template.tags],
      source_template_id: template.template_id,
    };
  });

  return {
    suggestions,
    metadata: {
      profile_id: profile.id,
      profile_name: profile.name,
      domain,
      domain_code: domainCode,
      test_type: testType,
      profile_type: profileType,
      scope_level,
      total_templates_matched: allMatched.length,
      total_after_scope_filter: scopeFiltered.length,
      generated_at: new Date().toISOString(),
      breakdown,
    },
  };
}

// ─── Conversion suggestion → scénario ─────────────────────────────────────

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
    scenario_code: suggestion.scenario_code,
    name: `[${suggestion.scenario_code}] ${suggestion.title}`,
    description: `${suggestion.rationale}\n\nPriorité : ${suggestion.priority}\nTags : ${suggestion.tags.join(', ')}\nInputs requis : ${suggestion.required_inputs.join(', ')}\nDatasets : ${suggestion.required_datasets_types.join(', ') || 'Aucun'}`,
    steps,
    status: 'DRAFT' as const,
    version: 1,
    required_dataset_types: suggestion.required_datasets_types,
    metadata: {
      source_template_id: suggestion.source_template_id,
      imported_at: new Date().toISOString(),
      imported_by: 'local-admin-001',
    },
  };
}

// ─── Import en masse robuste ──────────────────────────────────────────────

/**
 * Importe une liste de suggestions avec gestion des collisions.
 * Modes : SKIP (ignorer), RENAME (auto-renommer), OVERWRITE (écraser, admin only)
 *
 * @param store - Implémentation ScenarioStore (CRUD)
 * @param auditStore - Implémentation AuditStore (audit log)
 */
export function bulkImportSuggestions(
  suggestions: SuggestedScenario[],
  profileId: string,
  projectId: string,
  importMode: ImportMode = 'RENAME',
  store: ScenarioStore,
  auditStore: AuditStore,
): ImportReport {
  const details: ImportReport['details'] = [];
  let imported_count = 0;
  let skipped_count = 0;
  let renamed_count = 0;
  let overwritten_count = 0;

  for (const suggestion of suggestions) {
    const scenarioCode = suggestion.scenario_code;
    const exists = store.codeExists(projectId, scenarioCode);

    if (exists) {
      switch (importMode) {
        case 'SKIP': {
          skipped_count++;
          details.push({
            scenario_id: '',
            scenario_code: scenarioCode,
            action: 'SKIPPED',
            message: `Code "${scenarioCode}" existe déjà — ignoré.`,
          });
          break;
        }

        case 'RENAME': {
          // Générer un nouveau code avec next-id
          const domain = suggestion.scenario_code.split('-')[1] || 'WEB';
          const testType = suggestion.scenario_code.split('-')[0] || 'VABF';
          const newCode = store.generateCode(projectId, testType, domain, suggestion.title);

          const data = suggestionToScenario(suggestion, profileId, projectId);
          data.scenario_code = newCode;
          data.name = `[${newCode}] ${suggestion.title}`;
          (data.metadata as any) = {
            ...data.metadata,
            import_source_id: scenarioCode,
            import_mode: 'RENAME',
          };

          const created = store.create(profileId, projectId, data);
          renamed_count++;
          imported_count++;
          details.push({
            scenario_id: created.id,
            scenario_code: newCode,
            action: 'RENAMED',
            old_id: scenarioCode,
            message: `Renommé de "${scenarioCode}" → "${newCode}".`,
          });
          break;
        }

        case 'OVERWRITE': {
          // Trouver l'existant et le mettre à jour
          const allScenarios = store.listByProject(projectId);
          const existing = allScenarios.data.find(s => s.scenario_code === scenarioCode);
          if (existing) {
            const data = suggestionToScenario(suggestion, profileId, projectId);
            store.update(existing.id, {
              ...data,
              version: (existing.version || 1) + 1,
              metadata: { ...data.metadata, import_mode: 'OVERWRITE' },
            });
            overwritten_count++;
            imported_count++;
            details.push({
              scenario_id: existing.id,
              scenario_code: scenarioCode,
              action: 'OVERWRITTEN',
              message: `Écrasé (v${existing.version} → v${(existing.version || 1) + 1}).`,
            });
          }
          break;
        }
      }
    } else {
      // Pas de collision — import direct
      const data = suggestionToScenario(suggestion, profileId, projectId);
      (data.metadata as any) = { ...data.metadata, import_mode: importMode };
      const created = store.create(profileId, projectId, data);
      imported_count++;
      details.push({
        scenario_id: created.id,
        scenario_code: scenarioCode,
        action: 'IMPORTED',
        message: `Importé avec succès.`,
      });
    }
  }

  // Audit log
  const auditEntry = auditStore.add({
    actor_user_id: 'local-admin-001',
    project_id: projectId,
    profile_id: profileId,
    action: 'IMPORT',
    import_mode: importMode,
    imported_ids: details.filter(d => d.action !== 'SKIPPED').map(d => d.scenario_id),
  });

  return {
    imported_count,
    skipped_count,
    renamed_count,
    overwritten_count,
    details,
    audit_log_id: auditEntry.id,
    timestamp: auditEntry.timestamp,
  };
}
