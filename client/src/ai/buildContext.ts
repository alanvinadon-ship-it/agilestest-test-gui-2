/**
 * buildAiScriptContext — Assemble un contexte normalisé et déterministe
 * à partir de (project, profile, scenario, bundle + resolved datasets).
 *
 * Ce contexte est ensuite injecté dans les templates de prompt IA.
 */
import type { AiScriptContext, CodeLanguage, ScriptFramework } from './types';
import type {
  Project, TestProfile, TestScenario, DatasetBundle,
  DatasetInstance, DatasetSecretKey, TargetEnv,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Fusionne les values_json de tous les datasets d'un bundle en un seul objet */
function mergeDatasetValues(datasets: DatasetInstance[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const ds of datasets) {
    for (const [key, value] of Object.entries(ds.values_json)) {
      // Préfixe par dataset_type_id pour éviter les collisions
      merged[`${ds.dataset_type_id}.${key}`] = value;
      // Aussi disponible sans préfixe (dernier gagne)
      merged[key] = value;
    }
  }
  return merged;
}

/** Extrait les clés masquées (secrets) */
function extractMaskedKeys(secrets: DatasetSecretKey[]): string[] {
  return secrets.filter(s => s.is_secret).map(s => s.key_path);
}

/** Déduit le code_language et framework depuis le profil */
function inferFrameworkPreferences(profile: TestProfile): {
  code_language: CodeLanguage;
  framework_preferences: ScriptFramework[];
} {
  const domain = profile.domain || '';
  const profileType = (profile as any).profile_type || '';
  const config = profile.config || profile.parameters || {};
  const runnerType = (config as any).runner_type || '';

  // Détection par runner_type explicite
  if (runnerType === 'playwright' || profileType.includes('E2E')) {
    return { code_language: 'TypeScript', framework_preferences: ['playwright'] };
  }
  if (runnerType === 'robotframework' || runnerType === 'robot') {
    return { code_language: 'Robot', framework_preferences: ['robotframework'] };
  }
  if (runnerType === 'k6') {
    return { code_language: 'TypeScript', framework_preferences: ['k6'] };
  }
  if (runnerType === 'cypress') {
    return { code_language: 'TypeScript', framework_preferences: ['cypress'] };
  }

  // Détection par domaine
  if (domain === 'WEB' || domain === 'MOBILE') {
    return { code_language: 'TypeScript', framework_preferences: ['playwright', 'cypress'] };
  }
  if (domain === 'API' || domain === 'REST') {
    return { code_language: 'TypeScript', framework_preferences: ['playwright'] };
  }
  if (domain.startsWith('TELECOM') || domain === 'IMS' || domain === 'RAN') {
    return { code_language: 'Robot', framework_preferences: ['robotframework'] };
  }

  // Défaut
  return { code_language: 'TypeScript', framework_preferences: ['playwright'] };
}

// ─── Style rules par test_type ────────────────────────────────────────────

const STYLE_RULES_BY_TEST_TYPE: Record<string, string[]> = {
  VABF: [
    'fail-fast on first assertion failure',
    'no hardcoded selectors outside selectors.ts',
    'use dataset keys for all dynamic values',
    'one test function per scenario step',
    'clear assertion messages with step context',
  ],
  VSR: [
    'resilience-first: test recovery after failure injection',
    'use dataset keys for all dynamic values',
    'measure and assert response times',
    'capture traces on every step',
    'retry logic with configurable backoff',
  ],
  VABE: [
    'performance-oriented: measure latency and throughput',
    'use dataset keys for all dynamic values',
    'configurable load parameters from dataset',
    'collect metrics at each checkpoint',
    'fail on SLA breach',
  ],
};

const ARTIFACT_POLICY_BY_TEST_TYPE: Record<string, string[]> = {
  VABF: ['trace:on', 'screenshot:on-failure', 'video:off'],
  VSR:  ['trace:on', 'screenshot:on', 'video:on-failure', 'pcap:on-failure'],
  VABE: ['trace:on', 'screenshot:off', 'metrics:on', 'har:on'],
};

// ─── Main function ────────────────────────────────────────────────────────

export interface BuildContextInput {
  project: Project;
  profile: TestProfile;
  scenario: TestScenario;
  bundle: DatasetBundle;
  bundleDatasets: DatasetInstance[];
  secrets: DatasetSecretKey[];
}

export function buildAiScriptContext(input: BuildContextInput): AiScriptContext {
  const { project, profile, scenario, bundle, bundleDatasets, secrets } = input;

  const { code_language, framework_preferences } = inferFrameworkPreferences(profile);
  const mergedJson = mergeDatasetValues(bundleDatasets);
  const maskedKeys = extractMaskedKeys(secrets);

  // Extraire expected_results et required_inputs depuis les steps
  const expectedResults = scenario.steps.map(s => s.expected_result).filter(Boolean);
  const requiredInputs: string[] = [];
  for (const step of scenario.steps) {
    if (step.parameters) {
      for (const key of Object.keys(step.parameters)) {
        if (!requiredInputs.includes(key)) requiredInputs.push(key);
      }
    }
  }

  return {
    project: {
      id: project.id,
      name: project.name,
    },
    profile: {
      id: profile.id,
      domain: profile.domain || (profile as any).protocol || 'WEB',
      test_type: profile.test_type,
      profile_type: (profile as any).profile_type || 'UI_E2E',
      runner_type: ((profile.config || profile.parameters) as any)?.runner_type || 'playwright',
      config: profile.config || profile.parameters || {},
    },
    scenario: {
      id: scenario.id,
      title: scenario.name,
      scenario_code: scenario.scenario_code,
      steps: scenario.steps.map(s => ({
        id: s.id,
        order: s.order,
        action: s.action,
        description: s.description,
        expected_result: s.expected_result,
        parameters: s.parameters,
      })),
      expected_results: expectedResults,
      required_inputs: requiredInputs,
      required_dataset_types: scenario.required_dataset_types || [],
      tags: [],
    },
    dataset: {
      env: bundle.env,
      bundle: {
        id: bundle.bundle_id,
        name: bundle.name,
        version: bundle.version,
      },
      resolved: {
        merged_json: mergedJson,
      },
      secrets_policy: {
        masked_keys: maskedKeys,
      },
    },
    generation_constraints: {
      code_language,
      framework_preferences,
      style_rules: STYLE_RULES_BY_TEST_TYPE[profile.test_type] || STYLE_RULES_BY_TEST_TYPE.VABF,
      artifact_policy: ARTIFACT_POLICY_BY_TEST_TYPE[profile.test_type] || ARTIFACT_POLICY_BY_TEST_TYPE.VABF,
    },
  };
}
