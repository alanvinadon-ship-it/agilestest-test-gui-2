import { describe, it, expect } from "vitest";

/**
 * Tests for ValidateBundleModal handleValidate logic
 * Validates the bundle validation workflow: requiredDatasetTypes parsing,
 * coverage checks, conflict detection, and error handling.
 */

// ─── Reproduce handleValidate logic for unit testing ─────────────────────

interface ValidationResult {
  ok: boolean;
  missing_types: string[];
  conflicts: { dataset_type_id: string; dataset_ids: string[] }[];
  schema_errors_by_type: Record<string, string[]>;
  warnings: string[];
}

interface BundleItem { datasetId: string }
interface DatasetInstance { dataset_id: string; dataset_type_id: string; env: string }
interface Scenario { id: number; name: string; requiredDatasetTypes: any }

function validateBundle(
  scenario: Scenario | undefined,
  items: BundleItem[],
  allInstances: DatasetInstance[],
): ValidationResult {
  if (!scenario) {
    return {
      ok: false,
      missing_types: [],
      conflicts: [],
      schema_errors_by_type: {},
      warnings: ['Scénario introuvable. Veuillez en sélectionner un autre.'],
    };
  }

  // Parse requiredDatasetTypes — same logic as the fixed handleValidate
  let requiredTypes: string[] = [];
  const raw = scenario.requiredDatasetTypes;
  if (Array.isArray(raw)) {
    requiredTypes = raw;
  } else if (typeof raw === 'string') {
    try { requiredTypes = JSON.parse(raw); } catch { requiredTypes = []; }
  }

  const bundleDatasetIds = new Set(items.map(bi => bi.datasetId));
  const bundleDatasets = allInstances.filter(d => bundleDatasetIds.has(d.dataset_id));
  const coveredTypes = new Set(bundleDatasets.map(d => d.dataset_type_id));
  const missingTypes = requiredTypes.filter(t => !coveredTypes.has(t));

  const typeCounts = new Map<string, string[]>();
  bundleDatasets.forEach(d => {
    const arr = typeCounts.get(d.dataset_type_id) || [];
    arr.push(d.dataset_id);
    typeCounts.set(d.dataset_type_id, arr);
  });
  const conflicts = Array.from(typeCounts.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([typeId, ids]) => ({ dataset_type_id: typeId, dataset_ids: ids }));

  const warnings: string[] = [];
  if (requiredTypes.length === 0) {
    warnings.push('Ce scénario ne déclare aucun type de dataset requis. La validation de couverture est ignorée.');
  }
  if (bundleDatasets.length === 0) {
    warnings.push('Ce bundle ne contient aucun dataset. Ajoutez des datasets avant de valider.');
  }

  const ok = missingTypes.length === 0 && conflicts.length === 0;
  return { ok, missing_types: missingTypes, conflicts, schema_errors_by_type: {}, warnings };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("ValidateBundleModal — handleValidate logic", () => {

  describe("requiredDatasetTypes parsing", () => {
    it("handles requiredDatasetTypes as an array (Drizzle JSON auto-parsed)", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: ["load_test_data", "user_credentials"] };
      const items: BundleItem[] = [{ datasetId: "ds-1" }, { datasetId: "ds-2" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "load_test_data", env: "PROD" },
        { dataset_id: "ds-2", dataset_type_id: "user_credentials", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.ok).toBe(true);
      expect(result.missing_types).toEqual([]);
    });

    it("handles requiredDatasetTypes as a JSON string", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: '["load_test_data"]' };
      const items: BundleItem[] = [{ datasetId: "ds-1" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "load_test_data", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.ok).toBe(true);
    });

    it("handles requiredDatasetTypes as null", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: null };
      const items: BundleItem[] = [{ datasetId: "ds-1" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "load_test_data", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.ok).toBe(true);
      expect(result.warnings).toContain('Ce scénario ne déclare aucun type de dataset requis. La validation de couverture est ignorée.');
    });

    it("handles requiredDatasetTypes as undefined", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: undefined };
      const result = validateBundle(scenario, [], []);
      expect(result.ok).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });

    it("handles requiredDatasetTypes as invalid JSON string", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: "not-json" };
      const result = validateBundle(scenario, [], []);
      expect(result.ok).toBe(true); // no required types = no missing
      expect(result.warnings).toContain('Ce scénario ne déclare aucun type de dataset requis. La validation de couverture est ignorée.');
    });
  });

  describe("scenario not found", () => {
    it("returns error when scenario is undefined", () => {
      const result = validateBundle(undefined, [], []);
      expect(result.ok).toBe(false);
      expect(result.warnings).toContain('Scénario introuvable. Veuillez en sélectionner un autre.');
    });
  });

  describe("missing types detection", () => {
    it("detects missing dataset types", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: ["load_test_data", "user_credentials", "api_config"] };
      const items: BundleItem[] = [{ datasetId: "ds-1" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "load_test_data", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.ok).toBe(false);
      expect(result.missing_types).toEqual(["user_credentials", "api_config"]);
    });

    it("passes when all required types are covered", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: ["type_a", "type_b"] };
      const items: BundleItem[] = [{ datasetId: "ds-1" }, { datasetId: "ds-2" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "type_a", env: "PROD" },
        { dataset_id: "ds-2", dataset_type_id: "type_b", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.ok).toBe(true);
      expect(result.missing_types).toEqual([]);
    });
  });

  describe("conflict detection", () => {
    it("detects duplicate dataset types in bundle", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: ["type_a"] };
      const items: BundleItem[] = [{ datasetId: "ds-1" }, { datasetId: "ds-2" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "type_a", env: "PROD" },
        { dataset_id: "ds-2", dataset_type_id: "type_a", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.ok).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].dataset_type_id).toBe("type_a");
      expect(result.conflicts[0].dataset_ids).toEqual(["ds-1", "ds-2"]);
    });

    it("no conflicts when each type has one dataset", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: ["type_a", "type_b"] };
      const items: BundleItem[] = [{ datasetId: "ds-1" }, { datasetId: "ds-2" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "type_a", env: "PROD" },
        { dataset_id: "ds-2", dataset_type_id: "type_b", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("warnings", () => {
    it("warns when bundle has no datasets", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: ["type_a"] };
      const result = validateBundle(scenario, [], []);
      expect(result.warnings).toContain('Ce bundle ne contient aucun dataset. Ajoutez des datasets avant de valider.');
    });

    it("warns when scenario has no required types", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: [] };
      const result = validateBundle(scenario, [{ datasetId: "ds-1" }], [
        { dataset_id: "ds-1", dataset_type_id: "type_a", env: "PROD" },
      ]);
      expect(result.warnings).toContain('Ce scénario ne déclare aucun type de dataset requis. La validation de couverture est ignorée.');
    });

    it("no warnings when everything is properly configured", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: ["type_a"] };
      const items: BundleItem[] = [{ datasetId: "ds-1" }];
      const instances: DatasetInstance[] = [
        { dataset_id: "ds-1", dataset_type_id: "type_a", env: "PROD" },
      ];
      const result = validateBundle(scenario, items, instances);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty required types and empty bundle gracefully", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: null };
      const result = validateBundle(scenario, [], []);
      expect(result.ok).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    });

    it("items not found in allInstances are silently ignored", () => {
      const scenario: Scenario = { id: 1, name: "Test", requiredDatasetTypes: [] };
      const items: BundleItem[] = [{ datasetId: "ds-nonexistent" }];
      const instances: DatasetInstance[] = [];
      const result = validateBundle(scenario, items, instances);
      expect(result.ok).toBe(true);
    });
  });
});
