import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  driveRoutes,
  driveDevices,
  driveProbeLinks,
  driveJobs,
  probes,
} from "../../drizzle/schema";
import { eq, and, desc, lt, like, sql, SQL } from "drizzle-orm";
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

// ─── Drive Routes Router ───────────────────────────────────────────────────

export const driveRoutesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
        q: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions: SQL[] = [
        eq(driveRoutes.campaignId, input.campaignId),
      ];
      if (input.q) conditions.push(like(driveRoutes.name, `%${input.q}%`));
      if (input.cursor) conditions.push(lt(driveRoutes.id, input.cursor));

      const items = await db
        .select()
        .from(driveRoutes)
        .where(and(...conditions))
        .orderBy(desc(driveRoutes.id))
        .limit(input.limit + 1);

      let nextCursor: number | null = null;
      if (items.length > input.limit) {
        const last = items.pop()!;
        nextCursor = last.id;
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(driveRoutes)
        .where(eq(driveRoutes.campaignId, input.campaignId));

      return { items, total: countResult?.count ?? 0, nextCursor };
    }),

  get: protectedProcedure
    .input(z.object({ routeId: z.string() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [route] = await db
        .select()
        .from(driveRoutes)
        .where(eq(driveRoutes.uid, input.routeId))
        .limit(1);
      if (!route)
        throw new TRPCError({ code: "NOT_FOUND", message: "Route not found" });
      return route;
    }),

  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().min(1),
        routeGeojson: z.any().optional(),
        checkpointsGeojson: z.any().optional(),
        expectedDurationMin: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const uid = randomUUID();
      await db.insert(driveRoutes).values({
        uid,
        campaignId: input.campaignId,
        name: input.name,
        routeGeojson: input.routeGeojson ?? null,
        checkpointsGeojson: input.checkpointsGeojson ?? null,
        expectedDurationMin: input.expectedDurationMin ?? 30,
      });
      return { success: true, routeId: uid };
    }),

  update: protectedProcedure
    .input(
      z.object({
        routeId: z.string(),
        name: z.string().optional(),
        routeGeojson: z.any().optional(),
        checkpointsGeojson: z.any().optional(),
        expectedDurationMin: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const u: Record<string, unknown> = {};
      if (input.name !== undefined) u.name = input.name;
      if (input.routeGeojson !== undefined) u.routeGeojson = input.routeGeojson;
      if (input.checkpointsGeojson !== undefined)
        u.checkpointsGeojson = input.checkpointsGeojson;
      if (input.expectedDurationMin !== undefined)
        u.expectedDurationMin = input.expectedDurationMin;
      if (Object.keys(u).length) {
        await db
          .update(driveRoutes)
          .set(u)
          .where(eq(driveRoutes.uid, input.routeId));
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ routeId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db.delete(driveRoutes).where(eq(driveRoutes.uid, input.routeId));
      return { success: true };
    }),
});

// ─── Drive Devices Router ──────────────────────────────────────────────────

const deviceTypeEnum = z.enum(["ANDROID", "MODEM", "CPE", "LAPTOP"]);

export const driveDevicesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
        q: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions: SQL[] = [
        eq(driveDevices.campaignId, input.campaignId),
      ];
      if (input.q) conditions.push(like(driveDevices.name, `%${input.q}%`));
      if (input.cursor) conditions.push(lt(driveDevices.id, input.cursor));

      const items = await db
        .select()
        .from(driveDevices)
        .where(and(...conditions))
        .orderBy(desc(driveDevices.id))
        .limit(input.limit + 1);

      let nextCursor: number | null = null;
      if (items.length > input.limit) {
        const last = items.pop()!;
        nextCursor = last.id;
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(driveDevices)
        .where(eq(driveDevices.campaignId, input.campaignId));

      return { items, total: countResult?.count ?? 0, nextCursor };
    }),

  get: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [device] = await db
        .select()
        .from(driveDevices)
        .where(eq(driveDevices.uid, input.deviceId))
        .limit(1);
      if (!device)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
        });
      return device;
    }),

  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().optional(),
        deviceType: deviceTypeEnum.default("ANDROID"),
        model: z.string().optional(),
        osVersion: z.string().optional(),
        imei: z.string().optional(),
        phoneNumber: z.string().optional(),
        diagCapable: z.boolean().default(false),
        toolsEnabled: z.array(z.string()).optional(),
        notes: z.string().optional(),
        metaJson: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const uid = randomUUID();
      await db.insert(driveDevices).values({
        uid,
        campaignId: input.campaignId,
        name: input.name ?? null,
        deviceType: input.deviceType,
        model: input.model ?? null,
        osVersion: input.osVersion ?? null,
        imei: input.imei ?? null,
        phoneNumber: input.phoneNumber ?? null,
        diagCapable: input.diagCapable,
        toolsEnabled: input.toolsEnabled ?? null,
        notes: input.notes ?? null,
        metaJson: input.metaJson ?? null,
      });
      return { success: true, deviceId: uid };
    }),

  update: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        name: z.string().optional(),
        deviceType: deviceTypeEnum.optional(),
        model: z.string().optional(),
        osVersion: z.string().optional(),
        imei: z.string().optional(),
        phoneNumber: z.string().optional(),
        diagCapable: z.boolean().optional(),
        toolsEnabled: z.array(z.string()).optional(),
        notes: z.string().optional(),
        metaJson: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const u: Record<string, unknown> = {};
      if (input.name !== undefined) u.name = input.name;
      if (input.deviceType !== undefined) u.deviceType = input.deviceType;
      if (input.model !== undefined) u.model = input.model;
      if (input.osVersion !== undefined) u.osVersion = input.osVersion;
      if (input.imei !== undefined) u.imei = input.imei;
      if (input.phoneNumber !== undefined) u.phoneNumber = input.phoneNumber;
      if (input.diagCapable !== undefined) u.diagCapable = input.diagCapable;
      if (input.toolsEnabled !== undefined)
        u.toolsEnabled = input.toolsEnabled;
      if (input.notes !== undefined) u.notes = input.notes;
      if (input.metaJson !== undefined) u.metaJson = input.metaJson;
      if (Object.keys(u).length) {
        await db
          .update(driveDevices)
          .set(u)
          .where(eq(driveDevices.uid, input.deviceId));
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .delete(driveDevices)
        .where(eq(driveDevices.uid, input.deviceId));
      return { success: true };
    }),
});

// ─── Drive Probe Links Router ──────────────────────────────────────────────

const probeLinkRoleEnum = z.enum(["COLLECTOR", "MONITOR", "SPAN_TAP"]);

export const driveProbeLinksRouter = router({
  list: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const links = await db
        .select({
          id: driveProbeLinks.id,
          uid: driveProbeLinks.uid,
          campaignId: driveProbeLinks.campaignId,
          probeId: driveProbeLinks.probeId,
          role: driveProbeLinks.role,
          createdAt: driveProbeLinks.createdAt,
          probeName: probes.site,
          probeType: probes.probeType,
          probeStatus: probes.status,
        })
        .from(driveProbeLinks)
        .leftJoin(probes, eq(driveProbeLinks.probeId, probes.id))
        .where(eq(driveProbeLinks.campaignId, input.campaignId))
        .orderBy(desc(driveProbeLinks.id));
      return { items: links };
    }),

  attach: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        probeId: z.number(),
        role: probeLinkRoleEnum.default("COLLECTOR"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const [existing] = await db
        .select()
        .from(driveProbeLinks)
        .where(
          and(
            eq(driveProbeLinks.campaignId, input.campaignId),
            eq(driveProbeLinks.probeId, input.probeId)
          )
        )
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Probe already linked to this campaign",
        });
      const uid = randomUUID();
      await db.insert(driveProbeLinks).values({
        uid,
        campaignId: input.campaignId,
        probeId: input.probeId,
        role: input.role,
      });
      return { success: true, linkId: uid };
    }),

  detach: protectedProcedure
    .input(z.object({ linkId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .delete(driveProbeLinks)
        .where(eq(driveProbeLinks.uid, input.linkId));
      return { success: true };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        linkId: z.string(),
        role: probeLinkRoleEnum,
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db
        .update(driveProbeLinks)
        .set({ role: input.role })
        .where(eq(driveProbeLinks.uid, input.linkId));
      return { success: true };
    }),
});

// ─── Drive Jobs Router ─────────────────────────────────────────────────────

const jobStatusEnum = z.enum(["PENDING", "RUNNING", "DONE", "FAILED"]);
const targetEnvEnum = z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]);

export const driveJobsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
        status: jobStatusEnum.optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const conditions: SQL[] = [
        eq(driveJobs.campaignId, input.campaignId),
      ];
      if (input.status) conditions.push(eq(driveJobs.status, input.status));
      if (input.cursor) conditions.push(lt(driveJobs.id, input.cursor));

      const items = await db
        .select()
        .from(driveJobs)
        .where(and(...conditions))
        .orderBy(desc(driveJobs.id))
        .limit(input.limit + 1);

      let nextCursor: number | null = null;
      if (items.length > input.limit) {
        const last = items.pop()!;
        nextCursor = last.id;
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(driveJobs)
        .where(eq(driveJobs.campaignId, input.campaignId));

      return { items, total: countResult?.count ?? 0, nextCursor };
    }),

  get: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const db = await dbOrThrow();
      const [job] = await db
        .select()
        .from(driveJobs)
        .where(eq(driveJobs.uid, input.jobId))
        .limit(1);
      if (!job)
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return job;
    }),

  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        routeId: z.string(),
        deviceId: z.string(),
        targetEnv: targetEnvEnum.optional(),
        runnerId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const uid = randomUUID();
      await db.insert(driveJobs).values({
        uid,
        campaignId: input.campaignId,
        routeId: input.routeId,
        deviceId: input.deviceId,
        targetEnv: input.targetEnv ?? null,
        runnerId: input.runnerId ?? null,
        status: "PENDING",
        progressPct: 0,
      });
      return { success: true, jobId: uid };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        status: jobStatusEnum,
        progressPct: z.number().min(0).max(100).optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const u: Record<string, unknown> = { status: input.status };
      if (input.progressPct !== undefined) u.progressPct = input.progressPct;
      if (input.errorMessage !== undefined)
        u.errorMessage = input.errorMessage;
      if (input.status === "RUNNING") u.startedAt = new Date();
      if (input.status === "DONE" || input.status === "FAILED")
        u.finishedAt = new Date();
      await db
        .update(driveJobs)
        .set(u)
        .where(eq(driveJobs.uid, input.jobId));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db.delete(driveJobs).where(eq(driveJobs.uid, input.jobId));
      return { success: true };
    }),
});
