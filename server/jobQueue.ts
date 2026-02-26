// ============================================================================
// AgilesTest — MySQL-based Job Queue
// Polling-based async job system using the `jobs` table
// ============================================================================

import { getDb } from "./db";
import { jobs, executions, artifacts, aiAnalyses } from "../drizzle/schema";
import { eq, and, lte, sql, inArray } from "drizzle-orm";
import { ENV } from "./_core/env";
import { deleteArtifact } from "./artifactStorage";

// ── Types ──────────────────────────────────────────────────────────────────

export type JobName =
  | "parseJmeterJtl"
  | "aiAnalyzeRun"
  | "retentionPurge";

export interface JobPayload {
  parseJmeterJtl: { runId: number; artifactId: number };
  aiAnalyzeRun: { runId: number };
  retentionPurge: { dryRun?: boolean };
}

type JobHandler<T extends JobName> = (
  payload: JobPayload[T]
) => Promise<Record<string, unknown>>;

// ── Handler registry ───────────────────────────────────────────────────────

const handlers: Partial<Record<JobName, JobHandler<any>>> = {};

export function registerHandler<T extends JobName>(
  name: T,
  handler: JobHandler<T>
) {
  handlers[name] = handler;
}

// ── Enqueue ────────────────────────────────────────────────────────────────

export async function enqueueJob<T extends JobName>(
  name: T,
  payload: JobPayload[T],
  options?: { maxAttempts?: number; runAfter?: Date }
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(jobs).values({
    name,
    payload,
    maxAttempts: options?.maxAttempts ?? 3,
    runAfter: options?.runAfter ?? new Date(),
  });

  return result.insertId;
}

// ── Poll & Process ─────────────────────────────────────────────────────────

let _polling = false;
let _pollInterval: ReturnType<typeof setInterval> | null = null;

export async function pollAndProcess(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();

  // Fetch one QUEUED job that is ready to run
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "QUEUED"),
        lte(jobs.runAfter, now)
      )
    )
    .orderBy(jobs.createdAt)
    .limit(1);

  if (!job) return 0;

  // Claim the job (optimistic: set RUNNING)
  const [updateResult] = await db
    .update(jobs)
    .set({
      status: "RUNNING",
      startedAt: now,
      attempts: sql`${jobs.attempts} + 1`,
    })
    .where(
      and(
        eq(jobs.id, job.id),
        eq(jobs.status, "QUEUED")
      )
    );

  // If no rows affected, another worker claimed it
  if (!updateResult.affectedRows) return 0;

  const handler = handlers[job.name as JobName];
  if (!handler) {
    await db
      .update(jobs)
      .set({
        status: "FAILED",
        error: `No handler registered for job '${job.name}'`,
        completedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
    return 1;
  }

  try {
    const result = await handler(job.payload as any);
    await db
      .update(jobs)
      .set({
        status: "DONE",
        result,
        completedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));
  } catch (err: any) {
    const currentAttempts = (job.attempts ?? 0) + 1;
    const shouldRetry = currentAttempts < (job.maxAttempts ?? 3);

    await db
      .update(jobs)
      .set({
        status: shouldRetry ? "QUEUED" : "FAILED",
        error: err?.message ?? String(err),
        completedAt: shouldRetry ? null : new Date(),
      })
      .where(eq(jobs.id, job.id));
  }

  return 1;
}

export function startPolling(intervalMs = 5000) {
  if (_polling) return;
  _polling = true;
  console.log(`[JobQueue] Polling started (interval: ${intervalMs}ms)`);

  _pollInterval = setInterval(async () => {
    try {
      await pollAndProcess();
    } catch (err) {
      console.error("[JobQueue] Poll error:", err);
    }
  }, intervalMs);
}

export function stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
  _polling = false;
  console.log("[JobQueue] Polling stopped");
}

// ── Built-in Handlers ──────────────────────────────────────────────────────

/**
 * Parse JMeter JTL artifact: extract KPIs, update execution status.
 */
registerHandler("parseJmeterJtl", async (payload) => {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const { runId, artifactId } = payload;

  // Fetch artifact
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, artifactId))
    .limit(1);

  if (!artifact) throw new Error(`Artifact ${artifactId} not found`);

  // In a real implementation, this would:
  // 1. Download the JTL file from S3
  // 2. Parse CSV/XML JTL format
  // 3. Calculate KPIs (avg response time, throughput, error rate, p95, p99)
  // 4. Store results

  const kpis = {
    totalRequests: 0,
    avgResponseTimeMs: 0,
    throughputRps: 0,
    errorRate: 0,
    p95ResponseTimeMs: 0,
    p99ResponseTimeMs: 0,
    parsedAt: new Date().toISOString(),
    note: "JTL parsing placeholder — implement actual CSV/XML parsing",
  };

  // Update execution status
  await db
    .update(executions)
    .set({ status: "PASSED" })
    .where(eq(executions.id, runId));

  return { artifactId, kpis };
});

/**
 * AI analysis of a run: generate summary and recommendations.
 */
registerHandler("aiAnalyzeRun", async (payload) => {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const { runId } = payload;

  // Create pending analysis record
  const [insertResult] = await db.insert(aiAnalyses).values({
    executionId: runId,
    status: "PENDING",
  });

  const analysisId = insertResult.insertId;

  try {
    // In a real implementation, this would:
    // 1. Gather execution data + artifacts
    // 2. Call LLM via invokeLLM()
    // 3. Parse structured response

    const summary = "AI analysis placeholder — integrate with LLM for actual analysis";
    const recommendations = [
      "Implement actual JTL parsing to extract real KPIs",
      "Configure LLM integration for intelligent analysis",
    ];

    await db
      .update(aiAnalyses)
      .set({
        summary,
        recommendations: JSON.stringify(recommendations),
        status: "DONE",
      })
      .where(eq(aiAnalyses.id, analysisId));

    return { analysisId, summary };
  } catch (err: any) {
    await db
      .update(aiAnalyses)
      .set({ status: "FAILED" })
      .where(eq(aiAnalyses.id, analysisId));
    throw err;
  }
});

/**
 * Retention purge: delete expired runs, artifacts, and sessions.
 */
registerHandler("retentionPurge", async (payload) => {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const dryRun = payload.dryRun ?? false;

  const now = new Date();
  const artifactCutoff = new Date(
    now.getTime() - ENV.retentionDaysArtifacts * 24 * 60 * 60 * 1000
  );
  const runCutoff = new Date(
    now.getTime() - ENV.retentionDaysRuns * 24 * 60 * 60 * 1000
  );

  // Count expired artifacts
  const expiredArtifacts = await db
    .select()
    .from(artifacts)
    .where(lte(artifacts.createdAt, artifactCutoff));

  // Count expired runs (completed only)
  const expiredRuns = await db
    .select({ id: executions.id })
    .from(executions)
    .where(
      and(
        lte(executions.createdAt, runCutoff),
        inArray(executions.status, ["PASSED", "FAILED", "ERROR", "CANCELLED"])
      )
    );

  const stats = {
    dryRun,
    artifactCutoffDate: artifactCutoff.toISOString(),
    runCutoffDate: runCutoff.toISOString(),
    expiredArtifactsCount: expiredArtifacts.length,
    expiredRunsCount: expiredRuns.length,
    deletedArtifacts: 0,
    deletedRuns: 0,
  };

  if (!dryRun) {
    // Delete artifacts from S3 + DB
    for (const artifact of expiredArtifacts) {
      try {
        if (artifact.storagePath) {
          await deleteArtifact(artifact.storagePath);
        }
        await db.delete(artifacts).where(eq(artifacts.id, artifact.id));
        stats.deletedArtifacts++;
      } catch (err) {
        console.error(`[RetentionPurge] Failed to delete artifact ${artifact.id}:`, err);
      }
    }

    // Delete expired runs
    if (expiredRuns.length > 0) {
      const runIds = expiredRuns.map((r) => r.id);
      await db.delete(executions).where(inArray(executions.id, runIds));
      stats.deletedRuns = runIds.length;
    }
  }

  return stats;
});

// ── Job status query ───────────────────────────────────────────────────────

export async function getJobStatus(jobId: number) {
  const db = await getDb();
  if (!db) return null;

  const [job] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  return job ?? null;
}

export async function getJobsByRun(runId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(jobs)
    .where(
      sql`JSON_EXTRACT(${jobs.payload}, '$.runId') = ${runId}`
    )
    .orderBy(jobs.createdAt);
}
