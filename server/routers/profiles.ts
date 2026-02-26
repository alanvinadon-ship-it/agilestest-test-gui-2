import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as profilesDb from "../db/profiles";
import { paginationInput, paginateInMemory } from "../pagination";

export const profilesRouter = router({
  // ── READ — paginated list ──
  list: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await profilesDb.listProfiles(input.projectId);
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
      return profilesDb.getProfileByUid(input.uid);
    }),

  // ── CREATE — QA_MANAGER+ with project editor access ──
  create: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "profile"))
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

  // ── UPDATE — QA_MANAGER+ with project editor access ──
  update: qaManagerProcedure
    .use(auditMutation("UPDATE", "profile"))
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

  // ── DELETE — ORG_ADMIN only ──
  delete: orgAdminProcedure
    .use(auditMutation("DELETE", "profile"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return profilesDb.deleteProfile(input.uid);
    }),
});
