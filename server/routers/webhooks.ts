import { z } from "zod";
import { eq, and, sql, lte, isNull, or, asc, desc, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { outboundWebhooks, webhookDeliveries } from "../../drizzle/schema";
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
  const webhooks = await db
    .select({
      id: outboundWebhooks.id,
      url: outboundWebhooks.url,
      secret: outboundWebhooks.secret,
      events: outboundWebhooks.events,
    })
    .from(outboundWebhooks)
    .where(
      and(
        eq(outboundWebhooks.projectId, projectId),
        eq(outboundWebhooks.enabled, true)
      )
    );

  for (const wh of webhooks) {
    const events: string[] =
      typeof wh.events === "string" ? JSON.parse(wh.events) : (wh.events as string[]);
    if (!events.includes(eventType) && !events.includes("*")) continue;

    const uid = crypto.randomUUID();
    await db.insert(webhookDeliveries).values({
      uid,
      webhookId: wh.id,
      eventType,
      payload,
      status: "PENDING",
      attempt: 0,
      maxAttempts: 3,
    });
  }
}

// ─── Delivery processor (called from job poller) ────────────────────────────
export async function processWebhookDeliveries() {
  const db = await getDb();
  if (!db) return;

  // Get pending deliveries that are ready for (re)try
  // NOTE: Kept as raw SQL — JOIN + complex WHERE with OR/IS NULL + LIMIT
  // is more readable and performant as raw SQL for this specific query.
  const [pending] = (await db.execute(
    sql`
      SELECT d.id, d.webhook_id, d.event_type, d.payload, d.attempt, d.max_attempts,
             w.url, w.secret
      FROM webhook_deliveries d
      JOIN outbound_webhooks w ON w.id = d.webhook_id
      WHERE d.status = 'PENDING'
        AND (d.next_retry_at IS NULL OR d.next_retry_at <= NOW())
      ORDER BY d.created_at ASC
      LIMIT 20
    `
  )) as any;

  for (const delivery of pending as any[]) {
    const payloadStr =
      typeof delivery.payload === "string"
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
        await db
          .update(webhookDeliveries)
          .set({
            status: "SUCCESS",
            httpStatus,
            responseBody: responseBody.substring(0, 500),
            attempt,
            deliveredAt: new Date(),
          })
          .where(eq(webhookDeliveries.id, delivery.id));
      } else {
        await handleRetry(db, delivery.id, attempt, delivery.max_attempts, httpStatus, responseBody);
      }
    } catch (err: any) {
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
    await db
      .update(webhookDeliveries)
      .set({
        status: "FAILED" as const,
        httpStatus,
        responseBody: responseBody.substring(0, 500),
        attempt,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
  } else {
    const delaySec = 30 * Math.pow(4, attempt - 1);
    // NOTE: Kept as raw SQL — DATE_ADD with dynamic INTERVAL is not natively
    // supported in Drizzle's set() builder.
    await db.execute(
      sql`UPDATE webhook_deliveries
          SET attempt = ${attempt},
              http_status = ${httpStatus},
              response_body = ${responseBody.substring(0, 500)},
              next_retry_at = DATE_ADD(NOW(), INTERVAL ${sql.raw(String(delaySec))} SECOND)
          WHERE id = ${deliveryId}`
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

      const rows = await db
        .select({
          id: outboundWebhooks.id,
          uid: outboundWebhooks.uid,
          name: outboundWebhooks.name,
          url: outboundWebhooks.url,
          events: outboundWebhooks.events,
          enabled: outboundWebhooks.enabled,
          createdAt: outboundWebhooks.createdAt,
          updatedAt: outboundWebhooks.updatedAt,
        })
        .from(outboundWebhooks)
        .where(eq(outboundWebhooks.projectId, input.projectId))
        .orderBy(desc(outboundWebhooks.createdAt));

      return rows.map((r) => ({
        id: r.id,
        uid: r.uid,
        name: r.name,
        url: r.url,
        events: typeof r.events === "string" ? JSON.parse(r.events) : r.events,
        enabled: Boolean(r.enabled),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(255),
        url: z.string().url().max(1024),
        events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const uid = crypto.randomUUID();
      const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

      await db.insert(outboundWebhooks).values({
        uid,
        projectId: input.projectId,
        name: input.name,
        url: input.url,
        secret,
        events: input.events,
        enabled: true,
        createdBy: ctx.user!.id,
      });

      return { uid, secret };
    }),

  update: protectedProcedure
    .input(
      z.object({
        webhookId: z.number(),
        name: z.string().min(1).max(255).optional(),
        url: z.string().url().max(1024).optional(),
        events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const sets: Record<string, any> = {};
      if (input.name !== undefined) sets.name = input.name;
      if (input.url !== undefined) sets.url = input.url;
      if (input.events !== undefined) sets.events = input.events;
      if (input.enabled !== undefined) sets.enabled = input.enabled;
      if (Object.keys(sets).length === 0) return { success: true };

      await db
        .update(outboundWebhooks)
        .set(sets)
        .where(eq(outboundWebhooks.id, input.webhookId));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ webhookId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId));
      await db
        .delete(outboundWebhooks)
        .where(eq(outboundWebhooks.id, input.webhookId));

      return { success: true };
    }),

  regenerateSecret: protectedProcedure
    .input(z.object({ webhookId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const newSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
      await db
        .update(outboundWebhooks)
        .set({ secret: newSecret })
        .where(eq(outboundWebhooks.id, input.webhookId));

      return { secret: newSecret };
    }),

  deliveries: protectedProcedure
    .input(
      z.object({
        webhookId: z.number(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const offset = (input.page - 1) * input.pageSize;

      const [countResult] = await db
        .select({ total: count() })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId));
      const total = countResult?.total ?? 0;

      const rows = await db
        .select({
          id: webhookDeliveries.id,
          uid: webhookDeliveries.uid,
          eventType: webhookDeliveries.eventType,
          status: webhookDeliveries.status,
          httpStatus: webhookDeliveries.httpStatus,
          attempt: webhookDeliveries.attempt,
          maxAttempts: webhookDeliveries.maxAttempts,
          responseBody: webhookDeliveries.responseBody,
          deliveredAt: webhookDeliveries.deliveredAt,
          createdAt: webhookDeliveries.createdAt,
        })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return {
        items: rows.map((r) => ({
          ...r,
          responseBody: r.responseBody?.substring(0, 200),
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  test: protectedProcedure
    .input(z.object({ webhookId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [wh] = await db
        .select({
          id: outboundWebhooks.id,
          url: outboundWebhooks.url,
          secret: outboundWebhooks.secret,
        })
        .from(outboundWebhooks)
        .where(eq(outboundWebhooks.id, input.webhookId));

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
