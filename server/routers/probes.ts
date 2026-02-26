import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as probesDb from "../db/probes";

export const probesRouter = router({
  // Probes
  list: protectedProcedure
    .input(z.object({ site: z.string().optional() }))
    .query(async ({ input }) => {
      return probesDb.listProbes(input.site);
    }),

  getByUid: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(async ({ input }) => {
      return probesDb.getProbeByUid(input.uid);
    }),

  create: protectedProcedure
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

  update: protectedProcedure
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

  delete: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return probesDb.deleteProbe(input.uid);
    }),

  // Probe Policies
  listPolicies: protectedProcedure
    .input(z.object({ probeId: z.string() }))
    .query(async ({ input }) => {
      return probesDb.listProbePolicies(input.probeId);
    }),

  createPolicy: protectedProcedure
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

  deletePolicy: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return probesDb.deleteProbePolicy(input.uid);
    }),

  // Capture Policies
  listCapturePolicies: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return probesDb.listCapturePolicies(input.projectId);
    }),

  createCapturePolicy: protectedProcedure
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

  updateCapturePolicy: protectedProcedure
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

  deleteCapturePolicy: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(async ({ input }) => {
      return probesDb.deleteCapturePolicy(input.uid);
    }),
});
