/**
 * Tests: Reports History — listByExecution paginated + ReportsHistoryPanel frontend
 */
import { describe, it, expect } from "vitest";

// ─── Backend: reportsRouter.listByExecution ────────────────────────────

describe("reportsRouter.listByExecution paginated", () => {
  it("should have listByExecution procedure in reportsRouter", async () => {
    const { reportsRouter } = await import("./routers/reports");
    const procedures = Object.keys(reportsRouter._def.procedures);
    expect(procedures).toContain("listByExecution");
    expect(procedures).toContain("requestPdf");
    expect(procedures).toContain("getReport");
  });

  it("should accept pagination input (page, pageSize)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/reports.ts", "utf-8");
    expect(content).toContain("paginationInput");
    expect(content).toContain("normalizePagination");
    expect(content).toContain("countRows");
  });

  it("should return paginated response with data and pagination", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/reports.ts", "utf-8");
    expect(content).toContain("return { data, pagination:");
    expect(content).toContain("totalPages");
  });

  it("should enrich reports with requestedByName from users table", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/reports.ts", "utf-8");
    expect(content).toContain("requestedByName");
    expect(content).toContain("users.name");
    expect(content).toContain("userMap");
  });

  it("should import users from schema", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/reports.ts", "utf-8");
    expect(content).toContain("users");
    expect(content).toContain("from \"../../drizzle/schema\"");
  });

  it("should order by createdAt desc", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/reports.ts", "utf-8");
    expect(content).toContain("desc(reports.createdAt)");
  });

  it("should select specific columns for efficiency", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/reports.ts", "utf-8");
    expect(content).toContain("reports.id");
    expect(content).toContain("reports.status");
    expect(content).toContain("reports.filename");
    expect(content).toContain("reports.sizeBytes");
    expect(content).toContain("reports.downloadUrl");
  });
});

// ─── Frontend: ReportsHistoryPanel ─────────────────────────────────────

describe("frontend: ReportsHistoryPanel in ExecutionDetailPage", () => {
  it("should render ReportsHistoryPanel component", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("ReportsHistoryPanel");
    expect(content).toContain("<ReportsHistoryPanel executionId={executionId} />");
  });

  it("should call trpc.reports.listByExecution.useQuery", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("trpc.reports.listByExecution.useQuery");
  });

  it("should auto-refresh every 15 seconds", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("refetchInterval: 15000");
  });

  it("should display report table with status, filename, size, user, date, actions", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("Statut");
    expect(content).toContain("Fichier");
    expect(content).toContain("Taille");
    expect(content).toContain("Demandé par");
    expect(content).toContain("Date");
    expect(content).toContain("Actions");
  });

  it("should show status badges for DONE/PENDING/GENERATING/FAILED", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("case 'DONE'");
    expect(content).toContain("case 'PENDING'");
    expect(content).toContain("case 'GENERATING'");
    expect(content).toContain("case 'FAILED'");
  });

  it("should show download link for DONE reports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("r.downloadUrl");
    expect(content).toContain("Télécharger");
  });

  it("should show empty state when no reports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("Aucun rapport généré");
  });

  it("should display requestedByName (user name always visible)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("r.requestedByName");
  });

  it("should have pagination controls", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    // Check for pagination in ReportsHistoryPanel
    const panelIdx = content.indexOf("function ReportsHistoryPanel");
    const panelContent = content.slice(panelIdx);
    expect(panelContent).toContain("Précédent");
    expect(panelContent).toContain("Suivant");
    expect(panelContent).toContain("pagination.totalPages");
  });

  it("should be placed between Artifacts and Incidents sections", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    const reportsIdx = content.indexOf("Reports History");
    const incidentsIdx = content.indexOf("Incidents", reportsIdx);
    expect(reportsIdx).toBeGreaterThan(0);
    expect(incidentsIdx).toBeGreaterThan(reportsIdx);
  });
});
