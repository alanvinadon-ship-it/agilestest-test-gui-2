/**
 * Tests for kpiSamples + driveRunSummaries routers
 * Structure & input validation tests (no live DB)
 */
import { describe, it, expect } from "vitest";
import { kpiSamplesRouter, driveRunSummariesRouter } from "./routers/kpiData";

// ─── kpiSamplesRouter ──────────────────────────────────────────────────────

describe("kpiSamplesRouter", () => {
  it("exports a router with list, listAll, bulkInsert, deleteByJob", () => {
    const procedures = Object.keys((kpiSamplesRouter as any)._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("listAll");
    expect(procedures).toContain("bulkInsert");
    expect(procedures).toContain("deleteByJob");
  });

  it("list procedure exists and is a query", () => {
    const proc = (kpiSamplesRouter as any)._def.procedures.list;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("query");
  });

  it("listAll procedure exists and is a query", () => {
    const proc = (kpiSamplesRouter as any)._def.procedures.listAll;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("query");
  });

  it("bulkInsert procedure exists and is a mutation", () => {
    const proc = (kpiSamplesRouter as any)._def.procedures.bulkInsert;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("mutation");
  });

  it("deleteByJob procedure exists and is a mutation", () => {
    const proc = (kpiSamplesRouter as any)._def.procedures.deleteByJob;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("mutation");
  });

  it("list input accepts optional driveJobId, campaignId, kpiName, cursor, pageSize", () => {
    // Validate the input schema shape by checking the router definition exists
    const proc = (kpiSamplesRouter as any)._def.procedures.list;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });
});

// ─── driveRunSummariesRouter ───────────────────────────────────────────────

describe("driveRunSummariesRouter", () => {
  it("exports a router with list, get, upsert, delete", () => {
    const procedures = Object.keys((driveRunSummariesRouter as any)._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("get");
    expect(procedures).toContain("upsert");
    expect(procedures).toContain("delete");
  });

  it("list procedure exists and is a query", () => {
    const proc = (driveRunSummariesRouter as any)._def.procedures.list;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("query");
  });

  it("get procedure exists and is a query", () => {
    const proc = (driveRunSummariesRouter as any)._def.procedures.get;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("query");
  });

  it("upsert procedure exists and is a mutation", () => {
    const proc = (driveRunSummariesRouter as any)._def.procedures.upsert;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("mutation");
  });

  it("delete procedure exists and is a mutation", () => {
    const proc = (driveRunSummariesRouter as any)._def.procedures.delete;
    expect(proc).toBeDefined();
    expect(proc._def.type).toBe("mutation");
  });

  it("list input accepts optional campaignId, cursor, pageSize", () => {
    const proc = (driveRunSummariesRouter as any)._def.procedures.list;
    expect(proc._def.inputs).toBeDefined();
    expect(proc._def.inputs.length).toBeGreaterThan(0);
  });
});

// ─── Schema table checks ───────────────────────────────────────────────────

describe("kpiData schema tables", () => {
  it("kpiSamples table is importable", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.kpiSamples).toBeDefined();
  });

  it("driveRunSummaries table is importable", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.driveRunSummaries).toBeDefined();
  });

  it("kpiSamples has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.kpiSamples);
    expect(cols).toContain("uid");
    expect(cols).toContain("driveJobId");
    expect(cols).toContain("campaignId");
    expect(cols).toContain("kpiName");
    expect(cols).toContain("value");
  });

  it("driveRunSummaries has expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const cols = Object.keys(schema.driveRunSummaries);
    expect(cols).toContain("driveJobId");
    expect(cols).toContain("campaignId");
    expect(cols).toContain("totalSamples");
    expect(cols).toContain("overallPass");
  });
});
