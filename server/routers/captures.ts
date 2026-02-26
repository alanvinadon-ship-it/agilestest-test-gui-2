import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as capturesDb from "../db/captures";

export const capturesRouter = router({
  // Capture Jobs
  listJobs: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return capturesDb.listCaptureJobs(input.projectId);
    }),

  getJobByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return capturesDb.getCaptureJobByUid(input.uid);
    }),

  createJob: protectedProcedure
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

  updateJob: protectedProcedure
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

  // Capture Sources
  listSources: protectedProcedure
    .input(z.object({ captureId: z.string() }))
    .query(async ({ input }) => {
      return capturesDb.listCaptureSources(input.captureId);
    }),

  createSource: protectedProcedure
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

  deleteSource: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return capturesDb.deleteCaptureSource(input.uid);
    }),

  // Capture Artifacts
  listArtifacts: protectedProcedure
    .input(z.object({ captureJobId: z.string() }))
    .query(async ({ input }) => {
      return capturesDb.listCaptureArtifacts(input.captureJobId);
    }),

  createArtifact: protectedProcedure
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

  // Capture Sessions
  listSessions: protectedProcedure
    .input(z.object({ policyId: z.string() }))
    .query(async ({ input }) => {
      return capturesDb.listCaptureSessions(input.policyId);
    }),

  listSessionsByExecution: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return capturesDb.listCaptureSessionsByExecution(input.executionId);
    }),

  createSession: protectedProcedure
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
