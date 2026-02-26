import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { router } from "../_core/trpc";
import {
  viewerProcedure, testEngineerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as execDb from "../db/executions";
import { paginationInput, paginate, paginateInMemory, dateRangeFilter } from "../pagination";
import { getDb } from "../db";
import { executions, incidents } from "../../drizzle/schema";

// ─── Allowed sort fields (whitelist — prevents SQL injection) ────────────
const EXEC_SORT_FIELDS = ["createdAt", "status", "startedAt", "finishedAt", "durationMs"];
const INCIDENT_SORT_FIELDS = ["detectedAt", "severity", "title"];

export const executionsRouter = router({
  // ── READ — paginated list with SQL-native pagination + filters ──
  list: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({
      projectId: z.string(),
      // Advanced filters
      status: z.enum(["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
    }).merge(paginationInput))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      // Build WHERE clauses
      const where: any[] = [eq(executions.projectId, input.projectId)];
      if (input.status) where.push(eq(executions.status, input.status));
      if (input.targetEnv) where.push(eq(executions.targetEnv, input.targetEnv));
      where.push(...dateRangeFilter(executions.createdAt, input.dateFrom, input.dateTo));

      return paginate(
        db.select().from(executions).$dynamic(),
        executions,
        input,
        {
          allowedSortFields: EXEC_SORT_FIELDS,
          defaultSort: { by: "createdAt", dir: "desc" },
          where,
        },
      );
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

  // ── Runner Jobs — paginated (small volume, keep paginateInMemory) ──
  listJobs: viewerProcedure
    .input(z.object({ executionId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await execDb.listRunnerJobs(input.executionId);
      return paginateInMemory(all, input);
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

  // ── Artifacts — paginated (small volume, keep paginateInMemory) ──
  listArtifacts: viewerProcedure
    .input(z.object({ executionId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await execDb.listArtifacts(input.executionId);
      return paginateInMemory(all, input);
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

  // ── Incidents — SQL-native pagination + filters ──
  listIncidents: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({
      projectId: z.string(),
      severity: z.enum(["CRITICAL", "MAJOR", "MINOR", "INFO"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).merge(paginationInput))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      const where: any[] = [eq(incidents.projectId, input.projectId)];
      if (input.severity) where.push(eq(incidents.severity, input.severity));
      where.push(...dateRangeFilter(incidents.detectedAt, input.dateFrom, input.dateTo));

      return paginate(
        db.select().from(incidents).$dynamic(),
        incidents,
        input,
        {
          allowedSortFields: INCIDENT_SORT_FIELDS,
          defaultSort: { by: "detectedAt", dir: "desc" },
          where,
        },
      );
    }),

  listIncidentsByExecution: viewerProcedure
    .input(z.object({ executionId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await execDb.listIncidentsByExecution(input.executionId);
      return paginateInMemory(all, input);
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

  // ── Analyses ──
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
