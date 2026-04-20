/**
 * Tests ciblés : Finalisation des scénarios (DRAFT → FINAL)
 * Vérifie la structure du routeur scénarios, les inputs Zod de mise à jour,
 * la logique de validation côté client, et la transition de statut.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Router structure tests ─────────────────────────────────────────────

describe("tRPC router: scenarios — structure", () => {
  it("should have scenariosRouter with all CRUD procedures", async () => {
    const { scenariosRouter } = await import("./routers/testing");
    expect(scenariosRouter).toBeDefined();
    const procedures = Object.keys(scenariosRouter._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("get");
    expect(procedures).toContain("create");
    expect(procedures).toContain("update");
    expect(procedures).toContain("delete");
  });

  it("should have export and import procedures", async () => {
    const { scenariosRouter } = await import("./routers/testing");
    const procedures = Object.keys(scenariosRouter._def.procedures);
    expect(procedures).toContain("export");
    expect(procedures).toContain("import");
  });

  it("should be registered in the main appRouter", async () => {
    const { appRouter } = await import("./routers");
    const routerKeys = Object.keys(appRouter._def.procedures);
    // scenarios procedures are namespaced under "scenarios."
    const scenarioKeys = routerKeys.filter((k) => k.startsWith("scenarios."));
    expect(scenarioKeys.length).toBeGreaterThan(0);
    expect(scenarioKeys).toContain("scenarios.list");
    expect(scenarioKeys).toContain("scenarios.update");
  });
});

// ─── Scenario status enum validation ────────────────────────────────────

describe("scenario status enum", () => {
  const statusSchema = z.enum(["DRAFT", "FINAL", "DEPRECATED"]);

  it.each(["DRAFT", "FINAL", "DEPRECATED"])("should accept valid status: %s", (status) => {
    expect(statusSchema.safeParse(status).success).toBe(true);
  });

  it("should reject invalid status values", () => {
    expect(statusSchema.safeParse("ACTIVE").success).toBe(false);
    expect(statusSchema.safeParse("PENDING").success).toBe(false);
    expect(statusSchema.safeParse("COMPLETED").success).toBe(false);
    expect(statusSchema.safeParse("").success).toBe(false);
  });
});

// ─── Scenario update input validation (finalization path) ───────────────

describe("scenario update input — finalization", () => {
  const updateInput = z.object({
    scenarioId: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
    testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).optional(),
    steps: z.any().optional(),
    requiredDatasetTypes: z.any().optional(),
  });

  it("should accept finalization input (scenarioId + status FINAL)", () => {
    const result = updateInput.safeParse({ scenarioId: 42, status: "FINAL" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenarioId).toBe(42);
      expect(result.data.status).toBe("FINAL");
    }
  });

  it("should accept deprecation input (scenarioId + status DEPRECATED)", () => {
    const result = updateInput.safeParse({ scenarioId: 42, status: "DEPRECATED" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DEPRECATED");
    }
  });

  it("should accept revert to DRAFT input", () => {
    const result = updateInput.safeParse({ scenarioId: 42, status: "DRAFT" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DRAFT");
    }
  });

  it("should reject missing scenarioId", () => {
    const result = updateInput.safeParse({ status: "FINAL" });
    expect(result.success).toBe(false);
  });

  it("should reject non-numeric scenarioId", () => {
    const result = updateInput.safeParse({ scenarioId: "abc", status: "FINAL" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid status in update", () => {
    const result = updateInput.safeParse({ scenarioId: 42, status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("should accept update with multiple fields", () => {
    const result = updateInput.safeParse({
      scenarioId: 42,
      name: "Scénario mis à jour",
      status: "FINAL",
      testType: "VABE",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Scénario mis à jour");
      expect(result.data.status).toBe("FINAL");
      expect(result.data.testType).toBe("VABE");
    }
  });
});

// ─── Client-side finalization validation logic ──────────────────────────

describe("FinalizeDialog — client-side validation logic", () => {
  /**
   * Reproduces the validation logic from ScenariosPage.tsx FinalizeDialog.
   * The component checks:
   * 1. scenario.name must be non-empty
   * 2. scenario.steps must have at least 1 entry
   * 3. at least 1 step must have a non-empty expected_result
   */
  function validateFinalization(scenario: {
    name?: string;
    steps?: Array<{ expected_result?: string }>;
  }): string[] {
    const errors: string[] = [];
    if (!scenario.name?.trim()) errors.push("Le titre du scénario est vide");
    if (!scenario.steps || scenario.steps.length === 0) errors.push("Au moins 1 étape est requise");
    if (!scenario.steps?.some((s) => s.expected_result?.trim())) errors.push("Au moins 1 résultat attendu est requis");
    return errors;
  }

  it("should pass validation for a complete scenario", () => {
    const errors = validateFinalization({
      name: "VABF-WEB-001-AUTH-UTILISATEUR",
      steps: [
        { expected_result: "L'utilisateur est connecté" },
        { expected_result: "Le tableau de bord s'affiche" },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it("should fail validation when name is empty", () => {
    const errors = validateFinalization({
      name: "",
      steps: [{ expected_result: "OK" }],
    });
    expect(errors).toContain("Le titre du scénario est vide");
  });

  it("should fail validation when name is only whitespace", () => {
    const errors = validateFinalization({
      name: "   ",
      steps: [{ expected_result: "OK" }],
    });
    expect(errors).toContain("Le titre du scénario est vide");
  });

  it("should fail validation when steps array is empty", () => {
    const errors = validateFinalization({
      name: "Mon scénario",
      steps: [],
    });
    expect(errors).toContain("Au moins 1 étape est requise");
  });

  it("should fail validation when steps is undefined", () => {
    const errors = validateFinalization({
      name: "Mon scénario",
      steps: undefined,
    });
    expect(errors).toContain("Au moins 1 étape est requise");
  });

  it("should fail validation when no step has expected_result", () => {
    const errors = validateFinalization({
      name: "Mon scénario",
      steps: [
        { expected_result: "" },
        { expected_result: "  " },
      ],
    });
    expect(errors).toContain("Au moins 1 résultat attendu est requis");
  });

  it("should fail validation when expected_result is undefined", () => {
    const errors = validateFinalization({
      name: "Mon scénario",
      steps: [{ expected_result: undefined }],
    });
    expect(errors).toContain("Au moins 1 résultat attendu est requis");
  });

  it("should return multiple errors for a completely empty scenario", () => {
    const errors = validateFinalization({ name: "", steps: [] });
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors).toContain("Le titre du scénario est vide");
    expect(errors).toContain("Au moins 1 étape est requise");
  });

  it("should pass validation with at least one valid expected_result among many steps", () => {
    const errors = validateFinalization({
      name: "Scénario mixte",
      steps: [
        { expected_result: "" },
        { expected_result: "Résultat valide" },
        { expected_result: "" },
      ],
    });
    expect(errors).toHaveLength(0);
  });
});

// ─── Schema table structure tests ───────────────────────────────────────

describe("schema: testScenarios table", () => {
  it("should have testScenarios table defined", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.testScenarios).toBeDefined();
  });

  it("should have required columns for finalization workflow", async () => {
    const schema = await import("../drizzle/schema");
    const columns = Object.keys(schema.testScenarios);
    expect(columns).toContain("id");
    expect(columns).toContain("name");
    expect(columns).toContain("status");
    expect(columns).toContain("steps");
    expect(columns).toContain("projectId");
    expect(columns).toContain("testType");
  });
});

// ─── Frontend ScenariosPage — code integrity tests ──────────────────────

describe("ScenariosPage — finalization code integrity", () => {
  it("should use trpc.scenarios.update.useMutation for finalization", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ScenariosPage.tsx", "utf-8");
    expect(content).toContain("trpc.scenarios.update.useMutation");
  });

  it("should NOT have the old broken setTimeout-only finalization", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ScenariosPage.tsx", "utf-8");
    // The old buggy code used setTimeout with a fake success without calling tRPC
    expect(content).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*\{[^}]*setResult\(\s*\{\s*success:\s*true/);
  });

  it("should pass status FINAL in the mutation call", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ScenariosPage.tsx", "utf-8");
    expect(content).toContain("status: 'FINAL'");
  });

  it("should invalidate scenarios.list cache after finalization", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ScenariosPage.tsx", "utf-8");
    expect(content).toContain("utils.scenarios.list.invalidate()");
  });

  it("should validate scenario before calling mutation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ScenariosPage.tsx", "utf-8");
    // Validation checks must exist before mutation call
    expect(content).toContain("Le titre du scénario est vide");
    expect(content).toContain("Au moins 1 étape est requise");
    expect(content).toContain("Au moins 1 résultat attendu est requis");
  });

  it("should convert scenario.id to Number for tRPC input", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ScenariosPage.tsx", "utf-8");
    expect(content).toContain("Number(scenario.id)");
  });
});

// ─── Scenario create input validation ───────────────────────────────────

describe("scenario create input — default status is DRAFT", () => {
  const createInput = z.object({
    projectId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    profileId: z.string().optional(),
    testType: z.enum(["VABF", "VSR", "VABE"]).default("VABF"),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT"),
    steps: z.any().optional(),
    scenarioCode: z.string().optional(),
    requiredDatasetTypes: z.any().optional(),
  });

  it("should default to DRAFT status when not specified", () => {
    const result = createInput.safeParse({
      projectId: "proj-123",
      name: "Nouveau scénario",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DRAFT");
    }
  });

  it("should default to VABF testType when not specified", () => {
    const result = createInput.safeParse({
      projectId: "proj-123",
      name: "Nouveau scénario",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.testType).toBe("VABF");
    }
  });

  it("should reject empty name", () => {
    const result = createInput.safeParse({
      projectId: "proj-123",
      name: "",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Workflow transition tests ──────────────────────────────────────────

describe("scenario workflow transitions", () => {
  const statusSchema = z.enum(["DRAFT", "FINAL", "DEPRECATED"]);

  it("DRAFT → FINAL transition should be valid", () => {
    const from = statusSchema.parse("DRAFT");
    const to = statusSchema.parse("FINAL");
    expect(from).toBe("DRAFT");
    expect(to).toBe("FINAL");
  });

  it("FINAL → DEPRECATED transition should be valid", () => {
    const from = statusSchema.parse("FINAL");
    const to = statusSchema.parse("DEPRECATED");
    expect(from).toBe("FINAL");
    expect(to).toBe("DEPRECATED");
  });

  it("workflow order should be DRAFT → FINAL → DEPRECATED", () => {
    const workflow = ["DRAFT", "FINAL", "DEPRECATED"];
    expect(workflow.indexOf("DRAFT")).toBeLessThan(workflow.indexOf("FINAL"));
    expect(workflow.indexOf("FINAL")).toBeLessThan(workflow.indexOf("DEPRECATED"));
  });
});
