import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, testEngineerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as execDb from "../db/executions";

export const executionsRouter = router({
  // ── READ — any authenticated user ──
  list: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listExecutions(input.projectId);
    }),

  getByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return execDb.getExecutionByUid(input.uid);
    }),

  // ── CREATE — TEST_ENGINEER+ (launch executions) ──
  create: testEngineerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "execution"))
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

  // ── UPDATE STATUS — TEST_ENGINEER+ (push results) ──
  updateStatus: testEngineerProcedure
    .use(auditMutation("UPDATE_STATUS", "execution"))
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

  // ── DELETE — ORG_ADMIN only ──
  delete: orgAdminProcedure
    .use(auditMutation("DELETE", "execution"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return execDb.deleteExecution(input.uid);
    }),

  // ── Runner Jobs — TEST_ENGINEER+ ──
  listJobs: viewerProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listRunnerJobs(input.executionId);
    }),

  createJob: testEngineerProcedure
    .use(auditMutation("CREATE", "runner_job"))
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

  updateJob: testEngineerProcedure
    .use(auditMutation("UPDATE", "runner_job"))
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

  // ── Artifacts — TEST_ENGINEER+ can add, VIEWER can read ──
  listArtifacts: viewerProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listArtifacts(input.executionId);
    }),

  createArtifact: testEngineerProcedure
    .use(auditMutation("CREATE", "artifact"))
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

  // ── Incidents — TEST_ENGINEER+ can create, VIEWER can read ──
  listIncidents: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listIncidents(input.projectId);
    }),

  listIncidentsByExecution: viewerProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ input }) => {
      return execDb.listIncidentsByExecution(input.executionId);
    }),

  getIncidentByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return execDb.getIncidentByUid(input.uid);
    }),

  createIncident: testEngineerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "incident"))
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

  // ── Analyses — SECURITY_ANALYST+ or QA_MANAGER+ ──
  getAnalysisByIncident: viewerProcedure
    .input(z.object({ incidentId: z.string() }))
    .query(async ({ input }) => {
      return execDb.getAnalysisByIncident(input.incidentId);
    }),

  createAnalysis: testEngineerProcedure
    .use(auditMutation("CREATE", "analysis"))
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
