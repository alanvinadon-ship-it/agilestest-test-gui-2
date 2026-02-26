import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { testScenarios } from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

export async function listScenarios(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testScenarios).where(eq(testScenarios.projectId, projectId)).orderBy(desc(testScenarios.createdAt));
}

export async function getScenarioByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(testScenarios).where(eq(testScenarios.uid, uid)).limit(1);
  return rows[0];
}

export async function createScenario(data: {
  projectId: string;
  profileId: string;
  scenarioCode: string;
  name: string;
  description?: string;
  testType: "VABF" | "VSR" | "VABE";
  steps?: any[];
  requiredDatasetTypes?: string[];
  artifactPolicy?: string[];
  kpiThresholds?: Record<string, number>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(testScenarios).values({ uid, ...data });
  return getScenarioByUid(uid);
}

export async function updateScenario(uid: string, data: Partial<{
  name: string;
  description: string;
  scenarioCode: string;
  testType: "VABF" | "VSR" | "VABE";
  status: "DRAFT" | "FINAL" | "DEPRECATED";
  version: number;
  steps: any[];
  requiredDatasetTypes: string[];
  artifactPolicy: string[];
  kpiThresholds: Record<string, number>;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(testScenarios).set(updateSet).where(eq(testScenarios.uid, uid));
  }
  return getScenarioByUid(uid);
}

export async function deleteScenario(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(testScenarios).where(eq(testScenarios.uid, uid));
  return { success: true };
}
