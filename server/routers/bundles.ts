import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  datasetBundles,
  bundleItems,
  datasetInstances,
  datasetTypes,
} from "../../drizzle/schema";
import { eq, and, desc, like, sql, SQL } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Dataset Types ──────────────────────────────────────────────────────────
export const datasetTypesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const data = await db.select().from(datasetTypes).orderBy(datasetTypes.name);
    return { data };
  }),

  create: protectedProcedure.input(z.object({
    datasetTypeId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    domain: z.string().optional(),
    testType: z.string().optional(),
    schemaFields: z.any().optional(),
    examplePlaceholders: z.any().optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = randomUUID();
    const res = await db.insert(datasetTypes).values({
      uid,
      datasetTypeId: input.datasetTypeId,
      domain: input.domain ?? "WEB",
      testType: input.testType ?? null,
      name: input.name,
      description: input.description ?? null,
      schemaFields: input.schemaFields ?? null,
      examplePlaceholders: input.examplePlaceholders ?? null,
      tags: input.tags ?? null,
    });
    return { success: true, id: Number(res[0].insertId) };
  }),

  update: protectedProcedure.input(z.object({
    datasetTypeId: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    domain: z.string().optional(),
    testType: z.string().optional(),
    schemaFields: z.any().optional(),
    examplePlaceholders: z.any().optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.description !== undefined) u.description = input.description;
    if (input.domain !== undefined) u.domain = input.domain;
    if (input.testType !== undefined) u.testType = input.testType;
    if (input.schemaFields !== undefined) u.schemaFields = input.schemaFields;
    if (input.examplePlaceholders !== undefined) u.examplePlaceholders = input.examplePlaceholders;
    if (input.tags !== undefined) u.tags = input.tags;
    if (Object.keys(u).length) {
      await db.update(datasetTypes).set(u).where(eq(datasetTypes.datasetTypeId, input.datasetTypeId));
    }
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ datasetTypeId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(datasetTypes).where(eq(datasetTypes.datasetTypeId, input.datasetTypeId));
    return { success: true };
  }),
});

// ─── Dataset Instances ──────────────────────────────────────────────────────
export const datasetInstancesRouter = router({
  list: protectedProcedure.input(z.object({
    projectId: z.string(),
    env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
    datasetTypeId: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions: SQL[] = [eq(datasetInstances.projectId, input.projectId)];
    if (input.env) conditions.push(eq(datasetInstances.env, input.env));
    if (input.status) conditions.push(eq(datasetInstances.status, input.status));
    if (input.datasetTypeId) conditions.push(eq(datasetInstances.datasetTypeId, input.datasetTypeId));
    const where = and(...conditions);
    const data = await db.select().from(datasetInstances).where(where).orderBy(desc(datasetInstances.createdAt)).limit(100);
    return { data };
  }),

  create: protectedProcedure.input(z.object({
    projectId: z.string(),
    datasetTypeId: z.string(),
    env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV"),
    valuesJson: z.any().optional(),
    notes: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).default("DRAFT"),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = randomUUID();
    await db.insert(datasetInstances).values({
      uid,
      projectId: input.projectId,
      datasetTypeId: input.datasetTypeId,
      env: input.env,
      valuesJson: input.valuesJson ?? null,
      notes: input.notes ?? null,
      status: input.status,
      createdBy: ctx.user?.openId ?? null,
    });
    return { success: true, datasetId: uid };
  }),

  update: protectedProcedure.input(z.object({
    datasetId: z.string(),
    valuesJson: z.any().optional(),
    notes: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
    version: z.number().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.valuesJson !== undefined) u.valuesJson = input.valuesJson;
    if (input.notes !== undefined) u.notes = input.notes;
    if (input.status !== undefined) u.status = input.status;
    if (input.version !== undefined) u.version = input.version;
    if (Object.keys(u).length) {
      await db.update(datasetInstances).set(u).where(eq(datasetInstances.uid, input.datasetId));
    }
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ datasetId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Also remove from any bundles
    await db.delete(bundleItems).where(eq(bundleItems.datasetId, input.datasetId));
    await db.delete(datasetInstances).where(eq(datasetInstances.uid, input.datasetId));
    return { success: true };
  }),
});

// ─── Dataset Bundles ────────────────────────────────────────────────────────
export const bundlesRouter = router({
  list: protectedProcedure.input(z.object({
    projectId: z.string(),
    env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions: SQL[] = [eq(datasetBundles.projectId, input.projectId)];
    if (input.env) conditions.push(eq(datasetBundles.env, input.env));
    if (input.status) conditions.push(eq(datasetBundles.status, input.status));
    if (input.search) conditions.push(like(datasetBundles.name, `%${input.search}%`));
    const where = and(...conditions);
    const data = await db.select().from(datasetBundles).where(where).orderBy(desc(datasetBundles.createdAt)).limit(100);
    return { data };
  }),

  create: protectedProcedure.input(z.object({
    projectId: z.string(),
    name: z.string().min(1),
    env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("PREPROD"),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = randomUUID();
    await db.insert(datasetBundles).values({
      uid,
      projectId: input.projectId,
      name: input.name,
      env: input.env,
      tags: input.tags ?? [],
      createdBy: ctx.user?.openId ?? null,
    });
    return { success: true, bundleId: uid };
  }),

  update: protectedProcedure.input(z.object({
    bundleId: z.string(),
    name: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
    tags: z.array(z.string()).optional(),
    version: z.number().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.status !== undefined) u.status = input.status;
    if (input.tags !== undefined) u.tags = input.tags;
    if (input.version !== undefined) u.version = input.version;
    if (Object.keys(u).length) {
      await db.update(datasetBundles).set(u).where(eq(datasetBundles.uid, input.bundleId));
    }
    return { success: true };
  }),

  clone: protectedProcedure.input(z.object({ bundleId: z.string() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Get original bundle
    const [original] = await db.select().from(datasetBundles).where(eq(datasetBundles.uid, input.bundleId)).limit(1);
    if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
    // Create clone
    const newBundleId = randomUUID();
    await db.insert(datasetBundles).values({
      uid: newBundleId,
      projectId: original.projectId,
      name: `${original.name}_CLONE`,
      env: original.env,
      tags: original.tags as string[] ?? [],
      status: "DRAFT",
      createdBy: ctx.user?.openId ?? null,
    });
    // Clone items
    const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, original.uid));
    for (const item of items) {
      await db.insert(bundleItems).values({
        bundleId: newBundleId,
        datasetId: item.datasetId,
      });
    }
    return { success: true, bundleId: newBundleId };
  }),

  delete: protectedProcedure.input(z.object({ bundleId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Delete items first
    await db.delete(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
    await db.delete(datasetBundles).where(eq(datasetBundles.uid, input.bundleId));
    return { success: true };
  }),
});

// ─── Bundle Items ───────────────────────────────────────────────────────────
export const bundleItemsRouter = router({
  list: protectedProcedure.input(z.object({ bundleId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const data = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, input.bundleId));
    return { data };
  }),

  add: protectedProcedure.input(z.object({
    bundleId: z.string(),
    datasetId: z.string(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Check no duplicate
    const existing = await db.select().from(bundleItems)
      .where(and(eq(bundleItems.bundleId, input.bundleId), eq(bundleItems.datasetId, input.datasetId)))
      .limit(1);
    if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Dataset already in bundle" });
    await db.insert(bundleItems).values({
      bundleId: input.bundleId,
      datasetId: input.datasetId,
    });
    return { success: true };
  }),

  remove: protectedProcedure.input(z.object({
    bundleId: z.string(),
    datasetId: z.string(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(bundleItems).where(
      and(eq(bundleItems.bundleId, input.bundleId), eq(bundleItems.datasetId, input.datasetId))
    );
    return { success: true };
  }),
});
