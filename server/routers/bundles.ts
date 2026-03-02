import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  datasetBundles,
  bundleItems,
  datasetInstances,
  datasetTypes,
  datasetSecrets,
} from "../../drizzle/schema";
import { eq, and, desc, like, sql, SQL, lt } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Dataset Types ──────────────────────────────────────────────────────────
export const datasetTypesRouter = router({
  list: protectedProcedure.input(z.object({
    cursor: z.string().optional(),
    pageSize: z.number().min(1).max(200).default(50),
  }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const ps = input?.pageSize ?? 50;
    const conditions: SQL[] = [];
    if (input?.cursor) conditions.push(lt(datasetTypes.uid, input.cursor));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(datasetTypes).where(where).orderBy(datasetTypes.name).limit(ps + 1);
    const hasMore = rows.length > ps;
    const data = hasMore ? rows.slice(0, ps) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].uid : undefined;
    return { data, hasMore, nextCursor };
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

  get: protectedProcedure.input(z.object({ datasetId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [row] = await db.select().from(datasetInstances).where(eq(datasetInstances.uid, input.datasetId)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Dataset instance not found" });
    return row;
  }),

  clone: protectedProcedure.input(z.object({ datasetId: z.string() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [original] = await db.select().from(datasetInstances).where(eq(datasetInstances.uid, input.datasetId)).limit(1);
    if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "Dataset instance not found" });
    const newUid = randomUUID();
    await db.insert(datasetInstances).values({
      uid: newUid,
      projectId: original.projectId,
      datasetTypeId: original.datasetTypeId,
      env: original.env,
      valuesJson: original.valuesJson,
      notes: original.notes ? `${original.notes} (clone)` : 'clone',
      status: "DRAFT",
      version: 1,
      createdBy: ctx.user?.openId ?? null,
    });
    return { success: true, datasetId: newUid };
  }),

  delete: protectedProcedure.input(z.object({ datasetId: z.string() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Also remove from any bundles
    await db.delete(bundleItems).where(eq(bundleItems.datasetId, input.datasetId));
    await db.delete(datasetInstances).where(eq(datasetInstances.uid, input.datasetId));
    return { success: true };
  }),

  /**
   * Validate a dataset instance against its type's schemaFields.
   * Checks: required fields present, type validation, enum membership.
   * Returns { valid, errors[], warnings[] }.
   */
  validate: protectedProcedure.input(z.object({
    datasetId: z.string(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    // 1. Get the dataset instance
    const [instance] = await db.select().from(datasetInstances).where(eq(datasetInstances.uid, input.datasetId)).limit(1);
    if (!instance) throw new TRPCError({ code: "NOT_FOUND", message: "Dataset instance introuvable" });

    // 2. Get the dataset type (for schemaFields)
    const [dsType] = await db.select().from(datasetTypes).where(eq(datasetTypes.datasetTypeId, instance.datasetTypeId)).limit(1);
    if (!dsType) {
      return {
        valid: false,
        errors: [{ field: '_type', message: `Type de dataset '${instance.datasetTypeId}' introuvable` }],
        warnings: [],
        summary: { total: 0, filled: 0, required: 0, requiredFilled: 0 },
      };
    }

    const schemaFields = (dsType.schemaFields ?? []) as Array<{
      name: string; type: string; required: boolean; description?: string;
      enum_values?: string[]; min?: number; max?: number; pattern?: string;
    }>;
    const values = (instance.valuesJson ?? {}) as Record<string, unknown>;

    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    let requiredCount = 0;
    let requiredFilled = 0;
    let filledCount = 0;

    for (const field of schemaFields) {
      const val = values[field.name];
      const isEmpty = val === undefined || val === null || val === '';

      if (!isEmpty) filledCount++;

      if (field.required) {
        requiredCount++;
        if (isEmpty) {
          errors.push({ field: field.name, message: `Champ requis '${field.name}' manquant` });
        } else {
          requiredFilled++;
        }
      }

      if (!isEmpty) {
        // Type validation
        const strVal = String(val);
        switch (field.type) {
          case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
              errors.push({ field: field.name, message: `'${field.name}' n'est pas un email valide` });
            }
            break;
          case 'number': {
            const num = Number(val);
            if (isNaN(num)) {
              errors.push({ field: field.name, message: `'${field.name}' n'est pas un nombre valide` });
            } else {
              if (field.min !== undefined && num < field.min) {
                errors.push({ field: field.name, message: `'${field.name}' doit être >= ${field.min}` });
              }
              if (field.max !== undefined && num > field.max) {
                errors.push({ field: field.name, message: `'${field.name}' doit être <= ${field.max}` });
              }
            }
            break;
          }
          case 'boolean':
            if (!['true', 'false', '0', '1'].includes(strVal.toLowerCase())) {
              warnings.push({ field: field.name, message: `'${field.name}' n'est pas un booléen standard` });
            }
            break;
          case 'url':
            if (!/^https?:\/\/.+/.test(strVal)) {
              errors.push({ field: field.name, message: `'${field.name}' n'est pas une URL valide` });
            }
            break;
          case 'ip':
            if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(strVal) && !/^[0-9a-fA-F:]+$/.test(strVal)) {
              errors.push({ field: field.name, message: `'${field.name}' n'est pas une adresse IP valide` });
            }
            break;
          case 'enum':
            if (field.enum_values && !field.enum_values.includes(strVal)) {
              errors.push({ field: field.name, message: `'${field.name}' doit être parmi: ${field.enum_values.join(', ')}` });
            }
            break;
          case 'phone':
            if (!/^\+?[0-9\s\-()]{6,20}$/.test(strVal)) {
              warnings.push({ field: field.name, message: `'${field.name}' format téléphone inhabituel` });
            }
            break;
          case 'date':
            if (isNaN(Date.parse(strVal))) {
              errors.push({ field: field.name, message: `'${field.name}' n'est pas une date valide` });
            }
            break;
          default:
            // string type — no specific validation
            if (field.pattern) {
              try {
                if (!new RegExp(field.pattern).test(strVal)) {
                  warnings.push({ field: field.name, message: `'${field.name}' ne correspond pas au pattern attendu` });
                }
              } catch { /* invalid regex, skip */ }
            }
            break;
        }
      }
    }

    // Check for extra fields not in schema
    const schemaFieldNames = new Set(schemaFields.map(f => f.name));
    for (const key of Object.keys(values)) {
      if (!schemaFieldNames.has(key)) {
        warnings.push({ field: key, message: `Champ '${key}' non défini dans le schéma du type` });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: {
        total: schemaFields.length,
        filled: filledCount,
        required: requiredCount,
        requiredFilled,
      },
    };
  }),
});

// ─── Dataset Bundles ────────────────────────────────────────────────────────
export const bundlesRouter = router({
  list: protectedProcedure.input(z.object({
    projectId: z.string(),
    env: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
    search: z.string().optional(),
    cursor: z.string().optional(),
    pageSize: z.number().min(1).max(100).default(30),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions: SQL[] = [eq(datasetBundles.projectId, input.projectId)];
    if (input.env) conditions.push(eq(datasetBundles.env, input.env));
    if (input.status) conditions.push(eq(datasetBundles.status, input.status));
    if (input.search) conditions.push(like(datasetBundles.name, `%${input.search}%`));
    if (input.cursor) conditions.push(lt(datasetBundles.uid, input.cursor));
    const where = and(...conditions);
    const rows = await db.select().from(datasetBundles).where(where).orderBy(desc(datasetBundles.createdAt)).limit(input.pageSize + 1);
    const hasMore = rows.length > input.pageSize;
    const data = hasMore ? rows.slice(0, input.pageSize) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].uid : undefined;
    return { data, hasMore, nextCursor };
  }),

  get: protectedProcedure.input(z.object({ bundleId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [row] = await db.select().from(datasetBundles).where(eq(datasetBundles.uid, input.bundleId)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
    return row;
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

// ─── Dataset Secrets ────────────────────────────────────────────────────────
export const datasetSecretsRouter = router({
  list: protectedProcedure.input(z.object({ datasetId: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const data = await db.select().from(datasetSecrets).where(eq(datasetSecrets.datasetId, input.datasetId));
    return { data };
  }),

  set: protectedProcedure.input(z.object({
    datasetId: z.string(),
    keyPath: z.string().min(1),
    isSecret: z.boolean(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Upsert: check if exists
    const [existing] = await db.select().from(datasetSecrets)
      .where(and(eq(datasetSecrets.datasetId, input.datasetId), eq(datasetSecrets.keyPath, input.keyPath)))
      .limit(1);
    if (existing) {
      await db.update(datasetSecrets).set({ isSecret: input.isSecret })
        .where(eq(datasetSecrets.id, existing.id));
    } else {
      await db.insert(datasetSecrets).values({
        datasetId: input.datasetId,
        keyPath: input.keyPath,
        isSecret: input.isSecret,
      });
    }
    return { success: true };
  }),

  remove: protectedProcedure.input(z.object({
    datasetId: z.string(),
    keyPath: z.string(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(datasetSecrets).where(
      and(eq(datasetSecrets.datasetId, input.datasetId), eq(datasetSecrets.keyPath, input.keyPath))
    );
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
