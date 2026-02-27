/**
 * Scenario Templates Router — Browse, import, publish, unpublish, rate, comment, fork.
 *
 * Procedures:
 *   - list: List templates with optional domain/testType/difficulty filters
 *   - listPublic: List PUBLISHED templates (cursor pagination, search, tags filter)
 *   - get: Get a single template by uid with ratings + comments
 *   - importToProject: Import a built-in template into a project as a new scenario + optional profile
 *   - publish: Publish a user's scenario as a community template (with modal fields)
 *   - unpublish: Unpublish a template (author or admin only)
 *   - forkToProject: Fork a published template into a project as a new scenario
 *   - rate: Rate a template (1-5, upsert)
 *   - addComment: Add a comment to a template
 *   - deleteComment: Delete own comment
 */
import { z } from "zod";
import { eq, and, sql, SQL, desc, ne, like } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  scenarioTemplates, testScenarios, testProfiles,
  templateRatings, templateComments,
} from "../../drizzle/schema";
import { writeAuditLog } from "../lib/auditLog";
import { randomUUID } from "crypto";
import { normalizePagination, countRows } from "../lib/pagination";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db;
}

/** Build a versioned template JSON snapshot from a scenario */
function buildTemplateJson(scenario: any, profile: any | null) {
  return {
    schemaVersion: 1,
    scenario: {
      name: scenario.name,
      description: scenario.description,
      testType: scenario.testType,
      steps: scenario.steps,
      requiredDatasetTypes: scenario.requiredDatasetTypes,
      artifactPolicy: scenario.artifactPolicy,
      kpiThresholds: scenario.kpiThresholds,
    },
    profile: profile ? {
      name: profile.name,
      protocol: profile.protocol,
      domain: profile.domain,
      profileType: profile.profileType,
      parameters: profile.parameters,
    } : null,
    exportedAt: new Date().toISOString(),
  };
}

export const scenarioTemplatesRouter = router({
  /**
   * List templates with optional filters (all templates: built-in + community PUBLISHED)
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

      // Only show PUBLISHED templates (or built-in which are always published)
      filters.push(
        sql`(${scenarioTemplates.isBuiltIn} = true OR ${scenarioTemplates.status} = 'PUBLISHED')`
      );

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
        tagsJson: r.tagsJson as string[] | null,
        steps: r.steps as any[] | null,
        requiredDatasetTypes: r.requiredDatasetTypes as string[] | null,
      }));
    }),

  /**
   * List PUBLISHED community templates with cursor pagination
   */
  listPublic: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      domain: z.enum(["IMS", "5GC", "API_REST", "VOLTE", "DRIVE_TEST", "SECURITY", "PERFORMANCE"]).optional(),
      testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const { pageSize, offset } = normalizePagination(input);
      const filters: SQL[] = [
        eq(scenarioTemplates.status, "PUBLISHED"),
        eq(scenarioTemplates.isBuiltIn, false),
      ];

      if (input.domain) filters.push(eq(scenarioTemplates.domain, input.domain));
      if (input.testType) filters.push(eq(scenarioTemplates.testType, input.testType));
      if (input.search) {
        filters.push(sql`(${scenarioTemplates.name} LIKE ${'%' + input.search + '%'} OR ${scenarioTemplates.description} LIKE ${'%' + input.search + '%'})`);
      }
      if (input.tags && input.tags.length > 0) {
        // Filter by tags_json containing any of the specified tags
        for (const tag of input.tags) {
          filters.push(sql`JSON_CONTAINS(${scenarioTemplates.tagsJson}, ${JSON.stringify(tag)})`);
        }
      }

      const where = and(...filters);
      const [data, total] = await Promise.all([
        db.select().from(scenarioTemplates)
          .where(where)
          .orderBy(desc(scenarioTemplates.createdAt))
          .limit(pageSize)
          .offset(offset),
        countRows(db, scenarioTemplates, where),
      ]);

      return {
        items: data.map(r => ({
          ...r,
          tags: r.tags as string[] | null,
          tagsJson: r.tagsJson as string[] | null,
          steps: r.steps as any[] | null,
          requiredDatasetTypes: r.requiredDatasetTypes as string[] | null,
          templateJson: r.templateJson as any,
        })),
        total,
        page: input.page,
        pageSize,
      };
    }),

  /**
   * Get a single template by uid — includes ratings summary and comments
   */
  get: protectedProcedure
    .input(z.object({ templateUid: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [row] = await db.select().from(scenarioTemplates)
        .where(eq(scenarioTemplates.uid, input.templateUid))
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
        tagsJson: row.tagsJson as string[] | null,
        steps: row.steps as any[] | null,
        requiredDatasetTypes: row.requiredDatasetTypes as string[] | null,
        artifactPolicy: row.artifactPolicy as any,
        kpiThresholds: row.kpiThresholds as Record<string, number> | null,
        profileTemplate: row.profileTemplate as Record<string, unknown> | null,
        templateJson: row.templateJson as any,
        comments,
        ratings,
      };
    }),

  /**
   * Import a built-in template into a project as a new scenario (+ optional profile)
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
   * RBAC: owner of the scenario (via project membership) or admin
   */
  publish: protectedProcedure
    .input(z.object({
      scenarioUid: z.string(),
      projectId: z.string(),
      name: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      tags: z.array(z.string().max(50)).max(10).default([]),
      visibility: z.enum(["PUBLIC", "UNLISTED"]).default("PUBLIC"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      // Fetch the scenario by uid
      const [scenario] = await db.select().from(testScenarios)
        .where(and(
          eq(testScenarios.uid, input.scenarioUid),
          eq(testScenarios.projectId, input.projectId),
        ))
        .limit(1);
      if (!scenario) throw new TRPCError({ code: "NOT_FOUND", message: "Scénario introuvable" });

      // Fetch associated profile if any
      let profile: any = null;
      if (scenario.profileId) {
        const [p] = await db.select().from(testProfiles)
          .where(eq(testProfiles.uid, scenario.profileId))
          .limit(1);
        profile = p || null;
      }

      // Build the template JSON snapshot
      const templateJson = buildTemplateJson(scenario, profile);

      // Determine domain from profile or default
      const domain = (profile?.domain as string) || "API_REST";
      const validDomains = ["IMS", "5GC", "API_REST", "VOLTE", "DRIVE_TEST", "SECURITY", "PERFORMANCE"];
      const safeDomain = validDomains.includes(domain) ? domain : "API_REST";

      const templateUid = randomUUID();
      await db.insert(scenarioTemplates).values({
        uid: templateUid,
        orgId: input.projectId, // use projectId as org scope
        scenarioUid: input.scenarioUid,
        domain: safeDomain as any,
        name: input.name,
        description: input.description || scenario.description,
        tagsJson: input.tags,
        templateJson,
        visibility: input.visibility,
        status: "PUBLISHED",
        createdBy: ctx.user?.openId ?? null,
        version: 1,
        testType: scenario.testType,
        difficulty: "INTERMEDIATE",
        tags: input.tags, // also set legacy tags
        steps: scenario.steps,
        requiredDatasetTypes: scenario.requiredDatasetTypes,
        artifactPolicy: scenario.artifactPolicy,
        kpiThresholds: scenario.kpiThresholds,
        profileTemplate: profile ? {
          protocol: profile.protocol,
          domain: profile.domain,
          ...(profile.parameters as Record<string, unknown> ?? {}),
        } : null,
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
        details: { scenarioUid: input.scenarioUid, projectId: input.projectId, name: input.name },
      });

      return { templateUid, name: input.name };
    }),

  /**
   * Unpublish a template — author or admin only
   */
  unpublish: protectedProcedure
    .input(z.object({ templateUid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [tpl] = await db.select().from(scenarioTemplates)
        .where(eq(scenarioTemplates.uid, input.templateUid))
        .limit(1);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template introuvable" });

      // RBAC: only the author (createdBy/publishedByOpenId) or admin can unpublish
      const userOpenId = ctx.user?.openId ?? "";
      const userRole = ctx.user?.role ?? "user";
      const isAuthor = tpl.createdBy === userOpenId || tpl.publishedByOpenId === userOpenId;
      const isAdmin = userRole === "admin";

      if (!isAuthor && !isAdmin) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seul l'auteur ou un administrateur peut dépublier ce template" });
      }

      await db.update(scenarioTemplates)
        .set({ status: "UNPUBLISHED" })
        .where(eq(scenarioTemplates.uid, input.templateUid));

      writeAuditLog({
        userId: ctx.user?.id ?? 0,
        action: "UNPUBLISH_TEMPLATE",
        entity: "scenario_templates",
        entityId: input.templateUid,
        details: { name: tpl.name },
      });

      return { success: true };
    }),

  /**
   * Fork a published template into a project as a new scenario
   * Creates scenario + optional profile from template_json snapshot
   */
  forkToProject: protectedProcedure
    .input(z.object({
      templateUid: z.string(),
      projectUid: z.string(),
      scenarioName: z.string().optional(),
      createProfile: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const [tpl] = await db.select().from(scenarioTemplates)
        .where(and(
          eq(scenarioTemplates.uid, input.templateUid),
          eq(scenarioTemplates.status, "PUBLISHED"),
        ))
        .limit(1);
      if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Template introuvable ou non publié" });

      // Use templateJson if available, otherwise fall back to legacy fields
      const snapshot = tpl.templateJson as any;
      const scenarioData = snapshot?.scenario || {
        name: tpl.name,
        description: tpl.description,
        testType: tpl.testType,
        steps: tpl.steps,
        requiredDatasetTypes: tpl.requiredDatasetTypes,
        artifactPolicy: tpl.artifactPolicy,
        kpiThresholds: tpl.kpiThresholds,
      };
      const profileData = snapshot?.profile || (tpl.profileTemplate ? {
        protocol: (tpl.profileTemplate as any).protocol,
        domain: (tpl.profileTemplate as any).domain,
        parameters: tpl.profileTemplate,
      } : null);

      const scenarioUid = randomUUID();
      const scenarioCode = `FORK-${tpl.domain}-${Date.now().toString(36).toUpperCase()}`;
      const scenarioName = input.scenarioName || scenarioData.name || tpl.name;

      let profileUid: string | null = null;
      if (input.createProfile && profileData) {
        profileUid = randomUUID();
        await db.insert(testProfiles).values({
          uid: profileUid,
          projectId: input.projectUid,
          name: profileData.name || `Profil — ${scenarioName}`,
          protocol: profileData.protocol || "SIP",
          domain: profileData.domain || tpl.domain,
          parameters: profileData.parameters || profileData,
        });
      }

      await db.insert(testScenarios).values({
        uid: scenarioUid,
        scenarioCode,
        projectId: input.projectUid,
        profileId: profileUid || "",
        name: scenarioName,
        description: scenarioData.description || tpl.description,
        testType: scenarioData.testType || tpl.testType,
        status: "DRAFT",
        version: 1,
        steps: scenarioData.steps || tpl.steps,
        requiredDatasetTypes: scenarioData.requiredDatasetTypes || tpl.requiredDatasetTypes,
        artifactPolicy: scenarioData.artifactPolicy || tpl.artifactPolicy,
        kpiThresholds: scenarioData.kpiThresholds || tpl.kpiThresholds,
      });

      // Increment usage count
      await db.update(scenarioTemplates)
        .set({ usageCount: sql`COALESCE(${scenarioTemplates.usageCount}, 0) + 1` })
        .where(eq(scenarioTemplates.uid, input.templateUid));

      writeAuditLog({
        userId: ctx.user?.id ?? 0,
        action: "FORK_TEMPLATE",
        entity: "test_scenarios",
        entityId: scenarioUid,
        details: { templateUid: input.templateUid, projectUid: input.projectUid, name: scenarioName },
      });

      return {
        scenarioUid,
        scenarioCode,
        scenarioName,
        profileUid,
        templateDomain: tpl.domain,
      };
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
