/**
 * Success Rate Alert Service
 * Evaluates global execution success rate over a configurable window.
 * Triggers alert when rate drops below threshold for 2+ consecutive checks (hysteresis).
 * Anti-spam: cooldown of 60 minutes between notifications.
 * Resets when success rate recovers above threshold + margin.
 * Called periodically (every 5 min) from the job poller.
 */

import { getDb } from "./db";
import { alertsState } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { dispatchWebhookEvent } from "./routers/webhooks";
import crypto from "crypto";

// ── Config (overridable via env) ──────────────────────────────────────────
const SUCCESS_RATE_THRESHOLD = Number(process.env.ANALYTICS_SUCCESS_RATE_THRESHOLD ?? 0.90);
const WINDOW_DAYS = Number(process.env.ANALYTICS_WINDOW_DAYS ?? 7);
const CONSECUTIVE_BREACHES_REQUIRED = 2;
const COOLDOWN_MS = Number(process.env.ANALYTICS_ALERT_COOLDOWN_MS ?? 60 * 60 * 1000); // 60 min
const RECOVERY_MARGIN = Number(process.env.ANALYTICS_RECOVERY_MARGIN ?? 0.02); // +2%

export interface SuccessRateAlertResult {
  checked: boolean;
  successRate: number | null;
  alertSent: boolean;
  resolved: boolean;
  error?: string;
}

/** Main evaluation — call periodically (every 5 min) */
export async function evaluateSuccessRateAlert(): Promise<SuccessRateAlertResult> {
  const db = await getDb();
  if (!db) return { checked: false, successRate: null, alertSent: false, resolved: false, error: "DB unavailable" };

  const now = Date.now();
  const orgId = "GLOBAL"; // Cross-org for now; extend to per-org if needed
  const alertKey = "GLOBAL";

  // ── Compute success rate over window ──────────────────────────────────
  const windowStart = new Date(now - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);

  const [rateRows] = (await db.execute(
    sql.raw(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed
      FROM executions
      WHERE created_at >= '${windowStart}'
    `)
  )) as any;

  const row = (rateRows as any[])[0];
  const total = Number(row?.total ?? 0);
  const passed = Number(row?.passed ?? 0);

  if (total === 0) {
    return { checked: true, successRate: null, alertSent: false, resolved: false };
  }

  const successRate = passed / total;

  // ── Get or create alert state ──────────────────────────────────────────
  let [existing] = await db
    .select()
    .from(alertsState)
    .where(
      and(
        eq(alertsState.alertType, "SUCCESS_RATE_LOW"),
        eq(alertsState.key, alertKey)
      )
    )
    .limit(1);

  if (!existing) {
    const uid = crypto.randomUUID();
    await db.insert(alertsState).values({
      uid,
      orgId,
      alertType: "SUCCESS_RATE_LOW",
      key: alertKey,
      stateJson: JSON.stringify({
        consecutiveBreaches: 0,
        lastSuccessRate: successRate,
        threshold: SUCCESS_RATE_THRESHOLD,
        windowDays: WINDOW_DAYS,
      }),
      alertCount: 0,
    });
    [existing] = await db
      .select()
      .from(alertsState)
      .where(eq(alertsState.uid, uid))
      .limit(1);
  }

  const state: any = typeof existing.stateJson === "string"
    ? JSON.parse(existing.stateJson)
    : existing.stateJson ?? {};
  const consecutiveBreaches = state.consecutiveBreaches ?? 0;

  // ── Check threshold ────────────────────────────────────────────────────
  if (successRate >= SUCCESS_RATE_THRESHOLD + RECOVERY_MARGIN) {
    // Recovered: reset state
    if (consecutiveBreaches > 0 || existing.resolvedAt === null) {
      await db
        .update(alertsState)
        .set({
          stateJson: JSON.stringify({
            ...state,
            consecutiveBreaches: 0,
            lastSuccessRate: successRate,
            recoveredAt: new Date(now).toISOString(),
          }),
          resolvedAt: new Date(now),
        })
        .where(eq(alertsState.id, existing.id));
    }
    return { checked: true, successRate, alertSent: false, resolved: consecutiveBreaches > 0 };
  }

  if (successRate < SUCCESS_RATE_THRESHOLD) {
    const newBreaches = consecutiveBreaches + 1;

    await db
      .update(alertsState)
      .set({
        stateJson: JSON.stringify({
          ...state,
          consecutiveBreaches: newBreaches,
          lastSuccessRate: successRate,
          threshold: SUCCESS_RATE_THRESHOLD,
          windowDays: WINDOW_DAYS,
        }),
        resolvedAt: null,
      })
      .where(eq(alertsState.id, existing.id));

    // Need 2+ consecutive breaches to trigger alert
    if (newBreaches < CONSECUTIVE_BREACHES_REQUIRED) {
      return { checked: true, successRate, alertSent: false, resolved: false };
    }

    // Check cooldown
    if (existing.lastNotifiedAt) {
      const lastNotifMs = new Date(existing.lastNotifiedAt).getTime();
      if (now - lastNotifMs < COOLDOWN_MS) {
        return { checked: true, successRate, alertSent: false, resolved: false };
      }
    }

    // ── Send alert ─────────────────────────────────────────────────────
    const pct = (successRate * 100).toFixed(1);
    const thresholdPct = (SUCCESS_RATE_THRESHOLD * 100).toFixed(0);

    try {
      await notifyOwner({
        title: `⚠️ Taux de succès critique : ${pct}% (seuil : ${thresholdPct}%)`,
        content: [
          `Le taux de succès global des exécutions est tombé à **${pct}%** (seuil : ${thresholdPct}%).`,
          ``,
          `- **Fenêtre d'analyse** : ${WINDOW_DAYS} derniers jours`,
          `- **Exécutions** : ${total} total, ${passed} réussies`,
          `- **Détections consécutives** : ${newBreaches}`,
          ``,
          `Vérifiez les scénarios en échec depuis le Dashboard Analytique.`,
        ].join("\n"),
      });
    } catch (err: any) {
      return { checked: true, successRate, alertSent: false, resolved: false, error: err.message };
    }

    // Dispatch webhook
    try {
      await dispatchWebhookEvent("", "analytics.success_rate.low", {
        successRate,
        threshold: SUCCESS_RATE_THRESHOLD,
        windowDays: WINDOW_DAYS,
        total,
        passed,
        consecutiveBreaches: newBreaches,
        timestamp: new Date(now).toISOString(),
      });
    } catch (_) { /* best-effort */ }

    // Update alert state
    await db
      .update(alertsState)
      .set({
        lastNotifiedAt: new Date(now),
        alertCount: (existing.alertCount ?? 0) + 1,
      })
      .where(eq(alertsState.id, existing.id));

    return { checked: true, successRate, alertSent: true, resolved: false };
  }

  // Between threshold and threshold+margin: no action (hysteresis zone)
  await db
    .update(alertsState)
    .set({
      stateJson: JSON.stringify({
        ...state,
        lastSuccessRate: successRate,
      }),
    })
    .where(eq(alertsState.id, existing.id));

  return { checked: true, successRate, alertSent: false, resolved: false };
}
