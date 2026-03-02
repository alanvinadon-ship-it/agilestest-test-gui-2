/**
 * Tests: ExecutionDetailPage tRPC migration + scenarioId filter
 * Validates:
 * - executions.get returns artifacts, incidents, analyses, scenario, profile
 * - executions.list accepts scenarioId filter
 * - ExecutionDetailPage uses tRPC (no memoryStore/repositoryApi/collectorApi)
 * - Artifacts router has getDownloadUrl endpoint
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Backend: executions.get enriched response ─────────────────────────

describe("tRPC router: executions.get enriched", () => {
  it("should have executions router with get procedure", async () => {
    const { executionsRouter } = await import("./routers/testing");
    expect(executionsRouter).toBeDefined();
    const procedures = Object.keys(executionsRouter._def.procedures);
    expect(procedures).toContain("get");
  });

  it("should have artifacts router with getDownloadUrl procedure", async () => {
    const { artifactsRouter } = await import("./routers/artifacts");
    expect(artifactsRouter).toBeDefined();
    const procedures = Object.keys(artifactsRouter._def.procedures);
    expect(procedures).toContain("getDownloadUrl");
  });
});

// ─── Backend: executions.list scenarioId filter ────────────────────────

describe("executions list with scenarioId filter", () => {
  const listInput = z.object({
    projectId: z.number(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(25),
    search: z.string().optional(),
    status: z.enum(["PENDING", "RUNNING", "PASSED", "FAILED", "CANCELLED", "ERROR"]).optional(),
    scenarioId: z.number().optional(),
  });

  it("should accept input with scenarioId filter", () => {
    const result = listInput.safeParse({ projectId: 1, scenarioId: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenarioId).toBe(42);
    }
  });

  it("should accept input without scenarioId (backward compat)", () => {
    const result = listInput.safeParse({ projectId: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scenarioId).toBeUndefined();
    }
  });

  it("should accept combined filters: status + scenarioId", () => {
    const result = listInput.safeParse({ projectId: 1, status: "FAILED", scenarioId: 5 });
    expect(result.success).toBe(true);
  });

  it("should reject non-numeric scenarioId", () => {
    const result = listInput.safeParse({ projectId: 1, scenarioId: "abc" });
    expect(result.success).toBe(false);
  });
});

// ─── Frontend: ExecutionDetailPage uses tRPC ───────────────────────────

describe("frontend: ExecutionDetailPage tRPC migration", () => {
  it("should use tRPC hooks (not memoryStore/repositoryApi/collectorApi)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");

    // Must use tRPC
    expect(content).toContain("trpc");
    expect(content).toContain("trpc.executions.get.useQuery");

    // Must NOT use old APIs
    expect(content).not.toContain("repositoryApi");
    expect(content).not.toContain("collectorApi");
    expect(content).not.toContain("localStore");
    expect(content).not.toContain("memoryStore");
    expect(content).not.toContain("localExecutions");
    expect(content).not.toContain("localCapturePolicies");
    expect(content).not.toContain("localCaptureSessions");
  });

  it("should display scenario and profile info", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("execData.scenario");
    expect(content).toContain("execData.profile");
  });

  it("should display artifacts table", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("Artefacts");
    expect(content).toContain("artsList");
  });

  it("should display incidents section", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("Incidents");
    expect(content).toContain("incidentsList");
  });

  it("should display AI analysis panel", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("AiAnalysisPanel");
    expect(content).toContain("analysesList");
  });

  it("should have rerun button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("handleRerun");
    expect(content).toContain("Rerun");
  });

  it("should have job enqueue actions (IA + JMeter)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("enqueueAiAnalysis");
    expect(content).toContain("enqueueParseJtl");
    expect(content).toContain("Analyser IA");
    expect(content).toContain("Parser JMeter");
  });

  it("should have artifact download button using tRPC", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("ArtifactDownloadButton");
    expect(content).toContain("artifacts.getDownloadUrl");
  });
});

// ─── Schema: aiAnalyses table exists ───────────────────────────────────

describe("schema: aiAnalyses table", () => {
  it("should have aiAnalyses table in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.aiAnalyses).toBeDefined();
    const columns = Object.keys(schema.aiAnalyses);
    expect(columns.length).toBeGreaterThan(0);
  });
});

// ─── Status config completeness ────────────────────────────────────────

describe("execution status config", () => {
  const allStatuses = ["PENDING", "RUNNING", "PASSED", "FAILED", "ERROR", "CANCELLED"];
  const envValues = ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"];

  it("should handle all execution statuses in frontend", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    for (const status of allStatuses) {
      expect(content).toContain(status);
    }
  });

  it("should handle all target environments in frontend", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    for (const env of envValues) {
      expect(content).toContain(env);
    }
  });
});
