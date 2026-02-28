// ============================================================================
// AgilesTest — Drive Run Ingestion
// Computes summary KPIs from GPS telemetry + events after a run completes.
// Registered as a job handler in the job queue.
// ============================================================================

import { getDb } from "./db";
import { driveRuns, driveLocationSamples, driveRunEvents, driveRunSummaries } from "../drizzle/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { registerHandler, type JobName, type JobPayload } from "./jobQueue";
import { randomUUID } from "crypto";

// ── Extend job types ──────────────────────────────────────────────────────

// We augment the existing types via module augmentation
declare module "./jobQueue" {
  interface JobPayload {
    computeDriveRunSummary: { runUid: string };
  }
}

// ── Haversine distance (meters) ───────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Handler ───────────────────────────────────────────────────────────────

// @ts-expect-error — extended job type via module augmentation
registerHandler("computeDriveRunSummary", async (payload: { runUid: string }) => {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const { runUid } = payload;

  // 1. Fetch the run
  const [run] = await db
    .select()
    .from(driveRuns)
    .where(eq(driveRuns.uid, runUid))
    .limit(1);

  if (!run) throw new Error(`Drive run ${runUid} not found`);

  // 2. Fetch GPS samples ordered by timestamp
  const samples = await db
    .select()
    .from(driveLocationSamples)
    .where(eq(driveLocationSamples.runUid, runUid))
    .orderBy(driveLocationSamples.ts);

  // 3. Fetch events
  const [eventCounts] = await db
    .select({ total: count() })
    .from(driveRunEvents)
    .where(eq(driveRunEvents.runUid, runUid));

  const [errorCounts] = await db
    .select({ total: count() })
    .from(driveRunEvents)
    .where(
      and(
        eq(driveRunEvents.runUid, runUid),
        eq(driveRunEvents.severity, "ERROR")
      )
    );

  // 4. Compute GPS-based KPIs
  let totalDistanceM = 0;
  let maxSpeedMps = 0;
  let speedSum = 0;
  let speedCount = 0;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const lat1 = typeof prev.lat === "string" ? parseFloat(prev.lat) : prev.lat;
    const lon1 = typeof prev.lon === "string" ? parseFloat(prev.lon) : prev.lon;
    const lat2 = typeof curr.lat === "string" ? parseFloat(curr.lat) : curr.lat;
    const lon2 = typeof curr.lon === "string" ? parseFloat(curr.lon) : curr.lon;
    totalDistanceM += haversineM(lat1, lon1, lat2, lon2);

    if (curr.speedMps != null) {
      const speed = typeof curr.speedMps === "string" ? parseFloat(curr.speedMps) : curr.speedMps;
      if (speed > maxSpeedMps) maxSpeedMps = speed;
      speedSum += speed;
      speedCount++;
    }
  }

  const avgSpeedMps = speedCount > 0 ? speedSum / speedCount : 0;

  // Duration in seconds
  let durationSec = 0;
  if (run.startedAt && run.endedAt) {
    durationSec = Math.round(
      (new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
    );
  } else if (samples.length >= 2) {
    durationSec = Math.round(
      (new Date(samples[samples.length - 1].ts).getTime() - new Date(samples[0].ts).getTime()) / 1000
    );
  }

  // 5. Build summary JSON
  const summaryJson = {
    totalDistanceKm: Math.round((totalDistanceM / 1000) * 100) / 100,
    durationSec,
    avgSpeedKmh: Math.round(avgSpeedMps * 3.6 * 100) / 100,
    maxSpeedKmh: Math.round(maxSpeedMps * 3.6 * 100) / 100,
    gpsSampleCount: samples.length,
    eventCount: eventCounts?.total ?? 0,
    errorCount: errorCounts?.total ?? 0,
    computedAt: new Date().toISOString(),
  };

  // 6. Upsert into drive_run_summaries
  // Check if a summary already exists for this run
  const [existing] = await db
    .select()
    .from(driveRunSummaries)
    .where(eq(driveRunSummaries.driveJobId, runUid))
    .limit(1);

  if (existing) {
    await db
      .update(driveRunSummaries)
      .set({
        totalSamples: summaryJson.gpsSampleCount,
        durationSec: summaryJson.durationSec,
        distanceKm: summaryJson.totalDistanceKm,
        kpiAverages: { avgSpeedKmh: summaryJson.avgSpeedKmh, eventCount: summaryJson.eventCount },
        kpiMax: { maxSpeedKmh: summaryJson.maxSpeedKmh },
        kpiMin: { errorCount: summaryJson.errorCount },
        overallPass: summaryJson.errorCount === 0,
      })
      .where(eq(driveRunSummaries.driveJobId, runUid));
  } else {
    await db.insert(driveRunSummaries).values({
      driveJobId: runUid,
      campaignId: run.campaignUid ?? "",
      totalSamples: summaryJson.gpsSampleCount,
      durationSec: summaryJson.durationSec,
      distanceKm: summaryJson.totalDistanceKm,
      kpiAverages: { avgSpeedKmh: summaryJson.avgSpeedKmh, eventCount: summaryJson.eventCount },
      kpiMax: { maxSpeedKmh: summaryJson.maxSpeedKmh },
      kpiMin: { errorCount: summaryJson.errorCount },
      overallPass: summaryJson.errorCount === 0,
    });
  }

  // 7. Mark run as COMPLETED if still UPLOADING
  if (run.status === "UPLOADING") {
    await db
      .update(driveRuns)
      .set({ status: "COMPLETED", endedAt: new Date() })
      .where(eq(driveRuns.uid, runUid));
  }

  console.log(
    `[DriveIngestion] Run ${runUid}: ${summaryJson.totalDistanceKm} km, ${durationSec}s, ${samples.length} GPS pts, ${summaryJson.eventCount} events`
  );

  return summaryJson;
});

// ── Helper: enqueue summary computation ───────────────────────────────────

export async function enqueueRunSummary(runUid: string) {
  const { enqueueJob } = await import("./jobQueue");
  return enqueueJob("computeDriveRunSummary" as JobName, { runUid } as any);
}
