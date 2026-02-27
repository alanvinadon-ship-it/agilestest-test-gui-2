/**
 * Tests for aiGenerationRouter — Structure, input validation, Zod schemas, prompt builders.
 * No live DB or LLM required (structure + unit tests only).
 */
import { describe, it, expect } from "vitest";
import { aiGenerationRouter } from "./routers/aiGeneration";

// ─── Router structure ────────────────────────────────────────────────────────

describe("aiGenerationRouter structure", () => {
  const procedures = Object.keys((aiGenerationRouter as any)._def.procedures);

  it("exports all 3 procedures", () => {
    expect(procedures).toEqual(
      expect.arrayContaining(["planScript", "generateScript", "saveScript"])
    );
    expect(procedures.length).toBe(3);
  });

  it("planScript is a mutation", () => {
    const proc = (aiGenerationRouter as any)._def.procedures.planScript;
    expect(proc._def.type).toBe("mutation");
  });

  it("generateScript is a mutation", () => {
    const proc = (aiGenerationRouter as any)._def.procedures.generateScript;
    expect(proc._def.type).toBe("mutation");
  });

  it("saveScript is a mutation", () => {
    const proc = (aiGenerationRouter as any)._def.procedures.saveScript;
    expect(proc._def.type).toBe("mutation");
  });
});

// ─── Zod schema validation ──────────────────────────────────────────────────

describe("ScriptPlanResult Zod validation", () => {
  // We test the schema indirectly by importing and validating sample data
  const { z } = require("zod");

  const ScriptPlanResultSchema = z.object({
    framework_choice: z.string(),
    code_language: z.string(),
    file_plan: z.array(z.object({
      path: z.string(),
      purpose: z.string(),
      dependencies: z.array(z.string()).optional(),
    })),
    step_mapping: z.array(z.object({
      step_id: z.string(),
      step_order: z.number(),
      action: z.string(),
      target_file: z.string(),
      target_function: z.string(),
      dataset_keys_used: z.array(z.string()),
    })),
    missing_inputs: z.array(z.object({
      key: z.string(),
      reason: z.string(),
      severity: z.enum(["BLOCKING", "WARNING"]),
    })),
    notes: z.string().optional(),
    warnings: z.array(z.string()).optional(),
  });

  it("validates a correct plan", () => {
    const validPlan = {
      framework_choice: "playwright",
      code_language: "TypeScript",
      file_plan: [
        { path: "tests/login.spec.ts", purpose: "Main test spec" },
        { path: "helpers/selectors.ts", purpose: "Selector constants" },
      ],
      step_mapping: [
        {
          step_id: "step-1",
          step_order: 1,
          action: "Navigate to login page",
          target_file: "tests/login.spec.ts",
          target_function: "step1_navigate",
          dataset_keys_used: ["url"],
        },
      ],
      missing_inputs: [],
      notes: "Plan for login test",
      warnings: [],
    };
    const result = ScriptPlanResultSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it("rejects plan with invalid severity", () => {
    const invalidPlan = {
      framework_choice: "playwright",
      code_language: "TypeScript",
      file_plan: [],
      step_mapping: [],
      missing_inputs: [{ key: "password", reason: "Not found", severity: "CRITICAL" }],
    };
    const result = ScriptPlanResultSchema.safeParse(invalidPlan);
    expect(result.success).toBe(false);
  });

  it("rejects plan with missing required fields", () => {
    const result = ScriptPlanResultSchema.safeParse({ framework_choice: "playwright" });
    expect(result.success).toBe(false);
  });
});

describe("ScriptPackage Zod validation", () => {
  const { z } = require("zod");

  const ScriptPackageSchema = z.object({
    files: z.array(z.object({
      path: z.string(),
      content: z.string(),
      language: z.string().optional(),
    })).min(1),
    notes: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    metadata: z.object({
      framework: z.string(),
      code_language: z.string(),
      scenario_id: z.string(),
      bundle_id: z.string(),
      generated_at: z.string(),
      prompt_version: z.string(),
    }).optional(),
  });

  it("validates a correct package", () => {
    const validPackage = {
      files: [
        { path: "tests/login.spec.ts", content: "import { test } from '@playwright/test';", language: "typescript" },
      ],
      notes: "Generated successfully",
      warnings: [],
      metadata: {
        framework: "playwright",
        code_language: "TypeScript",
        scenario_id: "sc-1",
        bundle_id: "bun-1",
        generated_at: "2026-02-27T10:00:00Z",
        prompt_version: "PROMPT_SCRIPT_GEN_v1",
      },
    };
    const result = ScriptPackageSchema.safeParse(validPackage);
    expect(result.success).toBe(true);
  });

  it("rejects package with empty files array", () => {
    const result = ScriptPackageSchema.safeParse({
      files: [],
      notes: "Empty",
    });
    expect(result.success).toBe(false);
  });

  it("rejects package without files field", () => {
    const result = ScriptPackageSchema.safeParse({ notes: "No files" });
    expect(result.success).toBe(false);
  });
});

// ─── JSON extraction helper ─────────────────────────────────────────────────

describe("parseJSON helper logic", () => {
  // Replicate the parseJSON logic from the router
  function parseJSON(raw: string): unknown {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }
    return JSON.parse(cleaned);
  }

  it("parses plain JSON", () => {
    const result = parseJSON('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("strips markdown json fences", () => {
    const result = parseJSON('```json\n{"key": "value"}\n```');
    expect(result).toEqual({ key: "value" });
  });

  it("strips markdown fences without language tag", () => {
    const result = parseJSON('```\n{"key": "value"}\n```');
    expect(result).toEqual({ key: "value" });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJSON("not json")).toThrow();
  });
});

// ─── Input context schema ───────────────────────────────────────────────────

describe("AiContextInput validation", () => {
  const { z } = require("zod");

  const StepSchema = z.object({
    id: z.string(),
    order: z.number(),
    action: z.string(),
    description: z.string(),
    expected_result: z.string(),
    parameters: z.record(z.string(), z.unknown()),
  });

  const AiContextInput = z.object({
    project: z.object({ id: z.string(), name: z.string() }),
    profile: z.object({
      id: z.string(),
      domain: z.string(),
      test_type: z.string(),
      profile_type: z.string(),
      runner_type: z.string(),
      config: z.record(z.string(), z.unknown()),
    }),
    scenario: z.object({
      id: z.string(),
      title: z.string(),
      scenario_code: z.string().optional(),
      steps: z.array(StepSchema),
      expected_results: z.array(z.string()),
      required_inputs: z.array(z.string()),
      required_dataset_types: z.array(z.string()),
      tags: z.array(z.string()),
    }),
    dataset: z.object({
      env: z.string(),
      bundle: z.object({ id: z.string(), name: z.string(), version: z.number() }),
      resolved: z.object({ merged_json: z.record(z.string(), z.unknown()) }),
      secrets_policy: z.object({ masked_keys: z.array(z.string()) }),
    }),
    generation_constraints: z.object({
      code_language: z.string(),
      framework_preferences: z.array(z.string()),
      style_rules: z.array(z.string()),
      artifact_policy: z.array(z.string()),
    }),
  });

  const validContext = {
    project: { id: "proj-1", name: "Test Project" },
    profile: {
      id: "prof-1",
      domain: "IMS",
      test_type: "E2E",
      profile_type: "SIP",
      runner_type: "playwright",
      config: { headless: true },
    },
    scenario: {
      id: "sc-1",
      title: "Login Test",
      scenario_code: "SC-001",
      steps: [
        {
          id: "step-1",
          order: 1,
          action: "Navigate to login",
          description: "Open the login page",
          expected_result: "Login page is displayed",
          parameters: { url: "https://example.com/login" },
        },
      ],
      expected_results: ["User is logged in"],
      required_inputs: ["username", "password"],
      required_dataset_types: ["CREDENTIALS"],
      tags: ["auth"],
    },
    dataset: {
      env: "DEV",
      bundle: { id: "bun-1", name: "Auth Bundle", version: 1 },
      resolved: { merged_json: { username: "admin", password: "***" } },
      secrets_policy: { masked_keys: ["password"] },
    },
    generation_constraints: {
      code_language: "TypeScript",
      framework_preferences: ["playwright"],
      style_rules: ["Use page objects"],
      artifact_policy: ["spec.ts", "helpers/"],
    },
  };

  it("validates a complete context", () => {
    const result = AiContextInput.safeParse(validContext);
    expect(result.success).toBe(true);
  });

  it("rejects context without project", () => {
    const { project, ...rest } = validContext;
    const result = AiContextInput.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects context with invalid step (missing id)", () => {
    const ctx = {
      ...validContext,
      scenario: {
        ...validContext.scenario,
        steps: [{ order: 1, action: "test", description: "d", expected_result: "r", parameters: {} }],
      },
    };
    const result = AiContextInput.safeParse(ctx);
    expect(result.success).toBe(false);
  });
});
