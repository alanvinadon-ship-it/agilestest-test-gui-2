/**
 * ui router — lightweight aggregated queries for UI widgets.
 *
 * ui.sidebarCounts: returns badge counts for sidebar sections.
 *   - runningExecutions: COUNT of executions with status IN ('PENDING','RUNNING')
 *   - pendingInvites:    COUNT of invites with status = 'PENDING'
 *   - activeDriveSessions: 0 (placeholder — no drive_sessions table yet)
 */
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { executions, invites } from "../../drizzle/schema";
import { sql, inArray, eq, and } from "drizzle-orm";

export const uiRouter = router({
  sidebarCounts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    if (!db) {
      return {
        runningExecutions: 0,
        pendingInvites: 0,
        activeDriveSessions: 0,
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
      })
      .from(sql`(SELECT 1) AS _dummy`);

    return {
      runningExecutions: Number(result?.runningExecutions ?? 0),
      pendingInvites: Number(result?.pendingInvites ?? 0),
      activeDriveSessions: 0, // placeholder until drive_sessions table exists
    };
  }),
});
