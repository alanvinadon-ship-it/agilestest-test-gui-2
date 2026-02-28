// ============================================================================
// DriveAI — tRPC Router
// Endpoints: trigger, status, latest, list, segments, feedback, handoff
// ============================================================================

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  driveAiAnalyses, driveAiSegments, driveAiFeedback, driveAiHandoffs, driveRuns,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { enqueueJob } from "../jobQueue";
import { TRPCError } from "@trpc/server";

export const driveAiRouter = router({
  // ── Trigger analysis ────────────────────────────────────────────────────
  trigger: protectedProcedure
    .input(z.object({
      runUid: z.string().min(1),
      orgId: z.string().min(1),
      mode: z.enum(["FAST", "DEEP"]).default("FAST"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      // Verify run exists
      const [run] = await db.select({ uid: driveRuns.uid })
        .from(driveRuns).where(
          and(eq(driveRuns.uid, input.runUid), eq(driveRuns.orgId, orgId))
        ).limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });

      // Check if there's already a QUEUED or RUNNING analysis
      const [existing] = await db.select({ uid: driveAiAnalyses.uid, status: driveAiAnalyses.status })
        .from(driveAiAnalyses).where(
          and(
            eq(driveAiAnalyses.runUid, input.runUid),
            eq(driveAiAnalyses.orgId, orgId),
            sql`${driveAiAnalyses.status} IN ('QUEUED', 'RUNNING')`,
          )
        ).limit(1);

      if (existing) {
        return { analysisUid: existing.uid, status: existing.status, alreadyRunning: true };
      }

      // Create analysis record
      const analysisUid = randomUUID();
      await db.insert(driveAiAnalyses).values({
        uid: analysisUid,
        orgId,
        runUid: input.runUid,
        status: "QUEUED",
        mode: input.mode,
        createdBy: ctx.user.openId,
      });

      // Enqueue job
      const jobId = await enqueueJob("driveAiAnalyze", {
        analysisUid,
        runUid: input.runUid,
        orgId,
        mode: input.mode,
      });

      // Update job_id reference
      await db.update(driveAiAnalyses).set({ jobId })
        .where(eq(driveAiAnalyses.uid, analysisUid));

      return { analysisUid, status: "QUEUED", alreadyRunning: false };
    }),

  // ── Get analysis status ─────────────────────────────────────────────────
  status: protectedProcedure
    .input(z.object({ analysisUid: z.string().min(1), orgId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      const [analysis] = await db.select().from(driveAiAnalyses).where(
        and(eq(driveAiAnalyses.uid, input.analysisUid), eq(driveAiAnalyses.orgId, orgId))
      ).limit(1);

      if (!analysis) throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });
      return analysis;
    }),

  // ── Get latest analysis for a run ───────────────────────────────────────
  latest: protectedProcedure
    .input(z.object({ runUid: z.string().min(1), orgId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      const [analysis] = await db.select().from(driveAiAnalyses).where(
        and(eq(driveAiAnalyses.runUid, input.runUid), eq(driveAiAnalyses.orgId, orgId))
      ).orderBy(desc(driveAiAnalyses.createdAt)).limit(1);

      return analysis ?? null;
    }),

  // ── List all analyses for a run ─────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({ runUid: z.string().min(1), orgId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      return db.select().from(driveAiAnalyses).where(
        and(eq(driveAiAnalyses.runUid, input.runUid), eq(driveAiAnalyses.orgId, orgId))
      ).orderBy(desc(driveAiAnalyses.createdAt));
    }),

  // ── Get segments for an analysis ────────────────────────────────────────
  segments: protectedProcedure
    .input(z.object({ analysisUid: z.string().min(1), orgId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      return db.select().from(driveAiSegments).where(
        and(eq(driveAiSegments.analysisUid, input.analysisUid), eq(driveAiSegments.orgId, orgId))
      ).orderBy(driveAiSegments.createdAt);
    }),

  // ── Submit feedback ─────────────────────────────────────────────────────
  submitFeedback: protectedProcedure
    .input(z.object({
      analysisUid: z.string().min(1),
      orgId: z.string().min(1),
      score: z.number().int().min(1).max(5),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      // Verify analysis exists
      const [analysis] = await db.select({ uid: driveAiAnalyses.uid })
        .from(driveAiAnalyses).where(
          and(eq(driveAiAnalyses.uid, input.analysisUid), eq(driveAiAnalyses.orgId, orgId))
        ).limit(1);
      if (!analysis) throw new TRPCError({ code: "NOT_FOUND", message: "Analysis not found" });

      const feedbackUid = randomUUID();
      await db.insert(driveAiFeedback).values({
        uid: feedbackUid,
        orgId,
        analysisUid: input.analysisUid,
        score: input.score,
        notes: input.notes ?? null,
        createdBy: ctx.user.openId,
      });

      return { uid: feedbackUid };
    }),

  // ── Get feedback for an analysis ────────────────────────────────────────
  getFeedback: protectedProcedure
    .input(z.object({ analysisUid: z.string().min(1), orgId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      return db.select().from(driveAiFeedback).where(
        and(eq(driveAiFeedback.analysisUid, input.analysisUid), eq(driveAiFeedback.orgId, orgId))
      ).orderBy(desc(driveAiFeedback.createdAt));
    }),

  // ── Create handoff (escalate to human) ──────────────────────────────────
  createHandoff: protectedProcedure
    .input(z.object({
      analysisUid: z.string().min(1),
      orgId: z.string().min(1),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      const handoffUid = randomUUID();
      await db.insert(driveAiHandoffs).values({
        uid: handoffUid,
        orgId,
        analysisUid: input.analysisUid,
        status: "OPEN",
        notes: input.notes ?? null,
        createdBy: ctx.user.openId,
      });

      return { uid: handoffUid };
    }),

  // ── Update handoff status ───────────────────────────────────────────────
  updateHandoff: protectedProcedure
    .input(z.object({
      handoffUid: z.string().min(1),
      orgId: z.string().min(1),
      status: z.enum(["OPEN", "ASSIGNED", "RESOLVED"]),
      assignedToUserUid: z.string().optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      const updateData: Record<string, unknown> = { status: input.status };
      if (input.assignedToUserUid !== undefined) updateData.assignedToUserUid = input.assignedToUserUid;
      if (input.notes !== undefined) updateData.notes = input.notes;

      await db.update(driveAiHandoffs).set(updateData)
        .where(and(eq(driveAiHandoffs.uid, input.handoffUid), eq(driveAiHandoffs.orgId, orgId)));

      return { success: true };
    }),

  // ── List handoffs for an analysis ───────────────────────────────────────
  listHandoffs: protectedProcedure
    .input(z.object({ analysisUid: z.string().min(1), orgId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const orgId = input.orgId;

      return db.select().from(driveAiHandoffs).where(
        and(eq(driveAiHandoffs.analysisUid, input.analysisUid), eq(driveAiHandoffs.orgId, orgId))
      ).orderBy(desc(driveAiHandoffs.createdAt));
    }),
});
