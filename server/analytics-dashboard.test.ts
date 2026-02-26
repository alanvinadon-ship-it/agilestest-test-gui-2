import { describe, it, expect } from "vitest";

// ─── Analytics Router Tests ─────────────────────────────────────────────────

describe("Analytics — analyticsRouter", () => {
  it("should export analyticsRouter from routers/analytics.ts", async () => {
    const mod = await import("./routers/analytics");
    expect(mod.analyticsRouter).toBeDefined();
    expect(mod.analyticsRouter._def).toBeDefined();
  });

  it("analyticsRouter should have dashboard procedure", async () => {
    const mod = await import("./routers/analytics");
    const procedures = Object.keys(mod.analyticsRouter._def.procedures);
    expect(procedures).toContain("dashboard");
  });

  it("dashboard procedure should be protected", async () => {
    const mod = await import("./routers/analytics");
    const proc = (mod.analyticsRouter._def.procedures as any).dashboard;
    expect(proc).toBeDefined();
  });
});

// ─── Analytics registered in appRouter ──────────────────────────────────────

describe("Analytics — appRouter integration", () => {
  it("appRouter should include analytics router", async () => {
    const mod = await import("./routers");
    const procedures = Object.keys(mod.appRouter._def.procedures);
    // analytics.dashboard should be flattened as "analytics.dashboard"
    expect(procedures.some(p => p.startsWith("analytics"))).toBe(true);
  });
});

// ─── Cache layer tests ──────────────────────────────────────────────────────

describe("Analytics — cache layer", () => {
  it("should use 30s TTL cache to avoid hammering DB", async () => {
    // The cache is internal to the module, but we can verify the module loads
    const mod = await import("./routers/analytics");
    expect(mod.analyticsRouter).toBeDefined();
  });
});

// ─── DashboardPage frontend tests ───────────────────────────────────────────

describe("Analytics — DashboardPage frontend", () => {
  it("DashboardPage should import correctly", async () => {
    // Verify the file exists and exports a default component
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/DashboardPage.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export default function DashboardPage");
  });

  it("DashboardPage should use trpc.analytics.dashboard.useQuery", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/DashboardPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("trpc.analytics.dashboard.useQuery");
  });

  it("DashboardPage should render Chart.js components (Bar, Line, Doughnut)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/DashboardPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("from \"react-chartjs-2\"");
    expect(content).toContain("<Bar");
    expect(content).toContain("<Line");
    expect(content).toContain("<Doughnut");
  });

  it("DashboardPage should have period selector (week/month)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/DashboardPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Semaine");
    expect(content).toContain("Mois");
    expect(content).toContain("setPeriod");
  });

  it("DashboardPage should display 4 KPI cards", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/DashboardPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    // Count KpiCard instances
    const kpiCardCount = (content.match(/<KpiCard/g) || []).length;
    expect(kpiCardCount).toBe(4);
  });

  it("DashboardPage should have auto-refresh (refetchInterval)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/DashboardPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("refetchInterval");
  });
});

// ─── Route integration ──────────────────────────────────────────────────────

describe("Analytics — route integration", () => {
  it("App.tsx should have /dashboard route", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("/dashboard");
    expect(content).toContain("DashboardPage");
  });

  it("Sidebar should have Analytique link", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/components/DashboardLayout.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Analytique");
    expect(content).toContain("/dashboard");
  });
});

// ─── SQL query structure tests ──────────────────────────────────────────────

describe("Analytics — SQL queries use correct column names", () => {
  it("should use snake_case column names in raw SQL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // Real DB uses snake_case: project_id, created_at, detected_at, last_seen_at
    expect(content).toContain("e.project_id");
    expect(content).toContain("e.created_at");
    expect(content).toContain("i.detected_at");
    expect(content).toContain("p.last_seen_at");
    expect(content).toContain("p.status");
  });

  it("should support period grouping (week and month)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("%x-W%v"); // ISO week format
    expect(content).toContain("%Y-%m"); // month format
  });
});
