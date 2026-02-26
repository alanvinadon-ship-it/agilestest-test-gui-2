import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  invites, projectMemberships, roles, permissions,
  rolePermissions, userRoles, auditLogs
} from "../../drizzle/schema";
import { v4 as uuid } from "uuid";
import crypto from "crypto";

// ══════════════════════════════════════════════════════════════════════════
// INVITES
// ══════════════════════════════════════════════════════════════════════════
export async function listInvites(status?: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED") {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db.select().from(invites).where(eq(invites.status, status)).orderBy(desc(invites.createdAt));
  }
  return db.select().from(invites).orderBy(desc(invites.createdAt));
}

export async function getInviteByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  return rows[0];
}

export async function getInviteByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(invites).where(eq(invites.uid, uid)).limit(1);
  return rows[0];
}

export async function createInvite(data: {
  email: string;
  role?: "ADMIN" | "MANAGER" | "VIEWER";
  invitedBy?: string;
  invitedByName?: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  const token = crypto.randomBytes(48).toString("hex");
  await db.insert(invites).values({ uid, token, status: "PENDING", ...data });
  return getInviteByUid(uid);
}

export async function updateInviteStatus(uid: string, status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED", acceptedAt?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = { status };
  if (acceptedAt) updateSet.acceptedAt = acceptedAt;
  await db.update(invites).set(updateSet).where(eq(invites.uid, uid));
  return getInviteByUid(uid);
}

export async function revokeInvite(uid: string) {
  return updateInviteStatus(uid, "REVOKED");
}

// ══════════════════════════════════════════════════════════════════════════
// PROJECT MEMBERSHIPS
// ══════════════════════════════════════════════════════════════════════════
export async function listProjectMemberships(projectId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectMemberships).where(eq(projectMemberships.projectId, projectId)).orderBy(desc(projectMemberships.createdAt));
}

export async function listUserMemberships(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectMemberships).where(eq(projectMemberships.userId, userId)).orderBy(desc(projectMemberships.createdAt));
}

export async function createMembership(data: {
  projectId: string;
  projectName?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  projectRole?: "PROJECT_ADMIN" | "PROJECT_EDITOR" | "PROJECT_VIEWER";
  addedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(projectMemberships).values({ uid, ...data });
  const rows = await db.select().from(projectMemberships).where(eq(projectMemberships.uid, uid)).limit(1);
  return rows[0];
}

export async function updateMembership(uid: string, data: Partial<{
  projectRole: "PROJECT_ADMIN" | "PROJECT_EDITOR" | "PROJECT_VIEWER";
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projectMemberships).set(data).where(eq(projectMemberships.uid, uid));
  const rows = await db.select().from(projectMemberships).where(eq(projectMemberships.uid, uid)).limit(1);
  return rows[0];
}

export async function deleteMembership(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projectMemberships).where(eq(projectMemberships.uid, uid));
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// ROLES (RBAC)
// ══════════════════════════════════════════════════════════════════════════
export async function listRoles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roles).orderBy(roles.name);
}

export async function getRoleByUid(uid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(roles).where(eq(roles.uid, uid)).limit(1);
  return rows[0];
}

export async function createRole(data: {
  name: string;
  description?: string;
  scope?: "GLOBAL" | "PROJECT";
  isSystem?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(roles).values({ uid, ...data });
  return getRoleByUid(uid);
}

export async function updateRole(uid: string, data: Partial<{
  name: string;
  description: string;
  scope: "GLOBAL" | "PROJECT";
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) updateSet[k] = v;
  }
  if (Object.keys(updateSet).length > 0) {
    await db.update(roles).set(updateSet).where(eq(roles.uid, uid));
  }
  return getRoleByUid(uid);
}

export async function deleteRole(uid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, uid));
  await db.delete(userRoles).where(eq(userRoles.roleId, uid));
  await db.delete(roles).where(eq(roles.uid, uid));
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// PERMISSIONS
// ══════════════════════════════════════════════════════════════════════════
export async function listPermissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(permissions).orderBy(permissions.module, permissions.action);
}

export async function createPermission(data: {
  module: string;
  action: string;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(permissions).values({ uid, ...data });
  const rows = await db.select().from(permissions).where(eq(permissions.uid, uid)).limit(1);
  return rows[0];
}

// ══════════════════════════════════════════════════════════════════════════
// ROLE-PERMISSION MAPPING
// ══════════════════════════════════════════════════════════════════════════
export async function getRolePermissions(roleId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rolePermissions).where(eq(rolePermissions.roleId, roleId));
}

export async function addPermissionToRole(roleId: string, permissionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(rolePermissions).values({ roleId, permissionId });
  return { success: true };
}

export async function removePermissionFromRole(roleId: string, permissionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rolePermissions).where(
    and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
  );
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// USER-ROLE MAPPING
// ══════════════════════════════════════════════════════════════════════════
export async function getUserRoles(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userRoles).where(eq(userRoles.userId, userId));
}

export async function addRoleToUser(userId: string, roleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(userRoles).values({ userId, roleId });
  return { success: true };
}

export async function removeRoleFromUser(userId: string, roleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userRoles).where(
    and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId))
  );
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════════════════════════════════════
export async function listAuditLogs(filters?: {
  actorId?: string;
  entityType?: string;
  action?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));

  const query = conditions.length > 0
    ? db.select().from(auditLogs).where(and(...conditions)).orderBy(desc(auditLogs.timestamp))
    : db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));

  return query.limit(filters?.limit ?? 200);
}

export async function createAuditLog(data: {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(auditLogs).values({ uid, ...data });
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.uid, uid)).limit(1);
  return rows[0];
}
