/**
 * Probe Alert Service
 * Evaluates probe health and sends notifications when a probe stays RED > 5min.
 * Anti-spam: max 1 notification per probe per 30 minutes.
 * Called periodically (e.g. every 60s) from the job poller or a cron-like loop.
 */

import { getDb } from "./db";
import { probes, probeAlertState } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { dispatchWebhookEvent } from "./routers/webhooks";

// ── Config (overridable via env) ──────────────────────────────────────────
const HEALTH_GREEN_SEC = Number(process.env.PROBE_HEALTH_GREEN_SEC ?? 60);
const HEALTH_ORANGE_SEC = Number(process.env.PROBE_HEALTH_ORANGE_SEC ?? 300);
const RED_THRESHOLD_MS = Number(process.env.PROBE_RED_THRESHOLD_MS ?? 5 * 60 * 1000); // 5 min
const ANTI_SPAM_MS = Number(process.env.PROBE_ANTI_SPAM_MS ?? 30 * 60 * 1000); // 30 min

export type ProbeHealth = "GREEN" | "ORANGE" | "RED";

/** Compute health for a single probe row */
export function computeProbeHealth(
  status: string,
  lastSeenAt: Date | string | null,
  now: number = Date.now()
): ProbeHealth {
  if (status === "ONLINE" && lastSeenAt) {
    const ageSec = (now - new Date(lastSeenAt).getTime()) / 1000;
    if (ageSec <= HEALTH_GREEN_SEC) return "GREEN";
    if (ageSec <= HEALTH_ORANGE_SEC) return "ORANGE";
    return "RED";
  }
  if (status === "ONLINE") return "ORANGE"; // no heartbeat
  if (status === "DEGRADED") return "ORANGE";
  return "RED"; // OFFLINE
}

/** Main evaluation loop — call periodically */
export async function evaluateProbesHealthAndAlert(): Promise<{
  evaluated: number;
  alertsSent: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) return { evaluated: 0, alertsSent: 0, errors: ["DB unavailable"] };

  const now = Date.now();
  const allProbes = await db.select().from(probes).limit(1000);
  let alertsSent = 0;
  const errors: string[] = [];

  for (const probe of allProbes) {
    const health = computeProbeHealth(probe.status, probe.lastSeenAt, now);

    // Get or create alert state
    let [alertState] = await db
      .select()
      .from(probeAlertState)
      .where(eq(probeAlertState.probeId, probe.id))
      .limit(1);

    if (!alertState) {
      // Create initial state
      await db.insert(probeAlertState).values({
        probeId: probe.id,
        orgId: 0, // Global scope (no orgId on probes table)
        healthState: health,
        redSinceAt: health === "RED" ? new Date(now) : null,
        lastNotifiedAt: null,
        alertCount: 0,
      });
      // If immediately RED, set redSinceAt but don't alert yet (need 5min)
      continue;
    }

    // ── State transitions ──────────────────────────────────────────────

    if (health !== "RED") {
      // Probe recovered or is healthy → reset state
      if (alertState.healthState === "RED") {
        await db
          .update(probeAlertState)
          .set({
            healthState: health,
            redSinceAt: null,
            alertCount: 0,
          })
          .where(eq(probeAlertState.id, alertState.id));
      } else if (alertState.healthState !== health) {
        await db
          .update(probeAlertState)
          .set({ healthState: health })
          .where(eq(probeAlertState.id, alertState.id));
      }
      continue;
    }

    // health === "RED"
    if (alertState.healthState !== "RED") {
      // Just entered RED → record timestamp, don't alert yet
      await db
        .update(probeAlertState)
        .set({
          healthState: "RED",
          redSinceAt: new Date(now),
          alertCount: 0,
        })
        .where(eq(probeAlertState.id, alertState.id));
      continue;
    }

    // Already RED — check if > 5 min
    const redSince = alertState.redSinceAt
      ? new Date(alertState.redSinceAt).getTime()
      : now;
    const redDurationMs = now - redSince;

    if (redDurationMs < RED_THRESHOLD_MS) {
      // Not yet 5 min RED → skip
      continue;
    }

    // Check anti-spam: last notification < 30 min ago?
    if (alertState.lastNotifiedAt) {
      const lastNotifMs = new Date(alertState.lastNotifiedAt).getTime();
      if (now - lastNotifMs < ANTI_SPAM_MS) {
        // Anti-spam: skip
        continue;
      }
    }

    // ── Send notification ──────────────────────────────────────────────
    try {
      const redMinutes = Math.round(redDurationMs / 60000);
      await notifyOwner({
        title: `🔴 Sonde "${probe.site || probe.uid}" en état critique (RED)`,
        content: [
          `La sonde **${probe.site || probe.uid}** (${probe.probeType}) est en état RED depuis **${redMinutes} minutes**.`,
          ``,
          `- **Zone** : ${probe.zone || "N/A"}`,
          `- **Statut** : ${probe.status}`,
          `- **Dernier contact** : ${probe.lastSeenAt ? new Date(probe.lastSeenAt).toLocaleString("fr-FR") : "Jamais"}`,
          ``,
          `Vérifiez la connectivité de la sonde depuis le tableau de monitoring.`,
        ].join("\n"),
      });
      alertsSent++;
    } catch (err: any) {
      errors.push(`Notification failed for probe ${probe.id}: ${err.message}`);
    }

    // Dispatch webhook event
    try {
      await dispatchWebhookEvent(
        "", // probes table has no projectId; dispatch globally
        "probe.alert.red",
        {
          probeId: probe.id,
          probeName: probe.site || probe.uid,
          probeType: probe.probeType,
          zone: probe.zone,
          status: probe.status,
          redSinceMinutes: Math.round(redDurationMs / 60000),
          timestamp: new Date(now).toISOString(),
        }
      );
    } catch (_) { /* best-effort */ }

    // Update alert state
    await db
      .update(probeAlertState)
      .set({
        lastNotifiedAt: new Date(now),
        alertCount: (alertState.alertCount ?? 0) + 1,
      })
      .where(eq(probeAlertState.id, alertState.id));
  }

  return { evaluated: allProbes.length, alertsSent, errors };
}
