import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { executions, runnerJobs, artifacts, incidents, analyses } from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

// ── Executions ──
export async function listExecutions(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(executions).where(eq(executions.projectId, projectId)).orderBy(desc(executions.createdAt));
}

export async function getExecutionByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(executions).where(eq(executions.uid, uid)).limit(1);
  return rows[0];
}

export async function createExecution(data: {
  projectId: string;
  profileId: string;
  scenarioId: string;
  runnerType?: string;
  scriptId?: string;
  scriptVersion?: number;
  datasetBundleId?: string;
  targetEnv?: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  runnerId?: string;
  aiRepairFromExecutionId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(executions).values({ uid, status: "PENDING", ...data });
  return getExecutionByUid(uid);
}

export async function updateExecution(uid: string, data: Partial<{
  status: "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "ERROR" | "CANCELLED";
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  artifactsCount: number;
  incidentsCount: number;
  runnerId: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(executions).set(updateSet).where(eq(executions.uid, uid));
  }
  return getExecutionByUid(uid);
}

export async function deleteExecution(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(artifacts).where(eq(artifacts.executionId, uid));
  await db.delete(incidents).where(eq(incidents.executionId, uid));
  await db.delete(runnerJobs).where(eq(runnerJobs.executionId, uid));
  await db.delete(executions).where(eq(executions.uid, uid));
  return { success: true };
}

// ── Runner Jobs ──
export async function listRunnerJobs(executionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(runnerJobs).where(eq(runnerJobs.executionId, executionId)).orderBy(desc(runnerJobs.createdAt));
}

export async function createRunnerJob(data: {
  executionId: string;
  projectId: string;
  runnerId?: string;
  scriptId?: string;
  scriptVersion?: number;
  downloadUrl?: string;
  datasetBundleId?: string;
  targetEnv?: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  artifactUploadPolicy?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(runnerJobs).values({ uid, status: "PENDING", ...data });
  const rows = await db.select().from(runnerJobs).where(eq(runnerJobs.uid, uid)).limit(1);
  return rows[0];
}

export async function updateRunnerJob(uid: string, data: Partial<{
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  runnerId: string;
  startedAt: Date;
  finishedAt: Date;
  metrics: any;
  artifactManifest: any[];
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(runnerJobs).set(updateSet).where(eq(runnerJobs.uid, uid));
  }
  const rows = await db.select().from(runnerJobs).where(eq(runnerJobs.uid, uid)).limit(1);
  return rows[0];
}

// ── Artifacts ──
export async function listArtifacts(executionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(artifacts).where(eq(artifacts.executionId, executionId)).orderBy(desc(artifacts.createdAt));
}

export async function createArtifact(data: {
  executionId: string;
  type: string;
  filename: string;
  name?: string;
  mimeType?: string;
  contentType?: string;
  sizeBytes?: number;
  storagePath?: string;
  storageUrl?: string;
  s3Uri?: string;
  checksum?: string;
  captureJobId?: string;
  downloadUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(artifacts).values({ uid, ...data });
  const rows = await db.select().from(artifacts).where(eq(artifacts.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteArtifact(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(artifacts).where(eq(artifacts.uid, uid));
  return { success: true };
}

// ── Incidents ──
export async function listIncidents(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incidents).where(eq(incidents.projectId, projectId)).orderBy(desc(incidents.detectedAt));
}

export async function listIncidentsByExecution(executionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incidents).where(eq(incidents.executionId, executionId)).orderBy(desc(incidents.detectedAt));
}

export async function getIncidentByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(incidents).where(eq(incidents.uid, uid)).limit(1);
  return rows[0];
}

export async function createIncident(data: {
  executionId: string;
  projectId: string;
  title: string;
  description?: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "INFO";
  stepName?: string;
  expectedResult?: string;
  actualResult?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(incidents).values({ uid, ...data });
  return getIncidentByUid(uid);
}

// ── Analyses ──
export async function getAnalysisByIncident(incidentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(analyses).where(eq(analyses.incidentId, incidentId)).limit(1);
  return rows[0];
}

export async function createAnalysis(data: {
  incidentId: string;
  observation?: string;
  hypotheses?: any[];
  rootCause?: string;
  rootCauseJustification?: string;
  recommendedSolution?: string;
  confidenceScore?: number;
  pipelinePhases?: any[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(analyses).values({ uid, status: "PENDING", ...data });
  const rows = await db.select().from(analyses).where(eq(analyses.uid, uid)).limit(1);
  return rows[0];
}

export async function updateAnalysis(uid: string, data: Partial<{
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  observation: string;
  hypotheses: any[];
  rootCause: string;
  rootCauseJustification: string;
  recommendedSolution: string;
  confidenceScore: number;
  pipelinePhases: any[];
  completedAt: Date;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(analyses).set(updateSet).where(eq(analyses.uid, uid));
  }
  const rows = await db.select().from(analyses).where(eq(analyses.uid, uid)).limit(1);
  return rows[0];
}
