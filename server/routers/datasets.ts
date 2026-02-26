import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as datasetsDb from "../db/datasets";
import { paginationInput, paginateInMemory } from "../pagination";

export const datasetsRouter = router({
  // ── Dataset Types — paginated ──
  listTypes: viewerProcedure
    .input(z.object({ domain: z.string().optional() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await datasetsDb.listDatasetTypes(input.domain);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  getTypeByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getDatasetTypeByUid(input.uid);
    }),

  createType: orgAdminProcedure
    .use(auditMutation("CREATE", "dataset_type"))
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

  // ── Datasets — paginated ──
  listDatasets: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await datasetsDb.listDatasets(input.projectId);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  getDatasetByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getDatasetByUid(input.uid);
    }),

  createDataset: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "dataset"))
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

  deleteDataset: orgAdminProcedure
    .use(auditMutation("DELETE", "dataset"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return datasetsDb.deleteDataset(input.uid);
    }),

  // ── Dataset Instances — paginated ──
  listInstances: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await datasetsDb.listDatasetInstances(input.projectId);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  getInstanceByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getDatasetInstanceByUid(input.uid);
    }),

  createInstance: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "dataset_instance"))
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

  updateInstance: qaManagerProcedure
    .use(auditMutation("UPDATE", "dataset_instance"))
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

  deleteInstance: orgAdminProcedure
    .use(auditMutation("DELETE", "dataset_instance"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return datasetsDb.deleteDatasetInstance(input.uid);
    }),

  // ── Bundles — paginated ──
  listBundles: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await datasetsDb.listBundles(input.projectId);
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  getBundleByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.getBundleByUid(input.uid);
    }),

  createBundle: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "bundle"))
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

  deleteBundle: orgAdminProcedure
    .use(auditMutation("DELETE", "bundle"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return datasetsDb.deleteBundle(input.uid);
    }),

  // ── Bundle Items — paginated ──
  listBundleItems: viewerProcedure
    .input(z.object({ bundleId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await datasetsDb.listBundleItems(input.bundleId);
      return paginateInMemory(all, input);
    }),

  addBundleItem: qaManagerProcedure
    .use(auditMutation("ADD_ITEM", "bundle"))
    .input(z.object({
      bundleId: z.string(),
      datasetId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.addBundleItem(input.bundleId, input.datasetId);
    }),

  // ── Dataset Secrets — QA_MANAGER+ ──
  listSecrets: qaManagerProcedure
    .input(z.object({ datasetId: z.string() }))
    .query(async ({ input }) => {
      return datasetsDb.listDatasetSecrets(input.datasetId);
    }),

  setSecret: qaManagerProcedure
    .use(auditMutation("SET_SECRET", "dataset"))
    .input(z.object({
      datasetId: z.string(),
      keyPath: z.string(),
      isSecret: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      return datasetsDb.setDatasetSecret(input.datasetId, input.keyPath, input.isSecret);
    }),
});
