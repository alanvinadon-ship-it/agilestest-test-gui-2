import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as execDb from "../db/executions";

export const executionsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listExecutions(input.projectId);
    }),

  getByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return execDb.getExecutionByUid(input.uid);
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      profileId: z.string(),
      scenarioId: z.string(),
      runnerType: z.string().optional(),
      scriptId: z.string().optional(),
      scriptVersion: z.number().optional(),
      datasetBundleId: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      runnerId: z.string().optional(),
      aiRepairFromExecutionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return execDb.createExecution(input);
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      uid: z.string(),
      status: z.enum(["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"]).optional(),
      startedAt: z.coerce.date().optional(),
      finishedAt: z.coerce.date().optional(),
      durationMs: z.number().optional(),
      artifactsCount: z.number().optional(),
      incidentsCount: z.number().optional(),
      runnerId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return execDb.updateExecution(uid, data);
    }),

  delete: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return execDb.deleteExecution(input.uid);
    }),

  // Runner Jobs
  listJobs: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listRunnerJobs(input.executionId);
    }),

  createJob: protectedProcedure
    .input(z.object({
      executionId: z.string(),
      projectId: z.string(),
      runnerId: z.string().optional(),
      scriptId: z.string().optional(),
      scriptVersion: z.number().optional(),
      downloadUrl: z.string().optional(),
      datasetBundleId: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      artifactUploadPolicy: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return execDb.createRunnerJob(input);
    }),

  updateJob: protectedProcedure
    .input(z.object({
      uid: z.string(),
      status: z.enum(["PENDING", "RUNNING", "DONE", "FAILED"]).optional(),
      runnerId: z.string().optional(),
      startedAt: z.coerce.date().optional(),
      finishedAt: z.coerce.date().optional(),
      metrics: z.record(z.string(), z.unknown()).optional(),
      artifactManifest: z.array(z.record(z.string(), z.unknown())).optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return execDb.updateRunnerJob(uid, data);
    }),

  // Artifacts
  listArtifacts: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listArtifacts(input.executionId);
    }),

  createArtifact: protectedProcedure
    .input(z.object({
      executionId: z.string(),
      type: z.string(),
      filename: z.string(),
      name: z.string().optional(),
      mimeType: z.string().optional(),
      contentType: z.string().optional(),
      sizeBytes: z.number().optional(),
      storagePath: z.string().optional(),
      storageUrl: z.string().optional(),
      s3Uri: z.string().optional(),
      checksum: z.string().optional(),
      captureJobId: z.string().optional(),
      downloadUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return execDb.createArtifact(input);
    }),

  // Incidents
  listIncidents: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listIncidents(input.projectId);
    }),

  listIncidentsByExecution: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listIncidentsByExecution(input.executionId);
    }),

  getIncidentByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return execDb.getIncidentByUid(input.uid);
    }),

  createIncident: protectedProcedure
    .input(z.object({
      executionId: z.string(),
      projectId: z.string(),
      title: z.string(),
      description: z.string().optional(),
      severity: z.enum(["CRITICAL", "MAJOR", "MINOR", "INFO"]),
      stepName: z.string().optional(),
      expectedResult: z.string().optional(),
      actualResult: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return execDb.createIncident(input);
    }),

  // Analyses
  getAnalysisByIncident: protectedProcedure
    .input(z.object({ incidentId: z.string() }))
    .query(async ({ input }) => {
      return execDb.getAnalysisByIncident(input.incidentId);
    }),

  createAnalysis: protectedProcedure
    .input(z.object({
      incidentId: z.string(),
      observation: z.string().optional(),
      hypotheses: z.array(z.record(z.string(), z.unknown())).optional(),
      rootCause: z.string().optional(),
      rootCauseJustification: z.string().optional(),
      recommendedSolution: z.string().optional(),
      confidenceScore: z.number().optional(),
      pipelinePhases: z.array(z.record(z.string(), z.unknown())).optional(),
    }))
    .mutation(async ({ input }) => {
      return execDb.createAnalysis(input);
    }),
});
