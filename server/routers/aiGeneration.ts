/**
 * aiGeneration router — Endpoints IA réels pour la génération de scripts de test.
 *
 * Procédures :
 *   - planScript   : Analyse le scénario et produit un ScriptPlanResult via LLM
 *   - generateScript : Génère un ScriptPackage complet à partir du plan via LLM
 *   - saveScript   : Persiste le script généré dans generated_scripts
 *
 * Toutes les procédures sont protégées (auth requise).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { generatedScripts } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Zod schemas for AI output validation ───────────────────────────────

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

// ─── JSON Schema for structured LLM output ──────────────────────────────

const PLAN_JSON_SCHEMA = {
  name: "script_plan_result",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      framework_choice: { type: "string" as const, description: "Chosen framework (playwright, robotframework, etc.)" },
      code_language: { type: "string" as const, description: "Code language (TypeScript, Robot, Python)" },
      file_plan: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            path: { type: "string" as const },
            purpose: { type: "string" as const },
            dependencies: { type: "array" as const, items: { type: "string" as const } },
          },
          required: ["path", "purpose", "dependencies"],
          additionalProperties: false,
        },
      },
      step_mapping: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            step_id: { type: "string" as const },
            step_order: { type: "number" as const },
            action: { type: "string" as const },
            target_file: { type: "string" as const },
            target_function: { type: "string" as const },
            dataset_keys_used: { type: "array" as const, items: { type: "string" as const } },
          },
          required: ["step_id", "step_order", "action", "target_file", "target_function", "dataset_keys_used"],
          additionalProperties: false,
        },
      },
      missing_inputs: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            key: { type: "string" as const },
            reason: { type: "string" as const },
            severity: { type: "string" as const, enum: ["BLOCKING", "WARNING"] },
          },
          required: ["key", "reason", "severity"],
          additionalProperties: false,
        },
      },
      notes: { type: "string" as const },
      warnings: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["framework_choice", "code_language", "file_plan", "step_mapping", "missing_inputs", "notes", "warnings"],
    additionalProperties: false,
  },
};

export const GENERATE_JSON_SCHEMA = {
  name: "script_package",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      files: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            path: { type: "string" as const },
            content: { type: "string" as const },
            language: { type: "string" as const },
          },
          required: ["path", "content", "language"],
          additionalProperties: false,
        },
      },
      notes: { type: "string" as const },
      warnings: { type: "array" as const, items: { type: "string" as const } },
      metadata: {
        type: "object" as const,
        properties: {
          framework: { type: "string" as const },
          code_language: { type: "string" as const },
          scenario_id: { type: "string" as const },
          bundle_id: { type: "string" as const },
          generated_at: { type: "string" as const },
          prompt_version: { type: "string" as const },
        },
        required: ["framework", "code_language", "scenario_id", "bundle_id", "generated_at", "prompt_version"],
        additionalProperties: false,
      },
    },
    required: ["files", "notes", "warnings", "metadata"],
    additionalProperties: false,
  },
};

// ─── Input schemas ──────────────────────────────────────────────────────

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

// ─── Prompt builders (server-side copies from promptTemplates) ───────────

function jsonBlock(obj: unknown): string {
  return "```json\n" + JSON.stringify(obj, null, 2) + "\n```";
}

function formatSteps(steps: Array<{ order: number; action: string; description: string; expected_result: string; parameters: Record<string, unknown> }>): string {
  return steps.map(s =>
    `  ${s.order}. [${s.action}] ${s.description}\n     Expected: ${s.expected_result}\n     Params: ${JSON.stringify(s.parameters)}`
  ).join("\n");
}

function formatDatasetKeys(merged: Record<string, unknown>, maskedKeys: string[]): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(merged)) {
    const isMasked = maskedKeys.some(mk => key.includes(mk) || mk.includes(key));
    lines.push(`  ${key}: ${isMasked ? "***MASKED***" : JSON.stringify(value)}`);
  }
  return lines.join("\n");
}

function buildPlanPrompt(ctx: z.infer<typeof AiContextInput>): string {
  return `You are an expert test automation architect.

## TASK
Analyze the following test scenario and produce a **ScriptPlanResult** JSON object.

## CONTEXT

### Project
- Name: ${ctx.project.name}
- ID: ${ctx.project.id}

### Profile
- Domain: ${ctx.profile.domain}
- Test Type: ${ctx.profile.test_type}
- Profile Type: ${ctx.profile.profile_type}
- Runner Type: ${ctx.profile.runner_type}

### Scenario
- Title: ${ctx.scenario.title}
- Code: ${ctx.scenario.scenario_code || "N/A"}
- Required Dataset Types: ${ctx.scenario.required_dataset_types.join(", ") || "none"}
- Steps:
${formatSteps(ctx.scenario.steps)}

### Dataset (${ctx.dataset.env})
- Bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}
- Available keys:
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

### Generation Constraints
- Preferred Language: ${ctx.generation_constraints.code_language}
- Preferred Frameworks: ${ctx.generation_constraints.framework_preferences.join(", ")}
- Style Rules: ${ctx.generation_constraints.style_rules.join("; ")}
- Artifact Policy: ${ctx.generation_constraints.artifact_policy.join(", ")}

## RULES
1. Choose ONE framework from the preferred list.
2. Plan files following the framework's conventions.
3. Map EVERY scenario step to a specific file and function/keyword.
4. Reference dataset keys by their exact names — NEVER invent selectors or values.
5. If any required input is missing from the dataset, add it to missing_inputs with severity BLOCKING.
6. Secret keys (${ctx.dataset.secrets_policy.masked_keys.join(", ") || "none"}) must be referenced via environment variables, NEVER hardcoded.

Return ONLY the JSON matching the schema.`;
}

export function buildGeneratePrompt(ctx: z.infer<typeof AiContextInput>, plan: z.infer<typeof ScriptPlanResultSchema>): string {
  return `You are an expert test automation engineer.

## TASK
Generate complete, production-ready test script files for the following scenario.

## CONTEXT

### Project: ${ctx.project.name}
### Profile
- Domain: ${ctx.profile.domain} | Test Type: ${ctx.profile.test_type}
- Runner: ${ctx.profile.runner_type}

### Scenario: ${ctx.scenario.title} (${ctx.scenario.scenario_code || ctx.scenario.id})
Steps:
${formatSteps(ctx.scenario.steps)}

### Dataset (${ctx.dataset.env}) — Bundle: ${ctx.dataset.bundle.name} v${ctx.dataset.bundle.version}
Available keys:
${formatDatasetKeys(ctx.dataset.resolved.merged_json, ctx.dataset.secrets_policy.masked_keys)}

### Approved Plan
${jsonBlock(plan)}

### Generation Constraints
- Language: ${ctx.generation_constraints.code_language}
- Framework: ${plan.framework_choice}
- Style Rules: ${ctx.generation_constraints.style_rules.join("; ")}
- Artifacts: ${ctx.generation_constraints.artifact_policy.join(", ")}

## RULES
1. Generate ALL files listed in the plan.
2. NEVER hardcode selectors — import from selectors.ts or use dataset keys (selectors_*).
3. NEVER hardcode business values — use dataset keys via import or config.
4. Secret values (${ctx.dataset.secrets_policy.masked_keys.join(", ") || "none"}) → use process.env or %{ENV_VAR} syntax.
5. For RobotFramework: produce reusable keywords, centralized variables.
6. For Playwright: produce spec.ts + helpers + selectors.ts imports.
7. Include proper error handling and assertion messages referencing step context.
8. Each file must be complete and runnable.
9. In metadata, set scenario_id to "${ctx.scenario.id}", bundle_id to "${ctx.dataset.bundle.id}", prompt_version to "PROMPT_SCRIPT_GEN_v1", generated_at to current ISO timestamp.

Return ONLY the JSON matching the schema.`;
}

// ─── Helper: extract JSON from LLM response ────────────────────────────

function extractLLMContent(result: any): string {
  const msg = result?.choices?.[0]?.message;
  if (!msg) throw new Error("Empty LLM response");
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    const text = msg.content.find((p: any) => p.type === "text");
    if (text) return text.text;
  }
  throw new Error("Cannot extract text from LLM response");
}

function parseJSON(raw: string): unknown {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

// ─── Router ─────────────────────────────────────────────────────────────

export const aiGenerationRouter = router({
  /**
   * planScript — Analyse le scénario et produit un plan de génération via LLM.
   * Input: AiScriptContext (construit côté frontend via buildAiScriptContext)
   * Output: ScriptPlanResult validé par Zod
   */
  planScript: protectedProcedure
    .input(z.object({ context: AiContextInput }))
    .mutation(async ({ input }) => {
      const prompt = buildPlanPrompt(input.context);

      const llmResult = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert test automation architect. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: PLAN_JSON_SCHEMA,
        },
      });

      const raw = extractLLMContent(llmResult);
      const parsed = parseJSON(raw);
      const validated = ScriptPlanResultSchema.safeParse(parsed);

      if (!validated.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Plan LLM invalide: ${validated.error.message}`,
        });
      }

      return {
        plan: validated.data,
        usage: llmResult.usage || null,
      };
    }),

  /**
   * generateScript — Génère un ScriptPackage complet à partir du plan via LLM.
   * Input: AiScriptContext + ScriptPlanResult
   * Output: ScriptPackage validé par Zod
   */
  generateScript: protectedProcedure
    .input(z.object({
      context: AiContextInput,
      plan: ScriptPlanResultSchema,
    }))
    .mutation(async ({ input }) => {
      const prompt = buildGeneratePrompt(input.context, input.plan);

      const llmResult = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert test automation engineer. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: GENERATE_JSON_SCHEMA,
        },
      });

      const raw = extractLLMContent(llmResult);
      const parsed = parseJSON(raw);
      const validated = ScriptPackageSchema.safeParse(parsed);

      if (!validated.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Package LLM invalide: ${validated.error.message}`,
        });
      }

      return {
        package: validated.data,
        usage: llmResult.usage || null,
      };
    }),

  /**
   * saveScript — Persiste le script généré dans la table generated_scripts.
   * Combine tous les fichiers en un seul blob JSON dans la colonne `code`.
   */
  saveScript: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      scenarioId: z.string(),
      bundleId: z.string(),
      env: z.string(),
      framework: z.string(),
      codeLanguage: z.string(),
      files: z.array(z.object({
        path: z.string(),
        content: z.string(),
        language: z.string().optional(),
      })),
      plan: ScriptPlanResultSchema.optional(),
      notes: z.string().optional(),
      warnings: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Calculate next version for same scenario+framework
      const existing = await db
        .select({ version: generatedScripts.version })
        .from(generatedScripts)
        .where(
          and(
            eq(generatedScripts.projectId, input.projectId),
            eq(generatedScripts.framework, input.framework),
          )
        )
        .orderBy(desc(generatedScripts.version))
        .limit(1);

      const nextVersion = (existing[0]?.version ?? 0) + 1;

      // Store files + plan + metadata as JSON in the `code` column
      const codePayload = JSON.stringify({
        files: input.files,
        plan: input.plan || null,
        notes: input.notes || null,
        warnings: input.warnings || null,
        env: input.env,
        bundleId: input.bundleId,
      });

      const scenarioName = input.plan
        ? `${input.framework}/${input.codeLanguage} v${nextVersion}`
        : `Script v${nextVersion}`;

      const scriptUid = (await import("crypto")).randomUUID();
      const res = await db.insert(generatedScripts).values({
        uid: scriptUid,
        projectId: input.projectId,
        scenarioId: input.scenarioId || "",
        framework: input.framework,
        language: input.codeLanguage.toLowerCase(),
        code: codePayload,
        version: nextVersion,
        status: "DRAFT",
        createdBy: String(ctx.user!.id),
      });

      return {
        success: true,
        scriptId: Number(res[0].insertId),
        version: nextVersion,
      };
    }),
});
