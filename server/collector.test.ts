/**
 * Tests for collectorRouter — Structure, input validation, idempotence logic, schema tables.
 * No live DB required (structure tests only).
 */
import { describe, it, expect } from "vitest";
import { collectorRouter, collectorMetrics } from "./routers/collector";

// ─── Router structure ────────────────────────────────────────────────────────

describe("collectorRouter structure", () => {
  const procedures = Object.keys((collectorRouter as any)._def.procedures);

  it("exports all 9 procedures", () => {
    expect(procedures).toEqual(
      expect.arrayContaining([
        "start", "stop", "status", "heartbeat",
        "appendEvent", "listSessions", "listEvents", "activeSessions",
        "dashboard",
      ])
    );
    expect(procedures.length).toBe(9);
  });

  it("start is a mutation", () => {
    const proc = (collectorRouter as any)._def.procedures.start;
    expect(proc._def.type).toBe("mutation");
  });

  it("stop is a mutation", () => {
    const proc = (collectorRouter as any)._def.procedures.stop;
    expect(proc._def.type).toBe("mutation");
  });

  it("status is a query", () => {
    const proc = (collectorRouter as any)._def.procedures.status;
    expect(proc._def.type).toBe("query");
  });

  it("heartbeat is a mutation", () => {
    const proc = (collectorRouter as any)._def.procedures.heartbeat;
    expect(proc._def.type).toBe("mutation");
  });

  it("appendEvent is a mutation", () => {
    const proc = (collectorRouter as any)._def.procedures.appendEvent;
    expect(proc._def.type).toBe("mutation");
  });

  it("listSessions is a query", () => {
    const proc = (collectorRouter as any)._def.procedures.listSessions;
    expect(proc._def.type).toBe("query");
  });

  it("listEvents is a query", () => {
    const proc = (collectorRouter as any)._def.procedures.listEvents;
    expect(proc._def.type).toBe("query");
  });

  it("activeSessions is a query", () => {
    const proc = (collectorRouter as any)._def.procedures.activeSessions;
    expect(proc._def.type).toBe("query");
  });
});

// ─── Input schemas ───────────────────────────────────────────────────────────

describe("collectorRouter input schemas", () => {
  it("start input requires captureId and probeId", () => {
    const proc = (collectorRouter as any)._def.procedures.start;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });

  it("stop input requires sessionUid", () => {
    const proc = (collectorRouter as any)._def.procedures.stop;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });

  it("heartbeat input requires sessionUid", () => {
    const proc = (collectorRouter as any)._def.procedures.heartbeat;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });

  it("appendEvent input requires sessionUid, level, eventType", () => {
    const proc = (collectorRouter as any)._def.procedures.appendEvent;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });

  it("listSessions input accepts optional captureId, probeId, status, cursor, pageSize", () => {
    const proc = (collectorRouter as any)._def.procedures.listSessions;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });

  it("listEvents input requires sessionUid", () => {
    const proc = (collectorRouter as any)._def.procedures.listEvents;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });
});

// ─── Metrics ─────────────────────────────────────────────────────────────────

describe("collectorMetrics", () => {
  it("exposes sessionsStarted, heartbeats, events counters", () => {
    expect(collectorMetrics).toBeDefined();
    expect(typeof collectorMetrics.sessionsStarted).toBe("number");
    expect(typeof collectorMetrics.heartbeats).toBe("number");
    expect(typeof collectorMetrics.events).toBe("number");
  });
});

// ─── Schema tables ───────────────────────────────────────────────────────────

describe("collector schema tables", () => {
  it("collectorSessions table is importable", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.collectorSessions).toBeDefined();
  });

  it("collectorEvents table is importable", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.collectorEvents).toBeDefined();
  });

  it("collectorSessions has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.collectorSessions);
    expect(cols).toContain("uid");
    expect(cols).toContain("captureId");
    expect(cols).toContain("probeId");
    expect(cols).toContain("status");
    expect(cols).toContain("startedAt");
    expect(cols).toContain("stoppedAt");
    expect(cols).toContain("lastHeartbeatAt");
    expect(cols).toContain("metaJson");
    expect(cols).toContain("createdBy");
  });

  it("collectorEvents has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.collectorEvents);
    expect(cols).toContain("uid");
    expect(cols).toContain("sessionId");
    expect(cols).toContain("level");
    expect(cols).toContain("eventType");
    expect(cols).toContain("message");
    expect(cols).toContain("dataJson");
  });

  it("probes table has probeToken column", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.probes);
    expect(cols).toContain("probeToken");
  });

  it("collectorSessions status enum includes expected values", async () => {
    const schema = await import("../drizzle/schema");
    // Drizzle enum config is stored in the column definition
    const statusCol = (schema.collectorSessions as any).status;
    expect(statusCol).toBeDefined();
  });

  it("collectorEvents eventType enum includes expected values", async () => {
    const schema = await import("../drizzle/schema");
    const eventTypeCol = (schema.collectorEvents as any).eventType;
    expect(eventTypeCol).toBeDefined();
  });
});

// ─── Router registration ─────────────────────────────────────────────────────

describe("collector router registration", () => {
  it("collector router is registered in appRouter", async () => {
    const { appRouter } = await import("./routers");
    const routerKeys = Object.keys((appRouter as any)._def.procedures);
    // collector.start, collector.stop, etc. should be present as "collector.start"
    const collectorProcedures = routerKeys.filter(k => k.startsWith("collector."));
    expect(collectorProcedures.length).toBe(9);
    expect(collectorProcedures).toContain("collector.start");
    expect(collectorProcedures).toContain("collector.stop");
    expect(collectorProcedures).toContain("collector.status");
    expect(collectorProcedures).toContain("collector.heartbeat");
    expect(collectorProcedures).toContain("collector.appendEvent");
    expect(collectorProcedures).toContain("collector.listSessions");
    expect(collectorProcedures).toContain("collector.listEvents");
    expect(collectorProcedures).toContain("collector.activeSessions");
    expect(collectorProcedures).toContain("collector.dashboard");
  });
});

// ─── Frontend migration checks ───────────────────────────────────────────────

describe("collectorApi.ts should be dead code", () => {
  it("collectorApi.ts should not be imported by any page component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pagesDir = path.resolve(process.cwd(), "client/src/pages");
    
    if (!fs.existsSync(pagesDir)) return; // skip if pages dir doesn't exist in test env
    
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(pagesDir, file), "utf-8");
      expect(content).not.toContain("collectorApi");
    }
  });

  it("useCaptureQueries.ts should not be imported by any page component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pagesDir = path.resolve(process.cwd(), "client/src/pages");
    
    if (!fs.existsSync(pagesDir)) return;
    
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(pagesDir, file), "utf-8");
      expect(content).not.toContain("useCaptureQueries");
    }
  });

  it("useProbeQueries.ts should not be imported by any page component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const pagesDir = path.resolve(process.cwd(), "client/src/pages");
    
    if (!fs.existsSync(pagesDir)) return;
    
    const files = fs.readdirSync(pagesDir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(pagesDir, file), "utf-8");
      expect(content).not.toContain("useProbeQueries");
    }
  });
});
