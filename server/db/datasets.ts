import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { datasets, datasetTypes, datasetInstances, datasetBundles, bundleItems, datasetSecrets } from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

// ── Dataset Types ──
export async function listDatasetTypes(domain?: string) {
  const db = await getDb();
  if (!db) return [];
  if (domain) {
    return db.select().from(datasetTypes).where(eq(datasetTypes.domain, domain)).orderBy(desc(datasetTypes.createdAt));
  }
  return db.select().from(datasetTypes).orderBy(desc(datasetTypes.createdAt));
}

export async function getDatasetTypeByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(datasetTypes).where(eq(datasetTypes.uid, uid)).limit(1);
  return rows[0];
}

export async function createDatasetType(data: {
  datasetTypeId: string;
  domain: string;
  testType?: string;
  name: string;
  description?: string;
  schemaFields?: any[];
  examplePlaceholders?: Record<string, string>;
  tags?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(datasetTypes).values({ uid, ...data });
  return getDatasetTypeByUid(uid);
}

// ── Datasets ──
export async function listDatasets(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(datasets).where(eq(datasets.projectId, projectId)).orderBy(desc(datasets.createdAt));
}

export async function getDatasetByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(datasets).where(eq(datasets.uid, uid)).limit(1);
  return rows[0];
}

export async function createDataset(data: {
  projectId: string;
  name: string;
  description?: string;
  format?: "CSV" | "JSON" | "YAML";
  datasetTypeId?: string;
  rowCount?: number;
  sizeBytes?: number;
  storageUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(datasets).values({ uid, ...data });
  return getDatasetByUid(uid);
}

export async function deleteDataset(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(datasets).where(eq(datasets.uid, uid));
  return { success: true };
}

// ── Dataset Instances ──
export async function listDatasetInstances(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(datasetInstances).where(eq(datasetInstances.projectId, projectId)).orderBy(desc(datasetInstances.createdAt));
}

export async function getDatasetInstanceByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(datasetInstances).where(eq(datasetInstances.uid, uid)).limit(1);
  return rows[0];
}

export async function createDatasetInstance(data: {
  projectId: string;
  datasetTypeId: string;
  env: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  valuesJson?: Record<string, unknown>;
  notes?: string;
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(datasetInstances).values({ uid, ...data });
  return getDatasetInstanceByUid(uid);
}

export async function updateDatasetInstance(uid: string, data: Partial<{
  env: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  status: "DRAFT" | "ACTIVE" | "DEPRECATED";
  version: number;
  valuesJson: Record<string, unknown>;
  notes: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(datasetInstances).set(updateSet).where(eq(datasetInstances.uid, uid));
  }
  return getDatasetInstanceByUid(uid);
}

export async function deleteDatasetInstance(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(datasetInstances).where(eq(datasetInstances.uid, uid));
  return { success: true };
}

// ── Bundles ──
export async function listBundles(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(datasetBundles).where(eq(datasetBundles.projectId, projectId)).orderBy(desc(datasetBundles.createdAt));
}

export async function getBundleByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(datasetBundles).where(eq(datasetBundles.uid, uid)).limit(1);
  return rows[0];
}

export async function createBundle(data: {
  projectId: string;
  name: string;
  env: "DEV" | "PREPROD" | "PILOT_ORANGE" | "PROD";
  tags?: string[];
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(datasetBundles).values({ uid, ...data });
  return getBundleByUid(uid);
}

export async function addBundleItem(bundleUid: string, datasetUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(bundleItems).values({ bundleId: bundleUid, datasetId: datasetUid });
  return { success: true };
}

export async function listBundleItems(bundleUid: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundleUid));
}

export async function deleteBundle(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(bundleItems).where(eq(bundleItems.bundleId, uid));
  await db.delete(datasetBundles).where(eq(datasetBundles.uid, uid));
  return { success: true };
}

// ── Dataset Secrets ──
export async function listDatasetSecrets(datasetId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(datasetSecrets).where(eq(datasetSecrets.datasetId, datasetId));
}

export async function setDatasetSecret(datasetId: string, keyPath: string, isSecret: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(datasetSecrets).values({ datasetId, keyPath, isSecret });
  return { success: true };
}
