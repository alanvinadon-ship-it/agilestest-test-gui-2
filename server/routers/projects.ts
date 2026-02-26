import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as projectsDb from "../db/projects";

export const projectsRouter = router({
  list: protectedProcedure.query(async () => {
    return projectsDb.listProjects();
  }),

  getByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return projectsDb.getProjectByUid(input.uid);
    }),

  create: protectedProcedure
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

  update: protectedProcedure
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

  delete: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return projectsDb.deleteProject(input.uid);
    }),
});
