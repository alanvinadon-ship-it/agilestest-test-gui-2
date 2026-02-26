import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as datasetsDb from "../db/datasets";

export const datasetsRouter = router({
  // Dataset Types
  listTypes: protectedProcedure
    .input(z.object({ domain: z.string().optional() }))
    .query(async ({ input }) => {
      return datasetsDb.listDatasetTypes(input.domain);
    }),

  getTypeByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getDatasetTypeByUid(input.uid);
    }),

  createType: protectedProcedure
    .input(z.object({
      datasetTypeId: z.string(),
      domain: z.string(),
      name: z.string().min(1),
      testType: z.string().optional(),
      description: z.string().optional(),
      schemaFields: z.array(z.record(z.string(), z.unknown())).optional(),
      examplePlaceholders: z.record(z.string(), z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.createDatasetType(input);
    }),

  // Datasets
  listDatasets: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.listDatasets(input.projectId);
    }),

  getDatasetByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getDatasetByUid(input.uid);
    }),

  createDataset: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      datasetTypeId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.createDataset(input);
    }),

  deleteDataset: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return datasetsDb.deleteDataset(input.uid);
    }),

  // Dataset Instances
  listInstances: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.listDatasetInstances(input.projectId);
    }),

  getInstanceByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getDatasetInstanceByUid(input.uid);
    }),

  createInstance: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      datasetTypeId: z.string(),
      env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]),
      valuesJson: z.record(z.string(), z.unknown()).optional(),
      notes: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.createDatasetInstance(input);
    }),

  updateInstance: protectedProcedure
    .input(z.object({
      uid: z.string(),
      env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
      version: z.number().optional(),
      valuesJson: z.record(z.string(), z.unknown()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return datasetsDb.updateDatasetInstance(uid, data);
    }),

  deleteInstance: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return datasetsDb.deleteDatasetInstance(input.uid);
    }),

  // Bundles
  listBundles: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.listBundles(input.projectId);
    }),

  getBundleByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getBundleByUid(input.uid);
    }),

  createBundle: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1),
      env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]),
      tags: z.array(z.string()).optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.createBundle(input);
    }),

  deleteBundle: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return datasetsDb.deleteBundle(input.uid);
    }),

  // Bundle Items
  listBundleItems: protectedProcedure
    .input(z.object({ bundleId: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.listBundleItems(input.bundleId);
    }),

  addBundleItem: protectedProcedure
    .input(z.object({
      bundleId: z.string(),
      datasetId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.addBundleItem(input.bundleId, input.datasetId);
    }),

  // Dataset Secrets
  listSecrets: protectedProcedure
    .input(z.object({ datasetId: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.listDatasetSecrets(input.datasetId);
    }),

  setSecret: protectedProcedure
    .input(z.object({
      datasetId: z.string(),
      keyPath: z.string(),
      isSecret: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.setDatasetSecret(input.datasetId, input.keyPath, input.isSecret);
    }),
});
