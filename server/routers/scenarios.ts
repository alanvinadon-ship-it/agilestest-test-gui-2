import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as scenariosDb from "../db/scenarios";
import { paginationInput, paginateInMemory } from "../pagination";

export const scenariosRouter = router({
  // ── READ — paginated list ──
  list: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await scenariosDb.listScenarios(input.projectId);
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
      return scenariosDb.getScenarioByUid(input.uid);
    }),

  // ── CREATE — QA_MANAGER+ (create/edit test plans) ──
  create: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "scenario"))
    .input(z.object({
      projectId: z.string(),
      profileId: z.string(),
      scenarioCode: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      testType: z.enum(["VABF", "VSR", "VABE"]),
      steps: z.array(z.record(z.string(), z.unknown())).optional(),
      requiredDatasetTypes: z.array(z.string()).optional(),
      artifactPolicy: z.array(z.string()).optional(),
      kpiThresholds: z.record(z.string(), z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      return scenariosDb.createScenario(input);
    }),

  // ── UPDATE — QA_MANAGER+ ──
  update: qaManagerProcedure
    .use(auditMutation("UPDATE", "scenario"))
    .input(z.object({
      uid: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      scenarioCode: z.string().optional(),
      testType: z.enum(["VABF", "VSR", "VABE"]).optional(),
      status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).optional(),
      version: z.number().optional(),
      steps: z.array(z.record(z.string(), z.unknown())).optional(),
      requiredDatasetTypes: z.array(z.string()).optional(),
      artifactPolicy: z.array(z.string()).optional(),
      kpiThresholds: z.record(z.string(), z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return scenariosDb.updateScenario(uid, data);
    }),

  // ── DELETE — ORG_ADMIN only ──
  delete: orgAdminProcedure
    .use(auditMutation("DELETE", "scenario"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return scenariosDb.deleteScenario(input.uid);
    }),
});
