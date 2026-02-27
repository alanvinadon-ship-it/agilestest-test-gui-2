/**
 * Reports Router — PDF export management
 * Endpoints: requestPdf, getReport, listByExecution
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { reports, executions, users } from "../../drizzle/schema";
import { paginationInput } from "../../shared/pagination";
import { normalizePagination, countRows } from "../lib/pagination";
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

      // Create report record — execution.projectId is varchar, reports.projectId is int
      const [insertResult] = await db.insert(reports).values({
        executionId: input.executionId,
        projectId: Number(execution.projectId),
        status: "PENDING",
        requestedBy: ctx.user!.id,
      });
      const reportId = Number(insertResult.insertId);

      // Enqueue job
      await enqueueJob("generateExecutionPdf", {
        executionId: input.executionId,
        reportId,
        projectId: Number(execution.projectId),
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

  /** List reports for an execution — paginated with user info */
  listByExecution: protectedProcedure
    .input(z.object({
      executionId: z.number(),
      ...paginationInput.shape,
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { page, pageSize, offset } = normalizePagination(input);
      const where = eq(reports.executionId, input.executionId);
      const [rows, cnt] = await Promise.all([
        db.select({
          id: reports.id,
          executionId: reports.executionId,
          projectId: reports.projectId,
          status: reports.status,
          filename: reports.filename,
          sizeBytes: reports.sizeBytes,
          downloadUrl: reports.downloadUrl,
          error: reports.error,
          requestedBy: reports.requestedBy,
          createdAt: reports.createdAt,
          updatedAt: reports.updatedAt,
        }).from(reports)
          .where(where)
          .orderBy(desc(reports.createdAt))
          .limit(pageSize).offset(offset),
        countRows(db, reports, where),
      ]);
      const total = cnt[0]?.count ?? 0;
      // Enrich with user names
      const userIds = [...new Set(rows.map(r => r.requestedBy).filter(Boolean))] as number[];
      let userMap: Record<number, string> = {};
      if (userIds.length > 0) {
        const userRows = await db.select({ id: users.id, name: users.name }).from(users);
        userMap = Object.fromEntries(userRows.map(u => [u.id, u.name ?? `User #${u.id}`]));
      }
      const data = rows.map(r => ({
        ...r,
        requestedByName: r.requestedBy ? (userMap[r.requestedBy] ?? `User #${r.requestedBy}`) : null,
      }));
      return { data, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
    }),
});
