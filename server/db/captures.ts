import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { captureJobs, captureSources, captureArtifacts, captureSessions } from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

// ── Capture Jobs ──
export async function listCaptureJobs(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(captureJobs).where(eq(captureJobs.projectId, projectId)).orderBy(desc(captureJobs.createdAt));
}

export async function getCaptureJobByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(captureJobs).where(eq(captureJobs.uid, uid)).limit(1);
  return rows[0];
}

export async function createCaptureJob(data: {
  executionId: string;
  projectId: string;
  captureType: "LOGS" | "PCAP";
  targetType: "K8S" | "SSH" | "PROBE";
  incidentId?: string;
  triggeredBy?: string;
  durationSeconds?: number;
  maxSizeMb?: number;
  profile?: string;
  params?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(captureJobs).values({ uid, status: "QUEUED", ...data });
  return getCaptureJobByUid(uid);
}

export async function updateCaptureJob(uid: string, data: Partial<{
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: Date;
  completedAt: Date;
  errorMessage: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(captureJobs).set(updateSet).where(eq(captureJobs.uid, uid));
  }
  return getCaptureJobByUid(uid);
}

// ── Capture Sources ──
export async function listCaptureSources(captureId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(captureSources).where(eq(captureSources.captureId, captureId)).orderBy(desc(captureSources.createdAt));
}

export async function createCaptureSource(data: {
  captureId: string;
  namespace?: string;
  podSelector?: string;
  containerName?: string;
  host?: string;
  sshPort?: number;
  sshUser?: string;
  logPaths?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(captureSources).values({ uid, ...data });
  const rows = await db.select().from(captureSources).where(eq(captureSources.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteCaptureSource(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(captureSources).where(eq(captureSources.uid, uid));
  return { success: true };
}

// ── Capture Artifacts ──
export async function listCaptureArtifacts(captureJobId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(captureArtifacts).where(eq(captureArtifacts.captureJobId, captureJobId)).orderBy(desc(captureArtifacts.uploadedAt));
}

export async function createCaptureArtifact(data: {
  executionId: string;
  type: string;
  name: string;
  captureJobId?: string;
  storageUrl?: string;
  s3Uri?: string;
  contentType?: string;
  sizeBytes?: number;
  checksum?: string;
  downloadUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(captureArtifacts).values({ uid, ...data });
  const rows = await db.select().from(captureArtifacts).where(eq(captureArtifacts.uid, uid)).limit(1);
  return rows[0];
}

// ── Capture Sessions ──
export async function listCaptureSessions(policyId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(captureSessions).where(eq(captureSessions.policyId, policyId)).orderBy(desc(captureSessions.createdAt));
}

export async function listCaptureSessionsByExecution(executionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(captureSessions).where(eq(captureSessions.executionId, executionId)).orderBy(desc(captureSessions.createdAt));
}

export async function createCaptureSession(data: {
  policyId: string;
  executionId?: string;
  probeId?: string;
  pcapPath?: string;
  pcapSize?: number;
  packetCount?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(captureSessions).values({ uid, ...data });
  const rows = await db.select().from(captureSessions).where(eq(captureSessions.uid, uid)).limit(1);
  return rows[0];
}
