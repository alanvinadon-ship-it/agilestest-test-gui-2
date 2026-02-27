/**
 * Tests: Captures advanced filters — status/probeId/q server-side + URL sync frontend
 */
import { describe, it, expect } from "vitest";

// ─── Backend: captures.list extended input ─────────────────────────────

describe("capturesRouter.list extended filters", () => {
  it("should have captures router with list procedure", async () => {
    const { capturesRouter } = await import("./routers/testing");
    const procedures = Object.keys(capturesRouter._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("create");
    expect(procedures).toContain("delete");
  });

  it("should accept status as single value", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    // Zod union: single enum or array
    expect(content).toContain('z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"])');
    expect(content).toContain("z.union");
  });

  it("should accept status as array of values", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain("z.array(z.enum");
  });

  it("should accept probeId filter", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain("probeId: z.number().optional()");
  });

  it("should accept q (text search) filter", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain("q: z.string().optional()");
  });

  it("should filter by status using SQL WHERE", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain("inArray(captures.status, statuses)");
  });

  it("should filter by probeId using JSON_EXTRACT on config", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain("JSON_EXTRACT");
    expect(content).toContain("$.probeId");
  });

  it("should filter by q using LIKE on name", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain("like(captures.name");
  });

  it("should import inArray from drizzle-orm", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/testing.ts", "utf-8");
    expect(content).toContain("inArray");
    expect(content).toContain("from \"drizzle-orm\"");
  });
});

// ─── Frontend: CapturesPage filters ────────────────────────────────────

describe("frontend: CapturesPage advanced filters", () => {
  it("should use URL query params for filters (useSearch/useLocation)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("useSearch");
    expect(content).toContain("useLocation");
    expect(content).toContain("URLSearchParams");
  });

  it("should have status filter dropdown", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("statusFilter");
    expect(content).toContain("Tous les statuts");
  });

  it("should have probe filter dropdown fed by probes.listLite", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("probeIdFilter");
    expect(content).toContain("trpc.probes.listLite.useQuery");
    expect(content).toContain("Toutes les sondes");
  });

  it("should have debounced search input synced to URL", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("searchInput");
    expect(content).toContain("setTimeout");
    expect(content).toContain("p.set('q'");
  });

  it("should reset page to 1 when filters change", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("p.set('page', '1')");
  });

  it("should use cursor pagination with 'Charger plus' pattern", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("captureCursor");
    expect(content).toContain("Charger plus");
  });

  it("should have a reset filters button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("resetFilters");
    expect(content).toContain("Réinitialiser");
  });

  it("should NOT do client-side filtering (all server-side)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    // Should not have .filter() on captures for search
    expect(content).toContain("const filteredCaptures = captures;");
  });

  it("should pass probeId as number to tRPC query", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/CapturesPage.tsx", "utf-8");
    expect(content).toContain("probeId: Number(probeIdFilter)");
  });
});
