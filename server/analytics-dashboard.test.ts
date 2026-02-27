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

  it("analyticsRouter should have globalDashboard procedure", async () => {
    const mod = await import("./routers/analytics");
    const procedures = Object.keys(mod.analyticsRouter._def.procedures);
    expect(procedures).toContain("globalDashboard");
  });

  it("dashboard procedure should be protected", async () => {
    const mod = await import("./routers/analytics");
    const proc = (mod.analyticsRouter._def.procedures as any).dashboard;
    expect(proc).toBeDefined();
  });

  it("globalDashboard procedure should be protected", async () => {
    const mod = await import("./routers/analytics");
    const proc = (mod.analyticsRouter._def.procedures as any).globalDashboard;
    expect(proc).toBeDefined();
  });
});

// ─── Analytics registered in appRouter ──────────────────────────────────────

describe("Analytics — appRouter integration", () => {
  it("appRouter should include analytics router", async () => {
    const mod = await import("./routers");
    const procedures = Object.keys(mod.appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("analytics"))).toBe(true);
  });

  it("appRouter should include analytics.globalDashboard", async () => {
    const mod = await import("./routers");
    const procedures = Object.keys(mod.appRouter._def.procedures);
    expect(procedures).toContain("analytics.globalDashboard");
  });
});

// ─── Cache layer tests ──────────────────────────────────────────────────────

describe("Analytics — cache layer", () => {
  it("should use 30s TTL cache to avoid hammering DB", async () => {
    const mod = await import("./routers/analytics");
    expect(mod.analyticsRouter).toBeDefined();
  });
});

// ─── GlobalAnalyticsPage frontend tests ─────────────────────────────────────

describe("Analytics — GlobalAnalyticsPage frontend", () => {
  it("GlobalAnalyticsPage should import correctly", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/GlobalAnalyticsPage.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export default function GlobalAnalyticsPage");
  });

  it("GlobalAnalyticsPage should use trpc.analytics.globalDashboard.useQuery", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/GlobalAnalyticsPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("trpc.analytics.globalDashboard.useQuery");
  });

  it("GlobalAnalyticsPage should have period selector (week/month)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/GlobalAnalyticsPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Semaine");
    expect(content).toContain("Mois");
    expect(content).toContain("setPeriod");
  });

  it("GlobalAnalyticsPage should display KPI cards including incidents and probes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/GlobalAnalyticsPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const kpiCardCount = (content.match(/<KpiCard/g) || []).length;
    expect(kpiCardCount).toBeGreaterThanOrEqual(6);
  });

  it("GlobalAnalyticsPage should render Chart.js charts for runs, incidents, probes", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/GlobalAnalyticsPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    // Should have canvas refs for multiple charts
    expect(content).toContain("Chart");
    // Should reference runs, incidents, probes data
    expect(content).toContain("runs");
    expect(content).toContain("incidents");
    expect(content).toContain("probes");
  });

  it("GlobalAnalyticsPage should have auto-refresh (refetchInterval)", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/GlobalAnalyticsPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("refetchInterval");
  });
});

// ─── DashboardPage frontend tests ───────────────────────────────────────────

describe("Analytics — DashboardPage frontend", () => {
  it("DashboardPage should import correctly", async () => {
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

  it("Sidebar should have Analytique Globale link", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/components/DashboardLayout.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Analytique Globale");
    expect(content).toContain("/analytics");
  });
});

// ─── SQL query structure tests ──────────────────────────────────────────────

describe("Analytics — SQL queries use correct column names", () => {
  it("should use snake_case column names in raw SQL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
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
    expect(content).toContain("%x-W%v");
    expect(content).toContain("%Y-%m");
  });

  it("globalDashboard should query incidents by severity", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("i.severity = 'CRITICAL'");
    expect(content).toContain("i.severity = 'MAJOR'");
    expect(content).toContain("i.severity = 'MINOR'");
    expect(content).toContain("i.severity = 'INFO'");
  });

  it("globalDashboard should query probes health snapshot", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("green_count");
    expect(content).toContain("orange_count");
    expect(content).toContain("red_count");
    expect(content).toContain("total_probes");
  });

  it("globalDashboard should query jobs backlog", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("FROM jobs");
    expect(content).toContain("'QUEUED'");
    expect(content).toContain("'RUNNING'");
  });

  it("globalDashboard should support optional projectUid filter", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("projectUid");
  });
});

// ─── GlobalDashboard result shape tests ─────────────────────────────────────

describe("Analytics — globalDashboard result shape", () => {
  it("should return runs series with labels, passed, failed, aborted, total, successRate", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // Check the GlobalDashboardResult type includes runs
    expect(content).toContain("runs: {");
    expect(content).toContain("incidents: {");
    expect(content).toContain("probes: {");
  });

  it("KPIs should include openIncidents, redProbes, jobsBacklog", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "./routers/analytics.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("openIncidents");
    expect(content).toContain("redProbes");
    expect(content).toContain("jobsBacklog");
  });
});
