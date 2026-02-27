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

// ─── Capture Policies Router ──────────────────────────────────────────────

export const capturePoliciesRouter = router({
  /** List policies for a given scope (project, campaign, scenario) */
  list: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["project", "campaign", "scenario"]).optional(),
        scopeId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions: SQL[] = [];
      if (input.scope) conditions.push(eq(capturePolicies.scope, input.scope));
      if (input.scopeId) conditions.push(eq(capturePolicies.scopeId, input.scopeId));
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

      // Total count
      const [{ cnt }] = await db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(capturePolicies)
        .where(conditions.length ? and(...conditions) : undefined);

      return { items, total: Number(cnt), nextCursor, hasMore: nextCursor !== null };
    }),

  /** Get a single policy by scope + scopeId (the primary lookup pattern) */
  getByScope: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["project", "campaign", "scenario"]),
        scopeId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [row] = await db
        .select()
        .from(capturePolicies)
        .where(
          and(
            eq(capturePolicies.scope, input.scope),
            eq(capturePolicies.scopeId, input.scopeId)
          )
        )
        .limit(1);
      return row || null;
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

  /** Upsert: create or update a policy for a scope+scopeId */
  upsert: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["project", "campaign", "scenario"]),
        scopeId: z.string(),
        policyJson: z.any(), // CapturePolicy object
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      // Check if exists
      const [existing] = await db
        .select()
        .from(capturePolicies)
        .where(
          and(
            eq(capturePolicies.scope, input.scope),
            eq(capturePolicies.scopeId, input.scopeId)
          )
        )
        .limit(1);

      if (existing) {
        // Update
        await db
          .update(capturePolicies)
          .set({ policyJson: input.policyJson })
          .where(eq(capturePolicies.id, existing.id));
        return { ...existing, policyJson: input.policyJson };
      } else {
        // Create
        const uid = randomUUID();
        await db.insert(capturePolicies).values({
          uid,
          scope: input.scope,
          scopeId: input.scopeId,
          policyJson: input.policyJson,
          createdBy: ctx.user?.openId || "system",
        });
        const [created] = await db
          .select()
          .from(capturePolicies)
          .where(eq(capturePolicies.uid, uid))
          .limit(1);
        return created;
      }
    }),

  /** Delete a policy for a scope+scopeId (revert to parent default) */
  remove: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["project", "campaign", "scenario"]),
        scopeId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .delete(capturePolicies)
        .where(
          and(
            eq(capturePolicies.scope, input.scope),
            eq(capturePolicies.scopeId, input.scopeId)
          )
        );
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
