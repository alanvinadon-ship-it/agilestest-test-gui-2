import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { testProfiles } from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

export async function listProfiles(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testProfiles).where(eq(testProfiles.projectId, projectId)).orderBy(desc(testProfiles.createdAt));
}

export async function getProfileByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(testProfiles).where(eq(testProfiles.uid, uid)).limit(1);
  return rows[0];
}

export async function createProfile(data: {
  projectId: string;
  name: string;
  description?: string;
  protocol?: string;
  testType: "VABF" | "VSR" | "VABE";
  domain?: string;
  profileType?: string;
  targetHost?: string;
  targetPort?: number;
  parameters?: Record<string, unknown>;
  config?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(testProfiles).values({ uid, ...data });
  return getProfileByUid(uid);
}

export async function updateProfile(uid: string, data: Partial<{
  name: string;
  description: string;
  protocol: string;
  testType: "VABF" | "VSR" | "VABE";
  domain: string;
  profileType: string;
  targetHost: string;
  targetPort: number;
  parameters: Record<string, unknown>;
  config: Record<string, unknown>;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(testProfiles).set(updateSet).where(eq(testProfiles.uid, uid));
  }
  return getProfileByUid(uid);
}

export async function deleteProfile(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(testProfiles).where(eq(testProfiles.uid, uid));
  return { success: true };
}
