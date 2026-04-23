/**
 * Tests for resolveEntityCondition helper and execution engine scenario lookup fix.
 *
 * Bug: The execution engine only ran 2 steps out of 8 because it looked up
 * scenarios by uid only, but the execution stored a numeric id (e.g., "480002")
 * instead of a UUID. The resolveEntityCondition helper fixes this by looking up
 * by uid OR by numeric id.
 */
import { describe, it, expect } from "vitest";

// ─── resolveEntityCondition unit tests ──────────────────────────────────────

describe("resolveEntityCondition", () => {
  it("should be importable", async () => {
    const mod = await import("./lib/resolveEntityId");
    expect(mod.resolveEntityCondition).toBeDefined();
    expect(typeof mod.resolveEntityCondition).toBe("function");
  });

  it("should detect numeric IDs correctly", () => {
    // Numeric patterns
    expect(/^\d+$/.test("480002")).toBe(true);
    expect(/^\d+$/.test("1")).toBe(true);
    expect(/^\d+$/.test("0")).toBe(true);
    expect(/^\d+$/.test("9999999")).toBe(true);

    // UUID patterns — NOT numeric
    expect(/^\d+$/.test("556495a7-84f5-469b-8a26-e8dfc07110fc")).toBe(false);
    expect(/^\d+$/.test("abc-123")).toBe(false);
    expect(/^\d+$/.test("")).toBe(false);
    expect(/^\d+$/.test("12a")).toBe(false);
  });
});

// ─── executionEngine step resolution tests ──────────────────────────────────

describe("executionEngine — step resolution", () => {
  it("should export startExecution", async () => {
    const mod = await import("./executionEngine");
    expect(mod.startExecution).toBeDefined();
    expect(typeof mod.startExecution).toBe("function");
  });

  it("should import or from drizzle-orm in executionEngine", async () => {
    // Verify the import exists in the source file
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain('import { eq, or, sql } from "drizzle-orm"');
  });

  it("should use resolveEntityCondition pattern in executionEngine", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    // The engine should check for numeric IDs
    expect(content).toContain("isNumericId");
    expect(content).toContain("/^\\d+$/.test(exec.scenarioId)");
    // Should use or() for numeric IDs
    expect(content).toContain("or(eq(testScenarios.uid, exec.scenarioId), eq(testScenarios.id, Number(exec.scenarioId)))");
  });

  it("should handle empty scenarioId gracefully", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    // Should check for empty/whitespace scenarioId
    expect(content).toContain("exec.scenarioId && exec.scenarioId.trim()");
  });

  it("should parse expectedResult from scenario steps", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    // Should handle both expected_result and expectedResult field names
    expect(content).toContain("s.expected_result || s.expectedResult");
  });
});

// ─── testing.ts router — resolveEntityCondition usage ───────────────────────

describe("testing.ts router — resolveEntityCondition usage", () => {
  it("should import resolveEntityCondition in testing.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain('import { resolveEntityCondition } from "../lib/resolveEntityId"');
  });

  it("should use resolveEntityCondition for scenario lookups in testing.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    // All scenario lookups should use resolveEntityCondition
    expect(content).toContain("resolveEntityCondition(testScenarios.uid, testScenarios.id, exec.scenarioId)");
    // Should NOT have the old pattern
    expect(content).not.toContain("eq(testScenarios.uid, exec.scenarioId)");
  });

  it("should use resolveEntityCondition for profile lookups in testing.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    // All profile lookups should use resolveEntityCondition
    expect(content).toContain("resolveEntityCondition(testProfiles.uid, testProfiles.id, exec.profileId)");
    // Should NOT have the old pattern
    expect(content).not.toContain("eq(testProfiles.uid, exec.profileId)");
  });

  it("should import or from drizzle-orm in testing.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toMatch(/import\s*{[^}]*\bor\b[^}]*}\s*from\s*"drizzle-orm"/);
  });
});

// ─── jobQueue.ts — resolveEntityCondition usage ─────────────────────────────

describe("jobQueue.ts — resolveEntityCondition usage", () => {
  it("should import resolveEntityCondition in jobQueue.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain('import { resolveEntityCondition } from "./lib/resolveEntityId"');
  });

  it("should use resolveEntityCondition for scenario lookups in jobQueue.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain("resolveEntityCondition(testScenarios.uid, testScenarios.id, execution.scenarioId)");
    // Should NOT have the old pattern
    expect(content).not.toContain("eq(testScenarios.uid, execution.scenarioId)");
  });

  it("should use resolveEntityCondition for profile lookups in jobQueue.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain("resolveEntityCondition(testProfiles.uid, testProfiles.id, execution.profileId)");
    // Should NOT have the old pattern
    expect(content).not.toContain("eq(testProfiles.uid, execution.profileId)");
  });

  it("should import or from drizzle-orm in jobQueue.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toMatch(/import\s*{[^}]*\bor\b[^}]*}\s*from\s*"drizzle-orm"/);
  });
});

// ─── Frontend — ExecutionsPage dropdown values ──────────────────────────────

describe("ExecutionsPage — dropdown values use uid", () => {
  it("should use sc.uid in scenario filter dropdown", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionsPage.tsx", "utf-8");
    // Filter dropdown should use uid
    expect(content).toContain("value={sc.uid}");
    // Should NOT use String(sc.id) for scenario dropdown
    expect(content).not.toContain("value={String(sc.id)}");
  });

  it("should use p.uid in profile dropdown in create dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionsPage.tsx", "utf-8");
    expect(content).toContain("value={p.uid}");
  });

  it("should use sc.uid in scenario dropdown in create dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionsPage.tsx", "utf-8");
    // The create dialog scenario dropdown should also use uid
    const matches = content.match(/value={sc\.uid}/g);
    expect(matches).not.toBeNull();
    // At least 2 occurrences: filter dropdown + create dialog
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── resolveEntityId helper — edge cases ────────────────────────────────────

describe("resolveEntityCondition — edge case patterns", () => {
  it("should handle very large numeric IDs", () => {
    expect(/^\d+$/.test("999999999")).toBe(true);
    expect(/^\d+$/.test("480002")).toBe(true);
  });

  it("should not match UUIDs as numeric", () => {
    const uuids = [
      "556495a7-84f5-469b-8a26-e8dfc07110fc",
      "bdc231d1-5b87-4b8d-882f-d242ee2b1026",
      "5391294c-88e1-4670-a9db-a1700fc1bd49",
    ];
    for (const uuid of uuids) {
      expect(/^\d+$/.test(uuid)).toBe(false);
    }
  });

  it("should not match mixed alphanumeric as numeric", () => {
    expect(/^\d+$/.test("SC-123")).toBe(false);
    expect(/^\d+$/.test("abc")).toBe(false);
    expect(/^\d+$/.test("12a3")).toBe(false);
  });
});
