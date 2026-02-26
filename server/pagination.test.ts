/**
 * Pagination tests — validates the pagination helpers and
 * that paginated router procedures return the correct shape.
 *
 * Tests:
 *  1. paginateInMemory: items <= limit, total correct, sort works
 *  2. paginationInput Zod schema: defaults, bounds, validation
 *  3. Router integration: paginated list endpoints return { items, total }
 */
import { describe, expect, it } from "vitest";
import { paginationInput, paginateInMemory, type PaginatedResult } from "./pagination";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Generate N fake items with an id and createdAt */
function fakeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `item-${i + 1}`,
    createdAt: new Date(2025, 0, 1 + i),
  }));
}

/** Create a minimal authenticated context for router calls */
function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      fullName: "Test User",
      loginMethod: "manus",
      role: "admin",
      status: "ACTIVE",
      passwordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. paginationInput Zod schema
// ═══════════════════════════════════════════════════════════════════════════

describe("paginationInput schema", () => {
  it("applies default values when empty object is provided", () => {
    const result = paginationInput.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.sortDir).toBe("desc");
  });

  it("accepts valid custom values", () => {
    const result = paginationInput.parse({
      page: 3,
      pageSize: 50,
      sortBy: "name",
      sortDir: "asc",
    });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
    expect(result.sortBy).toBe("name");
    expect(result.sortDir).toBe("asc");
  });

  it("accepts legacy limit/offset", () => {
    const result = paginationInput.parse({
      limit: 50,
      offset: 100,
    });
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(100);
  });

  it("rejects limit > 100", () => {
    expect(() => paginationInput.parse({ limit: 200 })).toThrow();
  });

  it("rejects limit < 1", () => {
    expect(() => paginationInput.parse({ limit: 0 })).toThrow();
  });

  it("rejects negative offset", () => {
    expect(() => paginationInput.parse({ offset: -1 })).toThrow();
  });

  it("rejects pageSize > 100", () => {
    expect(() => paginationInput.parse({ pageSize: 200 })).toThrow();
  });

  it("rejects page < 1", () => {
    expect(() => paginationInput.parse({ page: 0 })).toThrow();
  });

  it("rejects invalid sortDir", () => {
    expect(() => paginationInput.parse({ sortDir: "random" })).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. paginateInMemory
// ═══════════════════════════════════════════════════════════════════════════

describe("paginateInMemory", () => {
  const items = fakeItems(50);

  it("returns items.length <= pageSize", () => {
    const result = paginateInMemory(items, { page: 1, pageSize: 10, sortDir: "desc" });
    expect(result.items.length).toBeLessThanOrEqual(10);
    expect(result.items.length).toBe(10);
  });

  it("returns correct total regardless of page/pageSize", () => {
    const result = paginateInMemory(items, { page: 5, pageSize: 5, sortDir: "desc" });
    expect(result.total).toBe(50);
  });

  it("returns empty items when page exceeds total", () => {
    const result = paginateInMemory(items, { page: 20, pageSize: 10, sortDir: "desc" });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(50);
  });

  it("respects page for slicing", () => {
    const result = paginateInMemory(items, { page: 3, pageSize: 5, sortDir: "desc" });
    // page 3, pageSize 5 → offset 10
    expect(result.items[0]).toEqual(items[10]);
    expect(result.items.length).toBe(5);
  });

  it("supports legacy limit/offset", () => {
    const result = paginateInMemory(items, { page: 1, pageSize: 25, limit: 5, offset: 10, sortDir: "desc" });
    // limit/offset take priority via resolveOffsets
    expect(result.items[0]).toEqual(items[10]);
    expect(result.items.length).toBe(5);
  });

  it("applies custom sort function", () => {
    const sortFn = (a: any, b: any) => b.id - a.id; // desc by id
    const result = paginateInMemory(items, { limit: 3, offset: 0, sortDir: "desc" }, sortFn);
    expect(result.items[0]!.id).toBe(50);
    expect(result.items[1]!.id).toBe(49);
    expect(result.items[2]!.id).toBe(48);
  });

  it("handles empty array", () => {
    const result = paginateInMemory([], { limit: 10, offset: 0, sortDir: "desc" });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns correct shape (items + total)", () => {
    const result = paginateInMemory(items, { limit: 5, offset: 0, sortDir: "desc" });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("last page returns remaining items", () => {
    const result = paginateInMemory(items, { limit: 25, offset: 40, sortDir: "desc" });
    expect(result.items.length).toBe(10); // 50 - 40 = 10
    expect(result.total).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Router integration — paginated list endpoints return { items, total }
// ═══════════════════════════════════════════════════════════════════════════

describe("Router paginated list endpoints", () => {
  const ctx = createTestContext();
  const caller = appRouter.createCaller(ctx);

  /**
   * Helper: call a paginated list endpoint and assert the shape.
   * We pass limit=1 to ensure we get at most 1 item (fast).
   */
  async function assertPaginatedShape(
    callFn: () => Promise<unknown>,
    label: string,
  ) {
    const result = (await callFn()) as PaginatedResult<unknown>;
    expect(result, `${label} should return an object`).toBeDefined();
    expect(result, `${label} should have 'items'`).toHaveProperty("items");
    expect(result, `${label} should have 'total'`).toHaveProperty("total");
    expect(Array.isArray(result.items), `${label} items should be array`).toBe(true);
    expect(typeof result.total, `${label} total should be number`).toBe("number");
    expect(result.items.length, `${label} items <= limit`).toBeLessThanOrEqual(1);
    expect(result.total, `${label} total >= 0`).toBeGreaterThanOrEqual(0);
  }

  it("projects.list returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.projects.list({ limit: 1, offset: 0 }),
      "projects.list",
    );
  });

  it("profiles.list returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.profiles.list({ projectId: "nonexistent", limit: 1, offset: 0 }),
      "profiles.list",
    );
  });

  it("scenarios.list returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.scenarios.list({ projectId: "nonexistent", limit: 1, offset: 0 }),
      "scenarios.list",
    );
  });

  it("executions.list returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.executions.list({ projectId: "nonexistent", limit: 1, offset: 0 }),
      "executions.list",
    );
  });

  it("captures.listSessions returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.captures.listSessions({ policyId: "nonexistent", limit: 1, offset: 0 }),
      "captures.listSessions",
    );
  });

  it("probes.list returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.probes.list({ limit: 1, offset: 0 }),
      "probes.list",
    );
  });

  it("datasets.listTypes returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.datasets.listTypes({ limit: 1, offset: 0 }),
      "datasets.listTypes",
    );
  });

  it("drivetest.listCampaigns returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.drivetest.listCampaigns({ projectId: "nonexistent", limit: 1, offset: 0 }),
      "drivetest.listCampaigns",
    );
  });

  it("drivetest.listJobs returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.drivetest.listJobs({ campaignId: "nonexistent", limit: 1, offset: 0 }),
      "drivetest.listJobs",
    );
  });

  it("drivetest.listKpiSamples returns { items, total }", async () => {
    await assertPaginatedShape(
      () => caller.drivetest.listKpiSamples({ driveJobId: "nonexistent", limit: 1, offset: 0 }),
      "drivetest.listKpiSamples",
    );
  });
});
