import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as projectsDb from "../db/projects";
import { paginationInput, paginateInMemory } from "../pagination";

export const projectsRouter = router({
  // ── READ — paginated list ──
  list: viewerProcedure
    .input(paginationInput)
    .query(async ({ input }) => {
      const all = await projectsDb.listProjects();
      return paginateInMemory(all, input, (a: any, b: any) => {
        const field = input.sortBy || "createdAt";
        const aVal = a[field], bVal = b[field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return input.sortDir === "asc" ? cmp : -cmp;
      });
    }),

  getByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return projectsDb.getProjectByUid(input.uid);
    }),

  // ── CREATE — QA_MANAGER+ ──
  create: qaManagerProcedure
    .use(auditMutation("CREATE", "project"))
    .input(z.object({
      name: z.string().min(1).max(255),
      domain: z.string().min(1),
      description: z.string().optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return projectsDb.createProject({
        ...input,
        createdBy: input.createdBy ?? ctx.user?.openId,
      });
    }),

  // ── UPDATE — QA_MANAGER+ ──
  update: qaManagerProcedure
    .use(auditMutation("UPDATE", "project"))
    .input(z.object({
      uid: z.string(),
      name: z.string().optional(),
      domain: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
      targetEnv: z.enum(["DEV", "PREPROD", "PILOT_ORANGE", "PROD"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return projectsDb.updateProject(uid, data);
    }),

  // ── DELETE — ORG_ADMIN only ──
  delete: orgAdminProcedure
    .use(auditMutation("DELETE", "project"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return projectsDb.deleteProject(input.uid);
    }),
});
