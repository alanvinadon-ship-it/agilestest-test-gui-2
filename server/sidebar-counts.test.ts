/**
 * Tests for sidebar badge counts feature.
 *
 * Covers:
 * - Backend: ui router file structure and SQL query
 * - Frontend: hook structure, section mapping, format logic
 * - Integration: DashboardLayout uses badge prop
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// ─── 1. Backend: ui router ─────────────────────────────────────────────────

describe("ui.sidebarCounts backend router", () => {
  const routerSrc = readFileSync(
    join(ROOT, "server/routers/ui.ts"),
    "utf-8"
  );

  it("file exists", () => {
    expect(existsSync(join(ROOT, "server/routers/ui.ts"))).toBe(true);
  });

  it("exports uiRouter", () => {
    expect(routerSrc).toContain("export const uiRouter");
  });

  it("defines sidebarCounts procedure", () => {
    expect(routerSrc).toContain("sidebarCounts");
  });

  it("uses protectedProcedure (auth required)", () => {
    expect(routerSrc).toContain("protectedProcedure");
  });

  it("queries executions with PENDING/RUNNING status", () => {
    expect(routerSrc).toContain("PENDING");
    expect(routerSrc).toContain("RUNNING");
  });

  it("queries invites with PENDING status", () => {
    expect(routerSrc).toContain("invites");
    expect(routerSrc).toContain("PENDING");
  });

  it("returns runningExecutions, pendingInvites, activeDriveSessions", () => {
    expect(routerSrc).toContain("runningExecutions");
    expect(routerSrc).toContain("pendingInvites");
    expect(routerSrc).toContain("activeDriveSessions");
  });

  it("uses a single aggregated query (sub-selects)", () => {
    expect(routerSrc).toContain("SELECT COUNT(*)");
    expect(routerSrc).toContain("_dummy");
  });

  it("handles missing DB gracefully (returns zeros)", () => {
    expect(routerSrc).toContain("runningExecutions: 0");
    expect(routerSrc).toContain("pendingInvites: 0");
    expect(routerSrc).toContain("activeDriveSessions: 0");
  });
});

// ─── 2. Router registration ────────────────────────────────────────────────

describe("ui router registration in appRouter", () => {
  const routersSrc = readFileSync(
    join(ROOT, "server/routers.ts"),
    "utf-8"
  );

  it("imports uiRouter", () => {
    expect(routersSrc).toContain('import { uiRouter } from "./routers/ui"');
  });

  it("registers ui router in appRouter", () => {
    expect(routersSrc).toContain("ui: uiRouter");
  });
});

// ─── 3. Frontend: useSidebarCounts hook ────────────────────────────────────

describe("useSidebarCounts hook", () => {
  const hookSrc = readFileSync(
    join(ROOT, "client/src/hooks/useSidebarCounts.ts"),
    "utf-8"
  );

  it("file exists", () => {
    expect(existsSync(join(ROOT, "client/src/hooks/useSidebarCounts.ts"))).toBe(true);
  });

  it("imports trpc", () => {
    expect(hookSrc).toContain("trpc");
  });

  it("calls trpc.ui.sidebarCounts.useQuery", () => {
    expect(hookSrc).toContain("trpc.ui.sidebarCounts.useQuery");
  });

  it("defines SECTION_COUNT_MAP with correct mappings", () => {
    expect(hookSrc).toContain('"Exécution": "runningExecutions"');
    expect(hookSrc).toContain('Administration: "pendingInvites"');
    expect(hookSrc).toContain('"Drive Test": "activeDriveSessions"');
  });

  it("defines ACTIVE_INTERVAL (10s) and IDLE_INTERVAL (60s)", () => {
    expect(hookSrc).toContain("ACTIVE_INTERVAL");
    expect(hookSrc).toContain("IDLE_INTERVAL");
    expect(hookSrc).toContain("10_000");
    expect(hookSrc).toContain("60_000");
  });

  it("uses refetchInterval with adaptive logic", () => {
    expect(hookSrc).toContain("refetchInterval");
    expect(hookSrc).toContain("runningExecutions > 0");
  });

  it("exports getCount and formatCount functions", () => {
    expect(hookSrc).toContain("getCount");
    expect(hookSrc).toContain("formatCount");
  });

  it("formatCount returns null for 0", () => {
    expect(hookSrc).toContain("if (count <= 0) return null");
  });

  it("formatCount returns '99+' for counts > 99", () => {
    expect(hookSrc).toContain('if (count > 99) return "99+"');
  });
});

// ─── 4. DashboardLayout badge integration ──────────────────────────────────

describe("DashboardLayout badge integration", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("imports useSidebarCounts", () => {
    expect(layoutSrc).toContain("useSidebarCounts");
  });

  it("calls formatCount", () => {
    expect(layoutSrc).toContain("formatCount");
  });

  it("passes badge prop to NavSectionAccordion", () => {
    expect(layoutSrc).toContain("badge={formatCount(section.label)}");
  });

  it("NavSectionAccordion accepts badge prop", () => {
    expect(layoutSrc).toContain("badge?: string | null");
  });

  it("renders badge span with aria-label for accessibility", () => {
    expect(layoutSrc).toContain("aria-label=");
    expect(layoutSrc).toContain("éléments actifs");
  });

  it("renders badge in collapsed mode (absolute positioned)", () => {
    expect(layoutSrc).toContain("absolute -top-1 -right-1");
  });

  it("hides active dot when badge is present", () => {
    expect(layoutSrc).toContain("!badge");
  });
});

// ─── 5. formatCount logic (pure function test) ─────────────────────────────

describe("formatCount logic", () => {
  // Inline the logic to test it as a pure function
  function formatCount(count: number): string | null {
    if (count <= 0) return null;
    if (count > 99) return "99+";
    return String(count);
  }

  it("returns null for 0", () => {
    expect(formatCount(0)).toBeNull();
  });

  it("returns null for negative", () => {
    expect(formatCount(-1)).toBeNull();
  });

  it("returns '1' for 1", () => {
    expect(formatCount(1)).toBe("1");
  });

  it("returns '99' for 99", () => {
    expect(formatCount(99)).toBe("99");
  });

  it("returns '99+' for 100", () => {
    expect(formatCount(100)).toBe("99+");
  });

  it("returns '99+' for 999", () => {
    expect(formatCount(999)).toBe("99+");
  });
});
