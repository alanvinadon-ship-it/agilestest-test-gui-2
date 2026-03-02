/**
 * ui router — lightweight aggregated queries for UI widgets.
 *
 * ui.sidebarCounts: returns badge counts for sidebar sections.
 *   - runningExecutions: COUNT of executions with status IN ('PENDING','RUNNING')
 *   - pendingInvites:    COUNT of invites with status = 'PENDING'
 *   - activeDriveSessions: 0 (placeholder — no drive_sessions table yet)
 *   - redProbes: COUNT of probes in RED health state (OFFLINE or lastSeenAt > 5min)
 */
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { executions, invites, probes } from "../../drizzle/schema";
import { sql, inArray, eq, and } from "drizzle-orm";

const HEALTH_ORANGE_SEC = Number(process.env.PROBE_HEALTH_ORANGE_SEC ?? 300);

export const uiRouter = router({
  sidebarCounts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    if (!db) {
      return {
        runningExecutions: 0,
        pendingInvites: 0,
        activeDriveSessions: 0,
        redProbes: 0,
      };
    }

    // Single aggregated query using sub-selects for performance
    const [result] = await db
      .select({
        runningExecutions: sql<number>`(
          SELECT COUNT(*) FROM executions
          WHERE status IN ('PENDING', 'RUNNING')
        )`.as("runningExecutions"),
        pendingInvites: sql<number>`(
          SELECT COUNT(*) FROM invites
          WHERE invite_status = 'PENDING'
        )`.as("pendingInvites"),
        redProbes: sql<number>`(
          SELECT COUNT(*) FROM probes
          WHERE status = 'OFFLINE'
             OR (status = 'ONLINE' AND (last_seen_at IS NULL OR TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) > 300))
        )`.as("redProbes"),
      })
      .from(sql`(SELECT 1) AS _dummy`);

    return {
      runningExecutions: Number(result?.runningExecutions ?? 0),
      pendingInvites: Number(result?.pendingInvites ?? 0),
      activeDriveSessions: 0, // placeholder until drive_sessions table exists
      redProbes: Number(result?.redProbes ?? 0),
    };
  }),
});
