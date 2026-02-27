/**
 * Collector Router — Manages active capture sessions (agent-based collection).
 *
 * Procedures:
 *   - start: Start a capture session (idempotent: returns existing RUNNING session)
 *   - stop: Stop a running session
 *   - status: Get session status + last events
 *   - heartbeat: Agent heartbeat (updates last_heartbeat_at)
 *   - appendEvent: Append an event to a session
 *   - listSessions: List sessions with cursor pagination + filters
 *   - listEvents: List events for a session with cursor pagination
 */
import { z } from "zod";
import { eq, desc, and, sql, SQL, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { collectorSessions, collectorEvents, captures, probes } from "../../drizzle/schema";
import { writeAuditLog } from "../lib/auditLog";
import { randomUUID } from "crypto";
import { notifyOwner } from "../_core/notification";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  return db;
}

// ─── Metrics counters (simple in-memory, exposed via /metrics if needed) ────
export const collectorMetrics = {
  sessionsStarted: 0,
  heartbeats: 0,
  events: 0,
};

// ─── Router ──────────────────────────────────────────────────────────────────

export const collectorRouter = router({
  /**
   * Start a capture session.
   * Idempotent: if a RUNNING/QUEUED session already exists for capture+probe, return it.
   */
  start: protectedProcedure
    .input(z.object({
      captureId: z.number(),
      probeId: z.number(),
      meta: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      // Validate capture exists
      const [capture] = await db.select().from(captures).where(eq(captures.id, input.captureId)).limit(1);
      if (!capture) throw new TRPCError({ code: "NOT_FOUND", message: "Capture introuvable" });

      // Validate probe exists and is ONLINE
      const [probe] = await db.select().from(probes).where(eq(probes.id, input.probeId)).limit(1);
      if (!probe) throw new TRPCError({ code: "NOT_FOUND", message: "Sonde introuvable" });

      // Idempotent: check for existing active session
      const [existing] = await db.select()
        .from(collectorSessions)
        .where(and(
          eq(collectorSessions.captureId, input.captureId),
          eq(collectorSessions.probeId, input.probeId),
          sql`${collectorSessions.status} IN ('QUEUED', 'RUNNING')`,
        ))
        .limit(1);

      if (existing) {
        return { sessionUid: existing.uid, session: existing, created: false };
      }

      // Create new session
      const uid = randomUUID();
      const now = new Date();
      await db.insert(collectorSessions).values({
        uid,
        captureId: input.captureId,
        probeId: input.probeId,
        status: "RUNNING",
        startedAt: now,
        lastHeartbeatAt: now,
        metaJson: input.meta ?? null,
        createdBy: ctx.user?.openId ?? null,
      });

      // Insert STARTED event
      await db.insert(collectorEvents).values({
        uid: randomUUID(),
        sessionId: (await db.select({ id: collectorSessions.id }).from(collectorSessions).where(eq(collectorSessions.uid, uid)).limit(1))[0].id,
        level: "INFO",
        eventType: "STARTED",
        message: `Session démarrée par ${ctx.user?.name ?? 'unknown'}`,
      });

      // Update capture status to RUNNING
      await db.update(captures).set({ status: "RUNNING" }).where(eq(captures.id, input.captureId));

      collectorMetrics.sessionsStarted++;

      writeAuditLog({
        userId: ctx.user?.id ?? null,
        action: "collector.start",
        entity: "collector_session",
        entityId: uid,
        details: { captureId: input.captureId, probeId: input.probeId },
      });

      const [created] = await db.select().from(collectorSessions).where(eq(collectorSessions.uid, uid)).limit(1);
      return { sessionUid: uid, session: created, created: true };
    }),

  /**
   * Stop a running session.
   */
  stop: protectedProcedure
    .input(z.object({ sessionUid: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();

      const [session] = await db.select().from(collectorSessions).where(eq(collectorSessions.uid, input.sessionUid)).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session introuvable" });

      if (session.status === "STOPPED") {
        return { ok: true, alreadyStopped: true };
      }

      const now = new Date();
      await db.update(collectorSessions)
        .set({ status: "STOPPED", stoppedAt: now })
        .where(eq(collectorSessions.uid, input.sessionUid));

      // Insert STOPPED event
      await db.insert(collectorEvents).values({
        uid: randomUUID(),
        sessionId: session.id,
        level: "INFO",
        eventType: "STOPPED",
        message: `Session arrêtée par ${ctx.user?.name ?? 'unknown'}`,
      });

      // Update capture status to COMPLETED if no other active sessions
      const [otherActive] = await db.select({ cnt: sql<number>`count(*)` })
        .from(collectorSessions)
        .where(and(
          eq(collectorSessions.captureId, session.captureId),
          sql`${collectorSessions.status} IN ('QUEUED', 'RUNNING')`,
          sql`${collectorSessions.uid} != ${input.sessionUid}`,
        ));

      if ((otherActive?.cnt ?? 0) === 0) {
        await db.update(captures).set({ status: "COMPLETED" }).where(eq(captures.id, session.captureId));
      }

      writeAuditLog({
        userId: ctx.user?.id ?? null,
        action: "collector.stop",
        entity: "collector_session",
        entityId: input.sessionUid,
      });

      return { ok: true, alreadyStopped: false };
    }),

  /**
   * Get session status + last events.
   */
  status: protectedProcedure
    .input(z.object({
      sessionUid: z.string().optional(),
      captureId: z.number().optional(),
      probeId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const conditions: SQL[] = [];
      if (input.sessionUid) conditions.push(eq(collectorSessions.uid, input.sessionUid));
      if (input.captureId) conditions.push(eq(collectorSessions.captureId, input.captureId));
      if (input.probeId) conditions.push(eq(collectorSessions.probeId, input.probeId));

      if (conditions.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Au moins un filtre requis (sessionUid, captureId, probeId)" });
      }

      const sessions = await db.select()
        .from(collectorSessions)
        .where(and(...conditions))
        .orderBy(desc(collectorSessions.createdAt))
        .limit(10);

      if (sessions.length === 0) {
        return { sessions: [], lastEvents: [] };
      }

      // Get last 20 events for the most recent session
      const primarySession = sessions[0];
      const lastEvents = await db.select()
        .from(collectorEvents)
        .where(eq(collectorEvents.sessionId, primarySession.id))
        .orderBy(desc(collectorEvents.createdAt))
        .limit(20);

      return {
        sessions,
        lastEvents,
        activeSession: sessions.find(s => s.status === "RUNNING" || s.status === "QUEUED") ?? null,
      };
    }),

  /**
   * Agent heartbeat — updates last_heartbeat_at.
   */
  heartbeat: protectedProcedure
    .input(z.object({
      sessionUid: z.string(),
      meta: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [session] = await db.select().from(collectorSessions).where(eq(collectorSessions.uid, input.sessionUid)).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session introuvable" });

      if (session.status !== "RUNNING" && session.status !== "QUEUED") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Session non active (status: ${session.status})` });
      }

      const now = new Date();
      const updates: Record<string, unknown> = { lastHeartbeatAt: now };
      if (input.meta) {
        updates.metaJson = { ...(session.metaJson as Record<string, unknown> ?? {}), ...input.meta };
      }

      await db.update(collectorSessions)
        .set(updates)
        .where(eq(collectorSessions.uid, input.sessionUid));

      // Insert HEARTBEAT event (lightweight)
      await db.insert(collectorEvents).values({
        uid: randomUUID(),
        sessionId: session.id,
        level: "INFO",
        eventType: "HEARTBEAT",
        message: "Heartbeat reçu",
        dataJson: input.meta ?? null,
      });

      collectorMetrics.heartbeats++;

      return { ok: true, lastHeartbeatAt: now };
    }),

  /**
   * Append an event to a session.
   */
  appendEvent: protectedProcedure
    .input(z.object({
      sessionUid: z.string(),
      level: z.enum(["INFO", "WARN", "ERROR"]),
      eventType: z.enum(["STARTED", "STOPPED", "HEARTBEAT", "UPLOAD", "ERROR", "CUSTOM"]),
      message: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();

      const [session] = await db.select().from(collectorSessions).where(eq(collectorSessions.uid, input.sessionUid)).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session introuvable" });

      const uid = randomUUID();
      await db.insert(collectorEvents).values({
        uid,
        sessionId: session.id,
        level: input.level,
        eventType: input.eventType,
        message: input.message ?? null,
        dataJson: input.data ?? null,
      });

      collectorMetrics.events++;

      return { ok: true, eventUid: uid };
    }),

  /**
   * List sessions with cursor pagination + filters.
   */
  listSessions: protectedProcedure
    .input(z.object({
      captureId: z.number().optional(),
      probeId: z.number().optional(),
      status: z.enum(["QUEUED", "RUNNING", "STOPPED", "FAILED"]).optional(),
      cursor: z.number().optional(),
      pageSize: z.number().min(1).max(100).default(30),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const conditions: SQL[] = [];
      if (input.captureId) conditions.push(eq(collectorSessions.captureId, input.captureId));
      if (input.probeId) conditions.push(eq(collectorSessions.probeId, input.probeId));
      if (input.status) conditions.push(eq(collectorSessions.status, input.status));
      if (input.cursor) conditions.push(lt(collectorSessions.id, input.cursor));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const fetchSize = input.pageSize + 1;

      const rows = await db.select()
        .from(collectorSessions)
        .where(where)
        .orderBy(desc(collectorSessions.id))
        .limit(fetchSize);

      const hasMore = rows.length > input.pageSize;
      const data = hasMore ? rows.slice(0, input.pageSize) : rows;
      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

      return { data, nextCursor, hasMore };
    }),

  /**
   * List events for a session with cursor pagination.
   */
  listEvents: protectedProcedure
    .input(z.object({
      sessionUid: z.string(),
      cursor: z.number().optional(),
      pageSize: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const [session] = await db.select().from(collectorSessions).where(eq(collectorSessions.uid, input.sessionUid)).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session introuvable" });

      const conditions: SQL[] = [eq(collectorEvents.sessionId, session.id)];
      if (input.cursor) conditions.push(lt(collectorEvents.id, input.cursor));

      const fetchSize = input.pageSize + 1;
      const rows = await db.select()
        .from(collectorEvents)
        .where(and(...conditions))
        .orderBy(desc(collectorEvents.id))
        .limit(fetchSize);

      const hasMore = rows.length > input.pageSize;
      const data = hasMore ? rows.slice(0, input.pageSize) : rows;
      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

      return { data, nextCursor, hasMore };
    }),

  /**
   * Get active sessions count (for monitoring).
   */
  activeSessions: protectedProcedure
    .query(async () => {
      const db = await requireDb();
      const [result] = await db.select({ count: sql<number>`count(*)` })
        .from(collectorSessions)
        .where(sql`${collectorSessions.status} IN ('QUEUED', 'RUNNING')`);
      return { count: result?.count ?? 0 };
    }),

  /**
   * Dashboard — aggregated view for collector monitoring.
   * Returns: active sessions with probe info, status breakdown, recent events, stale sessions.
   */
  dashboard: protectedProcedure
    .input(z.object({
      projectId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();

      // 1. Status breakdown (count by status)
      const statusBreakdown = await db.select({
        status: collectorSessions.status,
        count: sql<number>`count(*)`,
      })
        .from(collectorSessions)
        .groupBy(collectorSessions.status);

      // 2. Active sessions with probe + capture info
      const activeSessions = await db.select({
        sessionId: collectorSessions.id,
        sessionUid: collectorSessions.uid,
        status: collectorSessions.status,
        startedAt: collectorSessions.startedAt,
        lastHeartbeatAt: collectorSessions.lastHeartbeatAt,
        metaJson: collectorSessions.metaJson,
        captureId: collectorSessions.captureId,
        probeId: collectorSessions.probeId,
        probeName: probes.site,
        probeZone: probes.zone,
        probeStatus: probes.status,
        captureName: captures.name,
      })
        .from(collectorSessions)
        .leftJoin(probes, eq(collectorSessions.probeId, probes.id))
        .leftJoin(captures, eq(collectorSessions.captureId, captures.id))
        .where(sql`${collectorSessions.status} IN ('QUEUED', 'RUNNING')`)
        .orderBy(desc(collectorSessions.startedAt))
        .limit(50);

      // 3. Stale sessions (RUNNING but no heartbeat in last 5 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const staleSessions = activeSessions.filter(
        s => s.status === 'RUNNING' && s.lastHeartbeatAt && new Date(s.lastHeartbeatAt) < fiveMinAgo
      );

      // Notify owner if stale sessions detected (fire-and-forget)
      if (staleSessions.length > 0) {
        const probeNames = staleSessions.map(s => s.probeName ?? `Probe #${s.probeId}`).join(', ');
        notifyOwner({
          title: `\u23f0 ${staleSessions.length} session(s) collector sans heartbeat`,
          content: `Les sessions suivantes n'ont pas envoy\u00e9 de heartbeat depuis plus de 5 minutes : ${probeNames}. V\u00e9rifiez l'\u00e9tat des sondes.`,
        }).catch((err) => console.warn("[Notification] Stale heartbeat notify failed:", err));
      }

      // 4. Recent events (last 50 across all sessions)
      const recentEvents = await db.select({
        eventId: collectorEvents.id,
        eventUid: collectorEvents.uid,
        sessionId: collectorEvents.sessionId,
        level: collectorEvents.level,
        eventType: collectorEvents.eventType,
        message: collectorEvents.message,
        createdAt: collectorEvents.createdAt,
      })
        .from(collectorEvents)
        .orderBy(desc(collectorEvents.id))
        .limit(50);

      // 5. Events per probe (top 10 probes by event count in last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const eventsPerProbe = await db.select({
        probeId: collectorSessions.probeId,
        probeName: probes.site,
        eventCount: sql<number>`count(${collectorEvents.id})`,
      })
        .from(collectorEvents)
        .innerJoin(collectorSessions, eq(collectorEvents.sessionId, collectorSessions.id))
        .leftJoin(probes, eq(collectorSessions.probeId, probes.id))
        .where(sql`${collectorEvents.createdAt} >= ${oneDayAgo}`)
        .groupBy(collectorSessions.probeId, probes.site)
        .orderBy(sql`count(${collectorEvents.id}) DESC`)
        .limit(10);

      // 6. Totals
      const [totalSessions] = await db.select({ count: sql<number>`count(*)` }).from(collectorSessions);
      const [totalEvents] = await db.select({ count: sql<number>`count(*)` }).from(collectorEvents);

      return {
        statusBreakdown: statusBreakdown.map(r => ({ status: r.status, count: Number(r.count) })),
        activeSessions,
        staleSessions,
        recentEvents,
        eventsPerProbe: eventsPerProbe.map(r => ({ probeId: r.probeId, probeName: r.probeName, eventCount: Number(r.eventCount) })),
        totals: {
          sessions: Number(totalSessions?.count ?? 0),
          events: Number(totalEvents?.count ?? 0),
          active: activeSessions.length,
          stale: staleSessions.length,
        },
        metrics: collectorMetrics,
      };
    }),
});
