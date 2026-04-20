/**
 * checkPrerequisites — Vérifie que tous les prérequis sont remplis avant
 * de lancer la génération de script IA.
 *
 * Retourne une liste de diagnostics classés par sévérité (BLOCKING / WARNING / OK).
 */
import type {
  Project, TestProfile, TestScenario, DatasetBundle,
  DatasetInstance, DatasetSecretKey,
} from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'OK' | 'WARNING' | 'BLOCKING';

export interface DiagnosticItem {
  /** Identifiant unique du check (ex: 'project.id') */
  key: string;
  /** Catégorie du diagnostic */
  category: 'project' | 'profile' | 'scenario' | 'bundle' | 'dataset' | 'secret';
  /** Libellé humain */
  label: string;
  /** Sévérité : OK = prêt, WARNING = dégradé, BLOCKING = impossible */
  severity: DiagnosticSeverity;
  /** Message explicatif */
  message: string;
}

export interface PrerequisiteReport {
  /** Tous les diagnostics */
  items: DiagnosticItem[];
  /** Résumé global */
  canProceed: boolean;
  /** Nombre par sévérité */
  counts: { ok: number; warning: number; blocking: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function ok(key: string, category: DiagnosticItem['category'], label: string, message: string): DiagnosticItem {
  return { key, category, label, severity: 'OK', message };
}

function warn(key: string, category: DiagnosticItem['category'], label: string, message: string): DiagnosticItem {
  return { key, category, label, severity: 'WARNING', message };
}

function block(key: string, category: DiagnosticItem['category'], label: string, message: string): DiagnosticItem {
  return { key, category, label, severity: 'BLOCKING', message };
}

/**
 * Drizzle retourne les colonnes en camelCase (valuesJson, datasetTypeId)
 * mais le type frontend utilise snake_case (values_json, dataset_type_id).
 * Ces helpers supportent les deux formats.
 */
function getValuesJson(ds: any): Record<string, unknown> {
  return ds.valuesJson || ds.values_json || {};
}

function getDatasetTypeId(ds: any): string {
  return ds.datasetTypeId || ds.dataset_type_id || '';
}

// ─── Main function ───────────────────────────────────────────────────────

export interface CheckPrerequisitesInput {
  project: Project | null;
  profile: TestProfile | null;
  scenario: TestScenario | null;
  bundle: DatasetBundle | (Record<string, unknown>) | null;
  bundleDatasets: DatasetInstance[];
  secrets: DatasetSecretKey[];
}

export function checkPrerequisites(input: CheckPrerequisitesInput): PrerequisiteReport {
  const { project, profile, scenario, bundle, bundleDatasets, secrets } = input;
  const items: DiagnosticItem[] = [];

  // ── 1. Projet ──────────────────────────────────────────────────────────
  if (!project) {
    items.push(block('project', 'project', 'Projet', 'Aucun projet sélectionné. Sélectionnez un projet dans la barre supérieure.'));
  } else {
    const pid = String((project as any).uid || project.id || '');
    if (!pid) {
      items.push(block('project.id', 'project', 'ID Projet', 'Le projet sélectionné n\'a pas d\'identifiant valide.'));
    } else {
      items.push(ok('project', 'project', 'Projet', `${project.name} (${pid.slice(0, 8)}…)`));
    }
  }

  // ── 2. Profil ──────────────────────────────────────────────────────────
  if (!profile) {
    items.push(block('profile', 'profile', 'Profil de test', 'Aucun profil de test associé au scénario.'));
  } else {
    const profileId = String(profile.id || '');
    if (!profileId) {
      items.push(block('profile.id', 'profile', 'ID Profil', 'Le profil n\'a pas d\'identifiant valide.'));
    } else {
      items.push(ok('profile', 'profile', 'Profil', `${profile.name} (${profile.test_type || 'N/A'})`));
    }

    // Domaine
    const domain = profile.domain || (profile as any).protocol;
    if (!domain) {
      items.push(warn('profile.domain', 'profile', 'Domaine', 'Aucun domaine défini sur le profil. Le domaine par défaut "WEB" sera utilisé.'));
    }

    // Config / runner_type
    const config = profile.config || profile.parameters || {};
    const runnerType = (config as any)?.runner_type || 'playwright';
    items.push(ok('profile.runner', 'profile', 'Runner', `Runner configuré : ${runnerType}`));
  }

  // ── 3. Scénario ────────────────────────────────────────────────────────
  if (!scenario) {
    items.push(block('scenario', 'scenario', 'Scénario', 'Aucun scénario fourni.'));
  } else {
    const scenarioId = String(scenario.id || '');
    if (!scenarioId) {
      items.push(block('scenario.id', 'scenario', 'ID Scénario', 'Le scénario n\'a pas d\'identifiant valide.'));
    } else {
      items.push(ok('scenario', 'scenario', 'Scénario', `${scenario.name} (${scenario.scenario_code || 'sans code'})`));
    }

    // Steps
    const steps = scenario.steps || [];
    if (steps.length === 0) {
      items.push(block('scenario.steps', 'scenario', 'Étapes', 'Le scénario n\'a aucune étape. Ajoutez au moins une étape avant de générer un script.'));
    } else {
      // Vérifier que chaque step a au moins une action
      const emptySteps = steps.filter(s => !s.action);
      if (emptySteps.length > 0) {
        items.push(warn('scenario.steps.action', 'scenario', 'Actions des étapes', `${emptySteps.length} étape(s) sans action définie. Le LLM pourrait produire un résultat incomplet.`));
      } else {
        items.push(ok('scenario.steps', 'scenario', 'Étapes', `${steps.length} étape(s) définies`));
      }

      // Vérifier expected_result
      const noExpected = steps.filter(s => !s.expected_result);
      if (noExpected.length > 0 && noExpected.length === steps.length) {
        items.push(warn('scenario.steps.expected', 'scenario', 'Résultats attendus', 'Aucune étape n\'a de résultat attendu. Les assertions générées seront approximatives.'));
      }
    }

    // required_dataset_types
    const requiredTypes = scenario.required_dataset_types || [];
    if (requiredTypes.length > 0) {
      items.push(ok('scenario.dataset_types', 'scenario', 'Types de dataset requis', `${requiredTypes.length} type(s) requis : ${requiredTypes.join(', ')}`));
    }
  }

  // ── 4. Bundle ──────────────────────────────────────────────────────────
  if (!bundle) {
    items.push(block('bundle', 'bundle', 'Bundle', 'Aucun bundle sélectionné. Sélectionnez un bundle actif pour l\'environnement choisi.'));
  } else {
    const bundleId = String((bundle as any).uid || (bundle as any).bundle_id || (bundle as any).id || '');
    if (!bundleId) {
      items.push(block('bundle.id', 'bundle', 'ID Bundle', 'Le bundle n\'a pas d\'identifiant valide.'));
    } else {
      items.push(ok('bundle', 'bundle', 'Bundle', `${(bundle as any).name} v${(bundle as any).version || 1} (${(bundle as any).env || 'N/A'})`));
    }

    // Vérifier le statut
    const status = (bundle as any).status;
    if (status && status !== 'ACTIVE') {
      items.push(warn('bundle.status', 'bundle', 'Statut bundle', `Le bundle est en statut "${status}". Seuls les bundles ACTIVE sont recommandés.`));
    }
  }

  // ── 5. Datasets ────────────────────────────────────────────────────────
  if (bundleDatasets.length === 0) {
    items.push(block('dataset.empty', 'dataset', 'Datasets', 'Le bundle ne contient aucun dataset. Ajoutez au moins un dataset au bundle.'));
  } else {
    // Vérifier que les datasets ont des valeurs
    // Note: Drizzle retourne camelCase (valuesJson), le type frontend utilise snake_case (values_json)
    const emptyDatasets = bundleDatasets.filter(ds => {
      const vals = getValuesJson(ds);
      return Object.keys(vals).length === 0;
    });

    if (emptyDatasets.length === bundleDatasets.length) {
      items.push(block('dataset.values', 'dataset', 'Valeurs des datasets', 'Tous les datasets sont vides (aucune valeur). Le LLM ne pourra pas générer de données de test.'));
    } else if (emptyDatasets.length > 0) {
      items.push(block('dataset.values', 'dataset', 'Valeurs des datasets', `${emptyDatasets.length}/${bundleDatasets.length} dataset(s) sans valeurs. Tous les datasets doivent avoir des valeurs pour la génération IA.`));
    } else {
      const totalKeys = bundleDatasets.reduce((sum, ds) => sum + Object.keys(getValuesJson(ds)).length, 0);
      items.push(ok('dataset', 'dataset', 'Datasets', `${bundleDatasets.length} dataset(s) avec ${totalKeys} clé(s) au total`));
    }

    // Vérifier la couverture des required_dataset_types
    if (scenario) {
      const requiredTypes = scenario.required_dataset_types || [];
      if (requiredTypes.length > 0) {
        const coveredTypes = new Set(bundleDatasets.map(ds => getDatasetTypeId(ds)));
        const missingTypes = requiredTypes.filter(t => !coveredTypes.has(t));
        if (missingTypes.length > 0) {
          items.push(block('dataset.coverage', 'dataset', 'Couverture types', `Type(s) requis manquant(s) dans le bundle : ${missingTypes.join(', ')}. Ajoutez ces types de dataset au bundle.`));
        } else {
          items.push(ok('dataset.coverage', 'dataset', 'Couverture types', 'Tous les types de dataset requis sont couverts'));
        }
      }
    }
  }

  // ── 6. Secrets ─────────────────────────────────────────────────────────
  const secretKeys = secrets.filter(s => s.is_secret);
  if (secretKeys.length > 0) {
    items.push(ok('secret', 'secret', 'Secrets', `${secretKeys.length} clé(s) secrète(s) détectée(s) : ${secretKeys.map(s => s.key_path).join(', ')}. Elles seront masquées dans le script.`));
  } else if (secrets.length > 0) {
    items.push(ok('secret', 'secret', 'Secrets', `${secrets.length} clé(s) de dataset, aucune marquée comme secrète.`));
  }

  // ── Résumé ─────────────────────────────────────────────────────────────
  const counts = {
    ok: items.filter(i => i.severity === 'OK').length,
    warning: items.filter(i => i.severity === 'WARNING').length,
    blocking: items.filter(i => i.severity === 'BLOCKING').length,
  };

  return {
    items,
    canProceed: counts.blocking === 0,
    counts,
  };
}
