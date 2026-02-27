/**
 * Scenario Templates Router — Browse and import pre-built scenario templates.
 *
 * Procedures:
 *   - list: List templates with optional domain/testType/difficulty filters
 *   - get: Get a single template by id
 *   - importToProject: Import a template into a project as a new scenario + optional profile
 */
import { z } from "zod";
import { eq, and, sql, SQL, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { scenarioTemplates, testScenarios, testProfiles } from "../../drizzle/schema";
import { writeAuditLog } from "../lib/auditLog";
import { randomUUID } from "crypto";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db;
}

export const scenarioTemplatesRouter = router({
  /**
   * List templates with optional filters
   */
  list: protectedProcedure
    .input(z.object({
      domain: z.enum(["IMS", "5GC", "API_REST", "VOLTE", "DRIVE_TEST", "SECURITY", "PERFORMANCE"]).optional(),
      testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
      difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await requireDb();
      const filters: SQL[] = [];

      if (input?.domain) filters.push(eq(scenarioTemplates.domain, input.domain));
      if (input?.testType) filters.push(eq(scenarioTemplates.testType, input.testType));
      if (input?.difficulty) filters.push(eq(scenarioTemplates.difficulty, input.difficulty));
      if (input?.search) {
        filters.push(sql`(${scenarioTemplates.name} LIKE ${'%' + input.search + '%'} OR ${scenarioTemplates.description} LIKE ${'%' + input.search + '%'})`);
      }

      const where = filters.length > 0 ? and(...filters) : undefined;

      const rows = await db.select().from(scenarioTemplates)
        .where(where)
        .orderBy(scenarioTemplates.domain, scenarioTemplates.difficulty, scenarioTemplates.name);

      return rows.map(r => ({
        ...r,
        tags: r.tags as string[] | null,
        steps: r.steps as any[] | null,
        requiredDatasetTypes: r.requiredDatasetTypes as string[] | null,
      }));
    }),

  /**
   * Get a single template by id
   */
  get: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db.select().from(scenarioTemplates)
        .where(eq(scenarioTemplates.id, input.templateId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      return {
        ...row,
        tags: row.tags as string[] | null,
        steps: row.steps as any[] | null,
        requiredDatasetTypes: row.requiredDatasetTypes as string[] | null,
        artifactPolicy: row.artifactPolicy as any,
        kpiThresholds: row.kpiThresholds as Record<string, number> | null,
        profileTemplate: row.profileTemplate as Record<string, unknown> | null,
      };
    }),

  /**
   * Import a template into a project as a new scenario (+ optional profile)
   */
  importToProject: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      projectId: z.string(),
      scenarioName: z.string().optional(),
      createProfile: z.boolean().default(false),
      profileName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      // Fetch template
      const [tpl] = await db.select().from(scenarioTemplates)
        .where(eq(scenarioTemplates.id, input.templateId))
        .limit(1);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const scenarioUid = randomUUID();
      const scenarioCode = `TPL-${tpl.domain}-${Date.now().toString(36).toUpperCase()}`;
      const scenarioName = input.scenarioName || tpl.name;

      // Create profile if requested
      let profileUid: string | null = null;
      if (input.createProfile && tpl.profileTemplate) {
        profileUid = randomUUID();
        const profileConfig = tpl.profileTemplate as Record<string, unknown>;
        await db.insert(testProfiles).values({
          uid: profileUid,
          projectId: input.projectId,
          name: input.profileName || `Profil — ${tpl.name}`,
          protocol: (profileConfig.protocol as string) || "SIP",
          domain: tpl.domain,
          parameters: profileConfig,
        });
      }

      // Create scenario
      await db.insert(testScenarios).values({
        uid: scenarioUid,
        scenarioCode,
        projectId: input.projectId,
        profileId: profileUid || "",
        name: scenarioName,
        description: tpl.description,
        testType: tpl.testType,
        status: "DRAFT",
        version: 1,
        steps: tpl.steps,
        requiredDatasetTypes: tpl.requiredDatasetTypes,
        artifactPolicy: tpl.artifactPolicy,
        kpiThresholds: tpl.kpiThresholds,
      });

      // Audit log
      writeAuditLog({
        userId: ctx.user?.id ?? 0,
        action: "IMPORT_TEMPLATE",
        entity: "test_scenarios",
        entityId: scenarioUid,
        details: { templateId: tpl.id, templateUid: tpl.uid, domain: tpl.domain, projectId: input.projectId },
      });

      return {
        scenarioUid,
        scenarioCode,
        scenarioName,
        profileUid,
        templateDomain: tpl.domain,
        requiredDatasetTypes: tpl.requiredDatasetTypes as string[] | null,
      };
    }),
});
