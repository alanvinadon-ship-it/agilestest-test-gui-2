import { z } from "zod";
import { eq } from "drizzle-orm";
import { router } from "../_core/trpc";
import {
  viewerProcedure, testEngineerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as capturesDb from "../db/captures";
import { paginationInput, paginate, paginateInMemory, dateRangeFilter } from "../pagination";
import { getDb } from "../db";
import { captureJobs, captureSources, captureArtifacts, captureSessions } from "../../drizzle/schema";

// ─── Allowed sort fields ─────────────────────────────────────────────────
const CAPTURE_JOB_SORT_FIELDS = ["createdAt", "status", "startedAt", "completedAt"];
const CAPTURE_SESSION_SORT_FIELDS = ["createdAt", "startedAt", "completedAt"];

export const capturesRouter = router({
  // ── Capture Jobs — SQL-native pagination + filters ──
  listJobs: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({
      projectId: z.string(),
      // Advanced filters
      status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
      captureType: z.enum(["LOGS", "PCAP"]).optional(),
      targetType: z.enum(["K8S", "SSH", "PROBE"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).merge(paginationInput))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      const where: any[] = [eq(captureJobs.projectId, input.projectId)];
      if (input.status) where.push(eq(captureJobs.status, input.status));
      if (input.captureType) where.push(eq(captureJobs.captureType, input.captureType));
      if (input.targetType) where.push(eq(captureJobs.targetType, input.targetType));
      where.push(...dateRangeFilter(captureJobs.createdAt, input.dateFrom, input.dateTo));

      return paginate(
        db.select().from(captureJobs).$dynamic(),
        captureJobs,
        input,
        {
          allowedSortFields: CAPTURE_JOB_SORT_FIELDS,
          defaultSort: { by: "createdAt", dir: "desc" },
          where,
        },
      );
    }),

  getJobByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return capturesDb.getCaptureJobByUid(input.uid);
    }),

  createJob: testEngineerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "capture_job"))
    .input(z.object({
      executionId: z.string(),
      projectId: z.string(),
      captureType: z.enum(["LOGS", "PCAP"]),
      targetType: z.enum(["K8S", "SSH", "PROBE"]),
      incidentId: z.string().optional(),
      triggeredBy: z.string().optional(),
      durationSeconds: z.number().optional(),
      maxSizeMb: z.number().optional(),
      profile: z.string().optional(),
      params: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      return capturesDb.createCaptureJob(input);
    }),

  updateJob: testEngineerProcedure
    .use(auditMutation("UPDATE", "capture_job"))
    .input(z.object({
      uid: z.string(),
      status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
      startedAt: z.coerce.date().optional(),
      completedAt: z.coerce.date().optional(),
      errorMessage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return capturesDb.updateCaptureJob(uid, data);
    }),

  // ── Capture Sources — small volume, keep paginateInMemory ──
  listSources: viewerProcedure
    .input(z.object({ captureId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await capturesDb.listCaptureSources(input.captureId);
      return paginateInMemory(all, input);
    }),

  createSource: testEngineerProcedure
    .use(auditMutation("CREATE", "capture_source"))
    .input(z.object({
      captureId: z.string(),
      namespace: z.string().optional(),
      podSelector: z.string().optional(),
      containerName: z.string().optional(),
      host: z.string().optional(),
      sshPort: z.number().optional(),
      sshUser: z.string().optional(),
      logPaths: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return capturesDb.createCaptureSource(input);
    }),

  deleteSource: orgAdminProcedure
    .use(auditMutation("DELETE", "capture_source"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return capturesDb.deleteCaptureSource(input.uid);
    }),

  // ── Capture Artifacts — small volume, keep paginateInMemory ──
  listArtifacts: viewerProcedure
    .input(z.object({ captureJobId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await capturesDb.listCaptureArtifacts(input.captureJobId);
      return paginateInMemory(all, input);
    }),

  createArtifact: testEngineerProcedure
    .use(auditMutation("CREATE", "capture_artifact"))
    .input(z.object({
      executionId: z.string(),
      type: z.string(),
      name: z.string(),
      captureJobId: z.string().optional(),
      storageUrl: z.string().optional(),
      s3Uri: z.string().optional(),
      contentType: z.string().optional(),
      sizeBytes: z.number().optional(),
      checksum: z.string().optional(),
      downloadUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return capturesDb.createCaptureArtifact(input);
    }),

  // ── Capture Sessions — SQL-native pagination + filters ──
  listSessions: viewerProcedure
    .input(z.object({
      policyId: z.string(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).merge(paginationInput))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      const where: any[] = [eq(captureSessions.policyId, input.policyId)];
      where.push(...dateRangeFilter(captureSessions.createdAt, input.dateFrom, input.dateTo));

      return paginate(
        db.select().from(captureSessions).$dynamic(),
        captureSessions,
        input,
        {
          allowedSortFields: CAPTURE_SESSION_SORT_FIELDS,
          defaultSort: { by: "createdAt", dir: "desc" },
          where,
        },
      );
    }),

  listSessionsByExecution: viewerProcedure
    .input(z.object({ executionId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await capturesDb.listCaptureSessionsByExecution(input.executionId);
      return paginateInMemory(all, input);
    }),

  createSession: testEngineerProcedure
    .use(auditMutation("CREATE", "capture_session"))
    .input(z.object({
      policyId: z.string(),
      executionId: z.string().optional(),
      probeId: z.string().optional(),
      pcapPath: z.string().optional(),
      pcapSize: z.number().optional(),
      packetCount: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return capturesDb.createCaptureSession(input);
    }),
});
