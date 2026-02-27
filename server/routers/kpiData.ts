/**
 * kpiData router — KPI Samples + Drive Run Summaries
 * Provides read-only list/get + bulk insert for KPI samples,
 * and CRUD for drive run summaries.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, lt, sql, SQL } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { kpiSamples, driveRunSummaries } from "../../drizzle/schema";
import { randomUUID } from "crypto";

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

// ─── KPI Samples Router ─────────────────────────────────────────────────────

export const kpiSamplesRouter = router({
  /** List samples with cursor pagination, filterable by job/campaign/kpiName */
  list: protectedProcedure
    .input(
      z.object({
        driveJobId: z.string().optional(),
        campaignId: z.string().optional(),
        kpiName: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(500).default(100),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions: SQL[] = [];

      if (input.driveJobId) conditions.push(eq(kpiSamples.driveJobId, input.driveJobId));
      if (input.campaignId) conditions.push(eq(kpiSamples.campaignId, input.campaignId));
      if (input.kpiName) conditions.push(eq(kpiSamples.kpiName, input.kpiName));
      if (input.cursor) conditions.push(lt(kpiSamples.uid, input.cursor));

      const rows = await db
        .select()
        .from(kpiSamples)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(kpiSamples.uid))
        .limit(input.pageSize + 1);

      const hasMore = rows.length > input.pageSize;
      const data = hasMore ? rows.slice(0, input.pageSize) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.uid : undefined;

      return { data, hasMore, nextCursor };
    }),

  /** List ALL samples for a given job (no pagination, for analysis) */
  listAll: protectedProcedure
    .input(z.object({ driveJobId: z.string() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const rows = await db
        .select()
        .from(kpiSamples)
        .where(eq(kpiSamples.driveJobId, input.driveJobId))
        .orderBy(kpiSamples.timestamp);
      return rows;
    }),

  /** Bulk insert samples */
  bulkInsert: protectedProcedure
    .input(
      z.object({
        samples: z.array(
          z.object({
            driveJobId: z.string(),
            campaignId: z.string(),
            routeId: z.string(),
            timestamp: z.string(),
            lat: z.number(),
            lon: z.number(),
            kpiName: z.string(),
            value: z.number(),
            unit: z.string().default(""),
            cellId: z.string().optional(),
            technology: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      if (input.samples.length === 0) return { inserted: 0 };

      const rows = input.samples.map((s) => ({
        uid: randomUUID(),
        driveJobId: s.driveJobId,
        campaignId: s.campaignId,
        routeId: s.routeId,
        timestamp: new Date(s.timestamp),
        lat: s.lat,
        lon: s.lon,
        kpiName: s.kpiName,
        value: s.value,
        unit: s.unit,
        cellId: s.cellId || null,
        technology: s.technology || null,
      }));

      // Batch insert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        await db.insert(kpiSamples).values(rows.slice(i, i + chunkSize));
      }

      return { inserted: rows.length };
    }),

  /** Delete all samples for a job */
  deleteByJob: protectedProcedure
    .input(z.object({ driveJobId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .delete(kpiSamples)
        .where(eq(kpiSamples.driveJobId, input.driveJobId));
      return { success: true };
    }),
});

// ─── Drive Run Summaries Router ─────────────────────────────────────────────

export const driveRunSummariesRouter = router({
  /** List summaries for a campaign */
  list: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions: SQL[] = [];

      if (input.campaignId) conditions.push(eq(driveRunSummaries.campaignId, input.campaignId));
      if (input.cursor) conditions.push(lt(driveRunSummaries.id, Number(input.cursor)));

      const rows = await db
        .select()
        .from(driveRunSummaries)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(driveRunSummaries.id))
        .limit(input.pageSize + 1);

      const hasMore = rows.length > input.pageSize;
      const data = hasMore ? rows.slice(0, input.pageSize) : rows;
      const nextCursor = hasMore ? String(data[data.length - 1]?.id) : undefined;

      return { data, hasMore, nextCursor };
    }),

  /** Get summary by job ID */
  get: protectedProcedure
    .input(z.object({ driveJobId: z.string() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [row] = await db
        .select()
        .from(driveRunSummaries)
        .where(eq(driveRunSummaries.driveJobId, input.driveJobId))
        .limit(1);
      return row || null;
    }),

  /** Create or update a run summary */
  upsert: protectedProcedure
    .input(
      z.object({
        driveJobId: z.string(),
        campaignId: z.string(),
        totalSamples: z.number().default(0),
        durationSec: z.number().default(0),
        distanceKm: z.number().default(0),
        kpiAverages: z.record(z.string(), z.number()).optional(),
        kpiMin: z.record(z.string(), z.number()).optional(),
        kpiMax: z.record(z.string(), z.number()).optional(),
        thresholdViolations: z.any().optional(),
        overallPass: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      // Check if exists
      const [existing] = await db
        .select()
        .from(driveRunSummaries)
        .where(eq(driveRunSummaries.driveJobId, input.driveJobId))
        .limit(1);

      if (existing) {
        await db
          .update(driveRunSummaries)
          .set({
            totalSamples: input.totalSamples,
            durationSec: input.durationSec,
            distanceKm: input.distanceKm,
            kpiAverages: input.kpiAverages || null,
            kpiMin: input.kpiMin || null,
            kpiMax: input.kpiMax || null,
            thresholdViolations: input.thresholdViolations || null,
            overallPass: input.overallPass,
          })
          .where(eq(driveRunSummaries.id, existing.id));
        return { uid: String(existing.id), driveJobId: input.driveJobId };
      }

      await db.insert(driveRunSummaries).values({
        driveJobId: input.driveJobId,
        campaignId: input.campaignId,
        totalSamples: input.totalSamples,
        durationSec: input.durationSec,
        distanceKm: input.distanceKm,
        kpiAverages: input.kpiAverages || null,
        kpiMin: input.kpiMin || null,
        kpiMax: input.kpiMax || null,
        thresholdViolations: input.thresholdViolations || null,
        overallPass: input.overallPass,
      });

      const [inserted] = await db.select({ id: driveRunSummaries.id }).from(driveRunSummaries).where(eq(driveRunSummaries.driveJobId, input.driveJobId)).limit(1);
      return { uid: String(inserted?.id ?? 0), driveJobId: input.driveJobId };
    }),

  /** Delete summary by job ID */
  delete: protectedProcedure
    .input(z.object({ driveJobId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .delete(driveRunSummaries)
        .where(eq(driveRunSummaries.driveJobId, input.driveJobId));
      return { success: true };
    }),
});
