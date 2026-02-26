import { z } from "zod";
import { eq, desc, and, like, SQL } from "drizzle-orm";
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

// ─── Shared inputs ──────────────────────────────────────────────────────────
const projectScopedList = z.object({
  ...paginationInput.shape,
  projectId: z.number(),
  search: z.string().optional(),
});

// ─── Profiles ───────────────────────────────────────────────────────────────
export const profilesRouter = router({
  list: protectedProcedure.input(projectScopedList).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(testProfiles.projectId, input.projectId)];
    if (input.search) conditions.push(like(testProfiles.name, `%${input.search}%`));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(testProfiles).where(where).orderBy(desc(testProfiles.createdAt)).limit(pageSize).offset(offset),
      countRows(db, testProfiles, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  get: protectedProcedure.input(z.object({ profileId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(testProfiles).where(eq(testProfiles.id, input.profileId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Profil introuvable" });
    return r[0];
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.number(), name: z.string().min(1), description: z.string().optional(),
    profileType: z.string().default("WEB"), config: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const res = await db.insert(testProfiles).values({
      projectId: input.projectId, name: input.name, description: input.description ?? null,
      profileType: input.profileType, config: input.config ?? null, createdBy: ctx.user!.id,
    });
    await writeAuditLog({ userId: ctx.user!.id, action: "PROFILE_CREATED", entity: "test_profile", entityId: String(res[0].insertId) });
    return { success: true, profileId: Number(res[0].insertId) };
  }),
  update: protectedProcedure.input(z.object({
    profileId: z.number(), name: z.string().optional(), description: z.string().optional(),
    profileType: z.string().optional(), config: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.description !== undefined) u.description = input.description;
    if (input.profileType !== undefined) u.profileType = input.profileType;
    if (input.config !== undefined) u.config = input.config;
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
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(testScenarios.projectId, input.projectId)];
    if (input.search) conditions.push(like(testScenarios.name, `%${input.search}%`));
    if (input.testType) conditions.push(eq(testScenarios.testType, input.testType));
    if (input.status) conditions.push(eq(testScenarios.status, input.status));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(testScenarios).where(where).orderBy(desc(testScenarios.createdAt)).limit(pageSize).offset(offset),
      countRows(db, testScenarios, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  get: protectedProcedure.input(z.object({ scenarioId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(testScenarios).where(eq(testScenarios.id, input.scenarioId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Scénario introuvable" });
    return r[0];
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.number(), name: z.string().min(1), description: z.string().optional(),
    profileId: z.number().optional(), testType: z.enum(["VABF", "VSR", "VABE"]).default("VABF"),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT"),
    priority: z.enum(["P0", "P1", "P2"]).default("P1"), steps: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const res = await db.insert(testScenarios).values({
      projectId: input.projectId, name: input.name, description: input.description ?? null,
      profileId: input.profileId ?? null, testType: input.testType, status: input.status,
      priority: input.priority, steps: input.steps ?? null, createdBy: ctx.user!.id,
    });
    await writeAuditLog({ userId: ctx.user!.id, action: "SCENARIO_CREATED", entity: "test_scenario", entityId: String(res[0].insertId) });
    return { success: true, scenarioId: Number(res[0].insertId) };
  }),
  update: protectedProcedure.input(z.object({
    scenarioId: z.number(), name: z.string().optional(), description: z.string().optional(),
    testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).optional(),
    priority: z.enum(["P0", "P1", "P2"]).optional(), steps: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.description !== undefined) u.description = input.description;
    if (input.testType !== undefined) u.testType = input.testType;
    if (input.status !== undefined) u.status = input.status;
    if (input.priority !== undefined) u.priority = input.priority;
    if (input.steps !== undefined) u.steps = input.steps;
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
    if (input.datasetType) conditions.push(eq(datasets.datasetType, input.datasetType));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(datasets).where(where).orderBy(desc(datasets.createdAt)).limit(pageSize).offset(offset),
      countRows(db, datasets, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.number(), name: z.string().min(1), description: z.string().optional(),
    datasetType: z.string(), data: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const res = await db.insert(datasets).values({
      projectId: input.projectId, name: input.name, description: input.description ?? null,
      datasetType: input.datasetType, data: input.data ?? null, createdBy: ctx.user!.id,
    });
    return { success: true, datasetId: Number(res[0].insertId) };
  }),
  update: protectedProcedure.input(z.object({
    datasetId: z.number(), name: z.string().optional(), description: z.string().optional(),
    datasetType: z.string().optional(), data: z.any().optional(),
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const u: Record<string, unknown> = {};
    if (input.name !== undefined) u.name = input.name;
    if (input.description !== undefined) u.description = input.description;
    if (input.datasetType !== undefined) u.datasetType = input.datasetType;
    if (input.data !== undefined) u.data = input.data;
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
    scenarioId: z.number().optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(executions.projectId, input.projectId)];
    if (input.status) conditions.push(eq(executions.status, input.status));
    if (input.scenarioId) conditions.push(eq(executions.scenarioId, input.scenarioId));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(executions).where(where).orderBy(desc(executions.createdAt)).limit(pageSize).offset(offset),
      countRows(db, executions, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  get: protectedProcedure.input(z.object({ executionId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(executions).where(eq(executions.id, input.executionId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Exécution introuvable" });
    // Fetch related data in parallel
    const [arts, incs, analyses, scenario, profile] = await Promise.all([
      db.select().from(artifacts).where(eq(artifacts.executionId, input.executionId)),
      db.select().from(incidents).where(eq(incidents.executionId, input.executionId)).orderBy(desc(incidents.createdAt)),
      db.select().from(aiAnalyses).where(eq(aiAnalyses.executionId, input.executionId)).orderBy(desc(aiAnalyses.createdAt)),
      r[0].scenarioId ? db.select().from(testScenarios).where(eq(testScenarios.id, r[0].scenarioId)).limit(1) : Promise.resolve([]),
      r[0].profileId ? db.select().from(testProfiles).where(eq(testProfiles.id, r[0].profileId)).limit(1) : Promise.resolve([]),
    ]);
    return {
      ...r[0],
      artifacts: arts,
      incidents: incs,
      analyses,
      scenario: scenario[0] ?? null,
      profile: profile[0] ?? null,
    };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.number(), profileId: z.number().optional(), scenarioId: z.number().optional(),
    runnerType: z.string().optional(), scriptId: z.string().optional(),
    targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).default("DEV"),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const res = await db.insert(executions).values({
      projectId: input.projectId, profileId: input.profileId ?? null,
      scenarioId: input.scenarioId ?? null, status: "PENDING",
      runnerType: input.runnerType ?? null, scriptId: input.scriptId ?? null,
      targetEnv: input.targetEnv, createdBy: ctx.user!.id,
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
    return { success: true };
  }),
});

// ─── Captures ───────────────────────────────────────────────────────────────
export const capturesRouter = router({
  list: protectedProcedure.input(projectScopedList.extend({
    status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).optional(),
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [eq(captures.projectId, input.projectId)];
    if (input.status) conditions.push(eq(captures.status, input.status));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(captures).where(where).orderBy(desc(captures.createdAt)).limit(pageSize).offset(offset),
      countRows(db, captures, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.number(), name: z.string().min(1), executionId: z.number().optional(),
    captureType: z.enum(["LOGS", "PCAP"]).default("PCAP"),
    targetType: z.enum(["K8S", "SSH", "PROBE"]).default("SSH"),
    probeId: z.number().optional(),
    config: z.any().optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Validate probeId when targetType is PROBE
    if (input.targetType === "PROBE") {
      if (!input.probeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "probeId requis quand targetType=PROBE" });
      }
      // Verify probe exists and is ONLINE
      const [probe] = await db.select().from(probes).where(eq(probes.id, input.probeId)).limit(1);
      if (!probe) throw new TRPCError({ code: "NOT_FOUND", message: "Sonde introuvable" });
    }
    // Build config: merge probeId into config JSON when targetType=PROBE
    let configValue = typeof input.config === 'object' && input.config ? { ...input.config } : {};
    if (input.targetType === "PROBE" && input.probeId) {
      configValue = { ...configValue, probeId: input.probeId };
    } else {
      // Strip probeId from config if not PROBE target
      delete (configValue as any).probeId;
    }
    const res = await db.insert(captures).values({
      projectId: input.projectId, name: input.name, executionId: input.executionId ?? null,
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
  /** Lightweight list for dropdowns (id, name, type, status) */
  listLite: protectedProcedure.input(z.object({
    q: z.string().optional(),
    status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
  }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const conditions: SQL[] = [];
    if (input?.status) conditions.push(eq(probes.status, input.status));
    if (input?.q) conditions.push(like(probes.name, `%${input.q}%`));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select({
      id: probes.id, name: probes.name, probeType: probes.probeType, status: probes.status,
    }).from(probes).where(where).orderBy(probes.name).limit(200);
    return rows;
  }),
  /** Monitoring endpoint with server-side health calculation */
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
    if (input?.q) conditions.push(like(probes.name, `%${input.q}%`));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(probes).where(where).orderBy(probes.name).limit(500);
    // Server-side health calculation
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
        health = "ORANGE"; // ONLINE but no heartbeat
      } else if (p.status === "DEGRADED") {
        health = "ORANGE";
      }
      return { ...p, health };
    });
    return { items, total: items.length };
  }),
  list: protectedProcedure.input(z.object({
    ...paginationInput.shape,
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
    if (input.search) conditions.push(like(probes.name, `%${input.search}%`));
    const where = conditions.length ? and(...conditions) : undefined;
    const baseQuery = where ? db.select().from(probes).where(where) : db.select().from(probes);
    const [data, cnt] = await Promise.all([
      baseQuery.orderBy(desc(probes.createdAt)).limit(pageSize).offset(offset),
      countRows(db, probes, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  get: protectedProcedure.input(z.object({ probeId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const r = await db.select().from(probes).where(eq(probes.id, input.probeId)).limit(1);
    if (!r.length) throw new TRPCError({ code: "NOT_FOUND", message: "Sonde introuvable" });
    // Fetch captures linked to this probe (targetType = PROBE)
    const linkedCaptures = await db.select().from(captures)
      .where(and(eq(captures.targetType, "PROBE")))
      .orderBy(desc(captures.createdAt))
      .limit(50);
    // Filter captures whose config references this probe
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
    const res = await db.insert(probes).values({
      name: input.name, probeType: input.probeType, status: "OFFLINE",
      host: input.host ?? null, port: input.port ?? null,
      capabilities: input.capabilities ?? null, config: input.config ?? null,
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
    if (input.name !== undefined) u.name = input.name;
    if (input.probeType !== undefined) u.probeType = input.probeType;
    if (input.host !== undefined) u.host = input.host;
    if (input.port !== undefined) u.port = input.port;
    if (input.capabilities !== undefined) u.capabilities = input.capabilities;
    if (input.config !== undefined) u.config = input.config;
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
    if (input.search) conditions.push(like(generatedScripts.name, `%${input.search}%`));
    const where = and(...conditions);
    const [data, cnt] = await Promise.all([
      db.select().from(generatedScripts).where(where).orderBy(desc(generatedScripts.createdAt)).limit(pageSize).offset(offset),
      countRows(db, generatedScripts, where),
    ]);
    const total = cnt[0]?.count ?? 0;
    return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }),
  create: protectedProcedure.input(z.object({
    projectId: z.number(), scenarioId: z.number().optional(),
    name: z.string().min(1), framework: z.string(), language: z.string().default("typescript"),
    code: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const res = await db.insert(generatedScripts).values({
      projectId: input.projectId, scenarioId: input.scenarioId ?? null,
      name: input.name, framework: input.framework, language: input.language,
      code: input.code, status: "DRAFT", createdBy: ctx.user!.id,
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
});
