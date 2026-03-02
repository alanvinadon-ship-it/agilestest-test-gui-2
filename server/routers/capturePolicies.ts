import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { capturePolicies } from "../../drizzle/schema";
import { eq, and, desc, lt, sql, SQL } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Helpers ───────────────────────────────────────────────────────────────

function dbOrThrow() {
  return getDb().then((db) => {
    if (!db)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "DB unavailable",
      });
    return db;
  });
}

/**
 * Legacy compatibility: the frontend uses scope/scopeId/policyJson but the DB
 * stores project_id, name, capture_mode, etc. We keep the old API surface and
 * map internally.  For "project" scope, scopeId maps to projectId.
 * For "campaign"/"scenario" scopes we store the scopeId in the name column
 * prefixed with the scope (e.g. "campaign:<uid>") so we can look them up.
 */
function scopeToConditions(scope: string, scopeId: string): SQL[] {
  if (scope === "project") {
    return [eq(capturePolicies.projectId, scopeId)];
  }
  // For campaign/scenario: store as name = "scope:scopeId" with a placeholder projectId
  return [eq(capturePolicies.name, `${scope}:${scopeId}`)];
}

// ─── Capture Policies Router ──────────────────────────────────────────────

export const capturePoliciesRouter = router({
  /** List policies for a given project */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        scope: z.enum(["project", "campaign", "scenario"]).optional(),
        scopeId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions: SQL[] = [];
      if (input.projectId) conditions.push(eq(capturePolicies.projectId, input.projectId));
      if (input.scope && input.scopeId) {
        conditions.push(...scopeToConditions(input.scope, input.scopeId));
      }
      if (input.cursor) conditions.push(lt(capturePolicies.id, input.cursor));

      const items = await db
        .select()
        .from(capturePolicies)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(capturePolicies.id))
        .limit(input.limit + 1);

      let nextCursor: number | null = null;
      if (items.length > input.limit) {
        const last = items.pop()!;
        nextCursor = last.id;
      }

      const [{ cnt }] = await db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(capturePolicies)
        .where(conditions.length ? and(...conditions) : undefined);

      return { items, total: Number(cnt), nextCursor, hasMore: nextCursor !== null };
    }),

  /** Get a single policy by scope + scopeId (legacy compat) */
  getByScope: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["project", "campaign", "scenario"]),
        scopeId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions = scopeToConditions(input.scope, input.scopeId);
      const [row] = await db
        .select()
        .from(capturePolicies)
        .where(and(...conditions))
        .limit(1);
      if (!row) return null;
      // Return with legacy policyJson field for frontend compat
      return {
        ...row,
        scope: input.scope,
        scopeId: input.scopeId,
        policyJson: {
          captureMode: row.captureMode,
          triggerOn: row.triggerOn,
          autoCapture: row.autoCapture,
          duration: row.duration,
          maxSize: row.maxSize,
          bpfFilter: row.bpfFilter,
          interfaceName: row.interfaceName,
          probeId: row.probeId,
          enabled: row.enabled,
        },
      };
    }),

  /** Get a single policy by uid */
  get: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [row] = await db
        .select()
        .from(capturePolicies)
        .where(eq(capturePolicies.uid, input.uid))
        .limit(1);
      if (!row)
        throw new TRPCError({ code: "NOT_FOUND", message: "Capture policy not found" });
      return row;
    }),

  /** Upsert: create or update a policy for a scope+scopeId (legacy compat) */
  upsert: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["project", "campaign", "scenario"]),
        scopeId: z.string(),
        policyJson: z.any(), // CapturePolicy object
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions = scopeToConditions(input.scope, input.scopeId);
      const [existing] = await db
        .select()
        .from(capturePolicies)
        .where(and(...conditions))
        .limit(1);

      const policy = input.policyJson || {};

      if (existing) {
        await db
          .update(capturePolicies)
          .set({
            captureMode: policy.captureMode ?? existing.captureMode,
            triggerOn: policy.triggerOn ?? existing.triggerOn,
            autoCapture: policy.autoCapture ?? existing.autoCapture,
            duration: policy.duration ?? existing.duration,
            maxSize: policy.maxSize ?? existing.maxSize,
            bpfFilter: policy.bpfFilter ?? existing.bpfFilter,
            interfaceName: policy.interfaceName ?? existing.interfaceName,
            probeId: policy.probeId ?? existing.probeId,
            enabled: policy.enabled ?? existing.enabled,
          })
          .where(eq(capturePolicies.id, existing.id));
        return { ...existing, policyJson: input.policyJson };
      } else {
        const uid = randomUUID();
        const projectId = input.scope === "project" ? input.scopeId : "system";
        const name = input.scope === "project"
          ? `default`
          : `${input.scope}:${input.scopeId}`;
        await db.insert(capturePolicies).values({
          uid,
          projectId,
          name,
          captureMode: policy.captureMode || "RUNNER",
          triggerOn: policy.triggerOn ?? null,
          autoCapture: policy.autoCapture ?? null,
          duration: policy.duration ?? null,
          maxSize: policy.maxSize ?? null,
          bpfFilter: policy.bpfFilter ?? null,
          interfaceName: policy.interfaceName ?? null,
          probeId: policy.probeId ?? null,
          enabled: policy.enabled ?? true,
        });
        const [created] = await db
          .select()
          .from(capturePolicies)
          .where(eq(capturePolicies.uid, uid))
          .limit(1);
        return { ...created, policyJson: input.policyJson };
      }
    }),

  /** Create a new capture policy */
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string(),
        captureMode: z.enum(["RUNNER", "PROBE"]),
        triggerOn: z.any().optional(),
        autoCapture: z.boolean().optional(),
        duration: z.number().optional(),
        maxSize: z.number().optional(),
        bpfFilter: z.string().optional(),
        interfaceName: z.string().optional(),
        probeId: z.string().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const uid = randomUUID();
      await db.insert(capturePolicies).values({
        uid,
        projectId: input.projectId,
        name: input.name,
        captureMode: input.captureMode,
        triggerOn: input.triggerOn ?? null,
        autoCapture: input.autoCapture ?? null,
        duration: input.duration ?? null,
        maxSize: input.maxSize ?? null,
        bpfFilter: input.bpfFilter ?? null,
        interfaceName: input.interfaceName ?? null,
        probeId: input.probeId ?? null,
        enabled: input.enabled ?? true,
      });
      const [created] = await db
        .select()
        .from(capturePolicies)
        .where(eq(capturePolicies.uid, uid))
        .limit(1);
      return created;
    }),

  /** Update an existing capture policy */
  update: protectedProcedure
    .input(
      z.object({
        uid: z.string(),
        name: z.string().optional(),
        captureMode: z.enum(["RUNNER", "PROBE"]).optional(),
        triggerOn: z.any().optional(),
        autoCapture: z.boolean().optional(),
        duration: z.number().optional(),
        maxSize: z.number().optional(),
        bpfFilter: z.string().optional(),
        interfaceName: z.string().optional(),
        probeId: z.string().optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const { uid, ...updates } = input;
      const setData: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setData[key] = value;
      }
      if (Object.keys(setData).length > 0) {
        await db
          .update(capturePolicies)
          .set(setData)
          .where(eq(capturePolicies.uid, uid));
      }
      const [updated] = await db
        .select()
        .from(capturePolicies)
        .where(eq(capturePolicies.uid, uid))
        .limit(1);
      if (!updated)
        throw new TRPCError({ code: "NOT_FOUND", message: "Capture policy not found" });
      return updated;
    }),

  /** Delete a policy for a scope+scopeId (legacy compat) */
  remove: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["project", "campaign", "scenario"]),
        scopeId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions = scopeToConditions(input.scope, input.scopeId);
      await db
        .delete(capturePolicies)
        .where(and(...conditions));
      return { success: true };
    }),

  /** Delete a policy by uid */
  delete: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .delete(capturePolicies)
        .where(eq(capturePolicies.uid, input.uid));
      return { success: true };
    }),
});
