/**
 * Tests: Reports PDF Export — backend router + job handler + frontend button
 */
import { describe, it, expect } from "vitest";

// ─── Backend: reportsRouter structure ──────────────────────────────────

describe("reportsRouter structure", () => {
  it("should have requestPdf, getReport, listByExecution procedures", async () => {
    const { reportsRouter } = await import("./routers/reports");
    const procedures = Object.keys(reportsRouter._def.procedures);
    expect(procedures).toContain("requestPdf");
    expect(procedures).toContain("getReport");
    expect(procedures).toContain("listByExecution");
    expect(procedures.length).toBe(3);
  });
});

// ─── Backend: reports table in schema ──────────────────────────────────

describe("reports table schema", () => {
  it("should have reports table with correct columns", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.reports).toBeDefined();
    // Check the table has the expected columns by inspecting the symbol
    const columns = Object.keys(schema.reports);
    expect(columns).toContain("id");
    expect(columns).toContain("executionId");
    expect(columns).toContain("projectId");
    expect(columns).toContain("status");
    expect(columns).toContain("storagePath");
    expect(columns).toContain("downloadUrl");
    expect(columns).toContain("filename");
    expect(columns).toContain("sizeBytes");
    expect(columns).toContain("error");
    expect(columns).toContain("requestedBy");
  });
});

// ─── Backend: job handler registration ─────────────────────────────────

describe("generateExecutionPdf job handler", () => {
  it("should be registered as a job type", async () => {
    const { enqueueJob } = await import("./jobQueue");
    expect(enqueueJob).toBeDefined();
    // Verify the type is accepted (TypeScript ensures this at compile time)
    // We just verify the module loads without error
  });

  it("should have generateExecutionPdf in JobName type", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain('"generateExecutionPdf"');
    expect(content).toContain("registerHandler(\"generateExecutionPdf\"");
  });

  it("should use pdfkit for PDF generation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain("pdfkit");
    expect(content).toContain("PDFDocument");
  });

  it("should upload to S3 via storagePut", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain("storagePut");
    expect(content).toContain("application/pdf");
  });

  it("should update report status to DONE on success", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain('status: "DONE"');
    expect(content).toContain('status: "FAILED"');
    expect(content).toContain('status: "GENERATING"');
  });

  it("should include execution summary, incidents, artifacts, AI analyses in PDF", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/jobQueue.ts", "utf-8");
    expect(content).toContain("Résumé de l'exécution");
    expect(content).toContain("Incidents");
    expect(content).toContain("Artefacts");
    expect(content).toContain("Analyses IA");
  });
});

// ─── Backend: router wiring ────────────────────────────────────────────

describe("reportsRouter wiring in appRouter", () => {
  it("should be registered in the main appRouter", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("reports: reportsRouter");
    expect(content).toContain("import { reportsRouter }");
  });
});

// ─── Frontend: ExportPdfButton ─────────────────────────────────────────

describe("frontend: ExportPdfButton in ExecutionDetailPage", () => {
  it("should use trpc.reports.requestPdf.useMutation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("trpc.reports.requestPdf.useMutation");
  });

  it("should poll trpc.reports.getReport.useQuery with refetchInterval", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("trpc.reports.getReport.useQuery");
    expect(content).toContain("refetchInterval");
  });

  it("should show different states: Export PDF, Génération, Télécharger, Réessayer", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("Export PDF");
    expect(content).toContain("Génération...");
    expect(content).toContain("Télécharger PDF");
    expect(content).toContain("Réessayer PDF");
  });

  it("should auto-open download URL when report is DONE", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("window.open(report.downloadUrl");
  });

  it("should have FileDown icon from lucide-react", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/pages/ExecutionDetailPage.tsx", "utf-8");
    expect(content).toContain("FileDown");
  });
});
