import { z } from "zod";
import { eq, desc, and, like, or, SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  projects, projectMemberships, testProfiles, testScenarios,
  datasetTypes, datasetInstances, datasetBundles, bundleItems,
  generatedScripts,
} from "../../drizzle/schema";
import { paginationInput } from "../../shared/pagination";
import { normalizePagination, countRows } from "../lib/pagination";
import { writeAuditLog } from "../lib/auditLog";
import { randomUUID } from "crypto";

const listProjectsInput = z.object({
  ...paginationInput.shape,
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
  domain: z.string().optional(),
});

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

export const projectsRouter = router({
  list: protectedProcedure.input(listProjectsInput).query(async ({ input }) => {
    const db = await requireDb();
    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [];

    if (input.search) {
      const pattern = `%${input.search}%`;
      conditions.push(or(like(projects.name, pattern), like(projects.description, pattern))!);
    }
    if (input.status) conditions.push(eq(projects.status, input.status));
    if (input.domain) conditions.push(eq(projects.domain, input.domain));

    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db.select().from(projects).where(where).orderBy(desc(projects.createdAt)).limit(pageSize).offset(offset);
    const total = await countRows(db, projects, where);
    return { data: rows, pagination: { page, pageSize, total } };
  }),

  get: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ input }) => {
    const db = await requireDb();
    const [row] = await db.select().from(projects).where(eq(projects.uid, input.projectId)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable" });
    return row;
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      domain: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const uid = randomUUID();
      await db.insert(projects).values({
        uid,
        name: input.name,
        description: input.description || "",
        domain: input.domain || "IMS",
        status: "ACTIVE",
        createdBy: String(ctx.user!.id),
      });
      await db.insert(projectMemberships).values({
        uid: randomUUID(),
        projectId: uid,
        userId: String(ctx.user!.id),
        userName: ctx.user!.name || "",
        role: "PROJECT_ADMIN",
      });
      await writeAuditLog({
        userId: ctx.user!.id,
        action: "PROJECT_CREATED",
        entity: "project",
        entityId: uid,
        details: { name: input.name },
      });
      return { uid };
    }),

  update: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      domain: z.string().optional(),
      status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const updates: Record<string, any> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.domain !== undefined) updates.domain = input.domain;
      if (input.status !== undefined) updates.status = input.status;
      if (Object.keys(updates).length === 0) return { success: true };
      await db.update(projects).set(updates).where(eq(projects.uid, input.projectId));
      await writeAuditLog({
        userId: ctx.user!.id,
        action: "PROJECT_UPDATED",
        entity: "project",
        entityId: input.projectId,
        details: updates,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      const existing = await db.select().from(projects).where(eq(projects.uid, input.projectId)).limit(1);
      if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable" });
      await db.delete(projectMemberships).where(eq(projectMemberships.projectId, input.projectId));
      await db.delete(projects).where(eq(projects.uid, input.projectId));
      await writeAuditLog({
        userId: ctx.user!.id,
        action: "PROJECT_DELETED",
        entity: "project",
        entityId: String(input.projectId),
        details: { name: existing[0].name },
      });
      return { success: true };
    }),

  /**
   * Export a complete project as JSON (scenarios, profiles, datasets, bundles, scripts)
   */
  exportProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const [project] = await db.select().from(projects).where(eq(projects.uid, input.projectId)).limit(1);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable" });

      const profileRows = await db.select().from(testProfiles).where(eq(testProfiles.projectId, input.projectId));
      const scenarioRows = await db.select().from(testScenarios).where(eq(testScenarios.projectId, input.projectId));
      const datasetTypeRows = await db.select().from(datasetTypes);
      const datasetInstanceRows = await db.select().from(datasetInstances).where(eq(datasetInstances.projectId, input.projectId));
      const bundleRows = await db.select().from(datasetBundles).where(eq(datasetBundles.projectId, input.projectId));
      const projectAutoId = project.id;
      const scriptRows = await db.select().from(generatedScripts).where(eq(generatedScripts.projectId, input.projectId));

      // Fetch bundle items for each bundle
      const allBundleItems: Record<string, any[]> = {};
      for (const b of bundleRows) {
        const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, b.uid));
        allBundleItems[b.uid] = items;
      }

      return {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        project: {
          name: project.name,
          description: project.description,
          domain: project.domain,
          status: project.status,
        },
        profiles: profileRows.map((p) => ({
          uid: p.uid,
          name: p.name,
          description: p.description,
          protocol: p.protocol,
          domain: p.domain,
          profileType: p.profileType,
          testType: p.testType,
          targetHost: p.targetHost,
          targetPort: p.targetPort,
          parameters: p.parameters,
          config: p.config,
        })),
        scenarios: scenarioRows.map((s) => ({
          uid: s.uid,
          scenarioCode: s.scenarioCode,
          name: s.name,
          description: s.description,
          testType: s.testType,
          status: s.status,
          version: s.version,
          steps: s.steps,
          requiredDatasetTypes: s.requiredDatasetTypes,
          profileId: s.profileId,
        })),
        datasetTypes: datasetTypeRows.map((dt) => ({
          datasetTypeId: dt.datasetTypeId,
          domain: dt.domain,
          testType: dt.testType,
          name: dt.name,
          description: dt.description,
          schemaFields: dt.schemaFields,
        })),
        datasetInstances: datasetInstanceRows.map((di) => ({
          uid: di.uid,
          datasetTypeId: di.datasetTypeId,
          env: di.env,
          version: di.version,
          status: di.status,
          valuesJson: di.valuesJson,
          notes: di.notes,
        })),
        bundles: bundleRows.map((b) => ({
          uid: b.uid,
          name: b.name,
          env: b.env,
          version: b.version,
          status: b.status,
          tags: b.tags,
          items: (allBundleItems[b.uid] || []).map((item: any) => ({
            datasetId: item.datasetId,
            alias: item.alias,
          })),
        })),
        scripts: scriptRows.map((s) => ({
          name: s.framework,
          scenarioId: s.scenarioId,
          framework: s.framework,
          language: s.language,
          code: s.code,
          version: s.version,
          status: s.status,
        })),
      };
    }),

  /**
   * Import a complete project from JSON export
   */
  importProject: protectedProcedure
    .input(z.object({
      data: z.any(),
      targetProjectId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const exportData = input.data;
      if (!exportData?.version || !exportData?.project) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Format d'export invalide" });
      }

      let projectId = input.targetProjectId;
      let projectAutoId: number | null = null;

      // Create new project if no target
      if (!projectId) {
        const newUid = randomUUID();
        const [result] = await db.insert(projects).values({
          uid: newUid,
          name: `${exportData.project.name} (import)`,
          description: exportData.project.description || "",
          domain: exportData.project.domain || "IMS",
          status: "ACTIVE",
          createdBy: String(ctx.user!.id),
        }).$returningId();
        projectId = newUid;
        projectAutoId = result.id;

        await db.insert(projectMemberships).values({
          uid: randomUUID(),
          projectId: newUid,
          userId: String(ctx.user!.id),
          userName: ctx.user!.name || "",
          role: "PROJECT_ADMIN",
        });
      } else {
        const [existing] = await db.select().from(projects).where(eq(projects.uid, projectId)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Projet cible introuvable" });
        projectAutoId = existing.id;
      }

      // Map old UIDs to new UIDs
      const profileUidMap = new Map<string, string>();
      const instanceUidMap = new Map<string, string>();

      // Import profiles
      if (exportData.profiles?.length) {
        for (const p of exportData.profiles) {
          const newUid = randomUUID();
          if (p.uid) profileUidMap.set(p.uid, newUid);
          await db.insert(testProfiles).values({
            uid: newUid,
            projectId: projectId!,
            name: p.name || "Imported Profile",
            description: p.description || "",
            protocol: p.protocol || "SIP",
            testType: p.testType || "VABF",
            domain: p.domain || null,
            profileType: p.profileType || null,
            targetHost: p.targetHost || null,
            targetPort: p.targetPort || null,
            parameters: p.parameters || {},
            config: p.config || {},
          });
        }
      }

      // Import scenarios
      if (exportData.scenarios?.length) {
        for (const s of exportData.scenarios) {
          const newUid = randomUUID();
          const profileId = s.profileId ? (profileUidMap.get(s.profileId) || s.profileId) : "";
          await db.insert(testScenarios).values({
            uid: newUid,
            projectId: projectId!,
            scenarioCode: s.scenarioCode || `SC-${Date.now().toString(36).toUpperCase()}`,
            name: s.name || "Imported Scenario",
            description: s.description || "",
            testType: s.testType || "VABF",
            status: "DRAFT",
            version: 1,
            steps: s.steps || [],
            requiredDatasetTypes: s.requiredDatasetTypes || [],
            profileId,
          });
        }
      }

      // Import dataset instances
      if (exportData.datasetInstances?.length) {
        for (const di of exportData.datasetInstances) {
          const newUid = randomUUID();
          const [result] = await db.insert(datasetInstances).values({
            uid: newUid,
            projectId: projectId!,
            datasetTypeId: di.datasetTypeId || "unknown",
            env: di.env || "DEV",
            version: di.version || 1,
            status: di.status || "DRAFT",
            valuesJson: di.valuesJson || {},
            notes: di.notes || "",
          }).$returningId();
          if (di.uid) instanceUidMap.set(di.uid, newUid);
        }
      }

      // Import bundles
      if (exportData.bundles?.length) {
        for (const b of exportData.bundles) {
          const newUid = randomUUID();
          const [bundleResult] = await db.insert(datasetBundles).values({
            uid: newUid,
            projectId: projectId!,
            name: b.name || "Imported Bundle",
            env: b.env || "DEV",
            version: b.version || 1,
            status: b.status || "DRAFT",
            tags: b.tags || [],
          }).$returningId();

          if (b.items?.length) {
            for (const item of b.items) {
              const newInstanceUid = item.datasetId
                ? (instanceUidMap.get(item.datasetId) || null)
                : null;
              if (newInstanceUid) {
                await db.insert(bundleItems).values({
                  bundleId: newUid,
                  datasetId: newInstanceUid,
                });
              }
            }
          }
        }
      }

      // Import scripts (if projectAutoId is available)
      if (exportData.scripts?.length) {
        for (const s of exportData.scripts) {
          await db.insert(generatedScripts).values({
            uid: randomUUID(),
            projectId: projectId!,
            scenarioId: s.scenarioId || "",
            framework: s.name || s.framework || "playwright",
            language: s.language || "typescript",
            code: s.code || "",
            version: s.version || 1,
            status: s.status || "DRAFT",
            createdBy: String(ctx.user!.id),
          });
        }
      }

      await writeAuditLog({
        userId: ctx.user!.id,
        action: "PROJECT_IMPORTED",
        entity: "project",
        entityId: projectId!,
        details: {
          sourceName: exportData.project.name,
          profiles: exportData.profiles?.length || 0,
          scenarios: exportData.scenarios?.length || 0,
          datasetInstances: exportData.datasetInstances?.length || 0,
          bundles: exportData.bundles?.length || 0,
          scripts: exportData.scripts?.length || 0,
        },
      });

      return { projectId, success: true };
    }),
});
