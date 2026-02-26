import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, testEngineerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation, requireProjectAccess,
} from "../rbac/middleware";
import * as probesDb from "../db/probes";

export const probesRouter = router({
  // ── Probes — READ: VIEWER, WRITE: QA_MANAGER+ ──
  list: viewerProcedure
    .input(z.object({ site: z.string().optional() }))
    .query(async ({ input }) => {
      return probesDb.listProbes(input.site);
    }),

  getByUid: viewerProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return probesDb.getProbeByUid(input.uid);
    }),

  create: qaManagerProcedure
    .use(auditMutation("CREATE", "probe"))
    .input(z.object({
      site: z.string(),
      zone: z.string(),
      type: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]),
      status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
      capabilities: z.array(z.string()).optional(),
      authTokenHash: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      version: z.string().optional(),
      interfaces: z.array(z.string()).optional(),
      heartbeatIntervalSec: z.number().optional(),
      allowlistCidrs: z.array(z.string()).optional(),
      tlsEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return probesDb.createProbe(input);
    }),

  update: testEngineerProcedure
    .use(auditMutation("UPDATE", "probe"))
    .input(z.object({
      uid: z.string(),
      status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
      capabilities: z.array(z.string()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      version: z.string().optional(),
      lastSeenAt: z.coerce.date().optional(),
      uptimeSeconds: z.number().optional(),
      cpuPercent: z.number().optional(),
      diskFreeMb: z.number().optional(),
      interfaces: z.array(z.string()).optional(),
      activeSessions: z.number().optional(),
      totalCaptures: z.number().optional(),
      lastError: z.string().optional(),
      healthStatus: z.enum(["healthy", "degraded", "unhealthy"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return probesDb.updateProbe(uid, data);
    }),

  delete: orgAdminProcedure
    .use(auditMutation("DELETE", "probe"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return probesDb.deleteProbe(input.uid);
    }),

  // ── Probe Policies — READ: VIEWER, WRITE: QA_MANAGER+ ──
  listPolicies: viewerProcedure
    .input(z.object({ probeId: z.string() }))
    .query(async ({ input }) => {
      return probesDb.listProbePolicies(input.probeId);
    }),

  createPolicy: qaManagerProcedure
    .use(auditMutation("CREATE", "probe_policy"))
    .input(z.object({
      probeId: z.string(),
      maxCaptureDurationSec: z.number().optional(),
      maxCaptureSizeMb: z.number().optional(),
      pcapInterfacesAllowlist: z.array(z.string()).optional(),
      pcapBpfAllowlist: z.array(z.string()).optional(),
      storageKind: z.string().optional(),
      storageEndpoint: z.string().optional(),
      storageBucket: z.string().optional(),
      storagePrefix: z.string().optional(),
      redactionEnabled: z.boolean().optional(),
      redactionPatterns: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return probesDb.createProbePolicy(input);
    }),

  deletePolicy: orgAdminProcedure
    .use(auditMutation("DELETE", "probe_policy"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return probesDb.deleteProbePolicy(input.uid);
    }),

  // ── Capture Policies — READ: VIEWER, WRITE: QA_MANAGER+ ──
  listCapturePolicies: viewerProcedure
    .use(requireProjectAccess("PROJECT_VIEWER"))
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return probesDb.listCapturePolicies(input.projectId);
    }),

  createCapturePolicy: qaManagerProcedure
    .use(requireProjectAccess("PROJECT_EDITOR"))
    .use(auditMutation("CREATE", "capture_policy"))
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1),
      captureMode: z.enum(["RUNNER", "PROBE"]),
      triggerOn: z.array(z.string()).optional(),
      autoCapture: z.boolean().optional(),
      duration: z.number().optional(),
      maxSize: z.number().optional(),
      bpfFilter: z.string().optional(),
      interfaceName: z.string().optional(),
      probeId: z.string().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return probesDb.createCapturePolicy(input);
    }),

  updateCapturePolicy: qaManagerProcedure
    .use(auditMutation("UPDATE", "capture_policy"))
    .input(z.object({
      uid: z.string(),
      name: z.string().optional(),
      enabled: z.boolean().optional(),
      captureMode: z.enum(["RUNNER", "PROBE"]).optional(),
      autoCapture: z.boolean().optional(),
      duration: z.number().optional(),
      maxSize: z.number().optional(),
      bpfFilter: z.string().optional(),
      interfaceName: z.string().optional(),
      probeId: z.string().optional(),
      triggerOn: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { uid, ...data } = input;
      return probesDb.updateCapturePolicy(uid, data);
    }),

  deleteCapturePolicy: orgAdminProcedure
    .use(auditMutation("DELETE", "capture_policy"))
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return probesDb.deleteCapturePolicy(input.uid);
    }),
});
