import { z } from "zod";
import { eq, desc, and, like, or, SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { projects, projectMemberships } from "../../drizzle/schema";
import { paginationInput } from "../../shared/pagination";
import { normalizePagination, countRows } from "../lib/pagination";
import { writeAuditLog } from "../lib/auditLog";

const listProjectsInput = z.object({
  ...paginationInput.shape,
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
  domain: z.string().optional(),
});

const createProjectInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  domain: z.string().default("WEB"),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).default("ACTIVE"),
});

const updateProjectInput = z.object({
  projectId: z.number(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  domain: z.string().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
});

const deleteProjectInput = z.object({ projectId: z.number() });

export const projectsRouter = router({
  list: protectedProcedure.input(listProjectsInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [];

    if (input.search) {
      const pattern = `%${input.search}%`;
      conditions.push(or(like(projects.name, pattern), like(projects.description, pattern))!);
    }
    if (input.status) conditions.push(eq(projects.status, input.status));
    if (input.domain) conditions.push(eq(projects.domain, input.domain));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const baseQuery = where
      ? db.select().from(projects).where(where)
      : db.select().from(projects);

    const [data, countResult] = await Promise.all([
      baseQuery.orderBy(desc(projects.createdAt)).limit(pageSize).offset(offset),
      countRows(db, projects, where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }),

  get: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const result = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable" });
    return result[0];
  }),

  create: protectedProcedure.input(createProjectInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const result = await db.insert(projects).values({
      name: input.name,
      description: input.description ?? null,
      domain: input.domain,
      status: input.status,
      createdBy: ctx.user!.id,
    });

    const projectId = Number(result[0].insertId);

    await db.insert(projectMemberships).values({
      projectId,
      userId: ctx.user!.id,
      role: "ADMIN",
    });

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "PROJECT_CREATED",
      entity: "project",
      entityId: String(projectId),
      details: { name: input.name, domain: input.domain },
    });

    return { success: true, projectId };
  }),

  update: protectedProcedure.input(updateProjectInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const existing = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
    if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable" });

    const updateSet: Record<string, unknown> = {};
    if (input.name !== undefined) updateSet.name = input.name;
    if (input.description !== undefined) updateSet.description = input.description;
    if (input.domain !== undefined) updateSet.domain = input.domain;
    if (input.status !== undefined) updateSet.status = input.status;

    if (Object.keys(updateSet).length > 0) {
      await db.update(projects).set(updateSet).where(eq(projects.id, input.projectId));
    }

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "PROJECT_UPDATED",
      entity: "project",
      entityId: String(input.projectId),
      details: { changes: updateSet },
    });

    return { success: true };
  }),

  delete: protectedProcedure.input(deleteProjectInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const existing = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
    if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable" });

    await db.delete(projectMemberships).where(eq(projectMemberships.projectId, input.projectId));
    await db.delete(projects).where(eq(projects.id, input.projectId));

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "PROJECT_DELETED",
      entity: "project",
      entityId: String(input.projectId),
      details: { name: existing[0].name },
    });

    return { success: true };
  }),
});
