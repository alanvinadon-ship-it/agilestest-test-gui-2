import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";

// ─── Cache layer (short-lived, 30s) ────────────────────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 30_000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── SQL helpers ────────────────────────────────────────────────────────────
// Real DB uses snake_case columns: project_id, created_at, status, severity, etc.
// TiDB/MySQL DATE_FORMAT for week/month grouping

function periodFormat(period: "week" | "month"): string {
  if (period === "week") return "%x-W%v"; // ISO year-week: 2026-W08
  return "%Y-%m"; // 2026-02
}

function periodTrunc(period: "week" | "month", col: string): string {
  if (period === "week") return `DATE_FORMAT(${col}, '%x-W%v')`;
  return `DATE_FORMAT(${col}, '%Y-%m')`;
}

// ─── Analytics Router ───────────────────────────────────────────────────────
export const analyticsRouter = router({
  dashboard: protectedProcedure
    .input(z.object({
      period: z.enum(["week", "month"]).default("week"),
      projectId: z.string().optional(), // filter by project (varchar uid)
      from: z.string().optional(), // ISO date string
      to: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const cacheKey = `analytics:${input.period}:${input.projectId ?? "all"}:${input.from ?? ""}:${input.to ?? ""}`;
      const cached = getCached<DashboardResult>(cacheKey);
      if (cached) return cached;

      const periodFmt = periodFormat(input.period);
      const pTrunc = (col: string) => periodTrunc(input.period, col);

      // Build WHERE clauses
      const execWhere: string[] = [];
      const incWhere: string[] = [];
      if (input.projectId) {
        execWhere.push(`e.project_id = '${input.projectId.replace(/'/g, "''")}'`);
        incWhere.push(`i.project_id = '${input.projectId.replace(/'/g, "''")}'`);
      }
      if (input.from) {
        execWhere.push(`e.created_at >= '${input.from.replace(/'/g, "''")}'`);
        incWhere.push(`i.detected_at >= '${input.from.replace(/'/g, "''")}'`);
      }
      if (input.to) {
        execWhere.push(`e.created_at <= '${input.to.replace(/'/g, "''")}'`);
        incWhere.push(`i.detected_at <= '${input.to.replace(/'/g, "''")}'`);
      }
      const execWhereClause = execWhere.length ? `WHERE ${execWhere.join(" AND ")}` : "";
      const incWhereClause = incWhere.length ? `WHERE ${incWhere.join(" AND ")}` : "";

      // 1) Execution series: PASSED/FAILED/ERROR+CANCELLED grouped by period
      const execSeriesQuery = sql.raw(`
        SELECT ${pTrunc("e.created_at")} AS period_label,
          SUM(CASE WHEN e.status = 'PASSED' THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN e.status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN e.status IN ('ERROR','CANCELLED') THEN 1 ELSE 0 END) AS aborted,
          COUNT(*) AS total
        FROM executions e
        ${execWhereClause}
        GROUP BY period_label
        ORDER BY period_label
      `);

      // 2) Incident series: by severity grouped by period
      const incSeriesQuery = sql.raw(`
        SELECT ${pTrunc("i.detected_at")} AS period_label,
          SUM(CASE WHEN i.severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_count,
          SUM(CASE WHEN i.severity = 'MAJOR' THEN 1 ELSE 0 END) AS high_count,
          SUM(CASE WHEN i.severity = 'MINOR' THEN 1 ELSE 0 END) AS med_count,
          SUM(CASE WHEN i.severity = 'INFO' THEN 1 ELSE 0 END) AS low_count
        FROM incidents i
        ${incWhereClause}
        GROUP BY period_label
        ORDER BY period_label
      `);

      // 3) Probes snapshot (current state, not time-series since probes don't have historical data)
      const probesSnapshotQuery = sql.raw(`
        SELECT
          SUM(CASE WHEN p.status = 'ONLINE' AND p.last_seen_at IS NOT NULL AND TIMESTAMPDIFF(SECOND, p.last_seen_at, NOW()) <= 60 THEN 1 ELSE 0 END) AS green_count,
          SUM(CASE WHEN p.status = 'ONLINE' AND (p.last_seen_at IS NULL OR (TIMESTAMPDIFF(SECOND, p.last_seen_at, NOW()) > 60 AND TIMESTAMPDIFF(SECOND, p.last_seen_at, NOW()) <= 300)) THEN 1 ELSE 0 END) AS orange_count,
          SUM(CASE WHEN p.status = 'OFFLINE' OR p.status = 'DEGRADED' OR (p.status = 'ONLINE' AND (p.last_seen_at IS NULL OR TIMESTAMPDIFF(SECOND, p.last_seen_at, NOW()) > 300)) THEN 1 ELSE 0 END) AS red_count,
          COUNT(*) AS total_probes
        FROM probes p
      `);

      // 4) KPIs
      const kpiQuery = sql.raw(`
        SELECT
          (SELECT COUNT(*) FROM executions ${execWhereClause.replace(/\be\./g, "executions.")}) AS total_runs,
          (SELECT COUNT(*) FROM executions ${execWhereClause.replace(/\be\./g, "executions.")} ${execWhereClause ? "AND" : "WHERE"} status = 'PASSED') AS passed_runs,
          (SELECT COUNT(*) FROM incidents ${incWhereClause.replace(/\bi\./g, "incidents.")}) AS total_incidents
      `);

      // Execute all queries
      const [execRows] = await db.execute(execSeriesQuery) as any;
      const [incRows] = await db.execute(incSeriesQuery) as any;
      const [probeRows] = await db.execute(probesSnapshotQuery) as any;
      const [kpiRows] = await db.execute(kpiQuery) as any;

      // Format execution series
      const execSeries = {
        labels: (execRows as any[]).map((r: any) => r.period_label),
        passed: (execRows as any[]).map((r: any) => Number(r.passed)),
        failed: (execRows as any[]).map((r: any) => Number(r.failed)),
        aborted: (execRows as any[]).map((r: any) => Number(r.aborted)),
        successRate: (execRows as any[]).map((r: any) => {
          const total = Number(r.total);
          return total > 0 ? Math.round((Number(r.passed) / total) * 100) : 0;
        }),
      };

      // Format incident series
      const incidentSeries = {
        labels: (incRows as any[]).map((r: any) => r.period_label),
        critical: (incRows as any[]).map((r: any) => Number(r.critical_count)),
        high: (incRows as any[]).map((r: any) => Number(r.high_count)),
        med: (incRows as any[]).map((r: any) => Number(r.med_count)),
        low: (incRows as any[]).map((r: any) => Number(r.low_count)),
      };

      // Format probes snapshot
      const probeSnapshot = probeRows[0] ?? { green_count: 0, orange_count: 0, red_count: 0, total_probes: 0 };
      const probesSeries = {
        labels: ["Actuel"],
        green: [Number(probeSnapshot.green_count)],
        orange: [Number(probeSnapshot.orange_count)],
        red: [Number(probeSnapshot.red_count)],
      };

      // Format KPIs
      const kpi = kpiRows[0] ?? { total_runs: 0, passed_runs: 0, total_incidents: 0 };
      const totalRuns = Number(kpi.total_runs);
      const passedRuns = Number(kpi.passed_runs);
      const kpis = {
        totalRuns,
        successRate: totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0,
        openIncidents: Number(kpi.total_incidents),
        redProbes: Number(probeSnapshot.red_count),
      };

      const result: DashboardResult = { execSeries, incidentSeries, probesSeries, kpis };
      setCache(cacheKey, result);
      return result;
    }),

  /**
   * Global dashboard:: cross-project analytics with top failed scenarios,
   * avg execution time, and per-project breakdown.
   */
  globalDashboard: protectedProcedure
    .input(z.object({
      period: z.enum(["week", "month"]).default("week"),
      from: z.string().optional(),
      to: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const cacheKey = `global-analytics:${input.period}:${input.from ?? ""}:${input.to ?? ""}`;
      const cached = getCached<GlobalDashboardResult>(cacheKey);
      if (cached) return cached;

      const pTrunc = (col: string) => periodTrunc(input.period, col);

      // Build WHERE clauses
      const dateWhere: string[] = [];
      if (input.from) dateWhere.push(`e.created_at >= '${input.from.replace(/'/g, "''")}'`);
      if (input.to) dateWhere.push(`e.created_at <= '${input.to.replace(/'/g, "''")}'`);
      const dateClause = dateWhere.length ? `WHERE ${dateWhere.join(" AND ")}` : "";

      // 1) Global KPIs
      const globalKpiQuery = sql.raw(`
        SELECT
          COUNT(*) AS total_runs,
          SUM(CASE WHEN e.status = 'PASSED' THEN 1 ELSE 0 END) AS passed_runs,
          SUM(CASE WHEN e.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_runs,
          AVG(CASE WHEN e.duration_ms IS NOT NULL AND e.duration_ms > 0 THEN e.duration_ms ELSE NULL END) AS avg_duration_ms,
          COUNT(DISTINCT e.project_id) AS project_count
        FROM executions e
        ${dateClause}
      `);

      // 2) Success rate trend by period
      const trendQuery = sql.raw(`
        SELECT ${pTrunc("e.created_at")} AS period_label,
          COUNT(*) AS total,
          SUM(CASE WHEN e.status = 'PASSED' THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN e.status = 'FAILED' THEN 1 ELSE 0 END) AS failed
        FROM executions e
        ${dateClause}
        GROUP BY period_label
        ORDER BY period_label
      `);

      // 3) Top 10 failed scenarios
      const topFailedQuery = sql.raw(`
        SELECT s.name AS scenario_name, p.name AS project_name,
          COUNT(*) AS fail_count
        FROM executions e
        LEFT JOIN test_scenarios s ON s.uid = e.scenario_id
        LEFT JOIN projects p ON p.id = e.project_id
        ${dateClause ? dateClause + " AND" : "WHERE"} e.status = 'FAILED'
        GROUP BY s.name, p.name
        ORDER BY fail_count DESC
        LIMIT 10
      `);

      // 4) Per-project breakdown
      const perProjectQuery = sql.raw(`
        SELECT p.name AS project_name, e.project_id,
          COUNT(*) AS total_runs,
          SUM(CASE WHEN e.status = 'PASSED' THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN e.status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
          AVG(CASE WHEN e.duration_ms IS NOT NULL AND e.duration_ms > 0 THEN e.duration_ms ELSE NULL END) AS avg_duration_ms
        FROM executions e
        LEFT JOIN projects p ON p.id = e.project_id
        ${dateClause}
        GROUP BY p.name, e.project_id
        ORDER BY total_runs DESC
        LIMIT 20
      `);

      const [globalKpiRows] = await db.execute(globalKpiQuery) as any;
      const [trendRows] = await db.execute(trendQuery) as any;
      const [topFailedRows] = await db.execute(topFailedQuery) as any;
      const [perProjectRows] = await db.execute(perProjectQuery) as any;

      const gk = globalKpiRows[0] ?? { total_runs: 0, passed_runs: 0, failed_runs: 0, avg_duration_ms: null, project_count: 0 };
      const totalRuns = Number(gk.total_runs);
      const passedRuns = Number(gk.passed_runs);

      const result: GlobalDashboardResult = {
        kpis: {
          totalRuns,
          passedRuns,
          failedRuns: Number(gk.failed_runs),
          successRate: totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0,
          avgDurationMs: gk.avg_duration_ms ? Math.round(Number(gk.avg_duration_ms)) : null,
          projectCount: Number(gk.project_count),
        },
        trend: {
          labels: (trendRows as any[]).map((r: any) => r.period_label),
          total: (trendRows as any[]).map((r: any) => Number(r.total)),
          passed: (trendRows as any[]).map((r: any) => Number(r.passed)),
          failed: (trendRows as any[]).map((r: any) => Number(r.failed)),
          successRate: (trendRows as any[]).map((r: any) => {
            const t = Number(r.total);
            return t > 0 ? Math.round((Number(r.passed) / t) * 100) : 0;
          }),
        },
        topFailed: (topFailedRows as any[]).map((r: any) => ({
          scenarioName: r.scenario_name || "(inconnu)",
          projectName: r.project_name || "(inconnu)",
          failCount: Number(r.fail_count),
        })),
        perProject: (perProjectRows as any[]).map((r: any) => ({
          projectName: r.project_name || "(inconnu)",
          projectId: r.project_id,
          totalRuns: Number(r.total_runs),
          passed: Number(r.passed),
          failed: Number(r.failed),
          successRate: Number(r.total_runs) > 0 ? Math.round((Number(r.passed) / Number(r.total_runs)) * 100) : 0,
          avgDurationMs: r.avg_duration_ms ? Math.round(Number(r.avg_duration_ms)) : null,
        })),
      };

      setCache(cacheKey, result);
      return result;
    }),
});

// ─── Types ──────────────────────────────────────────────────────────────────
interface DashboardResult {
  execSeries: { labels: string[]; passed: number[]; failed: number[]; aborted: number[]; successRate: number[] };
  incidentSeries: { labels: string[]; critical: number[]; high: number[]; med: number[]; low: number[] };
  probesSeries: { labels: string[]; green: number[]; orange: number[]; red: number[] };
  kpis: { totalRuns: number; successRate: number; openIncidents: number; redProbes: number };
}

interface GlobalDashboardResult {
  kpis: {
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    successRate: number;
    avgDurationMs: number | null;
    projectCount: number;
  };
  trend: {
    labels: string[];
    total: number[];
    passed: number[];
    failed: number[];
    successRate: number[];
  };
  topFailed: { scenarioName: string; projectName: string; failCount: number }[];
  perProject: {
    projectName: string;
    projectId: string;
    totalRuns: number;
    passed: number;
    failed: number;
    successRate: number;
    avgDurationMs: number | null;
  }[];
}
