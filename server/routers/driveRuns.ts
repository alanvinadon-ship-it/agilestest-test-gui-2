import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { randomUUID } from "crypto";
import { writeAuditLog } from "../lib/auditLog";

// ─── Zod schemas ──────────────────────────────────────────────────────────

const driveRunStatusEnum = z.enum(["DRAFT", "RUNNING", "UPLOADING", "COMPLETED", "FAILED", "CANCELED"]);
const eventTypeEnum = z.enum(["NOTE", "PHOTO", "MARKER", "ERROR", "CUSTOM"]);
const eventSeverityEnum = z.enum(["INFO", "WARN", "ERROR"]);
const locationSourceEnum = z.enum(["GPS", "MANUAL"]);

// ─── Drive Runs Router ────────────────────────────────────────────────────

export const driveRunsRouter = router({
  /** List runs with cursor pagination */
  list: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        projectUid: z.string().optional(),
        campaignUid: z.string().optional(),
        status: driveRunStatusEnum.optional(),
        search: z.string().max(255).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.listDriveRunsCursor({
        orgId: input.orgId,
        projectUid: input.projectUid,
        campaignUid: input.campaignUid,
        status: input.status,
        search: input.search?.trim() || undefined,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  /** Get a single run by uid */
  get: protectedProcedure
    .input(z.object({ runUid: z.string() }))
    .query(async ({ input }) => {
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });
      return run;
    }),

  /** Create a new drive run (mobile starts a field session) */
  create: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        projectUid: z.string(),
        name: z.string().max(255).optional(),
        campaignUid: z.string().optional(),
        routeUid: z.string().optional(),
        deviceUid: z.string().optional(),
        probeUid: z.string().optional(),
        metaJson: z.any().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const uid = randomUUID();
      await db.createDriveRun({
        uid,
        name: input.name?.trim() || null,
        orgId: input.orgId,
        projectUid: input.projectUid,
        campaignUid: input.campaignUid ?? null,
        routeUid: input.routeUid ?? null,
        deviceUid: input.deviceUid ?? null,
        probeUid: input.probeUid ?? null,
        status: "DRAFT",
        createdBy: ctx.user.openId,
        metaJson: input.metaJson ?? null,
      });

      await writeAuditLog({
        userId: ctx.user.openId,
        action: "DRIVE_RUN_CREATED",
        entity: "drive_run",
        entityId: uid,
        details: { projectUid: input.projectUid, campaignUid: input.campaignUid },
      });

      return { success: true, runUid: uid };
    }),

  /** Start a run (transition DRAFT → RUNNING) */
  start: protectedProcedure
    .input(z.object({ runUid: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });
      if (run.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Impossible de démarrer un run en statut ${run.status}` });
      }
      await db.updateDriveRun(input.runUid, { status: "RUNNING", startedAt: new Date() });
      await writeAuditLog({
        userId: ctx.user.openId,
        action: "DRIVE_RUN_STARTED",
        entity: "drive_run",
        entityId: input.runUid,
      });
      return { success: true };
    }),

  /** Stop a run (transition RUNNING → UPLOADING or COMPLETED) */
  stop: protectedProcedure
    .input(z.object({ runUid: z.string(), finalStatus: z.enum(["UPLOADING", "COMPLETED"]).default("COMPLETED") }))
    .mutation(async ({ input, ctx }) => {
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });
      if (run.status !== "RUNNING" && run.status !== "UPLOADING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Impossible d'arrêter un run en statut ${run.status}` });
      }
      await db.updateDriveRun(input.runUid, { status: input.finalStatus, endedAt: new Date() });
      await writeAuditLog({
        userId: ctx.user.openId,
        action: "DRIVE_RUN_STOPPED",
        entity: "drive_run",
        entityId: input.runUid,
        details: { finalStatus: input.finalStatus },
      });
      return { success: true };
    }),

  /** Update run status (generic) */
  updateStatus: protectedProcedure
    .input(z.object({ runUid: z.string(), status: driveRunStatusEnum }))
    .mutation(async ({ input, ctx }) => {
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });
      const updates: Record<string, unknown> = { status: input.status };
      if (input.status === "RUNNING" && !run.startedAt) updates.startedAt = new Date();
      if (["COMPLETED", "FAILED", "CANCELED"].includes(input.status) && !run.endedAt) updates.endedAt = new Date();
      await db.updateDriveRun(input.runUid, updates as any);
      await writeAuditLog({
        userId: ctx.user.openId,
        action: "DRIVE_RUN_STATUS_CHANGED",
        entity: "drive_run",
        entityId: input.runUid,
        details: { from: run.status, to: input.status },
      });
      return { success: true };
    }),

  /** Rename a run */
  rename: protectedProcedure
    .input(z.object({ runUid: z.string(), name: z.string().max(255) }))
    .mutation(async ({ input, ctx }) => {
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });
      await db.updateDriveRun(input.runUid, { name: input.name.trim() || null });
      await writeAuditLog({
        userId: ctx.user.openId,
        action: "DRIVE_RUN_RENAMED",
        entity: "drive_run",
        entityId: input.runUid,
        details: { name: input.name.trim() },
      });
      return { success: true };
    }),

  /** Delete a run */
  delete: protectedProcedure
    .input(z.object({ runUid: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });
      // Delete associated data first
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        const { driveLocationSamples, driveRunEvents } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.delete(driveLocationSamples).where(eq(driveLocationSamples.runUid, input.runUid));
        await dbConn.delete(driveRunEvents).where(eq(driveRunEvents.runUid, input.runUid));
        const { driveRuns } = await import("../../drizzle/schema");
        await dbConn.delete(driveRuns).where(eq(driveRuns.uid, input.runUid));
      }
      await writeAuditLog({
        userId: ctx.user.openId,
        action: "DRIVE_RUN_DELETED",
        entity: "drive_run",
        entityId: input.runUid,
      });
      return { success: true };
    }),
});

// ─── Drive Telemetry Router (GPS location samples) ────────────────────────

export const driveTelemetryRouter = router({
  /** Bulk push GPS location samples from mobile */
  pushSamples: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        runUid: z.string(),
        samples: z.array(
          z.object({
            ts: z.string().or(z.date()),
            lat: z.number().min(-90).max(90),
            lon: z.number().min(-180).max(180),
            speedMps: z.number().optional(),
            headingDeg: z.number().optional(),
            accuracyM: z.number().optional(),
            altitudeM: z.number().optional(),
            source: locationSourceEnum.default("GPS"),
          })
        ).min(1).max(500),
      })
    )
    .mutation(async ({ input }) => {
      // Verify run exists
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });

      const samples = input.samples.map((s) => ({
        uid: randomUUID(),
        orgId: input.orgId,
        runUid: input.runUid,
        ts: new Date(s.ts),
        lat: s.lat,
        lon: s.lon,
        speedMps: s.speedMps ?? null,
        headingDeg: s.headingDeg ?? null,
        accuracyM: s.accuracyM ?? null,
        altitudeM: s.altitudeM ?? null,
        source: s.source,
      }));

      await db.bulkInsertLocationSamples(samples);
      return { success: true, inserted: samples.length };
    }),

  /** Get GPS track for a run */
  getTrack: protectedProcedure
    .input(z.object({ runUid: z.string(), orgId: z.string() }))
    .query(async ({ input }) => {
      return db.getLocationSamplesByRun(input.runUid, input.orgId);
    }),
});

// ─── Drive Run Events Router (field notes, markers) ──────────────────────

export const driveRunEventsRouter = router({
  /** List events for a run */
  list: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        runUid: z.string(),
        limit: z.number().min(1).max(200).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.listDriveRunEventsCursor({
        orgId: input.orgId,
        runUid: input.runUid,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  /** Create a field event (note, photo marker, error, etc.) */
  create: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        runUid: z.string(),
        ts: z.string().or(z.date()),
        type: eventTypeEnum,
        severity: eventSeverityEnum.default("INFO"),
        message: z.string().optional(),
        dataJson: z.any().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Verify run exists
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });

      const uid = randomUUID();
      await db.createDriveRunEvent({
        uid,
        orgId: input.orgId,
        runUid: input.runUid,
        ts: new Date(input.ts),
        type: input.type,
        severity: input.severity,
        message: input.message ?? null,
        dataJson: input.dataJson ?? null,
      });

      return { success: true, eventUid: uid };
    }),
});

// ─── Drive Uploads Router (file uploads for a run) ───────────────────────

export const driveUploadsRouter = router({
  /** Upload a trace/log file for a run → S3 + artifacts table */
  uploadFile: protectedProcedure
    .input(
      z.object({
        runUid: z.string(),
        orgId: z.string(),
        projectUid: z.string(),
        filename: z.string().min(1),
        mimeType: z.string().default("application/octet-stream"),
        base64: z.string().min(1),
        fileType: z.enum(["PCAP", "LOG", "DIAG", "SCREENSHOT", "CSV", "OTHER"]).default("OTHER"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify run exists
      const run = await db.getDriveRunByUid(input.runUid);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run introuvable" });

      const buffer = Buffer.from(input.base64, "base64");
      const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
      if (buffer.length > MAX_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Le fichier ne doit pas dépasser 50 Mo." });
      }

      // Upload to S3
      const suffix = randomUUID().slice(0, 8);
      const key = `drive-runs/${input.runUid}/${input.fileType.toLowerCase()}/${input.filename}-${suffix}`;
      const { storagePut } = await import("../storage");
      const { url } = await storagePut(key, buffer, input.mimeType);

      // Insert into artifacts table
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (dbConn) {
        const { artifacts } = await import("../../drizzle/schema");
        const artifactUid = randomUUID();
        await dbConn.insert(artifacts).values({
          uid: artifactUid,
          executionId: input.runUid, // reuse executionId for run association
          type: `DRIVE_${input.fileType}`,
          filename: input.filename,
          name: input.filename,
          mimeType: input.mimeType,
          sizeBytes: buffer.length,
          storagePath: key,
          storageUrl: url,
          s3Uri: `s3://${key}`,
        });

        await writeAuditLog({
          userId: ctx.user.openId,
          action: "DRIVE_FILE_UPLOADED",
          entity: "artifact",
          entityId: artifactUid,
          details: { runUid: input.runUid, filename: input.filename, fileType: input.fileType, sizeBytes: buffer.length },
        });

        // Auto-trigger GPS parsing for supported file types
        const gpsExtensions = [".gpx", ".kml", ".csv", ".tsv"];
        const ext = input.filename.toLowerCase().split(".").pop() ?? "";
        let parseJobId: number | null = null;
        if (gpsExtensions.some((e) => input.filename.toLowerCase().endsWith(e)) || input.fileType === "CSV") {
          try {
            const { enqueueJob } = await import("../jobQueue");
            const job = await enqueueJob("parseGpsFile", {
              artifactUid,
              runUid: input.runUid,
              orgId: input.orgId,
              filename: input.filename,
            });
            parseJobId = job ?? null;
            console.log(`[DriveUpload] Auto-enqueued parseGpsFile job for ${input.filename}`);
          } catch (err) {
            console.warn(`[DriveUpload] Failed to enqueue parseGpsFile:`, err);
          }
        }

        return { success: true, artifactUid, url, sizeBytes: buffer.length, parseJobId };
      }

      return { success: true, artifactUid: null, url, sizeBytes: buffer.length };
    }),

  /** List uploaded files for a run */
  listFiles: protectedProcedure
    .input(z.object({ runUid: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (!dbConn) return [];
      const { artifacts } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return dbConn
        .select()
        .from(artifacts)
        .where(eq(artifacts.executionId, input.runUid))
        .orderBy(artifacts.createdAt);
    }),

  /** Manually trigger GPS parsing for an uploaded file */
  triggerParse: protectedProcedure
    .input(
      z.object({
        artifactUid: z.string(),
        runUid: z.string(),
        orgId: z.string(),
        filename: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { enqueueJob } = await import("../jobQueue");
      const job = await enqueueJob("parseGpsFile", {
        artifactUid: input.artifactUid,
        runUid: input.runUid,
        orgId: input.orgId,
        filename: input.filename,
      });
      return { success: true, jobId: job ?? null };
    }),

  /** Get parse job status for an artifact */
  parseStatus: protectedProcedure
    .input(z.object({ artifactUid: z.string() }))
    .query(async ({ input }) => {
      const { getJobsByArtifactUid } = await import("../jobQueue");
      const jobs = await getJobsByArtifactUid(input.artifactUid);
      if (jobs.length === 0) return { status: "NONE" as const, jobs: [] };
      const latest = jobs[jobs.length - 1];
      return {
        status: latest.status as "PENDING" | "RUNNING" | "DONE" | "FAILED",
        jobs: jobs.map((j) => ({
          id: j.id,
          status: j.status,
          result: j.result,
          error: j.error,
          createdAt: j.createdAt,
          completedAt: j.completedAt,
        })),
      };
    }),
});
