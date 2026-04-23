/**
 * datasetResolver.ts — Résolution des bindings de dataset
 *
 * Transforme les références de binding (ex: "users.email", "users.password")
 * en valeurs réelles en interrogeant les tables dataset_bundles, bundle_items
 * et dataset_instances.
 *
 * Flux :
 *   1. Récupérer le bundle lié à l'exécution (execution.datasetBundleId)
 *   2. Récupérer les items du bundle (bundle_items → dataset_instances)
 *   3. Pour chaque instance, extraire les valeurs (valuesJson)
 *   4. Construire un dictionnaire plat : "datasetType.field" → "valeur"
 *
 * Également résout les URLs du profil (web_urls.full.login, etc.)
 * depuis les paramètres du profil de test.
 */

import { getDb } from "./db";
import {
  datasetBundles,
  bundleItems,
  datasetInstances,
  testProfiles,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { resolveEntityCondition } from "./lib/resolveEntityId";

// ─── Types ───────────────────────────────────────────────────────────────

export interface ResolvedBindings {
  /** Dictionnaire plat des bindings résolus */
  bindings: Record<string, string>;
  /** URL de base extraite du profil */
  baseUrl: string;
  /** Erreurs de résolution (non bloquantes) */
  warnings: string[];
}

// ─── Main Resolver ──────────────────────────────────────────────────────

/**
 * Résout tous les bindings nécessaires pour une exécution.
 * @param profileId - UID ou ID numérique du profil de test
 * @param datasetBundleId - UID du bundle de dataset (optionnel)
 * @param projectId - ID du projet
 */
export async function resolveBindings(
  profileId?: string,
  datasetBundleId?: string,
  projectId?: string,
): Promise<ResolvedBindings> {
  const db = await getDb();
  if (!db) {
    return { bindings: {}, baseUrl: "", warnings: ["DB unavailable"] };
  }

  const bindings: Record<string, string> = {};
  const warnings: string[] = [];
  let baseUrl = "";

  // ─── 1. Résoudre le profil (URLs, paramètres de connexion) ────────

  if (profileId && profileId.trim()) {
    try {
      const profileCondition = resolveEntityCondition(testProfiles.uid, testProfiles.id, profileId);
      const [profile] = await db.select().from(testProfiles).where(profileCondition).limit(1);

      if (profile) {
        // Extraire l'URL de base depuis targetHost
        if (profile.targetHost) {
          const protocol = profile.protocol || "https";
          const port = profile.targetPort ? `:${profile.targetPort}` : "";
          baseUrl = `${protocol}://${profile.targetHost}${port}`;
        }

        // Extraire les paramètres du profil comme bindings
        if (profile.parameters && typeof profile.parameters === "object") {
          flattenObject(profile.parameters as Record<string, unknown>, "profile", bindings);
        }

        // Extraire la config du profil
        if (profile.config && typeof profile.config === "object") {
          flattenObject(profile.config as Record<string, unknown>, "config", bindings);
        }

        // Ajouter les URLs web communes
        if (baseUrl) {
          bindings["web_urls.base"] = baseUrl;
          // Extraire les URLs spécifiques depuis les paramètres
          const params = profile.parameters as Record<string, any> | null;
          if (params?.urls && typeof params.urls === "object") {
            flattenObject(params.urls, "web_urls", bindings);
          }
          // Si pas d'URLs spécifiques, générer les URLs courantes
          if (!bindings["web_urls.full.login"]) {
            bindings["web_urls.full.login"] = `${baseUrl}/login`;
          }
        }
      } else {
        warnings.push(`Profil "${profileId}" non trouvé`);
      }
    } catch (err: any) {
      warnings.push(`Erreur résolution profil: ${err.message}`);
    }
  }

  // ─── 2. Résoudre le dataset bundle ────────────────────────────────

  if (datasetBundleId && datasetBundleId.trim()) {
    try {
      const [bundle] = await db.select().from(datasetBundles)
        .where(eq(datasetBundles.uid, datasetBundleId)).limit(1);

      if (bundle) {
        // Récupérer les items du bundle
        const items = await db.select().from(bundleItems)
          .where(eq(bundleItems.bundleId, bundle.uid));

        // Pour chaque item, récupérer l'instance de dataset
        for (const item of items) {
          const [instance] = await db.select().from(datasetInstances)
            .where(eq(datasetInstances.uid, item.datasetId)).limit(1);

          if (instance && instance.valuesJson) {
            const values = typeof instance.valuesJson === "string"
              ? JSON.parse(instance.valuesJson)
              : instance.valuesJson;

            // Aplatir les valeurs avec le type de dataset comme préfixe
            // Ex: datasetTypeId = "users" → "users.email", "users.password"
            const prefix = instance.datasetTypeId || "data";
            flattenObject(values, prefix, bindings);
          }
        }
      } else {
        warnings.push(`Bundle "${datasetBundleId}" non trouvé`);
      }
    } catch (err: any) {
      warnings.push(`Erreur résolution dataset: ${err.message}`);
    }
  }

  return { bindings, baseUrl, warnings };
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Aplatit un objet imbriqué en un dictionnaire plat avec des clés dotées.
 * Ex: { full: { login: "/login" } } avec prefix "web_urls"
 *   → { "web_urls.full.login": "/login" }
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix: string,
  result: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = `${prefix}.${key}`;
    if (value === null || value === undefined) continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      flattenObject(value as Record<string, unknown>, fullKey, result);
    } else {
      result[fullKey] = String(value);
    }
  }
}

// ─── Export pour tests ──────────────────────────────────────────────────

export { flattenObject };
