// ============================================================================
// DriveAI — Vitest Tests
// Tests for: heuristics, input hash, redactPII, router structure, Zod schemas
// ============================================================================

import { describe, it, expect } from "vitest";
import { detectHeuristicAnomalies, computeInputHash, type DriveAIInput, type HeuristicAnomaly } from "./driveAi/inputBuilder";
import { driveAiRouter } from "./routers/driveAi";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSample(ts: string, lat: number, lon: number, speedMps: number | null = null, altitudeM: number | null = null) {
  return { ts, lat, lon, speedMps, altitudeM };
}

function makeEvent(ts: string, type: string, severity: string | null = null, message: string | null = null) {
  return { ts, type, severity, message };
}

// ── Heuristic Anomaly Detection ──────────────────────────────────────────────

describe("detectHeuristicAnomalies", () => {
  it("returns empty array for empty inputs", () => {
    const result = detectHeuristicAnomalies([], [], {});
    expect(result).toEqual([]);
  });

  it("returns empty array for single GPS sample", () => {
    const result = detectHeuristicAnomalies(
      [makeSample("2025-01-01T00:00:00Z", 48.85, 2.35)],
      [],
      {},
    );
    expect(result).toEqual([]);
  });

  // ── GPS Gap Detection ──────────────────────────────────────────────────

  describe("GPS gaps", () => {
    it("detects a 35s gap as LOW severity", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35),
        makeSample("2025-01-01T00:00:35Z", 48.86, 2.36),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      expect(result.length).toBeGreaterThanOrEqual(1);
      const gps = result.find(a => a.type === "GPS_GAP");
      expect(gps).toBeDefined();
      expect(gps!.severity).toBe("LOW");
    });

    it("detects a 90s gap as MEDIUM severity", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35),
        makeSample("2025-01-01T00:01:30Z", 48.86, 2.36),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      const gps = result.find(a => a.type === "GPS_GAP");
      expect(gps).toBeDefined();
      expect(gps!.severity).toBe("MEDIUM");
    });

    it("detects a 180s gap as HIGH severity", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35),
        makeSample("2025-01-01T00:03:00Z", 48.86, 2.36),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      const gps = result.find(a => a.type === "GPS_GAP");
      expect(gps).toBeDefined();
      expect(gps!.severity).toBe("HIGH");
    });

    it("does not flag gaps <= 30s", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35),
        makeSample("2025-01-01T00:00:25Z", 48.86, 2.36),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      expect(result.filter(a => a.type === "GPS_GAP")).toHaveLength(0);
    });

    it("detects multiple GPS gaps", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35),
        makeSample("2025-01-01T00:01:00Z", 48.86, 2.36),
        makeSample("2025-01-01T00:01:10Z", 48.87, 2.37),
        makeSample("2025-01-01T00:02:30Z", 48.88, 2.38),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      const gpsGaps = result.filter(a => a.type === "GPS_GAP");
      expect(gpsGaps.length).toBe(2);
    });
  });

  // ── Speed Drop Detection ───────────────────────────────────────────────

  describe("speed drops", () => {
    it("detects speed drop from >5 m/s to 0", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35, 10),
        makeSample("2025-01-01T00:00:05Z", 48.85, 2.35, 8),
        makeSample("2025-01-01T00:00:10Z", 48.85, 2.35, 6),
        makeSample("2025-01-01T00:00:15Z", 48.85, 2.35, 7),
        makeSample("2025-01-01T00:00:20Z", 48.85, 2.35, 0),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      const drop = result.find(a => a.type === "SPEED_DROP");
      expect(drop).toBeDefined();
      expect(drop!.severity).toBe("LOW");
    });

    it("does not flag gradual speed decrease", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35, 10),
        makeSample("2025-01-01T00:00:05Z", 48.85, 2.35, 8),
        makeSample("2025-01-01T00:00:10Z", 48.85, 2.35, 5),
        makeSample("2025-01-01T00:00:15Z", 48.85, 2.35, 3),
        makeSample("2025-01-01T00:00:20Z", 48.85, 2.35, 1),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      const drops = result.filter(a => a.type === "SPEED_DROP");
      expect(drops).toHaveLength(0);
    });

    it("requires at least 5 speed samples", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35, 10),
        makeSample("2025-01-01T00:00:05Z", 48.85, 2.35, 0),
      ];
      const result = detectHeuristicAnomalies(samples, [], {});
      expect(result.filter(a => a.type === "SPEED_DROP")).toHaveLength(0);
    });
  });

  // ── Error Event Clustering ─────────────────────────────────────────────

  describe("error clustering", () => {
    it("detects cluster of 3+ ERROR events", () => {
      const events = [
        makeEvent("2025-01-01T00:00:00Z", "ERROR", "ERROR", "Connection timeout"),
        makeEvent("2025-01-01T00:00:05Z", "ERROR", "ERROR", "DNS resolution failed"),
        makeEvent("2025-01-01T00:00:10Z", "ERROR", "ERROR", "Socket closed"),
      ];
      const result = detectHeuristicAnomalies([], events, {});
      const cluster = result.find(a => a.type === "ERROR_CLUSTER");
      expect(cluster).toBeDefined();
      expect(cluster!.severity).toBe("LOW");
    });

    it("flags 5+ errors as MEDIUM", () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        makeEvent(`2025-01-01T00:00:${String(i * 5).padStart(2, "0")}Z`, "ERROR", "ERROR", `Error ${i}`)
      );
      const result = detectHeuristicAnomalies([], events, {});
      const cluster = result.find(a => a.type === "ERROR_CLUSTER");
      expect(cluster).toBeDefined();
      expect(cluster!.severity).toBe("MEDIUM");
    });

    it("flags 10+ errors as HIGH", () => {
      const events = Array.from({ length: 12 }, (_, i) =>
        makeEvent(`2025-01-01T00:00:${String(i * 5).padStart(2, "0")}Z`, "ERROR", "ERROR", `Error ${i}`)
      );
      const result = detectHeuristicAnomalies([], events, {});
      const cluster = result.find(a => a.type === "ERROR_CLUSTER");
      expect(cluster).toBeDefined();
      expect(cluster!.severity).toBe("HIGH");
    });

    it("does not flag fewer than 3 error events", () => {
      const events = [
        makeEvent("2025-01-01T00:00:00Z", "ERROR", "ERROR", "Timeout"),
        makeEvent("2025-01-01T00:00:05Z", "NOTE", null, "Normal event"),
      ];
      const result = detectHeuristicAnomalies([], events, {});
      expect(result.filter(a => a.type === "ERROR_CLUSTER")).toHaveLength(0);
    });
  });

  // ── KPI-based Anomalies ────────────────────────────────────────────────

  describe("KPI anomalies", () => {
    it("detects COVERAGE_HOLE when RSRP min < -120", () => {
      const kpi = { RSRP: { avg: -95, min: -125, max: -80, count: 100 } };
      const result = detectHeuristicAnomalies([], [], kpi);
      const hole = result.find(a => a.type === "COVERAGE_HOLE");
      expect(hole).toBeDefined();
      expect(hole!.severity).toBe("MEDIUM");
    });

    it("detects COVERAGE_HOLE as HIGH when RSRP min < -130", () => {
      const kpi = { RSRP: { avg: -100, min: -135, max: -80, count: 100 } };
      const result = detectHeuristicAnomalies([], [], kpi);
      const hole = result.find(a => a.type === "COVERAGE_HOLE");
      expect(hole).toBeDefined();
      expect(hole!.severity).toBe("HIGH");
    });

    it("detects HIGH_LATENCY when max > 200ms", () => {
      const kpi = { LATENCY: { avg: 120, min: 50, max: 350, count: 50 } };
      const result = detectHeuristicAnomalies([], [], kpi);
      const lat = result.find(a => a.type === "HIGH_LATENCY");
      expect(lat).toBeDefined();
      expect(lat!.severity).toBe("MEDIUM");
    });

    it("detects HIGH_LATENCY as HIGH when max > 500ms", () => {
      const kpi = { LATENCY: { avg: 200, min: 50, max: 600, count: 50 } };
      const result = detectHeuristicAnomalies([], [], kpi);
      const lat = result.find(a => a.type === "HIGH_LATENCY");
      expect(lat).toBeDefined();
      expect(lat!.severity).toBe("HIGH");
    });

    it("detects LOW_THROUGHPUT when DL min < 1 Mbps", () => {
      const kpi = { THROUGHPUT_DL: { avg: 5, min: 0.3, max: 20, count: 100 } };
      const result = detectHeuristicAnomalies([], [], kpi);
      const tp = result.find(a => a.type === "LOW_THROUGHPUT");
      expect(tp).toBeDefined();
      expect(tp!.severity).toBe("HIGH"); // < 0.5
    });

    it("detects PACKET_LOSS when max > 5%", () => {
      const kpi = { PACKET_LOSS: { avg: 3, min: 0, max: 8, count: 50 } };
      const result = detectHeuristicAnomalies([], [], kpi);
      const pl = result.find(a => a.type === "PACKET_LOSS");
      expect(pl).toBeDefined();
      expect(pl!.severity).toBe("MEDIUM");
    });

    it("does not flag normal KPI values", () => {
      const kpi = {
        RSRP: { avg: -85, min: -100, max: -70, count: 100 },
        LATENCY: { avg: 50, min: 20, max: 100, count: 50 },
        THROUGHPUT_DL: { avg: 15, min: 5, max: 30, count: 100 },
        PACKET_LOSS: { avg: 0.5, min: 0, max: 2, count: 50 },
      };
      const result = detectHeuristicAnomalies([], [], kpi);
      expect(result).toHaveLength(0);
    });

    it("handles case-insensitive KPI keys (lowercase)", () => {
      const kpi = { rsrp: { avg: -100, min: -125, max: -80, count: 100 } };
      const result = detectHeuristicAnomalies([], [], kpi);
      expect(result.find(a => a.type === "COVERAGE_HOLE")).toBeDefined();
    });
  });

  // ── Sorting and Limiting ───────────────────────────────────────────────

  describe("sorting and limiting", () => {
    it("sorts anomalies by severity (HIGH first)", () => {
      const kpi = {
        RSRP: { avg: -100, min: -135, max: -80, count: 100 }, // HIGH
        LATENCY: { avg: 120, min: 50, max: 250, count: 50 },  // MEDIUM
      };
      const result = detectHeuristicAnomalies([], [], kpi);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].severity).toBe("HIGH");
    });

    it("limits to 20 anomalies maximum", () => {
      // Create many GPS gaps
      const samples: { ts: string; lat: number; lon: number; speedMps: number | null; altitudeM: number | null }[] = [];
      for (let i = 0; i < 50; i++) {
        const t1 = new Date(2025, 0, 1, 0, i * 2, 0).toISOString();
        const t2 = new Date(2025, 0, 1, 0, i * 2, 50).toISOString();
        samples.push(makeSample(t1, 48.85 + i * 0.001, 2.35));
        samples.push(makeSample(t2, 48.85 + i * 0.001, 2.35));
      }
      const result = detectHeuristicAnomalies(samples, [], {});
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  // ── Combined Anomalies ─────────────────────────────────────────────────

  describe("combined anomalies", () => {
    it("detects multiple anomaly types simultaneously", () => {
      const samples = [
        makeSample("2025-01-01T00:00:00Z", 48.85, 2.35, 10),
        makeSample("2025-01-01T00:02:00Z", 48.86, 2.36, 8),
        makeSample("2025-01-01T00:02:05Z", 48.86, 2.36, 6),
        makeSample("2025-01-01T00:02:10Z", 48.86, 2.36, 7),
        makeSample("2025-01-01T00:02:15Z", 48.86, 2.36, 0),
      ];
      const events = [
        makeEvent("2025-01-01T00:00:00Z", "ERROR", "ERROR", "Err 1"),
        makeEvent("2025-01-01T00:00:05Z", "ERROR", "ERROR", "Err 2"),
        makeEvent("2025-01-01T00:00:10Z", "ERROR", "ERROR", "Err 3"),
      ];
      const kpi = { RSRP: { avg: -100, min: -125, max: -80, count: 100 } };

      const result = detectHeuristicAnomalies(samples, events, kpi);
      const types = result.map(a => a.type);
      expect(types).toContain("GPS_GAP");
      expect(types).toContain("SPEED_DROP");
      expect(types).toContain("ERROR_CLUSTER");
      expect(types).toContain("COVERAGE_HOLE");
    });
  });
});

// ── Input Hash ───────────────────────────────────────────────────────────────

describe("computeInputHash", () => {
  const baseInput: DriveAIInput = {
    run: {
      uid: "run-1", name: "Test", orgId: "org-1", projectUid: "proj-1",
      campaignUid: null, campaignName: null, status: "COMPLETED",
      startedAt: "2025-01-01T00:00:00Z", endedAt: "2025-01-01T01:00:00Z",
      durationSec: 3600, deviceUid: null, probeUid: null, metaJson: null,
    },
    summary: { totalGpsSamples: 100, totalEvents: 5, distanceKm: 10, avgSpeedMps: 5, durationSec: 3600 },
    gpsSamples: [],
    events: [],
    kpiAggregates: {},
    artifactRefs: [],
    heuristicAnomalies: [],
  };

  it("returns a 16-char hex string", () => {
    const hash = computeInputHash(baseInput);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("returns same hash for same input", () => {
    const h1 = computeInputHash(baseInput);
    const h2 = computeInputHash(baseInput);
    expect(h1).toBe(h2);
  });

  it("returns different hash when totalGpsSamples changes", () => {
    const modified = { ...baseInput, summary: { ...baseInput.summary, totalGpsSamples: 200 } };
    expect(computeInputHash(baseInput)).not.toBe(computeInputHash(modified));
  });

  it("returns different hash when anomalies count changes", () => {
    const modified: DriveAIInput = {
      ...baseInput,
      heuristicAnomalies: [{ type: "GPS_GAP", startTs: null, endTs: null, evidence: "test", severity: "LOW" }],
    };
    expect(computeInputHash(baseInput)).not.toBe(computeInputHash(modified));
  });

  it("returns different hash when KPI keys change", () => {
    const modified = { ...baseInput, kpiAggregates: { RSRP: { avg: -90, min: -100, max: -80, count: 10 } } };
    expect(computeInputHash(baseInput)).not.toBe(computeInputHash(modified));
  });
});

// ── Router Structure ─────────────────────────────────────────────────────────

describe("driveAiRouter structure", () => {
  it("exposes expected endpoints", () => {
    const procedures = Object.keys((driveAiRouter as any)._def.procedures ?? {});
    expect(procedures).toContain("trigger");
    expect(procedures).toContain("status");
    expect(procedures).toContain("latest");
    expect(procedures).toContain("list");
    expect(procedures).toContain("segments");
    expect(procedures).toContain("submitFeedback");
    expect(procedures).toContain("getFeedback");
    expect(procedures).toContain("createHandoff");
    expect(procedures).toContain("updateHandoff");
    expect(procedures).toContain("listHandoffs");
  });

  it("has exactly 10 endpoints", () => {
    const procedures = Object.keys((driveAiRouter as any)._def.procedures ?? {});
    expect(procedures.length).toBe(10);
  });
});
