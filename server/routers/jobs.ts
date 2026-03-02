// ============================================================================
// AgilesTest — Jobs tRPC Router
// Enqueue, status, list by run
// ============================================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { enqueueJob, getJobStatus, getJobsByRun } from "../jobQueue";

export const jobsRouter = router({
  /**
   * Enqueue a parseJmeterJtl job.
   */
  enqueueParseJtl: protectedProcedure
    .input(
      z.object({
        runId: z.number(),
        artifactId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const jobId = await enqueueJob("parseJmeterJtl", {
        runId: input.runId,
        artifactId: input.artifactId,
      });
      return { jobId };
    }),

  /**
   * Enqueue an AI analysis job.
   */
  enqueueAiAnalysis: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .mutation(async ({ input }) => {
      const jobId = await enqueueJob("aiAnalyzeRun", {
        runId: input.runId,
      });
      return { jobId };
    }),

  /**
   * Enqueue a retention purge job (admin only).
   */
  enqueueRetentionPurge: protectedProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can trigger retention purge",
        });
      }
      const jobId = await enqueueJob("retentionPurge", {
        dryRun: input.dryRun,
      });
      return { jobId };
    }),

  /**
   * Get job status by ID.
   */
  status: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async ({ input }) => {
      const job = await getJobStatus(input.jobId);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }
      return job;
    }),

  /**
   * List all jobs for a given run.
   */
  listByRun: protectedProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      return getJobsByRun(input.runId);
    }),
});
