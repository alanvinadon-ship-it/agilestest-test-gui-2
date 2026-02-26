import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as profilesDb from "../db/profiles";

export const profilesRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return profilesDb.listProfiles(input.projectId);
    }),

  getByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return profilesDb.getProfileByUid(input.uid);
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1),
      testType: z.enum(["VABF", "VSR", "VABE"]),
      description: z.string().optional(),
      protocol: z.string().optional(),
      domain: z.string().optional(),
      profileType: z.string().optional(),
      targetHost: z.string().optional(),
      targetPort: z.number().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      return profilesDb.createProfile(input);
    }),

  update: protectedProcedure
    .input(z.object({
      uid: z.string(),
      name: z.string().optional(),
      testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
      description: z.string().optional(),
      protocol: z.string().optional(),
      domain: z.string().optional(),
      profileType: z.string().optional(),
      targetHost: z.string().optional(),
      targetPort: z.number().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return profilesDb.updateProfile(uid, data);
    }),

  delete: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return profilesDb.deleteProfile(input.uid);
    }),
});
