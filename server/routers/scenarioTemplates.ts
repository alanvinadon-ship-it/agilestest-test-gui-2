/**
 * Scenario Templates Router — Browse, import, publish, rate, and comment on templates.
 *
 * Procedures:
 *   - list: List templates with optional domain/testType/difficulty filters
 *   - listCommunity: List only user-published templates (non-built-in)
 *   - get: Get a single template by id with ratings + comments
 *   - importToProject: Import a template into a project as a new scenario + optional profile
 *   - publish: Publish a user's scenario as a community template
 *   - rate: Rate a template (1-5, upsert)
 *   - addComment: Add a comment to a template
 *   - deleteComment: Delete own comment
 */
import { z } from "zod";
import { eq, and, sql, SQL, desc, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  scenarioTemplates, testScenarios, testProfiles,
  templateRatings, templateComments,
} from "../../drizzle/schema";
import { writeAuditLog } from "../lib/auditLog";
import { randomUUID } from "crypto";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db;
}

export const scenarioTemplatesRouter = router({
  /**
   * List templates with optional filters (all templates: built-in + community)
   */
  list: protectedProcedure
    .input(z.object({
      domain: z.enum(["IMS", "5GC", "API_REST", "VOLTE", "DRIVE_TEST", "SECURITY", "PERFORMANCE"]).optional(),
      testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
      difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
      search: z.string().optional(),
      communityOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await requireDb();
      const filters: SQL[] = [];

      if (input?.domain) filters.push(eq(scenarioTemplates.domain, input.domain));
      if (input?.testType) filters.push(eq(scenarioTemplates.testType, input.testType));
      if (input?.difficulty) filters.push(eq(scenarioTemplates.difficulty, input.difficulty));
      if (input?.communityOnly) filters.push(eq(scenarioTemplates.isBuiltIn, false));
      if (input?.search) {
        filters.push(sql`(${scenarioTemplates.name} LIKE ${'%' + input.search + '%'} OR ${scenarioTemplates.description} LIKE ${'%' + input.search + '%'})`);
      }

      const where = filters.length > 0 ? and(...filters) : undefined;

      const rows = await db.select().from(scenarioTemplates)
        .where(where)
        .orderBy(desc(scenarioTemplates.avgRating), scenarioTemplates.domain, scenarioTemplates.name);

      return rows.map(r => ({
        ...r,
        tags: r.tags as string[] | null,
        steps: r.steps as any[] | null,
        requiredDatasetTypes: r.requiredDatasetTypes as string[] | null,
      }));
    }),

  /**
   * Get a single template by id — includes ratings summary and comments
   */
  get: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db.select().from(scenarioTemplates)
        .where(eq(scenarioTemplates.id, input.templateId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      // Fetch comments
      const comments = await db.select().from(templateComments)
        .where(eq(templateComments.templateUid, row.uid))
        .orderBy(desc(templateComments.createdAt));

      // Fetch ratings distribution
      const ratings = await db.select().from(templateRatings)
        .where(eq(templateRatings.templateUid, row.uid));

      return {
        ...row,
        tags: row.tags as string[] | null,
        steps: row.steps as any[] | null,
        requiredDatasetTypes: row.requiredDatasetTypes as string[] | null,
        artifactPolicy: row.artifactPolicy as any,
        kpiThresholds: row.kpiThresholds as Record<string, number> | null,
        profileTemplate: row.profileTemplate as Record<string, unknown> | null,
        comments,
        ratings,
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

      const [tpl] = await db.select().from(scenarioTemplates)
        .where(eq(scenarioTemplates.id, input.templateId))
        .limit(1);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const scenarioUid = randomUUID();
      const scenarioCode = `TPL-${tpl.domain}-${Date.now().toString(36).toUpperCase()}`;
      const scenarioName = input.scenarioName || tpl.name;

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

      // Increment usage count
      await db.update(scenarioTemplates)
        .set({ usageCount: sql`COALESCE(${scenarioTemplates.usageCount}, 0) + 1` })
        .where(eq(scenarioTemplates.id, input.templateId));

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

  /**
   * Publish a user's scenario as a community template
   */
  publish: protectedProcedure
    .input(z.object({
      scenarioId: z.number(), // scenario auto-increment id
      projectId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      // Fetch the scenario
      const [scenario] = await db.select().from(testScenarios)
        .where(and(
          eq(testScenarios.id, input.scenarioId),
          eq(testScenarios.projectId, input.projectId),
        ))
        .limit(1);
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scénario introuvable" });

      // Fetch associated profile if any
      let profileTemplate: Record<string, unknown> | null = null;
      if (scenario.profileId) {
        const [profile] = await db.select().from(testProfiles)
          .where(eq(testProfiles.uid, scenario.profileId))
          .limit(1);
        if (profile) {
          profileTemplate = {
            protocol: profile.protocol,
            domain: profile.domain,
            ...(profile.parameters as Record<string, unknown> ?? {}),
          };
        }
      }

      const templateUid = randomUUID();
      await db.insert(scenarioTemplates).values({
        uid: templateUid,
        domain: (scenario as any).domain || "API_REST",
        name: scenario.name,
        description: scenario.description,
        testType: scenario.testType,
        difficulty: "INTERMEDIATE",
        tags: [],
        steps: scenario.steps,
        requiredDatasetTypes: scenario.requiredDatasetTypes,
        artifactPolicy: scenario.artifactPolicy,
        kpiThresholds: scenario.kpiThresholds,
        profileTemplate,
        isBuiltIn: false,
        publishedByOpenId: ctx.user?.openId ?? null,
        publishedByName: ctx.user?.name ?? null,
        publishedAt: new Date(),
        avgRating: 0,
        ratingCount: 0,
        usageCount: 0,
      });

      writeAuditLog({
        userId: ctx.user?.id ?? 0,
        action: "PUBLISH_TEMPLATE",
        entity: "scenario_templates",
        entityId: templateUid,
        details: { scenarioId: input.scenarioId, projectId: input.projectId },
      });

      return { templateUid, name: scenario.name };
    }),

  /**
   * Rate a template (1-5, upsert per user)
   */
  rate: protectedProcedure
    .input(z.object({
      templateUid: z.string(),
      rating: z.number().min(1).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const userOpenId = ctx.user?.openId ?? "";
      const userName = ctx.user?.name ?? null;

      // Check template exists
      const [tpl] = await db.select({ id: scenarioTemplates.id, uid: scenarioTemplates.uid })
        .from(scenarioTemplates)
        .where(eq(scenarioTemplates.uid, input.templateUid))
        .limit(1);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      // Upsert rating
      const [existing] = await db.select().from(templateRatings)
        .where(and(
          eq(templateRatings.templateUid, input.templateUid),
          eq(templateRatings.userOpenId, userOpenId),
        ))
        .limit(1);

      if (existing) {
        await db.update(templateRatings)
          .set({ rating: input.rating, userName })
          .where(eq(templateRatings.id, existing.id));
      } else {
        await db.insert(templateRatings).values({
          templateUid: input.templateUid,
          userOpenId,
          userName,
          rating: input.rating,
        });
      }

      // Recalculate average
      const [stats] = await db.select({
        avg: sql<number>`AVG(${templateRatings.rating})`,
        count: sql<number>`COUNT(*)`,
      }).from(templateRatings)
        .where(eq(templateRatings.templateUid, input.templateUid));

      await db.update(scenarioTemplates)
        .set({
          avgRating: stats?.avg ?? 0,
          ratingCount: stats?.count ?? 0,
        })
        .where(eq(scenarioTemplates.uid, input.templateUid));

      return { avgRating: stats?.avg ?? 0, ratingCount: stats?.count ?? 0 };
    }),

  /**
   * Add a comment to a template
   */
  addComment: protectedProcedure
    .input(z.object({
      templateUid: z.string(),
      content: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const userOpenId = ctx.user?.openId ?? "";
      const userName = ctx.user?.name ?? null;

      // Check template exists
      const [tpl] = await db.select({ uid: scenarioTemplates.uid })
        .from(scenarioTemplates)
        .where(eq(scenarioTemplates.uid, input.templateUid))
        .limit(1);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const commentUid = randomUUID();
      await db.insert(templateComments).values({
        uid: commentUid,
        templateUid: input.templateUid,
        userOpenId,
        userName,
        content: input.content,
      });

      return { uid: commentUid };
    }),

  /**
   * Delete own comment
   */
  deleteComment: protectedProcedure
    .input(z.object({ commentUid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const userOpenId = ctx.user?.openId ?? "";

      const [comment] = await db.select().from(templateComments)
        .where(eq(templateComments.uid, input.commentUid))
        .limit(1);
      if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "Commentaire introuvable" });
      if (comment.userOpenId !== userOpenId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez supprimer que vos propres commentaires" });
      }

      await db.delete(templateComments).where(eq(templateComments.uid, input.commentUid));
      return { success: true };
    }),
});
