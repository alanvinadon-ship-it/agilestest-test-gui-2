import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { projects } from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

export async function listProjects(filters?: { status?: string; domain?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(projects).orderBy(desc(projects.createdAt));
  // Note: filters applied in router via where clause
  return query;
}

export async function listProjectsFiltered(status?: string, domain?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (status) conditions.push(eq(projects.status, status as any));
  if (domain) conditions.push(eq(projects.domain, domain as any));
  if (conditions.length === 0) {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }
  return db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.createdAt));
}

export async function getProjectByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(projects).where(eq(projects.uid, uid)).limit(1);
  return rows[0];
}

export async function createProject(data: {
  name: string;
  description?: string;
  domain: string;
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(projects).values({
    uid,
    name: data.name,
    description: data.description ?? null,
    domain: data.domain,
    status: "ACTIVE",
    createdBy: data.createdBy ?? null,
  });
  return getProjectByUid(uid);
}

export async function updateProject(uid: string, data: {
  name?: string;
  description?: string;
  domain?: string;
  status?: "ACTIVE" | "ARCHIVED" | "DRAFT";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.description !== undefined) updateSet.description = data.description;
  if (data.domain !== undefined) updateSet.domain = data.domain;
  if (data.status !== undefined) updateSet.status = data.status;
  if (Object.keys(updateSet).length === 0) return getProjectByUid(uid);
  await db.update(projects).set(updateSet).where(eq(projects.uid, uid));
  return getProjectByUid(uid);
}

export async function deleteProject(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projects).where(eq(projects.uid, uid));
  return { success: true };
}
