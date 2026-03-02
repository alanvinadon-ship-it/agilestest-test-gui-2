// ============================================================================
// AgilesTest — Observability Middleware
// x-request-id, /healthz, /readyz, Prometheus metrics
// ============================================================================

import { Request, Response, NextFunction, Express } from "express";
import { randomUUID } from "crypto";
import logger from "./logger";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

// ── Request ID Middleware ──────────────────────────────────────────────────

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId =
    (req.headers["x-request-id"] as string) || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

// ── Request Logging Middleware ─────────────────────────────────────────────

export function requestLoggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();
  const requestId = (req as any).requestId || "unknown";

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, "request completed with error");
    } else if (res.statusCode >= 400) {
      logger.warn(logData, "request completed with client error");
    } else {
      logger.info(logData, "request completed");
    }
  });

  next();
}

// ── Prometheus Metrics ─────────────────────────────────────────────────────

interface MetricCounter {
  total: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
}

const metrics = {
  http: {
    total: 0,
    byStatus: {} as Record<string, number>,
    byMethod: {} as Record<string, number>,
  } as MetricCounter,
  trpc: {
    total: 0,
    success: 0,
    error: 0,
    byProcedure: {} as Record<string, number>,
  },
  jobs: {
    enqueued: 0,
    completed: 0,
    failed: 0,
    byName: {} as Record<string, number>,
  },
  uptime: Date.now(),
};

export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  metrics.http.total++;
  metrics.http.byMethod[req.method] =
    (metrics.http.byMethod[req.method] || 0) + 1;

  res.on("finish", () => {
    const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;
    metrics.http.byStatus[statusGroup] =
      (metrics.http.byStatus[statusGroup] || 0) + 1;

    // Track tRPC calls
    if (req.originalUrl.startsWith("/api/trpc")) {
      metrics.trpc.total++;
      if (res.statusCode < 400) {
        metrics.trpc.success++;
      } else {
        metrics.trpc.error++;
      }
      const procedure = req.originalUrl
        .replace("/api/trpc/", "")
        .split("?")[0];
      if (procedure) {
        metrics.trpc.byProcedure[procedure] =
          (metrics.trpc.byProcedure[procedure] || 0) + 1;
      }
    }
  });

  next();
}

export function incrementJobMetric(
  event: "enqueued" | "completed" | "failed",
  jobName?: string
) {
  metrics.jobs[event]++;
  if (jobName) {
    metrics.jobs.byName[jobName] =
      (metrics.jobs.byName[jobName] || 0) + 1;
  }
}

/**
 * Format metrics in Prometheus text exposition format.
 */
function formatPrometheusMetrics(): string {
  const lines: string[] = [];
  const uptimeSeconds = Math.floor((Date.now() - metrics.uptime) / 1000);

  // Uptime
  lines.push("# HELP agilestest_uptime_seconds Server uptime in seconds");
  lines.push("# TYPE agilestest_uptime_seconds gauge");
  lines.push(`agilestest_uptime_seconds ${uptimeSeconds}`);

  // HTTP
  lines.push("# HELP agilestest_http_requests_total Total HTTP requests");
  lines.push("# TYPE agilestest_http_requests_total counter");
  lines.push(`agilestest_http_requests_total ${metrics.http.total}`);

  for (const [status, count] of Object.entries(metrics.http.byStatus)) {
    lines.push(`agilestest_http_requests_by_status{status="${status}"} ${count}`);
  }

  for (const [method, count] of Object.entries(metrics.http.byMethod)) {
    lines.push(`agilestest_http_requests_by_method{method="${method}"} ${count}`);
  }

  // tRPC
  lines.push("# HELP agilestest_trpc_calls_total Total tRPC calls");
  lines.push("# TYPE agilestest_trpc_calls_total counter");
  lines.push(`agilestest_trpc_calls_total ${metrics.trpc.total}`);
  lines.push(`agilestest_trpc_calls_success ${metrics.trpc.success}`);
  lines.push(`agilestest_trpc_calls_error ${metrics.trpc.error}`);

  // Jobs
  lines.push("# HELP agilestest_jobs_total Total jobs by event");
  lines.push("# TYPE agilestest_jobs_total counter");
  lines.push(`agilestest_jobs_enqueued_total ${metrics.jobs.enqueued}`);
  lines.push(`agilestest_jobs_completed_total ${metrics.jobs.completed}`);
  lines.push(`agilestest_jobs_failed_total ${metrics.jobs.failed}`);

  return lines.join("\n") + "\n";
}

// ── Health Endpoints ───────────────────────────────────────────────────────

export function registerHealthEndpoints(app: Express) {
  /**
   * /healthz — Liveness probe.
   * Returns 200 if the process is alive.
   */
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * /readyz — Readiness probe.
   * Returns 200 if the app can serve traffic (DB connected).
   */
  app.get("/readyz", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({
          status: "not_ready",
          reason: "database_unavailable",
        });
        return;
      }

      // Quick DB ping
      await db.execute(sql`SELECT 1`);

      res.status(200).json({
        status: "ready",
        timestamp: new Date().toISOString(),
        checks: {
          database: "ok",
        },
      });
    } catch (err: any) {
      res.status(503).json({
        status: "not_ready",
        reason: "database_check_failed",
        error: err?.message,
      });
    }
  });

  /**
   * /metrics — Prometheus metrics endpoint.
   * Protected by basic auth in production.
   */
  app.get("/metrics", (req: Request, res: Response) => {
    // Basic auth check in production
    if (
      process.env.METRICS_BASIC_AUTH_USER &&
      process.env.METRICS_BASIC_AUTH_PASSWORD
    ) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Basic ")) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Metrics"');
        res.status(401).send("Unauthorized");
        return;
      }

      const base64 = authHeader.slice(6);
      const [user, pass] = Buffer.from(base64, "base64")
        .toString()
        .split(":");

      if (
        user !== process.env.METRICS_BASIC_AUTH_USER ||
        pass !== process.env.METRICS_BASIC_AUTH_PASSWORD
      ) {
        res.status(403).send("Forbidden");
        return;
      }
    }

    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(formatPrometheusMetrics());
  });
}

// ── Export metrics for testing ──────────────────────────────────────────────

export { metrics };
