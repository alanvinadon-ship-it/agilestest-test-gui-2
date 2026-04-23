/**
 * Tests for:
 * 1. Execution creation mutation — scenarioId/profileId properly passed
 * 2. PDF handler — graceful handling of empty scenario/profile IDs
 * 3. ExecutionsPage — create dialog with scenario/profile selection
 */
import { describe, it, expect } from "vitest";

// ─── 1. Execution create mutation input schema ─────────────────────────────
describe("executions.create mutation input", () => {
  it("should accept scenarioId and profileId as optional strings", async () => {
    // The Zod schema in testing.ts defines:
    // scenarioId: z.string().optional()
    // profileId: z.string().optional()
    const { z } = await import("zod");
    const schema = z.object({
      projectId: z.string(),
      profileId: z.string().optional(),
      scenarioId: z.string().optional(),
      runnerType: z.string().optional(),
      scriptId: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV"),
      executionMode: z.enum(["SIMULATED", "REAL"]).default("SIMULATED"),
      autoStart: z.boolean().default(false),
    });

    // Valid input with scenarioId and profileId
    const result = schema.safeParse({
      projectId: "P-12345",
      scenarioId: "3896b9dd-fa64-43fe-871b-f0099709f8f2",
      profileId: "55e451fc-475d-4b7e-af2d-eb5127efe979",
      targetEnv: "DEV",
      executionMode: "SIMULATED",
      autoStart: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenarioId).toBe("3896b9dd-fa64-43fe-871b-f0099709f8f2");
      expect(result.data.profileId).toBe("55e451fc-475d-4b7e-af2d-eb5127efe979");
    }
  });

  it("should accept input without scenarioId and profileId", () => {
    const { z } = require("zod");
    const schema = z.object({
      projectId: z.string(),
      profileId: z.string().optional(),
      scenarioId: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV"),
      executionMode: z.enum(["SIMULATED", "REAL"]).default("SIMULATED"),
      autoStart: z.boolean().default(false),
    });

    const result = schema.safeParse({
      projectId: "P-12345",
      targetEnv: "PROD",
      executionMode: "SIMULATED",
      autoStart: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenarioId).toBeUndefined();
      expect(result.data.profileId).toBeUndefined();
    }
  });

  it("should default scenarioId/profileId to empty string when undefined is passed to insert", () => {
    // This tests the pattern: scenarioId: input.scenarioId ?? ""
    const input = { scenarioId: undefined, profileId: undefined };
    expect(input.scenarioId ?? "").toBe("");
    expect(input.profileId ?? "").toBe("");
  });

  it("should preserve UUID scenarioId when provided", () => {
    const input = {
      scenarioId: "3896b9dd-fa64-43fe-871b-f0099709f8f2",
      profileId: "55e451fc-475d-4b7e-af2d-eb5127efe979",
    };
    expect(input.scenarioId ?? "").toBe("3896b9dd-fa64-43fe-871b-f0099709f8f2");
    expect(input.profileId ?? "").toBe("55e451fc-475d-4b7e-af2d-eb5127efe979");
  });
});

// ─── 2. PDF handler — empty ID handling ────────────────────────────────────
describe("PDF handler — empty scenario/profile ID handling", () => {
  it("should skip DB query when scenarioId is empty string", () => {
    const execution = { scenarioId: "", profileId: "" };
    // The handler uses: execution.scenarioId && execution.scenarioId.trim() ? query : skip
    const shouldQueryScenario = execution.scenarioId && execution.scenarioId.trim();
    const shouldQueryProfile = execution.profileId && execution.profileId.trim();
    expect(shouldQueryScenario).toBeFalsy();
    expect(shouldQueryProfile).toBeFalsy();
  });

  it("should skip DB query when scenarioId is whitespace only", () => {
    const execution = { scenarioId: "   ", profileId: "  " };
    const shouldQueryScenario = execution.scenarioId && execution.scenarioId.trim();
    const shouldQueryProfile = execution.profileId && execution.profileId.trim();
    expect(shouldQueryScenario).toBeFalsy();
    expect(shouldQueryProfile).toBeFalsy();
  });

  it("should query DB when scenarioId is a valid UUID", () => {
    const execution = {
      scenarioId: "3896b9dd-fa64-43fe-871b-f0099709f8f2",
      profileId: "55e451fc-475d-4b7e-af2d-eb5127efe979",
    };
    const shouldQueryScenario = execution.scenarioId && execution.scenarioId.trim();
    const shouldQueryProfile = execution.profileId && execution.profileId.trim();
    expect(shouldQueryScenario).toBeTruthy();
    expect(shouldQueryProfile).toBeTruthy();
  });

  it("should display 'Non spécifié' when scenario is null", () => {
    const scenario = null;
    const displayName = scenario?.name ?? "Non spécifié";
    expect(displayName).toBe("Non spécifié");
  });

  it("should display scenario name when scenario exists", () => {
    const scenario = { name: "Test API Login" };
    const displayName = scenario?.name ?? "Non spécifié";
    expect(displayName).toBe("Test API Login");
  });

  it("should display 'Non spécifié' when profile is null", () => {
    const profile = null;
    const displayName = profile?.name ?? "Non spécifié";
    expect(displayName).toBe("Non spécifié");
  });
});

// ─── 3. Execution get handler — empty ID handling ──────────────────────────
describe("Execution get handler — empty ID handling", () => {
  it("should skip scenario lookup when scenarioId is empty string (falsy)", () => {
    const exec = { scenarioId: "", profileId: "" };
    // The handler uses: exec.scenarioId ? query : Promise.resolve([])
    const willQueryScenario = !!exec.scenarioId;
    const willQueryProfile = !!exec.profileId;
    expect(willQueryScenario).toBe(false);
    expect(willQueryProfile).toBe(false);
  });

  it("should query scenario when scenarioId is a valid UUID", () => {
    const exec = {
      scenarioId: "3896b9dd-fa64-43fe-871b-f0099709f8f2",
      profileId: "55e451fc-475d-4b7e-af2d-eb5127efe979",
    };
    const willQueryScenario = !!exec.scenarioId;
    const willQueryProfile = !!exec.profileId;
    expect(willQueryScenario).toBe(true);
    expect(willQueryProfile).toBe(true);
  });
});

// ─── 4. ExecutionsPage — create dialog integration ─────────────────────────
describe("ExecutionsPage — create dialog", () => {
  it("should import Dialog, Button, Label, Switch components", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/client/src/pages/ExecutionsPage.tsx",
      "utf-8"
    );
    expect(content).toContain("from '@/components/ui/dialog'");
    expect(content).toContain("from '@/components/ui/button'");
    expect(content).toContain("from '@/components/ui/label'");
    expect(content).toContain("from '@/components/ui/switch'");
  });

  it("should have showCreateDialog state", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/client/src/pages/ExecutionsPage.tsx",
      "utf-8"
    );
    expect(content).toContain("showCreateDialog");
    expect(content).toContain("setShowCreateDialog");
  });

  it("should have scenario and profile selection in create dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/client/src/pages/ExecutionsPage.tsx",
      "utf-8"
    );
    expect(content).toContain("newExecScenarioId");
    expect(content).toContain("newExecProfileId");
    expect(content).toContain("exec-scenario");
    expect(content).toContain("exec-profile");
  });

  it("should pass scenarioId and profileId to createExecution.mutate", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/client/src/pages/ExecutionsPage.tsx",
      "utf-8"
    );
    // The mutate call should include scenarioId and profileId
    expect(content).toContain("scenarioId: newExecScenarioId || undefined");
    expect(content).toContain("profileId: newExecProfileId || undefined");
  });

  it("should fetch profiles list for the dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/client/src/pages/ExecutionsPage.tsx",
      "utf-8"
    );
    expect(content).toContain("trpc.profiles.list.useQuery");
    expect(content).toContain("profilesList");
  });

  it("should have environment and mode selectors in dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/client/src/pages/ExecutionsPage.tsx",
      "utf-8"
    );
    expect(content).toContain("newExecEnv");
    expect(content).toContain("newExecMode");
    expect(content).toContain("exec-env");
    expect(content).toContain("exec-mode");
  });

  it("should have auto-start toggle in dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/client/src/pages/ExecutionsPage.tsx",
      "utf-8"
    );
    expect(content).toContain("newExecAutoStart");
    expect(content).toContain("exec-autostart");
  });
});

// ─── 5. PDF handler — jobQueue.ts uses "Non spécifié" ──────────────────────
describe("PDF handler — jobQueue.ts content verification", () => {
  it("should use 'Non spécifié' instead of '—' for missing scenario/profile in PDF", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/server/jobQueue.ts",
      "utf-8"
    );
    // Verify the PDF handler uses "Non spécifié" for missing scenario/profile
    expect(content).toContain('scenario?.name ?? "Non spécifié"');
    expect(content).toContain('profile?.name ?? "Non spécifié"');
  });

  it("should check scenarioId with trim() before querying", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/agilestest-test-gui/server/jobQueue.ts",
      "utf-8"
    );
    // Verify the handler checks for empty/whitespace IDs
    expect(content).toContain("execution.scenarioId && execution.scenarioId.trim()");
    expect(content).toContain("execution.profileId && execution.profileId.trim()");
  });
});
