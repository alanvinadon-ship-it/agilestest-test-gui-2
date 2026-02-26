/**
 * Reports Router — PDF export management
 * Endpoints: requestPdf, getReport, listByExecution
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reports, executions } from "../../drizzle/schema";
import { enqueueJob } from "../jobQueue";

export const reportsRouter = router({
  /** Request PDF generation for an execution */
  requestPdf: protectedProcedure
    .input(z.object({ executionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify execution exists
      const [execution] = await db.select().from(executions)
        .where(eq(executions.id, input.executionId)).limit(1);
      if (!execution) throw new TRPCError({ code: "NOT_FOUND", message: "Exécution introuvable" });

      // Check if there's already a pending/generating report
      const [existing] = await db.select().from(reports)
        .where(and(
          eq(reports.executionId, input.executionId),
          eq(reports.status, "PENDING"),
        )).limit(1);
      if (existing) {
        return { reportId: existing.id, status: "PENDING", message: "Un rapport est déjà en cours de génération." };
      }

      // Create report record
      const [insertResult] = await db.insert(reports).values({
        executionId: input.executionId,
        projectId: execution.projectId,
        status: "PENDING",
        requestedBy: ctx.user!.id,
      });
      const reportId = Number(insertResult.insertId);

      // Enqueue job
      await enqueueJob("generateExecutionPdf", {
        executionId: input.executionId,
        reportId,
        projectId: execution.projectId,
      });

      return { reportId, status: "PENDING", message: "Génération du PDF lancée." };
    }),

  /** Get a specific report by ID */
  getReport: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [report] = await db.select().from(reports)
        .where(eq(reports.id, input.reportId)).limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Rapport introuvable" });

      return report;
    }),

  /** List reports for an execution */
  listByExecution: protectedProcedure
    .input(z.object({ executionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db.select().from(reports)
        .where(eq(reports.executionId, input.executionId))
        .orderBy(desc(reports.createdAt))
        .limit(20);

      return rows;
    }),
});
