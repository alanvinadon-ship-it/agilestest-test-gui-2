// ============================================================================
// DriveAI — Input Builder + Heuristics Pre-Analysis
// Assembles a minimal payload for the AI provider and detects anomalies.
// ============================================================================

import { getDb } from "../db";
import {
  driveRuns, driveLocationSamples, driveRunEvents, driveRunSummaries,
  artifacts, kpiSamples, driveCampaigns,
} from "../../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { createHash } from "crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DriveAIInput {
  run: {
    uid: string;
    name: string | null;
    orgId: string;
    projectUid: string;
    campaignUid: string | null;
    campaignName: string | null;
    status: string;
    startedAt: string | null;
    endedAt: string | null;
    durationSec: number | null;
    deviceUid: string | null;
    probeUid: string | null;
    metaJson: Record<string, unknown> | null;
  };
  summary: {
    totalGpsSamples: number;
    totalEvents: number;
    distanceKm: number | null;
    avgSpeedMps: number | null;
    durationSec: number | null;
  };
  gpsSamples: {
    ts: string;
    lat: number;
    lon: number;
    speedMps: number | null;
    altitudeM: number | null;
  }[];
  events: {
    ts: string;
    type: string;
    severity: string | null;
    message: string | null;
  }[];
  kpiAggregates: Record<string, { avg: number; min: number; max: number; count: number }>;
  artifactRefs: {
    uid: string;
    type: string | null;
    filename: string | null;
    contentType: string | null;
    sizeBytes: number | null;
  }[];
  heuristicAnomalies: HeuristicAnomaly[];
}

export interface HeuristicAnomaly {
  type: string;
  startTs: string | null;
  endTs: string | null;
  evidence: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

// ── Input Builder ──────────────────────────────────────────────────────────

export async function buildDriveAIInput(runUid: string, orgId: string): Promise<DriveAIInput> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // 1. Fetch run
  const [run] = await db.select().from(driveRuns).where(
    and(eq(driveRuns.uid, runUid), eq(driveRuns.orgId, orgId))
  ).limit(1);
  if (!run) throw new Error(`Run ${runUid} not found`);

  // 2. Fetch campaign name if linked
  let campaignName: string | null = null;
  if (run.campaignUid) {
    const [camp] = await db.select({ name: driveCampaigns.name })
      .from(driveCampaigns)
      .where(eq(driveCampaigns.uid, run.campaignUid))
      .limit(1);
    campaignName = camp?.name ?? null;
  }

  // 3. Fetch GPS samples (limit to 2000 for context window)
  const gpsSamples = await db.select({
    ts: driveLocationSamples.ts,
    lat: driveLocationSamples.lat,
    lon: driveLocationSamples.lon,
    speedMps: driveLocationSamples.speedMps,
    altitudeM: driveLocationSamples.altitudeM,
  })
    .from(driveLocationSamples)
    .where(and(eq(driveLocationSamples.runUid, runUid), eq(driveLocationSamples.orgId, orgId)))
    .orderBy(driveLocationSamples.ts)
    .limit(2000);

  // 4. Fetch events
  const events = await db.select({
    ts: driveRunEvents.ts,
    type: driveRunEvents.type,
    severity: driveRunEvents.severity,
    message: driveRunEvents.message,
  })
    .from(driveRunEvents)
    .where(and(eq(driveRunEvents.runUid, runUid), eq(driveRunEvents.orgId, orgId)))
    .orderBy(driveRunEvents.ts);

  // 5. Fetch artifacts refs (no signed URLs)
  const artifactRefs = await db.select({
    uid: artifacts.uid,
    type: artifacts.type,
    filename: artifacts.filename,
    contentType: artifacts.contentType,
    sizeBytes: artifacts.sizeBytes,
  })
    .from(artifacts)
    .where(eq(artifacts.executionId, runUid))
    .limit(50);

  // 6. Compute summary stats
  const totalGpsSamples = gpsSamples.length;
  const totalEvents = events.length;
  const durationSec = run.startedAt && run.endedAt
    ? Math.round((new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;

  // Compute avg speed
  const speedValues = gpsSamples.filter(s => s.speedMps != null).map(s => s.speedMps!);
  const avgSpeedMps = speedValues.length > 0
    ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length
    : null;

  // Compute distance (Haversine)
  let distanceKm: number | null = null;
  if (gpsSamples.length >= 2) {
    let totalDist = 0;
    for (let i = 1; i < gpsSamples.length; i++) {
      totalDist += haversineKm(
        gpsSamples[i - 1].lat, gpsSamples[i - 1].lon,
        gpsSamples[i].lat, gpsSamples[i].lon,
      );
    }
    distanceKm = Math.round(totalDist * 100) / 100;
  }

  // 7. KPI aggregates (from kpi_samples if campaign linked)
  const kpiAggregates: Record<string, { avg: number; min: number; max: number; count: number }> = {};
  if (run.campaignUid) {
    const kpiRows = await db.select({
      kpiName: kpiSamples.kpiName,
      avg: sql<number>`AVG(${kpiSamples.value})`,
      min: sql<number>`MIN(${kpiSamples.value})`,
      max: sql<number>`MAX(${kpiSamples.value})`,
      count: sql<number>`COUNT(*)`,
    })
      .from(kpiSamples)
      .where(eq(kpiSamples.campaignId, run.campaignUid))
      .groupBy(kpiSamples.kpiName);

    for (const row of kpiRows) {
      kpiAggregates[row.kpiName] = {
        avg: Number(row.avg),
        min: Number(row.min),
        max: Number(row.max),
        count: Number(row.count),
      };
    }
  }

  // 8. Heuristic anomalies
  const heuristicAnomalies = detectHeuristicAnomalies(gpsSamples, events, kpiAggregates);

  return {
    run: {
      uid: run.uid,
      name: run.name,
      orgId: run.orgId,
      projectUid: run.projectUid,
      campaignUid: run.campaignUid,
      campaignName,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? null,
      endedAt: run.endedAt?.toISOString() ?? null,
      durationSec,
      deviceUid: run.deviceUid,
      probeUid: run.probeUid,
      metaJson: (run.metaJson as Record<string, unknown>) ?? null,
    },
    summary: {
      totalGpsSamples,
      totalEvents,
      distanceKm,
      avgSpeedMps: avgSpeedMps != null ? Math.round(avgSpeedMps * 100) / 100 : null,
      durationSec,
    },
    gpsSamples: gpsSamples.map(s => ({
      ts: new Date(s.ts).toISOString(),
      lat: s.lat,
      lon: s.lon,
      speedMps: s.speedMps,
      altitudeM: s.altitudeM,
    })),
    events: events.map(e => ({
      ts: new Date(e.ts).toISOString(),
      type: e.type,
      severity: e.severity,
      message: redactPII(e.message),
    })),
    kpiAggregates,
    artifactRefs: artifactRefs.map(a => ({
      uid: a.uid,
      type: a.type,
      filename: a.filename,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    })),
    heuristicAnomalies,
  };
}

// ── Heuristics Pre-Analysis ────────────────────────────────────────────────

export function detectHeuristicAnomalies(
  gpsSamples: { ts: Date | string; lat: number; lon: number; speedMps: number | null; altitudeM: number | null }[],
  events: { ts: Date | string; type: string; severity: string | null; message: string | null }[],
  kpiAggregates: Record<string, { avg: number; min: number; max: number; count: number }>,
): HeuristicAnomaly[] {
  const anomalies: HeuristicAnomaly[] = [];

  // A) GPS gaps: detect gaps > 30 seconds between consecutive samples
  if (gpsSamples.length >= 2) {
    for (let i = 1; i < gpsSamples.length; i++) {
      const prev = new Date(gpsSamples[i - 1].ts).getTime();
      const curr = new Date(gpsSamples[i].ts).getTime();
      const gapSec = (curr - prev) / 1000;
      if (gapSec > 30) {
        anomalies.push({
          type: "GPS_GAP",
          startTs: new Date(gpsSamples[i - 1].ts).toISOString(),
          endTs: new Date(gpsSamples[i].ts).toISOString(),
          evidence: `Interruption GPS de ${Math.round(gapSec)}s entre les points #${i - 1} et #${i}`,
          severity: gapSec > 120 ? "HIGH" : gapSec > 60 ? "MEDIUM" : "LOW",
        });
      }
    }
  }

  // B) Speed anomalies: sudden drops to 0 while previously moving
  const speedSamples = gpsSamples.filter(s => s.speedMps != null);
  if (speedSamples.length >= 5) {
    for (let i = 2; i < speedSamples.length; i++) {
      const prevSpeed = speedSamples[i - 1].speedMps!;
      const currSpeed = speedSamples[i].speedMps!;
      if (prevSpeed > 5 && currSpeed === 0) {
        anomalies.push({
          type: "SPEED_DROP",
          startTs: new Date(speedSamples[i - 1].ts).toISOString(),
          endTs: new Date(speedSamples[i].ts).toISOString(),
          evidence: `Vitesse chutée de ${prevSpeed.toFixed(1)} m/s à 0 m/s`,
          severity: "LOW",
        });
      }
    }
  }

  // C) Error events clustering
  const errorEvents = events.filter(e => e.severity === "ERROR" || e.type === "ERROR");
  if (errorEvents.length >= 3) {
    anomalies.push({
      type: "ERROR_CLUSTER",
      startTs: new Date(errorEvents[0].ts).toISOString(),
      endTs: new Date(errorEvents[errorEvents.length - 1].ts).toISOString(),
      evidence: `${errorEvents.length} événements ERROR détectés: ${errorEvents.slice(0, 3).map(e => e.message?.substring(0, 80) ?? "N/A").join("; ")}`,
      severity: errorEvents.length >= 10 ? "HIGH" : errorEvents.length >= 5 ? "MEDIUM" : "LOW",
    });
  }

  // D) KPI-based anomalies (if available)
  const rsrp = kpiAggregates["RSRP"] || kpiAggregates["rsrp"];
  if (rsrp && rsrp.min < -120) {
    anomalies.push({
      type: "COVERAGE_HOLE",
      startTs: null,
      endTs: null,
      evidence: `RSRP min=${rsrp.min} dBm (seuil -120 dBm), avg=${rsrp.avg.toFixed(1)} dBm sur ${rsrp.count} échantillons`,
      severity: rsrp.min < -130 ? "HIGH" : "MEDIUM",
    });
  }

  const latency = kpiAggregates["LATENCY"] || kpiAggregates["latency"] || kpiAggregates["RTT"] || kpiAggregates["rtt"];
  if (latency && latency.max > 200) {
    anomalies.push({
      type: "HIGH_LATENCY",
      startTs: null,
      endTs: null,
      evidence: `Latence max=${latency.max.toFixed(0)} ms (seuil 200 ms), avg=${latency.avg.toFixed(0)} ms`,
      severity: latency.max > 500 ? "HIGH" : "MEDIUM",
    });
  }

  const throughput = kpiAggregates["THROUGHPUT_DL"] || kpiAggregates["throughput_dl"];
  if (throughput && throughput.min < 1) {
    anomalies.push({
      type: "LOW_THROUGHPUT",
      startTs: null,
      endTs: null,
      evidence: `Débit DL min=${throughput.min.toFixed(2)} Mbps (seuil 1 Mbps), avg=${throughput.avg.toFixed(2)} Mbps`,
      severity: throughput.min < 0.5 ? "HIGH" : "MEDIUM",
    });
  }

  const packetLoss = kpiAggregates["PACKET_LOSS"] || kpiAggregates["packet_loss"];
  if (packetLoss && packetLoss.max > 5) {
    anomalies.push({
      type: "PACKET_LOSS",
      startTs: null,
      endTs: null,
      evidence: `Perte paquets max=${packetLoss.max.toFixed(1)}% (seuil 5%), avg=${packetLoss.avg.toFixed(1)}%`,
      severity: packetLoss.max > 15 ? "HIGH" : "MEDIUM",
    });
  }

  // Limit to top 20 anomalies sorted by severity
  const severityOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  anomalies.sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0));
  return anomalies.slice(0, 20);
}

// ── Input Hash ─────────────────────────────────────────────────────────────

export function computeInputHash(input: DriveAIInput): string {
  const data = JSON.stringify({
    runUid: input.run.uid,
    totalSamples: input.summary.totalGpsSamples,
    totalEvents: input.summary.totalEvents,
    anomaliesCount: input.heuristicAnomalies.length,
    kpiKeys: Object.keys(input.kpiAggregates).sort(),
  });
  return createHash("sha256").update(data).digest("hex").substring(0, 16);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Redact PII patterns from text (emails, phone numbers, tokens) */
function redactPII(text: string | null): string | null {
  if (!text) return null;
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{8,15}\b/g, "[PHONE_REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [TOKEN_REDACTED]")
    .replace(/https?:\/\/[^\s]*X-Amz-Signature=[^\s&]*/gi, "[SIGNED_URL_REDACTED]");
}
