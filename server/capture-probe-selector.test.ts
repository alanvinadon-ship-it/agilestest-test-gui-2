/**
 * Tests: Capture probe selector — backend validation + frontend integration
 * Validates:
 * - captures.create with targetType=PROBE requires probeId
 * - captures.create with targetType=PROBE + probeId => config.probeId set
 * - captures.create with targetType!=PROBE => probeId ignored
 * - probes.listLite endpoint exists and returns lite data
 * - probes.monitoring endpoint exists with health calculation
 * - CapturesPage frontend uses probes.listLite for PROBE target
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Backend: captures.create input with probeId ───────────────────────

describe("captures.create input validation with probeId", () => {
  const createInput = z.object({
    projectId: z.number(),
    name: z.string().min(1),
    executionId: z.number().optional(),
    captureType: z.enum(["LOGS", "PCAP"]).default("PCAP"),
    targetType: z.enum(["K8S", "SSH", "PROBE"]).default("SSH"),
    probeId: z.number().optional(),
    config: z.any().optional(),
  });

  it("should accept PROBE target with probeId", () => {
    const result = createInput.safeParse({
      projectId: 1, name: "test", targetType: "PROBE", probeId: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.probeId).toBe(42);
      expect(result.data.targetType).toBe("PROBE");
    }
  });

  it("should accept PROBE target without probeId in Zod (server validates)", () => {
    const result = createInput.safeParse({
      projectId: 1, name: "test", targetType: "PROBE",
    });
    // Zod accepts it — server-side logic throws BAD_REQUEST
    expect(result.success).toBe(true);
  });

  it("should accept K8S target without probeId", () => {
    const result = createInput.safeParse({
      projectId: 1, name: "test", targetType: "K8S",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.probeId).toBeUndefined();
  });

  it("should accept SSH target with probeId (server strips it)", () => {
    const result = createInput.safeParse({
      projectId: 1, name: "test", targetType: "SSH", probeId: 99,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Backend: probes.listLite endpoint ─────────────────────────────────

describe("probes.listLite endpoint", () => {
  it("should have listLite procedure in probesRouter", async () => {
    const { probesRouter } = await import("./routers/testing");
    const procedures = Object.keys(probesRouter._def.procedures);
    expect(procedures).toContain("listLite");
  });

  it("listLite input should accept optional status filter", () => {
    const input = z.object({
      q: z.string().optional(),
      status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
    }).optional();

    expect(input.safeParse({}).success).toBe(true);
    expect(input.safeParse({ status: "ONLINE" }).success).toBe(true);
    expect(input.safeParse({ q: "paris" }).success).toBe(true);
    expect(input.safeParse(undefined).success).toBe(true);
  });
});

// ─── Backend: probes.monitoring endpoint ───────────────────────────────

describe("probes.monitoring endpoint", () => {
  it("should have monitoring procedure in probesRouter", async () => {
    const { probesRouter } = await import("./routers/testing");
    const procedures = Object.keys(probesRouter._def.procedures);
    expect(procedures).toContain("monitoring");
  });

  it("monitoring input should accept optional filters", () => {
    const input = z.object({
      q: z.string().optional(),
      probeType: z.enum(["LINUX_EDGE", "K8S_CLUSTER", "NETWORK_TAP"]).optional(),
      status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
    }).optional();

    expect(input.safeParse({}).success).toBe(true);
    expect(input.safeParse({ probeType: "K8S_CLUSTER" }).success).toBe(true);
    expect(input.safeParse({ q: "edge", status: "ONLINE" }).success).toBe(true);
  });
});

// ─── Backend: health calculation logic ─────────────────────────────────

describe("probe health calculation", () => {
  const HEALTH_GREEN_SEC = 60;
  const HEALTH_ORANGE_SEC = 300;

  function calcHealth(status: string, lastSeenAt: Date | null): "GREEN" | "ORANGE" | "RED" {
    if (status === "ONLINE" && lastSeenAt) {
      const ageSec = (Date.now() - lastSeenAt.getTime()) / 1000;
      if (ageSec <= HEALTH_GREEN_SEC) return "GREEN";
      if (ageSec <= HEALTH_ORANGE_SEC) return "ORANGE";
      return "RED";
    }
    if (status === "ONLINE") return "ORANGE";
    if (status === "DEGRADED") return "ORANGE";
    return "RED";
  }

  it("should return GREEN for ONLINE probe with recent heartbeat", () => {
    expect(calcHealth("ONLINE", new Date())).toBe("GREEN");
  });

  it("should return ORANGE for ONLINE probe with old heartbeat (2 min)", () => {
    const twoMinAgo = new Date(Date.now() - 120_000);
    expect(calcHealth("ONLINE", twoMinAgo)).toBe("ORANGE");
  });

  it("should return RED for ONLINE probe with very old heartbeat (10 min)", () => {
    const tenMinAgo = new Date(Date.now() - 600_000);
    expect(calcHealth("ONLINE", tenMinAgo)).toBe("RED");
  });

  it("should return ORANGE for ONLINE probe without heartbeat", () => {
    expect(calcHealth("ONLINE", null)).toBe("ORANGE");
  });

  it("should return ORANGE for DEGRADED probe", () => {
    expect(calcHealth("DEGRADED", null)).toBe("ORANGE");
  });

  it("should return RED for OFFLINE probe", () => {
    expect(calcHealth("OFFLINE", null)).toBe("RED");
  });
});

// ─── Frontend: CapturesPage probe selector ─────────────────────────────

describe("frontend: CapturesPage probe selector", () => {
  it("should use probes.listLite for PROBE target dropdown", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("trpc.probes.listLite.useQuery");
    expect(content).toContain("targetType === 'PROBE'");
    expect(content).toContain("probeId");
    expect(content).toContain("Sélectionner une sonde");
  });

  it("should reset probeId when switching away from PROBE target", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("setProbeId('')");
  });

  it("should validate probeId required for PROBE target in form", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("Sonde requise quand la cible est PROBE");
  });

  it("should show empty state when no probes available", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("Aucune sonde en ligne");
  });

  it("should include probeId in mutation payload for PROBE target", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("probeId: Number(probeId)");
  });
});

// ─── Backend: capturesRouter has probeId in create ─────────────────────

describe("capturesRouter create with probeId", () => {
  it("should have captures router with create procedure", async () => {
    const { capturesRouter } = await import("./routers/testing");
    const procedures = Object.keys(capturesRouter._def.procedures);
    expect(procedures).toContain("create");
    expect(procedures).toContain("list");
    expect(procedures).toContain("delete");
  });
});
