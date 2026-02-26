import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, testEngineerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as driveDb from "../db/drivetest";
import { paginationInput, paginateInMemory } from "../pagination";

export const drivetestRouter = router({
  // ── Campaigns — paginated ──
  listCampaigns: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await driveDb.listCampaigns(input.projectId);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  getCampaign: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(({ input }) => driveDb.getCampaignByUid(input.uid)),

  createCampaign: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "drive_campaign"))
    .input(z.object({
      projectId: z.string(), name: z.string().min(1), description: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      networkType: z.string().optional(), area: z.string().optional(),
      startDate: z.string().optional(), endDate: z.string().optional(), createdBy: z.string().optional(),
    }))
    .mutation(({ input }) => driveDb.createCampaign(input)),

  updateCampaign: qaManagerProcedure
    .use(auditMutation("UPDATE", "drive_campaign"))
    .input(z.object({
      uid: z.string(), name: z.string().optional(), description: z.string().optional(),
      status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      networkType: z.string().optional(), area: z.string().optional(),
      startDate: z.string().optional(), endDate: z.string().optional(),
    }))
    .mutation(({ input }) => { const { uid, ...d } = input; return driveDb.updateCampaign(uid, d); }),

  deleteCampaign: orgAdminProcedure
    .use(auditMutation("DELETE", "drive_campaign"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteCampaign(input.uid)),

  // ── Routes — paginated ──
  listRoutes: viewerProcedure
    .input(z.object({ campaignId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await driveDb.listRoutes(input.campaignId);
      return paginateInMemory(all, input);
    }),

  createRoute: qaManagerProcedure
    .use(auditMutation("CREATE", "drive_route"))
    .input(z.object({
      campaignId: z.string(), name: z.string().min(1),
      routeGeojson: z.unknown().optional(), checkpointsGeojson: z.unknown().optional(),
      expectedDurationMin: z.number().optional(),
    }))
    .mutation(({ input }) => driveDb.createRoute(input)),

  deleteRoute: orgAdminProcedure
    .use(auditMutation("DELETE", "drive_route"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteRoute(input.uid)),

  // ── Devices — paginated ──
  listDevices: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await driveDb.listDevices(input.projectId);
      return paginateInMemory(all, input);
    }),

  createDevice: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "drive_device"))
    .input(z.object({
      projectId: z.string(), type: z.string(), model: z.string(),
      osVersion: z.string().optional(), diagCapable: z.boolean().optional(),
      toolsEnabled: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => driveDb.createDevice(input)),

  deleteDevice: orgAdminProcedure
    .use(auditMutation("DELETE", "drive_device"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteDevice(input.uid)),

  // ── Probe Configs — paginated ──
  listProbeConfigs: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await driveDb.listProbeConfigs(input.projectId);
      return paginateInMemory(all, input);
    }),

  createProbeConfig: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "drive_probe_config"))
    .input(z.object({
      projectId: z.string(), name: z.string().min(1),
      location: z.object({ lat: z.number(), lon: z.number(), label: z.string() }).optional(),
      captureType: z.string().optional(), retentionDays: z.number().optional(),
      maxSizeMb: z.number().optional(), rotation: z.boolean().optional(),
      outputTarget: z.string().optional(), enabled: z.boolean().optional(),
    }))
    .mutation(({ input }) => driveDb.createProbeConfig(input)),

  deleteProbeConfig: orgAdminProcedure
    .use(auditMutation("DELETE", "drive_probe_config"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteProbeConfig(input.uid)),

  // ── Drive Jobs — paginated ──
  listJobs: viewerProcedure
    .input(z.object({ campaignId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await driveDb.listDriveJobs(input.campaignId);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  getJob: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(({ input }) => driveDb.getDriveJobByUid(input.uid)),

  createJob: testEngineerProcedure
    .use(auditMutation("CREATE", "drive_job"))
    .input(z.object({
      campaignId: z.string(), routeId: z.string(), deviceId: z.string(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      runnerId: z.string().optional(),
    }))
    .mutation(({ input }) => driveDb.createDriveJob(input)),

  updateJob: testEngineerProcedure
    .use(auditMutation("UPDATE", "drive_job"))
    .input(z.object({
      uid: z.string(),
      status: z.enum(["PENDING", "RUNNING", "DONE", "FAILED"]).optional(),
      progressPct: z.number().optional(), errorMessage: z.string().optional(),
      startedAt: z.coerce.date().optional(), finishedAt: z.coerce.date().optional(),
      artifactsManifest: z.array(z.object({
        artifact_type: z.string(), filename: z.string(), minio_path: z.string(),
        size_bytes: z.number(), sha256: z.string(), content_type: z.string(),
      })).optional(),
    }))
    .mutation(({ input }) => { const { uid, ...d } = input; return driveDb.updateDriveJob(uid, d); }),

  // ── KPI Samples — paginated (high volume) ──
  listKpiSamples: viewerProcedure
    .input(z.object({ driveJobId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await driveDb.listKpiSamples(input.driveJobId);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "timestamp";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  insertKpiSamples: testEngineerProcedure
    .use(auditMutation("INSERT_BATCH", "kpi_sample"))
    .input(z.object({
      samples: z.array(z.object({
        driveJobId: z.string(), campaignId: z.string(), routeId: z.string(),
        timestamp: z.coerce.date(), lat: z.number(), lon: z.number(),
        kpiName: z.string(), value: z.number(), unit: z.string().optional(),
        cellId: z.string().optional(), technology: z.string().optional(),
      })),
    }))
    .mutation(({ input }) => driveDb.insertKpiSamples(input.samples)),

  // ── Run Summaries ──
  getRunSummary: viewerProcedure
    .input(z.object({ driveJobId: z.string() }))
    .query(({ input }) => driveDb.getRunSummary(input.driveJobId)),

  upsertRunSummary: testEngineerProcedure
    .use(auditMutation("UPSERT", "run_summary"))
    .input(z.object({
      driveJobId: z.string(), campaignId: z.string(),
      totalSamples: z.number().optional(), durationSec: z.number().optional(),
      distanceKm: z.number().optional(),
      kpiAverages: z.record(z.string(), z.number()).optional(),
      kpiMin: z.record(z.string(), z.number()).optional(),
      kpiMax: z.record(z.string(), z.number()).optional(),
      thresholdViolations: z.array(z.object({
        kpi_name: z.string(), threshold: z.number(), actual_avg: z.number(),
        direction: z.string(), violation_count: z.number(), total_samples: z.number(),
      })).optional(),
      overallPass: z.boolean().optional(),
    }))
    .mutation(({ input }) => driveDb.upsertRunSummary(input)),

  // ── Imports — paginated ──
  listImports: viewerProcedure
    .input(z.object({ campaignId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await driveDb.listImports(input.campaignId);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  createImport: testEngineerProcedure
    .use(auditMutation("CREATE", "drive_import"))
    .input(z.object({
      campaignId: z.string(), sourceFilename: z.string(),
      sourceFormat: z.enum(["CSV", "JSON", "GPX", "GEOJSON", "IPERF3"]),
      samplesImported: z.number().optional(), samplesSkipped: z.number().optional(),
      errors: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => driveDb.createImport(input)),
});
