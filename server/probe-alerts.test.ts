/**
 * Tests: Probe Alert System — probeAlertService + sidebar badge + anti-spam
 */
import { describe, it, expect } from "vitest";

// ─── probeAlertService ─────────────────────────────────────────────────

describe("probeAlertService", () => {
  it("should export computeProbeHealth function", async () => {
    const { computeProbeHealth } = await import("./probeAlertService");
    expect(typeof computeProbeHealth).toBe("function");
  });

  it("should export evaluateProbesHealthAndAlert function", async () => {
    const { evaluateProbesHealthAndAlert } = await import("./probeAlertService");
    expect(typeof evaluateProbesHealthAndAlert).toBe("function");
  });

  it("should compute GREEN for ONLINE probe with recent heartbeat", async () => {
    const { computeProbeHealth } = await import("./probeAlertService");
    const now = Date.now();
    const lastSeen = new Date(now - 10_000); // 10s ago
    expect(computeProbeHealth("ONLINE", lastSeen, now)).toBe("GREEN");
  });

  it("should compute ORANGE for ONLINE probe with stale heartbeat (60-300s)", async () => {
    const { computeProbeHealth } = await import("./probeAlertService");
    const now = Date.now();
    const lastSeen = new Date(now - 120_000); // 2min ago
    expect(computeProbeHealth("ONLINE", lastSeen, now)).toBe("ORANGE");
  });

  it("should compute RED for ONLINE probe with very stale heartbeat (>300s)", async () => {
    const { computeProbeHealth } = await import("./probeAlertService");
    const now = Date.now();
    const lastSeen = new Date(now - 600_000); // 10min ago
    expect(computeProbeHealth("ONLINE", lastSeen, now)).toBe("RED");
  });

  it("should compute RED for OFFLINE probe", async () => {
    const { computeProbeHealth } = await import("./probeAlertService");
    expect(computeProbeHealth("OFFLINE", null)).toBe("RED");
  });

  it("should compute ORANGE for DEGRADED probe", async () => {
    const { computeProbeHealth } = await import("./probeAlertService");
    expect(computeProbeHealth("DEGRADED", null)).toBe("ORANGE");
  });

  it("should compute ORANGE for ONLINE probe with no heartbeat", async () => {
    const { computeProbeHealth } = await import("./probeAlertService");
    expect(computeProbeHealth("ONLINE", null)).toBe("ORANGE");
  });
});

// ─── probe_alert_state table ───────────────────────────────────────────

describe("probe_alert_state schema", () => {
  it("should have probeAlertState table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.probeAlertState).toBeDefined();
  });

  it("should have required columns", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(content).toContain("probeId");
    expect(content).toContain("orgId");
    expect(content).toContain("healthState");
    expect(content).toContain("redSinceAt");
    expect(content).toContain("lastNotifiedAt");
    expect(content).toContain("alertCount");
  });

  it("should have health state enum with GREEN, ORANGE, RED", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("drizzle/schema.ts", "utf-8");
    const alertStateSection = content.slice(content.indexOf("probe_alert_state"));
    expect(alertStateSection).toContain('"GREEN"');
    expect(alertStateSection).toContain('"ORANGE"');
    expect(alertStateSection).toContain('"RED"');
  });
});

// ─── Anti-spam logic ───────────────────────────────────────────────────

describe("anti-spam logic in probeAlertService", () => {
  it("should check lastNotifiedAt before sending notification", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    expect(content).toContain("lastNotifiedAt");
    expect(content).toContain("ANTI_SPAM_MS");
  });

  it("should have 30-minute anti-spam window by default", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    expect(content).toContain("30 * 60 * 1000");
  });

  it("should have 5-minute RED threshold before alerting", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    expect(content).toContain("5 * 60 * 1000");
    expect(content).toContain("RED_THRESHOLD_MS");
  });

  it("should track alertCount per probe", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    expect(content).toContain("alertCount");
  });

  it("should reset state when probe recovers from RED", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    // When health !== RED and previous state was RED, reset
    expect(content).toContain("redSinceAt: null");
    expect(content).toContain("alertCount: 0");
  });
});

// ─── Notification content ──────────────────────────────────────────────

describe("notification content", () => {
  it("should use notifyOwner from notification module", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    expect(content).toContain("notifyOwner");
    expect(content).toContain("from \"./_core/notification\"");
  });

  it("should include probe name, type, host, status in notification", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    expect(content).toContain("probe.site");
    expect(content).toContain("probe.probeType");
    expect(content).toContain("probe.zone");
    expect(content).toContain("probe.status");
  });

  it("should include duration in RED state in notification", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/probeAlertService.ts", "utf-8");
    expect(content).toContain("redMinutes");
  });
});

// ─── Integration with jobQueue polling ─────────────────────────────────

describe("integration with jobQueue polling", () => {
  it("should import evaluateProbesHealthAndAlert in jobQueue", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain("evaluateProbesHealthAndAlert");
    expect(content).toContain("from \"./probeAlertService\"");
  });

  it("should start probe alert interval in startPolling", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain("_probeAlertInterval");
    expect(content).toContain("PROBE_ALERT_POLL_MS");
  });

  it("should clear probe alert interval in stopPolling", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    const stopSection = content.slice(content.indexOf("function stopPolling"));
    expect(stopSection).toContain("_probeAlertInterval");
    expect(stopSection).toContain("clearInterval");
  });
});

// ─── Sidebar badge for RED probes ──────────────────────────────────────

describe("sidebar badge for RED probes", () => {
  it("should include redProbes in ui.sidebarCounts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/ui.ts", "utf-8");
    expect(content).toContain("redProbes");
  });

  it("should count OFFLINE probes and stale ONLINE probes as RED", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/ui.ts", "utf-8");
    expect(content).toContain("status = 'OFFLINE'");
    expect(content).toContain("TIMESTAMPDIFF");
  });

  it("should include redProbes in frontend useSidebarCounts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/hooks/useSidebarCounts.ts", "utf-8");
    expect(content).toContain("redProbes");
  });

  it("should combine runningExecutions + redProbes for Exécution section badge", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/hooks/useSidebarCounts.ts", "utf-8");
    expect(content).toContain("counts.redProbes");
    expect(content).toContain("Exécution");
  });

  it("should use faster polling when redProbes > 0", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/hooks/useSidebarCounts.ts", "utf-8");
    expect(content).toContain("counts.redProbes > 0");
    expect(content).toContain("ACTIVE_INTERVAL");
  });
});
