import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import crypto from "crypto";

// ─── Supported event types ──────────────────────────────────────────────────
export const WEBHOOK_EVENT_TYPES = [
  "run.completed",
  "run.failed",
  "probe.alert.red",
  "probe.status.changed",
  "incident.created",
  "analytics.success_rate.low",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

// ─── HMAC signature helper ──────────────────────────────────────────────────
export function signPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// ─── Webhook delivery engine ────────────────────────────────────────────────
export async function dispatchWebhookEvent(
  projectId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return;

  // Find all enabled webhooks for this project that subscribe to this event
  const [webhooks] = (await db.execute(
    sql.raw(`
      SELECT id, url, secret, events FROM outbound_webhooks
      WHERE project_id = '${projectId.replace(/'/g, "''")}'
        AND enabled = 1
    `)
  )) as any;

  for (const wh of webhooks as any[]) {
    const events: string[] = typeof wh.events === "string" ? JSON.parse(wh.events) : wh.events;
    if (!events.includes(eventType) && !events.includes("*")) continue;

    const uid = crypto.randomUUID();
    // Create delivery record
    await db.execute(
      sql.raw(`
        INSERT INTO webhook_deliveries (uid, webhook_id, event_type, payload, status, attempt, max_attempts, created_at)
        VALUES ('${uid}', ${wh.id}, '${eventType}', '${JSON.stringify(payload).replace(/'/g, "\\'")}', 'PENDING', 0, 3, NOW())
      `)
    );
  }
}

// ─── Delivery processor (called from job poller) ────────────────────────────
export async function processWebhookDeliveries() {
  const db = await getDb();
  if (!db) return;

  // Get pending deliveries that are ready for (re)try
  const [pending] = (await db.execute(
    sql.raw(`
      SELECT d.id, d.webhook_id, d.event_type, d.payload, d.attempt, d.max_attempts,
             w.url, w.secret
      FROM webhook_deliveries d
      JOIN outbound_webhooks w ON w.id = d.webhook_id
      WHERE d.status = 'PENDING'
        AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
      ORDER BY d.created_at ASC
      LIMIT 20
    `)
  )) as any;

  for (const delivery of pending as any[]) {
    const payloadStr = typeof delivery.payload === "string"
      ? delivery.payload
      : JSON.stringify(delivery.payload);
    const signature = signPayload(delivery.secret, payloadStr);
    const attempt = Number(delivery.attempt) + 1;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(delivery.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": delivery.event_type,
          "X-Webhook-Delivery": String(delivery.id),
        },
        body: payloadStr,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseBody = await response.text().catch(() => "");
      const httpStatus = response.status;

      if (response.ok) {
        // Success
        await db.execute(
          sql.raw(`
            UPDATE webhook_deliveries
            SET status = 'SUCCESS', http_status = ${httpStatus},
                response_body = '${responseBody.substring(0, 500).replace(/'/g, "\\'")}',
                attempt = ${attempt}, delivered_at = NOW()
            WHERE id = ${delivery.id}
          `)
        );
      } else {
        // HTTP error — retry or fail
        await handleRetry(db, delivery.id, attempt, delivery.max_attempts, httpStatus, responseBody);
      }
    } catch (err: any) {
      // Network error — retry or fail
      const errMsg = err?.message?.substring(0, 200) ?? "Unknown error";
      await handleRetry(db, delivery.id, attempt, delivery.max_attempts, null, errMsg);
    }
  }
}

async function handleRetry(
  db: any,
  deliveryId: number,
  attempt: number,
  maxAttempts: number,
  httpStatus: number | null,
  responseBody: string
) {
  if (attempt >= maxAttempts) {
    // Final failure
    await db.execute(
      sql.raw(`
        UPDATE webhook_deliveries
        SET status = 'FAILED', http_status = ${httpStatus ?? "NULL"},
            response_body = '${responseBody.substring(0, 500).replace(/'/g, "\\'")}',
            attempt = ${attempt}
        WHERE id = ${deliveryId}
      `)
    );
  } else {
    // Exponential backoff: 30s, 120s, 480s...
    const delaySec = 30 * Math.pow(4, attempt - 1);
    await db.execute(
      sql.raw(`
        UPDATE webhook_deliveries
        SET attempt = ${attempt}, http_status = ${httpStatus ?? "NULL"},
            response_body = '${responseBody.substring(0, 500).replace(/'/g, "\\'")}',
            next_retry_at = DATE_ADD(NOW(), INTERVAL ${delaySec} SECOND)
        WHERE id = ${deliveryId}
      `)
    );
  }
}

// ─── Webhooks Router (CRUD + deliveries list) ───────────────────────────────
export const webhooksRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [rows] = (await db.execute(
        sql.raw(`
          SELECT id, uid, name, url, events, enabled, created_at, updated_at
          FROM outbound_webhooks
          WHERE project_id = '${input.projectId.replace(/'/g, "''")}'
          ORDER BY created_at DESC
        `)
      )) as any;
      return (rows as any[]).map(r => ({
        id: r.id,
        uid: r.uid,
        name: r.name,
        url: r.url,
        events: typeof r.events === "string" ? JSON.parse(r.events) : r.events,
        enabled: Boolean(r.enabled),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      name: z.string().min(1).max(255),
      url: z.string().url().max(1024),
      events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const uid = crypto.randomUUID();
      const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
      await db.execute(
        sql.raw(`
          INSERT INTO outbound_webhooks (uid, project_id, name, url, secret, events, enabled, created_by)
          VALUES ('${uid}', '${input.projectId.replace(/'/g, "''")}', '${input.name.replace(/'/g, "''")}',
                  '${input.url.replace(/'/g, "''")}', '${secret}',
                  '${JSON.stringify(input.events)}', 1, ${ctx.user!.id})
        `)
      );
      return { uid, secret };
    }),

  update: protectedProcedure
    .input(z.object({
      webhookId: z.number(),
      name: z.string().min(1).max(255).optional(),
      url: z.string().url().max(1024).optional(),
      events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const sets: string[] = [];
      if (input.name !== undefined) sets.push(`name = '${input.name.replace(/'/g, "''")}'`);
      if (input.url !== undefined) sets.push(`url = '${input.url.replace(/'/g, "''")}'`);
      if (input.events !== undefined) sets.push(`events = '${JSON.stringify(input.events)}'`);
      if (input.enabled !== undefined) sets.push(`enabled = ${input.enabled ? 1 : 0}`);
      if (sets.length === 0) return { success: true };
      await db.execute(
        sql.raw(`UPDATE outbound_webhooks SET ${sets.join(", ")} WHERE id = ${input.webhookId}`)
      );
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ webhookId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Delete deliveries first, then webhook
      await db.execute(sql.raw(`DELETE FROM webhook_deliveries WHERE webhook_id = ${input.webhookId}`));
      await db.execute(sql.raw(`DELETE FROM outbound_webhooks WHERE id = ${input.webhookId}`));
      return { success: true };
    }),

  regenerateSecret: protectedProcedure
    .input(z.object({ webhookId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const newSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
      await db.execute(
        sql.raw(`UPDATE outbound_webhooks SET secret = '${newSecret}' WHERE id = ${input.webhookId}`)
      );
      return { secret: newSecret };
    }),

  deliveries: protectedProcedure
    .input(z.object({
      webhookId: z.number(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const offset = (input.page - 1) * input.pageSize;
      const [countRows] = (await db.execute(
        sql.raw(`SELECT COUNT(*) as total FROM webhook_deliveries WHERE webhook_id = ${input.webhookId}`)
      )) as any;
      const total = Number((countRows as any[])[0]?.total ?? 0);
      const [rows] = (await db.execute(
        sql.raw(`
          SELECT id, uid, event_type, status, http_status, attempt, max_attempts,
                 delivered_at, created_at, response_body
          FROM webhook_deliveries
          WHERE webhook_id = ${input.webhookId}
          ORDER BY created_at DESC
          LIMIT ${input.pageSize} OFFSET ${offset}
        `)
      )) as any;
      return {
        items: (rows as any[]).map(r => ({
          id: r.id,
          uid: r.uid,
          eventType: r.event_type,
          status: r.status,
          httpStatus: r.http_status,
          attempt: r.attempt,
          maxAttempts: r.max_attempts,
          responseBody: r.response_body?.substring(0, 200),
          deliveredAt: r.delivered_at,
          createdAt: r.created_at,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // Test endpoint: manually trigger a test delivery
  test: protectedProcedure
    .input(z.object({ webhookId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [rows] = (await db.execute(
        sql.raw(`SELECT id, url, secret FROM outbound_webhooks WHERE id = ${input.webhookId}`)
      )) as any;
      const wh = (rows as any[])[0];
      if (!wh) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });

      const testPayload = JSON.stringify({
        event: "test.ping",
        timestamp: new Date().toISOString(),
        message: "Test webhook delivery from AgilesTest",
      });
      const signature = signPayload(wh.secret, testPayload);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(wh.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": `sha256=${signature}`,
            "X-Webhook-Event": "test.ping",
          },
          body: testPayload,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return { success: response.ok, httpStatus: response.status };
      } catch (err: any) {
        return { success: false, httpStatus: null, error: err?.message };
      }
    }),
});
