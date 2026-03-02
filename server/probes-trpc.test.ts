/**
 * Tests: ProbesPage tRPC migration + CRUD complet + liaison captures
 * Validates:
 * - probes router has list/get/create/update/updateStatus/delete
 * - ProbesPage uses tRPC (no collectorApi/useProbeQueries)
 * - Probe type filter in list input
 * - Captures liaison via probes.get
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Backend: probes router structure ──────────────────────────────────

describe("tRPC router: probes CRUD complet", () => {
  it("should have probes router with all 6 procedures", async () => {
    const { probesRouter } = await import("./routers/testing");
    expect(probesRouter).toBeDefined();
    const procedures = Object.keys(probesRouter._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("get");
    expect(procedures).toContain("create");
    expect(procedures).toContain("update");
    expect(procedures).toContain("updateStatus");
    expect(procedures).toContain("delete");
    expect(procedures).toContain("listLite");
    expect(procedures).toContain("monitoring");
    expect(procedures.length).toBe(8);
  });
});

// ─── Backend: probes.list input validation ─────────────────────────────

describe("probes list input validation", () => {
  const listInput = z.object({
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(25),
    status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
    probeType: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).optional(),
    search: z.string().optional(),
  });

  it("should accept empty input (list all)", () => {
    const result = listInput.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should accept status filter", () => {
    const result = listInput.safeParse({ status: "ONLINE" });
    expect(result.success).toBe(true);
  });

  it("should accept probeType filter", () => {
    const result = listInput.safeParse({ probeType: "K8S_CLUSTER" });
    expect(result.success).toBe(true);
  });

  it("should accept search filter", () => {
    const result = listInput.safeParse({ search: "paris" });
    expect(result.success).toBe(true);
  });

  it("should accept combined filters", () => {
    const result = listInput.safeParse({ status: "ONLINE", probeType: "LINUX_EDGE", search: "edge" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const result = listInput.safeParse({ status: "RUNNING" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid probeType", () => {
    const result = listInput.safeParse({ probeType: "DOCKER" });
    expect(result.success).toBe(false);
  });
});

// ─── Backend: probes.updateStatus input validation ─────────────────────

describe("probes updateStatus input validation", () => {
  const updateStatusInput = z.object({
    probeId: z.number(),
    status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]),
  });

  it("should accept valid status update to ONLINE", () => {
    const result = updateStatusInput.safeParse({ probeId: 1, status: "ONLINE" });
    expect(result.success).toBe(true);
  });

  it("should accept valid status update to DEGRADED", () => {
    const result = updateStatusInput.safeParse({ probeId: 1, status: "DEGRADED" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid status", () => {
    const result = updateStatusInput.safeParse({ probeId: 1, status: "RUNNING" });
    expect(result.success).toBe(false);
  });

  it("should reject missing probeId", () => {
    const result = updateStatusInput.safeParse({ status: "ONLINE" });
    expect(result.success).toBe(false);
  });
});

// ─── Backend: probes.update input validation ───────────────────────────

describe("probes update input validation", () => {
  const updateInput = z.object({
    probeId: z.number(),
    name: z.string().optional(),
    probeType: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    capabilities: z.any().optional(),
    config: z.any().optional(),
  });

  it("should accept partial update (name only)", () => {
    const result = updateInput.safeParse({ probeId: 1, name: "new-name" });
    expect(result.success).toBe(true);
  });

  it("should accept partial update (host + port)", () => {
    const result = updateInput.safeParse({ probeId: 1, host: "10.0.0.1", port: 8443 });
    expect(result.success).toBe(true);
  });

  it("should accept full update", () => {
    const result = updateInput.safeParse({
      probeId: 1, name: "probe-v2", probeType: "K8S_CLUSTER",
      host: "k8s.local", port: 6443, config: { tls: true },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing probeId", () => {
    const result = updateInput.safeParse({ name: "test" });
    expect(result.success).toBe(false);
  });
});

// ─── Frontend: ProbesPage uses tRPC ────────────────────────────────────

describe("frontend: ProbesPage tRPC migration", () => {
  it("should use tRPC hooks (not collectorApi/useProbeQueries)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");

    // Must use tRPC
    expect(content).toContain("trpc");
    expect(content).toContain("trpc.probes.list.useQuery");

    // Must NOT use old APIs
    expect(content).not.toContain("collectorApi");
    expect(content).not.toContain("useProbeQueries");
    expect(content).not.toContain("useProbes(");
    expect(content).not.toContain("useCreateProbe(");
    expect(content).not.toContain("useDeleteProbe(");
    expect(content).not.toContain("useProbeHealth(");
    expect(content).not.toContain("localStore");
    expect(content).not.toContain("memoryStore");
    expect(content).not.toContain("localProbes");
  });

  it("should have create probe modal", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");
    expect(content).toContain("CreateProbeModal");
    expect(content).toContain("trpc.probes.create.useMutation");
  });

  it("should have edit probe inline", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");
    expect(content).toContain("EditProbeInline");
    expect(content).toContain("trpc.probes.update.useMutation");
  });

  it("should have delete probe action", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");
    expect(content).toContain("trpc.probes.delete.useMutation");
  });

  it("should have status toggle (online/offline)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");
    expect(content).toContain("trpc.probes.updateStatus.useMutation");
    expect(content).toContain("ONLINE");
    expect(content).toContain("OFFLINE");
    expect(content).toContain("DEGRADED");
  });

  it("should have type filter dropdown", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");
    expect(content).toContain("typeFilter");
    expect(content).toContain("Tous les types");
    expect(content).toContain("LINUX_EDGE");
    expect(content).toContain("K8S_CLUSTER");
    expect(content).toContain("NETWORK_TAP");
  });

  it("should display linked captures in expanded view", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");
    expect(content).toContain("trpc.probes.get.useQuery");
    expect(content).toContain("Captures liées");
    expect(content).toContain("probeDetail");
  });

  it("should have cursor pagination (Charger plus)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesPage.tsx", "utf-8");
    expect(content).toContain("Charger plus");
    expect(content).toContain("cursor");
    expect(content).toContain("hasMore");
  });
});

// ─── Schema: probes table ──────────────────────────────────────────────

describe("schema: probes table", () => {
  it("should have probes table with required columns", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.probes).toBeDefined();
    expect(schema.probes.site).toBeDefined();
    expect(schema.probes.probeType).toBeDefined();
    expect(schema.probes.status).toBeDefined();
    expect(schema.probes.zone).toBeDefined();
    expect(schema.probes.capabilities).toBeDefined();
    expect(schema.probes.lastSeenAt).toBeDefined();
  });
});
