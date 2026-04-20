import { describe, it, expect } from "vitest";

/**
 * Tests for bundles.update backend validation:
 * - Empêcher l'activation d'un bundle vide (sans datasets)
 * - Vérifier que la procédure update accepte les bons inputs
 * - Vérifier le comportement pour DRAFT et DEPRECATED (pas de validation)
 */

// ─── Simulate the validation logic from bundles.update ─────────────────

interface BundleItem { id: number; bundleId: string; datasetId: string }

function validateBundleActivation(
  status: "DRAFT" | "ACTIVE" | "DEPRECATED" | undefined,
  bundleId: string,
  items: BundleItem[],
  bundleExists: boolean,
): { success: boolean; error?: string } {
  // Only validate when activating
  if (status === "ACTIVE") {
    if (items.length === 0) {
      return {
        success: false,
        error: "Impossible d'activer un bundle vide. Ajoutez au moins un dataset avant d'activer le bundle.",
      };
    }
    if (!bundleExists) {
      return { success: false, error: "Bundle introuvable." };
    }
  }
  return { success: true };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("bundles.update — activation validation", () => {

  describe("activation with empty bundle", () => {
    it("rejects activation when bundle has no items", () => {
      const result = validateBundleActivation("ACTIVE", "bundle-1", [], true);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Impossible d'activer un bundle vide");
    });

    it("rejects activation when bundle does not exist", () => {
      const items: BundleItem[] = [{ id: 1, bundleId: "bundle-1", datasetId: "ds-1" }];
      const result = validateBundleActivation("ACTIVE", "bundle-nonexistent", items, false);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Bundle introuvable.");
    });

    it("allows activation when bundle has items", () => {
      const items: BundleItem[] = [
        { id: 1, bundleId: "bundle-1", datasetId: "ds-1" },
        { id: 2, bundleId: "bundle-1", datasetId: "ds-2" },
      ];
      const result = validateBundleActivation("ACTIVE", "bundle-1", items, true);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("allows activation with a single item", () => {
      const items: BundleItem[] = [{ id: 1, bundleId: "bundle-1", datasetId: "ds-1" }];
      const result = validateBundleActivation("ACTIVE", "bundle-1", items, true);
      expect(result.success).toBe(true);
    });
  });

  describe("non-ACTIVE status changes skip validation", () => {
    it("allows DRAFT status change with empty bundle", () => {
      const result = validateBundleActivation("DRAFT", "bundle-1", [], true);
      expect(result.success).toBe(true);
    });

    it("allows DEPRECATED status change with empty bundle", () => {
      const result = validateBundleActivation("DEPRECATED", "bundle-1", [], true);
      expect(result.success).toBe(true);
    });

    it("allows undefined status (name-only update) with empty bundle", () => {
      const result = validateBundleActivation(undefined, "bundle-1", [], true);
      expect(result.success).toBe(true);
    });
  });

  describe("router structure validation", () => {
    it("should have bundlesRouter with update procedure", async () => {
      const { bundlesRouter } = await import("./routers/bundles");
      expect(bundlesRouter).toBeDefined();
      expect(bundlesRouter._def.procedures).toHaveProperty("update");
    });

    it("should have bundlesRouter with list, get, create, update, clone, delete procedures", async () => {
      const { bundlesRouter } = await import("./routers/bundles");
      const procedures = Object.keys(bundlesRouter._def.procedures);
      expect(procedures).toContain("list");
      expect(procedures).toContain("get");
      expect(procedures).toContain("create");
      expect(procedures).toContain("update");
      expect(procedures).toContain("clone");
      expect(procedures).toContain("delete");
    });

    it("should have bundleItemsRouter with list, add, remove procedures", async () => {
      const { bundleItemsRouter } = await import("./routers/bundles");
      const procedures = Object.keys(bundleItemsRouter._def.procedures);
      expect(procedures).toContain("list");
      expect(procedures).toContain("add");
      expect(procedures).toContain("remove");
    });
  });

  describe("input schema validation", () => {
    it("bundleId is required for update", async () => {
      const { bundlesRouter } = await import("./routers/bundles");
      const updateProc = bundlesRouter._def.procedures.update as any;
      const schema = updateProc._def.inputs?.[0];
      expect(schema).toBeDefined();
      // Validate that bundleId is a required string
      const parsed = schema.safeParse({ bundleId: "test-id", status: "ACTIVE" });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid status values", async () => {
      const { bundlesRouter } = await import("./routers/bundles");
      const updateProc = bundlesRouter._def.procedures.update as any;
      const schema = updateProc._def.inputs?.[0];
      const parsed = schema.safeParse({ bundleId: "test-id", status: "INVALID" });
      expect(parsed.success).toBe(false);
    });

    it("accepts valid status values", async () => {
      const { bundlesRouter } = await import("./routers/bundles");
      const updateProc = bundlesRouter._def.procedures.update as any;
      const schema = updateProc._def.inputs?.[0];
      for (const status of ["DRAFT", "ACTIVE", "DEPRECATED"]) {
        const parsed = schema.safeParse({ bundleId: "test-id", status });
        expect(parsed.success).toBe(true);
      }
    });

    it("accepts update without status (name-only update)", async () => {
      const { bundlesRouter } = await import("./routers/bundles");
      const updateProc = bundlesRouter._def.procedures.update as any;
      const schema = updateProc._def.inputs?.[0];
      const parsed = schema.safeParse({ bundleId: "test-id", name: "New Name" });
      expect(parsed.success).toBe(true);
    });
  });
});
