import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as driveDb from "../db/drivetest";

export const drivetestRouter = router({
  // Campaigns
  listCampaigns: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => driveDb.listCampaigns(input.projectId)),

  getCampaign: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(({ input }) => driveDb.getCampaignByUid(input.uid)),

  createCampaign: protectedProcedure
    .input(z.object({
      projectId: z.string(), name: z.string().min(1), description: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      networkType: z.string().optional(), area: z.string().optional(),
      startDate: z.string().optional(), endDate: z.string().optional(), createdBy: z.string().optional(),
    }))
    .mutation(({ input }) => driveDb.createCampaign(input)),

  updateCampaign: protectedProcedure
    .input(z.object({
      uid: z.string(), name: z.string().optional(), description: z.string().optional(),
      status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      networkType: z.string().optional(), area: z.string().optional(),
      startDate: z.string().optional(), endDate: z.string().optional(),
    }))
    .mutation(({ input }) => { const { uid, ...d } = input; return driveDb.updateCampaign(uid, d); }),

  deleteCampaign: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteCampaign(input.uid)),

  // Routes
  listRoutes: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input }) => driveDb.listRoutes(input.campaignId)),

  createRoute: protectedProcedure
    .input(z.object({
      campaignId: z.string(), name: z.string().min(1),
      routeGeojson: z.unknown().optional(), checkpointsGeojson: z.unknown().optional(),
      expectedDurationMin: z.number().optional(),
    }))
    .mutation(({ input }) => driveDb.createRoute(input)),

  deleteRoute: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteRoute(input.uid)),

  // Devices
  listDevices: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => driveDb.listDevices(input.projectId)),

  createDevice: protectedProcedure
    .input(z.object({
      projectId: z.string(), type: z.string(), model: z.string(),
      osVersion: z.string().optional(), diagCapable: z.boolean().optional(),
      toolsEnabled: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => driveDb.createDevice(input)),

  deleteDevice: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteDevice(input.uid)),

  // Probe Configs
  listProbeConfigs: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => driveDb.listProbeConfigs(input.projectId)),

  createProbeConfig: protectedProcedure
    .input(z.object({
      projectId: z.string(), name: z.string().min(1),
      location: z.object({ lat: z.number(), lon: z.number(), label: z.string() }).optional(),
      captureType: z.string().optional(), retentionDays: z.number().optional(),
      maxSizeMb: z.number().optional(), rotation: z.boolean().optional(),
      outputTarget: z.string().optional(), enabled: z.boolean().optional(),
    }))
    .mutation(({ input }) => driveDb.createProbeConfig(input)),

  deleteProbeConfig: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => driveDb.deleteProbeConfig(input.uid)),

  // Drive Jobs
  listJobs: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input }) => driveDb.listDriveJobs(input.campaignId)),

  getJob: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(({ input }) => driveDb.getDriveJobByUid(input.uid)),

  createJob: protectedProcedure
    .input(z.object({
      campaignId: z.string(), routeId: z.string(), deviceId: z.string(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      runnerId: z.string().optional(),
    }))
    .mutation(({ input }) => driveDb.createDriveJob(input)),

  updateJob: protectedProcedure
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

  // KPI Samples
  listKpiSamples: protectedProcedure
    .input(z.object({ driveJobId: z.string() }))
    .query(({ input }) => driveDb.listKpiSamples(input.driveJobId)),

  insertKpiSamples: protectedProcedure
    .input(z.object({
      samples: z.array(z.object({
        driveJobId: z.string(), campaignId: z.string(), routeId: z.string(),
        timestamp: z.coerce.date(), lat: z.number(), lon: z.number(),
        kpiName: z.string(), value: z.number(), unit: z.string().optional(),
        cellId: z.string().optional(), technology: z.string().optional(),
      })),
    }))
    .mutation(({ input }) => driveDb.insertKpiSamples(input.samples)),

  // Run Summaries
  getRunSummary: protectedProcedure
    .input(z.object({ driveJobId: z.string() }))
    .query(({ input }) => driveDb.getRunSummary(input.driveJobId)),

  upsertRunSummary: protectedProcedure
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

  // Imports
  listImports: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input }) => driveDb.listImports(input.campaignId)),

  createImport: protectedProcedure
    .input(z.object({
      campaignId: z.string(), sourceFilename: z.string(),
      sourceFormat: z.enum(["CSV", "JSON", "GPX", "GEOJSON", "IPERF3"]),
      samplesImported: z.number().optional(), samplesSkipped: z.number().optional(),
      errors: z.array(z.string()).optional(),
    }))
    .mutation(({ input }) => driveDb.createImport(input)),
});
