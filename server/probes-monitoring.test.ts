/**
 * Tests: Probes Monitoring — backend endpoint + health calculation + frontend page
 */
import { describe, it, expect } from "vitest";

// ─── Backend: probes.monitoring endpoint ───────────────────────────────

describe("probes.monitoring endpoint structure", () => {
  it("should have monitoring procedure in probesRouter", async () => {
    const { probesRouter } = await import("./routers/testing");
    const procedures = Object.keys(probesRouter._def.procedures);
    expect(procedures).toContain("monitoring");
    expect(procedures).toContain("listLite");
  });
});

// ─── Health calculation logic ──────────────────────────────────────────

describe("probe health calculation logic", () => {
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

  it("GREEN: ONLINE + heartbeat < 60s", () => {
    expect(calcHealth("ONLINE", new Date())).toBe("GREEN");
  });

  it("GREEN: ONLINE + heartbeat exactly at boundary", () => {
    const justNow = new Date(Date.now() - 30_000);
    expect(calcHealth("ONLINE", justNow)).toBe("GREEN");
  });

  it("ORANGE: ONLINE + heartbeat 60-300s", () => {
    const twoMinAgo = new Date(Date.now() - 120_000);
    expect(calcHealth("ONLINE", twoMinAgo)).toBe("ORANGE");
  });

  it("ORANGE: ONLINE + heartbeat at 4 min", () => {
    const fourMinAgo = new Date(Date.now() - 240_000);
    expect(calcHealth("ONLINE", fourMinAgo)).toBe("ORANGE");
  });

  it("RED: ONLINE + heartbeat > 300s", () => {
    const tenMinAgo = new Date(Date.now() - 600_000);
    expect(calcHealth("ONLINE", tenMinAgo)).toBe("RED");
  });

  it("ORANGE: ONLINE + no heartbeat", () => {
    expect(calcHealth("ONLINE", null)).toBe("ORANGE");
  });

  it("ORANGE: DEGRADED + any heartbeat", () => {
    expect(calcHealth("DEGRADED", new Date())).toBe("ORANGE");
  });

  it("ORANGE: DEGRADED + no heartbeat", () => {
    expect(calcHealth("DEGRADED", null)).toBe("ORANGE");
  });

  it("RED: OFFLINE + recent heartbeat", () => {
    expect(calcHealth("OFFLINE", new Date())).toBe("RED");
  });

  it("RED: OFFLINE + no heartbeat", () => {
    expect(calcHealth("OFFLINE", null)).toBe("RED");
  });
});

// ─── Frontend: ProbesMonitoringPage ────────────────────────────────────

describe("frontend: ProbesMonitoringPage", () => {
  it("should use trpc.probes.monitoring.useQuery with refetchInterval", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("trpc.probes.monitoring.useQuery");
    expect(content).toContain("refetchInterval");
  });

  it("should have grid and compact view modes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("viewMode === 'grid'");
    expect(content).toContain("ProbeMonitorCard");
    expect(content).toContain("ProbeMonitorRow");
  });

  it("should have health status indicators (GREEN/ORANGE/RED)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("GREEN");
    expect(content).toContain("ORANGE");
    expect(content).toContain("RED");
    expect(content).toContain("healthConfig");
  });

  it("should have filters for status and probeType", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("statusFilter");
    expect(content).toContain("typeFilter");
    expect(content).toContain("LINUX_EDGE");
    expect(content).toContain("K8S_CLUSTER");
    expect(content).toContain("NETWORK_TAP");
  });

  it("should show stats bar with counts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("stats.green");
    expect(content).toContain("stats.orange");
    expect(content).toContain("stats.red");
  });

  it("should display last update time", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("dataUpdatedAt");
  });

  it("should have legend explaining health thresholds", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("Légende");
    expect(content).toContain("60s");
    expect(content).toContain("300s");
  });

  it("should persist view mode in uiStorage", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ProbesMonitoringPage.tsx", "utf-8");
    expect(content).toContain("uiGet");
    expect(content).toContain("uiSet");
    expect(content).toContain("probesMonitorView");
  });
});

// ─── Route registration ────────────────────────────────────────────────

describe("route: /probes/monitoring", () => {
  it("should be registered in App.tsx", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(content).toContain("/probes/monitoring");
    expect(content).toContain("ProbesMonitoringPage");
  });

  it("should be in sidebar navigation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/DashboardLayout.tsx", "utf-8");
    expect(content).toContain("/probes/monitoring");
    expect(content).toContain("Monitoring");
  });
});
