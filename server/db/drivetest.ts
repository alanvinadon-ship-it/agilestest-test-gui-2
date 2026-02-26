import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  driveCampaigns, driveRoutes, testDevices, driveProbeConfigs,
  driveJobs, kpiSamples, driveRunSummaries, driveImports
} from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

// ── Drive Campaigns ──
export async function listCampaigns(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(driveCampaigns).where(eq(driveCampaigns.projectId, projectId)).orderBy(desc(driveCampaigns.createdAt));
}

export async function getCampaignByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(driveCampaigns).where(eq(driveCampaigns.uid, uid)).limit(1);
  return rows[0];
}

export async function createCampaign(data: {
  projectId: string;
  name: string;
  description?: string;
  targetEnv?: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  networkType?: string;
  area?: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(driveCampaigns).values({ uid, status: "DRAFT", ...data });
  return getCampaignByUid(uid);
}

export async function updateCampaign(uid: string, data: Partial<{
  name: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  targetEnv: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  networkType: string;
  area: string;
  startDate: string;
  endDate: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(driveCampaigns).set(updateSet).where(eq(driveCampaigns.uid, uid));
  }
  return getCampaignByUid(uid);
}

export async function deleteCampaign(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(driveCampaigns).where(eq(driveCampaigns.uid, uid));
  return { success: true };
}

// ── Drive Routes ──
export async function listRoutes(campaignId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(driveRoutes).where(eq(driveRoutes.campaignId, campaignId)).orderBy(desc(driveRoutes.createdAt));
}

export async function createRoute(data: {
  campaignId: string;
  name: string;
  routeGeojson?: unknown;
  checkpointsGeojson?: unknown;
  expectedDurationMin?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(driveRoutes).values({ uid, ...data });
  const rows = await db.select().from(driveRoutes).where(eq(driveRoutes.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteRoute(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(driveRoutes).where(eq(driveRoutes.uid, uid));
  return { success: true };
}

// ── Test Devices ──
export async function listDevices(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testDevices).where(eq(testDevices.projectId, projectId)).orderBy(desc(testDevices.createdAt));
}

export async function createDevice(data: {
  projectId: string;
  type: string;
  model: string;
  osVersion?: string;
  diagCapable?: boolean;
  toolsEnabled?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(testDevices).values({ uid, ...data });
  const rows = await db.select().from(testDevices).where(eq(testDevices.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteDevice(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(testDevices).where(eq(testDevices.uid, uid));
  return { success: true };
}

// ── Drive Probe Configs ──
export async function listProbeConfigs(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(driveProbeConfigs).where(eq(driveProbeConfigs.projectId, projectId)).orderBy(desc(driveProbeConfigs.createdAt));
}

export async function createProbeConfig(data: {
  projectId: string;
  name: string;
  location?: { lat: number; lon: number; label: string };
  captureType?: string;
  retentionDays?: number;
  maxSizeMb?: number;
  rotation?: boolean;
  outputTarget?: string;
  enabled?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(driveProbeConfigs).values({ uid, ...data });
  const rows = await db.select().from(driveProbeConfigs).where(eq(driveProbeConfigs.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteProbeConfig(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(driveProbeConfigs).where(eq(driveProbeConfigs.uid, uid));
  return { success: true };
}

// ── Drive Jobs ──
export async function listDriveJobs(campaignId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(driveJobs).where(eq(driveJobs.campaignId, campaignId)).orderBy(desc(driveJobs.createdAt));
}

export async function getDriveJobByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(driveJobs).where(eq(driveJobs.uid, uid)).limit(1);
  return rows[0];
}

export async function createDriveJob(data: {
  campaignId: string;
  routeId: string;
  deviceId: string;
  targetEnv?: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  runnerId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(driveJobs).values({ uid, status: "PENDING", ...data });
  return getDriveJobByUid(uid);
}

export async function updateDriveJob(uid: string, data: Partial<{
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  progressPct: number;
  errorMessage: string;
  startedAt: Date;
  finishedAt: Date;
  artifactsManifest: Array<{
    artifact_type: string;
    filename: string;
    minio_path: string;
    size_bytes: number;
    sha256: string;
    content_type: string;
  }>;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(driveJobs).set(updateSet).where(eq(driveJobs.uid, uid));
  }
  return getDriveJobByUid(uid);
}

// ── KPI Samples ──
export async function listKpiSamples(driveJobId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(kpiSamples).where(eq(kpiSamples.driveJobId, driveJobId)).orderBy(kpiSamples.timestamp);
}

export async function insertKpiSamples(samples: Array<{
  driveJobId: string;
  campaignId: string;
  routeId: string;
  timestamp: Date;
  lat: number;
  lon: number;
  kpiName: string;
  value: number;
  unit?: string;
  cellId?: string;
  technology?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (samples.length === 0) return { inserted: 0 };
  const withUids = samples.map(s => ({ uid: uuid(), ...s }));
  await db.insert(kpiSamples).values(withUids);
  return { inserted: samples.length };
}

// ── Drive Run Summaries ──
export async function getRunSummary(driveJobId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(driveRunSummaries).where(eq(driveRunSummaries.driveJobId, driveJobId)).limit(1);
  return rows[0];
}

export async function upsertRunSummary(data: {
  driveJobId: string;
  campaignId: string;
  totalSamples?: number;
  durationSec?: number;
  distanceKm?: number;
  kpiAverages?: Record<string, number>;
  kpiMin?: Record<string, number>;
  kpiMax?: Record<string, number>;
  thresholdViolations?: Array<{
    kpi_name: string;
    threshold: number;
    actual_avg: number;
    direction: string;
    violation_count: number;
    total_samples: number;
  }>;
  overallPass?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getRunSummary(data.driveJobId);
  if (existing) {
    const updateSet: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && k !== "driveJobId") updateSet[k] = v;
    }
    await db.update(driveRunSummaries).set(updateSet).where(eq(driveRunSummaries.driveJobId, data.driveJobId));
  } else {
    await db.insert(driveRunSummaries).values(data);
  }
  return getRunSummary(data.driveJobId);
}

// ── Drive Imports ──
export async function listImports(campaignId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(driveImports).where(eq(driveImports.campaignId, campaignId)).orderBy(desc(driveImports.importedAt));
}

export async function createImport(data: {
  campaignId: string;
  sourceFilename: string;
  sourceFormat: "CSV" | "JSON" | "GPX" | "GEOJSON" | "IPERF3";
  samplesImported?: number;
  samplesSkipped?: number;
  errors?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(driveImports).values({ uid, ...data });
  const rows = await db.select().from(driveImports).where(eq(driveImports.uid, uid)).limit(1);
  return rows[0];
}
