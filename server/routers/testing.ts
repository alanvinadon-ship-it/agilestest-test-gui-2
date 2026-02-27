import { z } from "zod";
import { eq, desc, and, like, inArray, sql, SQL, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  testProfiles, testScenarios, datasets, executions,
  artifacts, incidents, captures, probes, generatedScripts,
  aiAnalyses,
} from "../../drizzle/schema";
import { paginationInput } from "../../shared/pagination";
import { normalizePagination, countRows } from "../lib/pagination";
import { writeAuditLog } from "../lib/auditLog";
import { randomUUID } from "crypto";
import { notifyOwner } from "../_core/notification";
import { dispatchWebhookEvent } from "./webhooks";

// ─── Shared inputs ──────────────────────────────────────────────────────────
// projectId is varchar(36) in DB — use z.string() for all project-scoped queries
const projectScopedList = z.object({
  ...paginationInput.shape,
  projectId: z.string(),
  search: z.string().optional(),
});

// ─── Profiles ───────────────────────────────────────────────────────────────
export const profilesRouter = router({
  list: protectedProcedure.input(projectScopedList.extend({
    cursor: z.number().optional(), // id of last item for cursor-based pagination
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(testProfiles.projectId, input.projectId)];
    if (input.search) conditions.push(like(testProfiles.name, `%${input.search}%`));
    // Cursor-based: fetch items with id < cursor (descending order)
    if (input.cursor) conditions.push(sql`${testProfiles.id} < ${input.cursor}`);
    const where = and(...conditions);
    const fetchSize = pageSize + 1; // fetch one extra to detect hasMore
    const rows = await db.select().from(testProfiles).where(where).orderBy(desc(testProfiles.id)).limit(fetchSize);
    const hasMore = rows.length > pageSize;
    const data = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;
    // Also return offset-based pagination for backward compat
    const cnt = await countRows(db, testProfiles, and(eq(testProfiles.projectId, input.projectId), input.search ? like(testProfiles.name, `%${input.search}%`) : undefined));
    const total = cnt[0]?.count ?? 0;
    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      nextCursor,
      hasMore,
    };
  }),
  get: protectedProcedure.input(z.object({ profileId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(testProfiles).where(eq(testProfiles.id, input.profileId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Profil introuvable" });
    return r[0];
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.string(), name: z.string().min(1), description: z.string().optional(),
    profileType: z.string().default("WEB"), config: z.any().optional(),
    testType: z.enum(["VABF", "VSR", "VABE"]).default("VABF"),
    domain: z.string().optional(),
    protocol: z.string().optional(),
    targetHost: z.string().optional(),
    targetPort: z.number().optional(),
    parameters: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = randomUUID();
    const res = await db.insert(testProfiles).values({
      uid,
      projectId: input.projectId, name: input.name, description: input.description ?? null,
      profileType: input.profileType, config: input.config ?? null,
      testType: input.testType,
      domain: input.domain ?? null,
      protocol: input.protocol ?? null,
      targetHost: input.targetHost ?? null,
      targetPort: input.targetPort ?? null,
      parameters: input.parameters ?? null,
    });
    await writeAuditLog({ userId: ctx.user!.id, action: "PROFILE_CREATED", entity: "test_profile", entityId: String(res[0].insertId) });
    return { success: true, profileId: Number(res[0].insertId), uid };
  }),
  update: protectedProcedure.input(z.object({
    profileId: z.number(), name: z.string().optional(), description: z.string().optional(),
    profileType: z.string().optional(), config: z.any().optional(),
    testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
    domain: z.string().optional(),
    protocol: z.string().optional(),
    targetHost: z.string().optional(),
    targetPort: z.number().optional(),
    parameters: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.description !== undefined) u.description = input.description;
    if (input.profileType !== undefined) u.profileType = input.profileType;
    if (input.config !== undefined) u.config = input.config;
    if (input.testType !== undefined) u.testType = input.testType;
    if (input.domain !== undefined) u.domain = input.domain;
    if (input.protocol !== undefined) u.protocol = input.protocol;
    if (input.targetHost !== undefined) u.targetHost = input.targetHost;
    if (input.targetPort !== undefined) u.targetPort = input.targetPort;
    if (input.parameters !== undefined) u.parameters = input.parameters;
    if (Object.keys(u).length) await db.update(testProfiles).set(u).where(eq(testProfiles.id, input.profileId));
    await writeAuditLog({ userId: ctx.user!.id, action: "PROFILE_UPDATED", entity: "test_profile", entityId: String(input.profileId) });
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ profileId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(testProfiles).where(eq(testProfiles.id, input.profileId));
    await writeAuditLog({ userId: ctx.user!.id, action: "PROFILE_DELETED", entity: "test_profile", entityId: String(input.profileId) });
    return { success: true };
  }),
});

// ─── Scenarios ──────────────────────────────────────────────────────────────
export const scenariosRouter = router({
  list: protectedProcedure.input(projectScopedList.extend({
    testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).optional(),
    cursor: z.number().optional(), // id of last item for cursor-based pagination
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(testScenarios.projectId, input.projectId)];
    if (input.search) conditions.push(like(testScenarios.name, `%${input.search}%`));
    if (input.testType) conditions.push(eq(testScenarios.testType, input.testType));
    if (input.status) conditions.push(eq(testScenarios.status, input.status));
    // Cursor-based: fetch items with id < cursor (descending order)
    if (input.cursor) conditions.push(sql`${testScenarios.id} < ${input.cursor}`);
    const where = and(...conditions);
    const fetchSize = pageSize + 1;
    const rows = await db.select().from(testScenarios).where(where).orderBy(desc(testScenarios.id)).limit(fetchSize);
    const hasMore = rows.length > pageSize;
    const data = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;
    // Also return offset-based pagination for backward compat
    const baseConditions: SQL[] = [eq(testScenarios.projectId, input.projectId)];
    if (input.search) baseConditions.push(like(testScenarios.name, `%${input.search}%`));
    if (input.testType) baseConditions.push(eq(testScenarios.testType, input.testType));
    if (input.status) baseConditions.push(eq(testScenarios.status, input.status));
    const cnt = await countRows(db, testScenarios, and(...baseConditions));
    const total = cnt[0]?.count ?? 0;
    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      nextCursor,
      hasMore,
    };
  }),
  get: protectedProcedure.input(z.object({ scenarioId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(testScenarios).where(eq(testScenarios.id, input.scenarioId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Scénario introuvable" });
    return r[0];
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.string(), name: z.string().min(1), description: z.string().optional(),
    profileId: z.string().optional(), testType: z.enum(["VABF", "VSR", "VABE"]).default("VABF"),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT"),
    steps: z.any().optional(),
    scenarioCode: z.string().optional(),
    requiredDatasetTypes: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = randomUUID();
    const scenarioCode = input.scenarioCode || `SC-${Date.now().toString(36).toUpperCase()}`;
    const res = await db.insert(testScenarios).values({
      uid,
      scenarioCode,
      projectId: input.projectId, name: input.name, description: input.description ?? null,
      profileId: input.profileId ?? "", testType: input.testType, status: input.status,
      steps: input.steps ?? null,
      requiredDatasetTypes: input.requiredDatasetTypes ?? null,
    });
    await writeAuditLog({ userId: ctx.user!.id, action: "SCENARIO_CREATED", entity: "test_scenario", entityId: String(res[0].insertId) });
    return { success: true, scenarioId: Number(res[0].insertId), uid };
  }),
  update: protectedProcedure.input(z.object({
    scenarioId: z.number(), name: z.string().optional(), description: z.string().optional(),
    testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).optional(),
    steps: z.any().optional(),
    requiredDatasetTypes: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.description !== undefined) u.description = input.description;
    if (input.testType !== undefined) u.testType = input.testType;
    if (input.status !== undefined) u.status = input.status;
    if (input.steps !== undefined) u.steps = input.steps;
    if (input.requiredDatasetTypes !== undefined) u.requiredDatasetTypes = input.requiredDatasetTypes;
    if (Object.keys(u).length) await db.update(testScenarios).set(u).where(eq(testScenarios.id, input.scenarioId));
    await writeAuditLog({ userId: ctx.user!.id, action: "SCENARIO_UPDATED", entity: "test_scenario", entityId: String(input.scenarioId) });
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ scenarioId: z.number() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(testScenarios).where(eq(testScenarios.id, input.scenarioId));
    await writeAuditLog({ userId: ctx.user!.id, action: "SCENARIO_DELETED", entity: "test_scenario", entityId: String(input.scenarioId) });
    return { success: true };
  }),

  // ── Export scenario as portable JSON ──────────────────────────────────
  export: protectedProcedure.input(z.object({ scenarioId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [scenario] = await db.select().from(testScenarios).where(eq(testScenarios.id, input.scenarioId)).limit(1);
    if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scénario introuvable" });

    // Fetch linked profile if any
    let profile: Record<string, unknown> | null = null;
    if (scenario.profileId) {
      // profileId is a varchar uid, we need to look up by uid
      const [p] = await db.select().from(testProfiles).where(eq(testProfiles.uid, scenario.profileId)).limit(1);
      if (p) {
        profile = {
          name: p.name,
          description: p.description,
          profileType: p.profileType,
          config: p.config,
        };
      }
    }

    // Fetch datasets for same project
    const projectDatasets = await db.select().from(datasets).where(eq(datasets.projectId, scenario.projectId)).limit(100);

    const exportPayload = {
      _format: "agilestest-scenario-v1" as const,
      exportedAt: new Date().toISOString(),
      scenario: {
        name: scenario.name,
        description: scenario.description,
        testType: scenario.testType,
        status: scenario.status,
        steps: scenario.steps,
      },
      profile,
      datasets: projectDatasets.map(d => ({
        name: d.name,
        description: d.description,
        format: d.format,
        datasetTypeId: d.datasetTypeId,
      })),
    };
    return exportPayload;
  }),

  // ── Import scenario from portable JSON ────────────────────────────────
  import: protectedProcedure.input(z.object({
    projectId: z.string(),
    payload: z.object({
      _format: z.literal("agilestest-scenario-v1"),
      scenario: z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        testType: z.enum(["VABF", "VSR", "VABE"]).default("VABF"),
        status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT"),
        steps: z.any().optional(),
      }),
      profile: z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        profileType: z.string().default("WEB"),
        config: z.any().optional(),
      }).nullable().optional(),
      datasets: z.array(z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        format: z.enum(["CSV", "JSON", "YAML"]).default("CSV"),
        datasetTypeId: z.string().optional(),
      })).optional(),
    }),
    importProfile: z.boolean().default(true),
    importDatasets: z.boolean().default(true),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { projectId, payload, importProfile, importDatasets } = input;
    const userId = ctx.user!.id;

    let profileUid: string | null = null;
    const importedDatasetIds: number[] = [];
    const warnings: string[] = [];

    // Import profile if requested and present
    if (importProfile && payload.profile) {
      try {
        const uid = randomUUID();
        const res = await db.insert(testProfiles).values({
          uid,
          projectId,
          name: payload.profile.name,
          description: payload.profile.description ?? null,
          profileType: payload.profile.profileType ?? "WEB",
          config: payload.profile.config ?? null,
          testType: "VABF",
        });
        profileUid = uid;
      } catch (err: any) {
        warnings.push(`Profil non importé: ${err.message}`);
      }
    }

    // Import datasets if requested
    if (importDatasets && payload.datasets && payload.datasets.length > 0) {
      for (const ds of payload.datasets) {
        try {
          const uid = randomUUID();
          const res = await db.insert(datasets).values({
            uid,
            projectId,
            name: ds.name,
            description: ds.description ?? null,
            format: ds.format ?? "CSV",
            datasetTypeId: ds.datasetTypeId ?? null,
          });
          importedDatasetIds.push(Number(res[0].insertId));
        } catch (err: any) {
          warnings.push(`Dataset "${ds.name}" non importé: ${err.message}`);
        }
      }
    }

    // Import scenario
    const scenarioUid = randomUUID();
    const scenarioCode = `SC-IMP-${Date.now().toString(36).toUpperCase()}`;
    const scenarioRes = await db.insert(testScenarios).values({
      uid: scenarioUid,
      scenarioCode,
      projectId,
      name: payload.scenario.name,
      description: payload.scenario.description ?? null,
      testType: payload.scenario.testType ?? "VABF",
      status: "DRAFT",
      steps: payload.scenario.steps ?? null,
      profileId: profileUid ?? "",
    });
    const scenarioId = Number(scenarioRes[0].insertId);

    await writeAuditLog({ userId, action: "SCENARIO_IMPORTED", entity: "test_scenario", entityId: String(scenarioId) });

    return {
      success: true,
      scenarioId,
      profileUid,
      importedDatasets: importedDatasetIds.length,
      warnings,
    };
  }),
});

// ─── Datasets ───────────────────────────────────────────────────────────────
export const datasetsRouter = router({
  list: protectedProcedure.input(projectScopedList.extend({
    datasetType: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(datasets.projectId, input.projectId)];
    if (input.search) conditions.push(like(datasets.name, `%${input.search}%`));
    if (input.datasetType) conditions.push(eq(datasets.datasetTypeId, input.datasetType));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(datasets).where(where).orderBy(desc(datasets.createdAt)).limit(pageSize).offset(offset),
      countRows(db, datasets, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.string(), name: z.string().min(1), description: z.string().optional(),
    format: z.enum(["CSV", "JSON", "YAML"]).default("CSV"),
    datasetTypeId: z.string().optional(),
    rowCount: z.number().optional(),
    sizeBytes: z.number().optional(),
    storageUrl: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = randomUUID();
    const res = await db.insert(datasets).values({
      uid,
      projectId: input.projectId, name: input.name, description: input.description ?? null,
      format: input.format,
      datasetTypeId: input.datasetTypeId ?? null,
      rowCount: input.rowCount ?? null,
      sizeBytes: input.sizeBytes ?? null,
      storageUrl: input.storageUrl ?? null,
    });
    return { success: true, datasetId: Number(res[0].insertId) };
  }),
  update: protectedProcedure.input(z.object({
    datasetId: z.number(), name: z.string().optional(), description: z.string().optional(),
    format: z.enum(["CSV", "JSON", "YAML"]).optional(),
    datasetTypeId: z.string().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.description !== undefined) u.description = input.description;
    if (input.format !== undefined) u.format = input.format;
    if (input.datasetTypeId !== undefined) u.datasetTypeId = input.datasetTypeId;
    if (Object.keys(u).length) await db.update(datasets).set(u).where(eq(datasets.id, input.datasetId));
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ datasetId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(datasets).where(eq(datasets.id, input.datasetId));
    return { success: true };
  }),
});

// ─── Executions ─────────────────────────────────────────────────────────────
export const executionsRouter = router({
  list: protectedProcedure.input(projectScopedList.extend({
    status: z.enum(["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"]).optional(),
    scenarioId: z.string().optional(),
    cursor: z.number().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(executions.projectId, input.projectId)];
    if (input.status) conditions.push(eq(executions.status, input.status));
    if (input.scenarioId) conditions.push(eq(executions.scenarioId, input.scenarioId));
    // Cursor-based: fetch items with id < cursor (descending order)
    if (input.cursor) conditions.push(sql`${executions.id} < ${input.cursor}`);
    const where = and(...conditions);
    const fetchSize = pageSize + 1;
    const rows = await db.select().from(executions).where(where).orderBy(desc(executions.id)).limit(fetchSize);
    const hasMore = rows.length > pageSize;
    const data = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;
    const [cnt] = await countRows(db, executions, where);
    const total = cnt?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, nextCursor, hasMore };
  }),
  get: protectedProcedure.input(z.object({ executionId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(executions).where(eq(executions.id, input.executionId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Exécution introuvable" });
    // Fetch related data in parallel — use uid-based lookups for varchar FK columns
    const exec = r[0];
    const [arts, incs, analyses, scenario, profile] = await Promise.all([
      db.select().from(artifacts).where(eq(artifacts.executionId, exec.uid)),
      db.select().from(incidents).where(eq(incidents.executionId, exec.uid)).orderBy(desc(incidents.detectedAt)),
      db.select().from(aiAnalyses).where(eq(aiAnalyses.executionId, input.executionId)).orderBy(desc(aiAnalyses.createdAt)),
      exec.scenarioId ? db.select().from(testScenarios).where(eq(testScenarios.uid, exec.scenarioId)).limit(1) : Promise.resolve([]),
      exec.profileId ? db.select().from(testProfiles).where(eq(testProfiles.uid, exec.profileId)).limit(1) : Promise.resolve([]),
    ]);
    return {
      ...exec,
      artifacts: arts,
      incidents: incs,
      analyses,
      scenario: scenario[0] ?? null,
      profile: profile[0] ?? null,
    };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.string(), profileId: z.string().optional(), scenarioId: z.string().optional(),
    runnerType: z.string().optional(), scriptId: z.string().optional(),
    targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV"),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = randomUUID();
    const res = await db.insert(executions).values({
      uid,
      projectId: input.projectId, profileId: input.profileId ?? "",
      scenarioId: input.scenarioId ?? "", status: "PENDING",
      runnerType: input.runnerType ?? null, scriptId: input.scriptId ?? null,
      targetEnv: input.targetEnv,
    });
    await writeAuditLog({ userId: ctx.user!.id, action: "EXECUTION_CREATED", entity: "execution", entityId: String(res[0].insertId) });
    return { success: true, executionId: Number(res[0].insertId) };
  }),
  updateStatus: protectedProcedure.input(z.object({
    executionId: z.number(),
    status: z.enum(["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"]),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const updateSet: Record<string, unknown> = { status: input.status };
    if (input.status === "RUNNING") updateSet.startedAt = new Date();
    if (["PASSED", "FAILED", "ERROR", "CANCELLED"].includes(input.status)) updateSet.finishedAt = new Date();
    await db.update(executions).set(updateSet).where(eq(executions.id, input.executionId));

    // Notify owner on terminal failure statuses
    if (["FAILED", "ERROR"].includes(input.status)) {
      // Fetch execution details for the notification
      const [exec] = await db.select().from(executions).where(eq(executions.id, input.executionId)).limit(1);
      const scenarioName = exec?.scenarioId
        ? (await db.select({ name: testScenarios.name }).from(testScenarios).where(eq(testScenarios.uid, exec.scenarioId)).limit(1))?.[0]?.name ?? "—"
        : "—";
      notifyOwner({
        title: `\u26a0\ufe0f Ex\u00e9cution #${input.executionId} ${input.status}`,
        content: `L'ex\u00e9cution #${input.executionId} (sc\u00e9nario: ${scenarioName}, env: ${exec?.targetEnv ?? "\u2014"}) est pass\u00e9e en ${input.status} le ${new Date().toLocaleString("fr-FR")}.`,
      }).catch((err) => console.warn("[Notification] Failed to notify owner:", err));

      // Dispatch webhook event for failed executions
      dispatchWebhookEvent(exec?.projectId ?? "", "run.failed", {
        executionId: input.executionId,
        executionUid: exec?.uid,
        status: input.status,
        scenarioName,
        targetEnv: exec?.targetEnv ?? null,
        timestamp: new Date().toISOString(),
      }).catch((err) => console.warn("[Webhook] Failed to dispatch run.failed:", err));
    }

    // Dispatch webhook event for completed executions (PASSED)
    if (input.status === "PASSED") {
      const [exec] = await db.select().from(executions).where(eq(executions.id, input.executionId)).limit(1);
      const scenarioName = exec?.scenarioId
        ? (await db.select({ name: testScenarios.name }).from(testScenarios).where(eq(testScenarios.uid, exec.scenarioId)).limit(1))?.[0]?.name ?? "\u2014"
        : "\u2014";
      dispatchWebhookEvent(exec?.projectId ?? "", "run.completed", {
        executionId: input.executionId,
        executionUid: exec?.uid,
        status: input.status,
        scenarioName,
        targetEnv: exec?.targetEnv ?? null,
        timestamp: new Date().toISOString(),
      }).catch((err) => console.warn("[Webhook] Failed to dispatch run.completed:", err));
    }

    return { success: true };
  }),

  compare: protectedProcedure.input(z.object({
    executionIdA: z.number(),
    executionIdB: z.number(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const loadExec = async (execId: number) => {
      const [exec] = await db.select().from(executions).where(eq(executions.id, execId)).limit(1);
      if (!exec) throw new TRPCError({ code: "NOT_FOUND", message: `Exécution #${execId} introuvable` });
      const [arts, incs, scenario, profile] = await Promise.all([
        db.select().from(artifacts).where(eq(artifacts.executionId, exec.uid)),
        db.select().from(incidents).where(eq(incidents.executionId, exec.uid)).orderBy(desc(incidents.detectedAt)),
        exec.scenarioId ? db.select().from(testScenarios).where(eq(testScenarios.uid, exec.scenarioId)).limit(1) : Promise.resolve([]),
        exec.profileId ? db.select().from(testProfiles).where(eq(testProfiles.uid, exec.profileId)).limit(1) : Promise.resolve([]),
      ]);
      return {
        ...exec,
        artifacts: arts,
        incidents: incs,
        scenario: scenario[0] ?? null,
        profile: profile[0] ?? null,
      };
    };

    const [a, b] = await Promise.all([loadExec(input.executionIdA), loadExec(input.executionIdB)]);

    // Build comparison summary
    const summary = {
      statusMatch: a.status === b.status,
      durationDiffMs: (a.durationMs ?? 0) - (b.durationMs ?? 0),
      artifactCountDiff: a.artifacts.length - b.artifacts.length,
      incidentCountDiff: a.incidents.length - b.incidents.length,
      sameScenario: a.scenarioId === b.scenarioId,
      sameProfile: a.profileId === b.profileId,
      sameEnv: a.targetEnv === b.targetEnv,
    };

    return { a, b, summary };
  }),
});

// ─── Captures ───────────────────────────────────────────────────────────────
export const capturesRouter = router({
  list: protectedProcedure.input(projectScopedList.extend({
    status: z.union([
      z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
      z.array(z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"])),
    ]).optional(),
    probeId: z.number().optional(),
    q: z.string().optional(),
    cursor: z.number().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    // captures.projectId is still int in DB
    const conditions: SQL[] = [eq(captures.projectId, Number(input.projectId))];
    if (input.status) {
      const statuses = Array.isArray(input.status) ? input.status : [input.status];
      if (statuses.length === 1) {
        conditions.push(eq(captures.status, statuses[0]));
      } else if (statuses.length > 1) {
        conditions.push(inArray(captures.status, statuses));
      }
    }
    if (input.probeId) {
      conditions.push(sql`JSON_EXTRACT(${captures.config}, '$.probeId') = ${input.probeId}`);
    }
    if (input.q && input.q.trim()) {
      conditions.push(like(captures.name, `%${input.q.trim()}%`));
    }
    if (input.search && input.search.trim()) {
      conditions.push(like(captures.name, `%${input.search.trim()}%`));
    }
    // Cursor-based: fetch items with id < cursor (descending order)
    if (input.cursor) conditions.push(sql`${captures.id} < ${input.cursor}`);
    const where = and(...conditions);
    const fetchSize = pageSize + 1;
    const rows = await db.select().from(captures).where(where).orderBy(desc(captures.id)).limit(fetchSize);
    const hasMore = rows.length > pageSize;
    const data = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;
    const [cnt] = await countRows(db, captures, where);
    const total = cnt?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, nextCursor, hasMore };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.string(), name: z.string().min(1), executionId: z.number().optional(),
    captureType: z.enum(["LOGS", "PCAP"]).default("PCAP"),
    targetType: z.enum(["K8S", "SSH", "PROBE"]).default("SSH"),
    probeId: z.number().optional(),
    config: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    if (input.targetType === "PROBE") {
      if (!input.probeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "probeId requis quand targetType=PROBE" });
      }
      const [probe] = await db.select().from(probes).where(eq(probes.id, input.probeId)).limit(1);
      if (!probe) throw new TRPCError({ code: "NOT_FOUND", message: "Sonde introuvable" });
    }
    let configValue = typeof input.config === 'object' && input.config ? { ...input.config } : {};
    if (input.targetType === "PROBE" && input.probeId) {
      configValue = { ...configValue, probeId: input.probeId };
    } else {
      delete (configValue as any).probeId;
    }
    const res = await db.insert(captures).values({
      projectId: Number(input.projectId), name: input.name, executionId: input.executionId ?? null,
      captureType: input.captureType, targetType: input.targetType,
      config: Object.keys(configValue).length ? configValue : null, status: "QUEUED", createdBy: ctx.user!.id,
    });
    return { success: true, captureId: Number(res[0].insertId) };
  }),
  delete: protectedProcedure.input(z.object({ captureId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(captures).where(eq(captures.id, input.captureId));
    return { success: true };
  }),
});

// ─── Probes ─────────────────────────────────────────────────────────────────
export const probesRouter = router({
  listLite: protectedProcedure.input(z.object({
    q: z.string().optional(),
    status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
  }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions: SQL[] = [];
    if (input?.status) conditions.push(eq(probes.status, input.status));
    if (input?.q) conditions.push(like(probes.site, `%${input.q}%`));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select({
      id: probes.id, site: probes.site, probeType: probes.probeType, status: probes.status,
    }).from(probes).where(where).orderBy(probes.site).limit(200);
    return rows;
  }),
  monitoring: protectedProcedure.input(z.object({
    q: z.string().optional(),
    probeType: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).optional(),
    status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
  }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions: SQL[] = [];
    if (input?.status) conditions.push(eq(probes.status, input.status));
    if (input?.probeType) conditions.push(eq(probes.probeType, input.probeType));
    if (input?.q) conditions.push(like(probes.site, `%${input.q}%`));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(probes).where(where).orderBy(probes.site).limit(500);
    const HEALTH_GREEN_SEC = Number(process.env.PROBE_HEALTH_GREEN_SEC ?? 60);
    const HEALTH_ORANGE_SEC = Number(process.env.PROBE_HEALTH_ORANGE_SEC ?? 300);
    const now = Date.now();
    const items = rows.map(p => {
      let health: "GREEN" | "ORANGE" | "RED" = "RED";
      if (p.status === "ONLINE" && p.lastSeenAt) {
        const ageSec = (now - new Date(p.lastSeenAt).getTime()) / 1000;
        if (ageSec <= HEALTH_GREEN_SEC) health = "GREEN";
        else if (ageSec <= HEALTH_ORANGE_SEC) health = "ORANGE";
        else health = "RED";
      } else if (p.status === "ONLINE") {
        health = "ORANGE";
      } else if (p.status === "DEGRADED") {
        health = "ORANGE";
      }
      return { ...p, health };
    });
    return { items, total: items.length };
  }),
  list: protectedProcedure.input(z.object({
    ...paginationInput.shape,
    cursor: z.number().optional(),
    status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
    probeType: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).optional(),
    search: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [];
    if (input.status) conditions.push(eq(probes.status, input.status));
    if (input.probeType) conditions.push(eq(probes.probeType, input.probeType));
    if (input.search) conditions.push(like(probes.site, `%${input.search}%`));
    if (input.cursor) conditions.push(lt(probes.id, input.cursor));
    const where = conditions.length ? and(...conditions) : undefined;
    const baseQuery = where ? db.select().from(probes).where(where) : db.select().from(probes);
    const [data, cnt] = await Promise.all([
      baseQuery.orderBy(desc(probes.createdAt)).limit(pageSize + 1).offset(input.cursor ? 0 : offset),
      countRows(db, probes, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    const hasMore = data.length > pageSize;
    const items = hasMore ? data.slice(0, pageSize) : data;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;
    return { data: items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }, hasMore, nextCursor };
  }),
  get: protectedProcedure.input(z.object({ probeId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(probes).where(eq(probes.id, input.probeId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Sonde introuvable" });
    const linkedCaptures = await db.select().from(captures)
      .where(and(eq(captures.targetType, "PROBE")))
      .orderBy(desc(captures.createdAt))
      .limit(50);
    const probeCaptures = linkedCaptures.filter((c: any) => {
      try {
        const cfg = typeof c.config === 'string' ? JSON.parse(c.config) : c.config;
        return cfg?.probeId === input.probeId;
      } catch { return false; }
    });
    return { ...r[0], captures: probeCaptures };
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1), probeType: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).default("LINUX_EDGE"),
    host: z.string().optional(), port: z.number().optional(),
    capabilities: z.any().optional(), config: z.any().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = (await import('crypto')).randomUUID();
    const res = await db.insert(probes).values({
      uid, site: input.name, probeType: input.probeType, status: "OFFLINE",
      zone: input.host || "default",
      capabilities: input.capabilities ?? null,
    });
    return { success: true, probeId: Number(res[0].insertId) };
  }),
  update: protectedProcedure.input(z.object({
    probeId: z.number(),
    name: z.string().optional(),
    probeType: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    capabilities: z.any().optional(),
    config: z.any().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.site = input.name;
    if (input.probeType !== undefined) u.probeType = input.probeType;
    if (input.host !== undefined) u.zone = input.host;
    if (input.capabilities !== undefined) u.capabilities = input.capabilities;
    if (Object.keys(u).length) await db.update(probes).set(u).where(eq(probes.id, input.probeId));
    return { success: true };
  }),
  updateStatus: protectedProcedure.input(z.object({
    probeId: z.number(),
    status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const updateSet: Record<string, unknown> = { status: input.status };
    if (input.status === "ONLINE") updateSet.lastSeenAt = new Date();
    await db.update(probes).set(updateSet).where(eq(probes.id, input.probeId));
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ probeId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(probes).where(eq(probes.id, input.probeId));
    return { success: true };
  }),
});

// ─── Generated Scripts ──────────────────────────────────────────────────────
export const scriptsRouter = router({
  list: protectedProcedure.input(projectScopedList).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(generatedScripts.projectId, input.projectId)];
    if (input.search) conditions.push(like(generatedScripts.framework, `%${input.search}%`));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(generatedScripts).where(where).orderBy(desc(generatedScripts.createdAt)).limit(pageSize).offset(offset),
      countRows(db, generatedScripts, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.string(), scenarioId: z.number().optional(),
    name: z.string().min(1), framework: z.string(), language: z.string().default("typescript"),
    code: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const uid = (await import("crypto")).randomUUID();
    const res = await db.insert(generatedScripts).values({
      uid,
      projectId: input.projectId, scenarioId: input.scenarioId ? String(input.scenarioId) : "",
      framework: input.framework || input.name, language: input.language,
      code: input.code, status: "DRAFT", createdBy: String(ctx.user!.id),
    });
    return { success: true, scriptId: Number(res[0].insertId) };
  }),
  update: protectedProcedure.input(z.object({
    scriptId: z.number(), name: z.string().optional(), code: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.code !== undefined) u.code = input.code;
    if (input.status !== undefined) u.status = input.status;
    if (Object.keys(u).length) await db.update(generatedScripts).set(u).where(eq(generatedScripts.id, input.scriptId));
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ scriptId: z.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    await db.delete(generatedScripts).where(eq(generatedScripts.id, input.scriptId));
    return { success: true };
  }),

  /** Get a single script by ID */
  get: protectedProcedure.input(z.object({ scriptId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [row] = await db.select().from(generatedScripts).where(eq(generatedScripts.id, input.scriptId)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Script not found" });
    return row;
  }),

  /** List all versions of scripts for the same scenario+framework (for diff viewer) */
  listVersions: protectedProcedure.input(z.object({
    projectId: z.string(),
    scenarioId: z.number(),
    framework: z.string().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions: SQL[] = [
      eq(generatedScripts.projectId, input.projectId),
      eq(generatedScripts.scenarioId, String(input.scenarioId)),
    ];
    if (input.framework) conditions.push(eq(generatedScripts.framework, input.framework));
    const data = await db.select().from(generatedScripts)
      .where(and(...conditions))
      .orderBy(desc(generatedScripts.createdAt));
    return { data };
  }),
});
