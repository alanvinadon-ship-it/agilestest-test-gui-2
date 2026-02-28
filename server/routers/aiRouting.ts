// ============================================================================
// AI Routing Router — Admin-only CRUD for routing rules
// Rules determine which AI engine to use for each use case.
// ============================================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { eq, and, asc } from "drizzle-orm";
import { router, adminProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { aiRoutingRules, aiEngines } from "../../drizzle/schema";
import { writeAuditLog } from "../lib/auditLog";

// ── Constants ────────────────────────────────────────────────────────────

export const USE_CASES = ["DRIVE_DIAG", "ANALYTICS", "SUMMARIZE", "INGEST_LONG", "GENERAL"] as const;
export type UseCase = (typeof USE_CASES)[number];

export const USE_CASE_LABELS: Record<UseCase, string> = {
  DRIVE_DIAG: "Drive Test Diagnostic",
  ANALYTICS: "Analytique",
  SUMMARIZE: "Résumé",
  INGEST_LONG: "Ingestion Long-Context",
  GENERAL: "Général",
};

// ── Zod Schemas ──────────────────────────────────────────────────────────

const useCaseEnum = z.enum(USE_CASES);

const conditionsSchema = z.object({
  minTokens: z.number().int().min(0).optional(),
  maxTokens: z.number().int().min(0).optional(),
  hasLargeArtifacts: z.boolean().optional(),
  artifactKinds: z.array(z.string()).optional(),
  preferLongContext: z.boolean().optional(),
}).passthrough().nullable().optional();

const orgInput = z.object({ orgId: z.string().min(1) });

const createInput = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(128).transform((s) => s.trim()),
  useCase: useCaseEnum,
  priority: z.number().int().min(0).max(10000).optional().default(100),
  enabled: z.boolean().optional().default(true),
  conditionsJson: conditionsSchema,
  targetEngineUid: z.string().uuid(),
});

const updateInput = z.object({
  uid: z.string().uuid(),
  name: z.string().min(1).max(128).transform((s) => s.trim()).optional(),
  useCase: useCaseEnum.optional(),
  priority: z.number().int().min(0).max(10000).optional(),
  enabled: z.boolean().optional(),
  conditionsJson: conditionsSchema,
  targetEngineUid: z.string().uuid().optional(),
});

const deleteInput = z.object({ uid: z.string().uuid() });

const reorderInput = z.object({
  useCase: useCaseEnum,
  orgId: z.string().min(1),
  orderedUids: z.array(z.string().uuid()),
});

const dryRunInput = z.object({
  orgId: z.string().min(1),
  useCase: useCaseEnum,
  context: z.object({
    tokenEstimate: z.number().int().min(0).optional(),
    hasLargeArtifacts: z.boolean().optional(),
    artifactKinds: z.array(z.string()).optional(),
    preferLongContext: z.boolean().optional(),
  }).passthrough().optional().default({}),
});

// ── Helpers ──────────────────────────────────────────────────────────────

function assertNotLocked() {
  if (ENV.aiConfigLocked) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "AI configuration is locked (AI_CONFIG_LOCKED=true).",
    });
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

/** Check if conditions match the given context */
export function matchConditions(
  conditions: Record<string, unknown> | null | undefined,
  context: Record<string, unknown>
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  // minTokens
  if (conditions.minTokens != null && typeof conditions.minTokens === "number") {
    const tokens = typeof context.tokenEstimate === "number" ? context.tokenEstimate : 0;
    if (tokens < conditions.minTokens) return false;
  }

  // maxTokens
  if (conditions.maxTokens != null && typeof conditions.maxTokens === "number") {
    const tokens = typeof context.tokenEstimate === "number" ? context.tokenEstimate : 0;
    if (tokens > conditions.maxTokens) return false;
  }

  // hasLargeArtifacts
  if (conditions.hasLargeArtifacts === true) {
    if (!context.hasLargeArtifacts) return false;
  }

  // preferLongContext
  if (conditions.preferLongContext === true) {
    if (!context.preferLongContext) return false;
  }

  // artifactKinds (rule requires at least one of these kinds)
  if (Array.isArray(conditions.artifactKinds) && conditions.artifactKinds.length > 0) {
    const ctxKinds = Array.isArray(context.artifactKinds) ? context.artifactKinds : [];
    const hasMatch = conditions.artifactKinds.some((k: string) => ctxKinds.includes(k));
    if (!hasMatch) return false;
  }

  return true;
}

// ── Router ───────────────────────────────────────────────────────────────

export const aiRoutingRouter = router({
  /** List routing rules, optionally filtered by useCase */
  list: adminProcedure.input(
    orgInput.extend({ useCase: useCaseEnum.optional() })
  ).query(async ({ input }) => {
    const db = await requireDb();
    const conditions = [eq(aiRoutingRules.orgId, input.orgId)];
    if (input.useCase) {
      conditions.push(eq(aiRoutingRules.useCase, input.useCase));
    }

    const rows = await db.select().from(aiRoutingRules)
      .where(and(...conditions))
      .orderBy(asc(aiRoutingRules.priority));

    return {
      rules: rows.map((r) => ({
        uid: r.uid,
        orgId: r.orgId,
        name: r.name,
        enabled: r.enabled,
        priority: r.priority,
        useCase: r.useCase,
        conditionsJson: r.conditionsJson as Record<string, unknown> | null,
        targetEngineUid: r.targetEngineUid,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    };
  }),

  /** Create a new routing rule */
  create: adminProcedure.input(createInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const uid = randomUUID();
    const userId = ctx.user.openId;

    // Verify target engine exists
    const [engine] = await db.select({ uid: aiEngines.uid })
      .from(aiEngines)
      .where(eq(aiEngines.uid, input.targetEngineUid))
      .limit(1);
    if (!engine) throw new TRPCError({ code: "BAD_REQUEST", message: "Target engine not found" });

    await db.insert(aiRoutingRules).values({
      uid,
      orgId: input.orgId,
      name: input.name,
      useCase: input.useCase,
      priority: input.priority,
      enabled: input.enabled,
      conditionsJson: input.conditionsJson ?? null,
      targetEngineUid: input.targetEngineUid,
      createdBy: userId,
    });

    await writeAuditLog({
      userId,
      action: "AI_ROUTING_CREATE",
      entity: "ai_routing_rule",
      entityId: uid,
      details: { name: input.name, useCase: input.useCase, targetEngine: input.targetEngineUid },
    });

    return { uid };
  }),

  /** Update an existing routing rule */
  update: adminProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const userId = ctx.user.openId;

    const [existing] = await db.select().from(aiRoutingRules)
      .where(eq(aiRoutingRules.uid, input.uid))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Routing rule not found" });

    // Verify target engine if changed
    if (input.targetEngineUid) {
      const [engine] = await db.select({ uid: aiEngines.uid })
        .from(aiEngines)
        .where(eq(aiEngines.uid, input.targetEngineUid))
        .limit(1);
      if (!engine) throw new TRPCError({ code: "BAD_REQUEST", message: "Target engine not found" });
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.useCase !== undefined) patch.useCase = input.useCase;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.conditionsJson !== undefined) patch.conditionsJson = input.conditionsJson;
    if (input.targetEngineUid !== undefined) patch.targetEngineUid = input.targetEngineUid;

    if (Object.keys(patch).length > 0) {
      await db.update(aiRoutingRules)
        .set(patch)
        .where(eq(aiRoutingRules.id, existing.id));
    }

    await writeAuditLog({
      userId,
      action: "AI_ROUTING_UPDATE",
      entity: "ai_routing_rule",
      entityId: input.uid,
      details: { fields: Object.keys(patch) },
    });

    return { ok: true };
  }),

  /** Delete a routing rule */
  delete: adminProcedure.input(deleteInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const userId = ctx.user.openId;

    const [existing] = await db.select({ id: aiRoutingRules.id })
      .from(aiRoutingRules)
      .where(eq(aiRoutingRules.uid, input.uid))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Routing rule not found" });

    await db.delete(aiRoutingRules).where(eq(aiRoutingRules.id, existing.id));

    await writeAuditLog({
      userId,
      action: "AI_ROUTING_DELETE",
      entity: "ai_routing_rule",
      entityId: input.uid,
    });

    return { ok: true };
  }),

  /** Reorder rules for a given use case (re-writes priority) */
  reorder: adminProcedure.input(reorderInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const userId = ctx.user.openId;

    // Update priority for each uid in order
    for (let i = 0; i < input.orderedUids.length; i++) {
      await db.update(aiRoutingRules)
        .set({ priority: i * 10 })
        .where(
          and(
            eq(aiRoutingRules.uid, input.orderedUids[i]),
            eq(aiRoutingRules.orgId, input.orgId),
            eq(aiRoutingRules.useCase, input.useCase),
          )
        );
    }

    await writeAuditLog({
      userId,
      action: "AI_ROUTING_REORDER",
      entity: "ai_routing_rule",
      entityId: input.useCase,
      details: { orderedUids: input.orderedUids },
    });

    return { ok: true };
  }),

  /** Dry run: simulate which engine would be selected for a given context */
  dryRun: adminProcedure.input(dryRunInput).query(async ({ input }) => {
    const db = await requireDb();

    // Load enabled rules for this use case, ordered by priority
    const rules = await db.select().from(aiRoutingRules)
      .where(
        and(
          eq(aiRoutingRules.orgId, input.orgId),
          eq(aiRoutingRules.useCase, input.useCase),
          eq(aiRoutingRules.enabled, true),
        )
      )
      .orderBy(asc(aiRoutingRules.priority));

    // Try to match a rule
    for (const rule of rules) {
      const conditions = rule.conditionsJson as Record<string, unknown> | null;
      if (matchConditions(conditions, input.context)) {
        // Load the target engine
        const [engine] = await db.select({
          uid: aiEngines.uid,
          name: aiEngines.name,
          provider: aiEngines.provider,
          model: aiEngines.model,
          enabled: aiEngines.enabled,
        }).from(aiEngines)
          .where(
            and(
              eq(aiEngines.uid, rule.targetEngineUid),
              eq(aiEngines.enabled, true),
            )
          )
          .limit(1);

        if (engine) {
          return {
            matched: true,
            matchedRule: { uid: rule.uid, name: rule.name, priority: rule.priority },
            selectedEngine: engine,
          };
        }
        // Engine disabled, skip this rule
      }
    }

    // No rule matched → fallback to primary engine
    const [primary] = await db.select({
      uid: aiEngines.uid,
      name: aiEngines.name,
      provider: aiEngines.provider,
      model: aiEngines.model,
      enabled: aiEngines.enabled,
    }).from(aiEngines)
      .where(
        and(
          eq(aiEngines.orgId, input.orgId),
          eq(aiEngines.isPrimary, true),
          eq(aiEngines.enabled, true),
        )
      )
      .limit(1);

    if (primary) {
      return {
        matched: false,
        matchedRule: null,
        selectedEngine: primary,
        fallback: "primary",
      };
    }

    // No primary → ENV fallback
    return {
      matched: false,
      matchedRule: null,
      selectedEngine: null,
      fallback: "env",
    };
  }),
});
