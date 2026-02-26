import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  invites, projectMemberships, roles, permissions,
  rolePermissions, userRoles, auditLogs, users
} from "../../drizzle/schema";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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

/**
 * Accept an invitation by token:
 * 1. Validate the token exists and is PENDING + not expired
 * 2. Mark invite as ACCEPTED
 * 3. Create or activate the user in the users table
 * 4. Return the updated invite + user info
 */
export async function acceptInvite(token: string, fullName: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Find the invite
  const rows = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  const invite = rows[0];
  if (!invite) throw new Error("Invitation non trouvée ou lien invalide.");

  if (invite.status === "ACCEPTED") throw new Error("Cette invitation a déjà été acceptée.");
  if (invite.status === "REVOKED") throw new Error("Cette invitation a été révoquée.");
  if (invite.status === "EXPIRED" || (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())) {
    // Auto-expire if not already
    if (invite.status !== "EXPIRED") {
      await db.update(invites).set({ status: "EXPIRED" }).where(eq(invites.uid, invite.uid));
    }
    throw new Error("Cette invitation a expiré.");
  }

  // 2. Mark invite as accepted
  const now = new Date();
  await db.update(invites).set({ status: "ACCEPTED", acceptedAt: now }).where(eq(invites.uid, invite.uid));

  // 3. Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Create or activate user
  const openId = `invite_${invite.uid}`;
  const mapRole = invite.role === "ADMIN" ? "admin" as const : "user" as const;

  // Check if user already exists by email
  const existingUsers = await db.select().from(users).where(eq(users.email, invite.email)).limit(1);
  let userId: number;

  if (existingUsers.length > 0) {
    // Activate existing user
    userId = existingUsers[0].id;
    await db.update(users).set({
      fullName,
      passwordHash,
      status: "ACTIVE",
      role: mapRole,
    }).where(eq(users.id, userId));
  } else {
    // Create new user
    const result = await db.insert(users).values({
      openId,
      name: fullName,
      email: invite.email,
      fullName,
      loginMethod: "invite",
      role: mapRole,
      status: "ACTIVE",
      passwordHash,
      lastSignedIn: now,
    });
    userId = result[0].insertId;
  }

  // 5. Return updated invite
  const updatedInvite = await getInviteByUid(invite.uid);
  return {
    invite: updatedInvite,
    user: { id: userId, email: invite.email, fullName, role: mapRole },
  };
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

// ══════════════════════════════════════════════════════════════════════════
// USERS MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

type UserRole = "admin" | "manager" | "viewer" | "user";
type UserStatus = "ACTIVE" | "DISABLED" | "INVITED";

export async function listUsers(filters?: {
  search?: string;
  role?: string;
  status?: UserStatus;
}) {
  const db = await getDb();
  if (!db) return [];

  // --- 1. Fetch real users from the users table ---
  let userResults: any[] = [];
  const onlyInvited = filters?.status === "INVITED";

  if (!onlyInvited) {
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(users.status, filters.status));
    if (filters?.role) {
      const dbRole = filters.role.toLowerCase() as UserRole;
      conditions.push(eq(users.role, dbRole));
    }

    let query;
    if (conditions.length > 0) {
      query = db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt));
    } else {
      query = db.select().from(users).orderBy(desc(users.createdAt));
    }
    userResults = await query;
  }

  // --- 2. Fetch PENDING invitations and merge as virtual "INVITED" users ---
  const shouldIncludeInvited = !filters?.status || filters.status === "INVITED";
  let inviteResults: any[] = [];

  if (shouldIncludeInvited) {
    const inviteConditions: any[] = [eq(invites.status, "PENDING")];
    if (filters?.role) {
      inviteConditions.push(eq(invites.role, filters.role.toUpperCase() as any));
    }

    inviteResults = await db.select().from(invites)
      .where(inviteConditions.length > 1 ? and(...inviteConditions) : inviteConditions[0])
      .orderBy(desc(invites.createdAt));
  }

  // Map invites to virtual user rows
  const inviteAsUsers = inviteResults.map((inv: any) => ({
    id: -inv.id, // negative ID to distinguish from real users
    openId: `invite_${inv.uid}`,
    name: inv.email.split("@")[0], // use email prefix as name
    email: inv.email,
    fullName: inv.email.split("@")[0],
    loginMethod: "invite",
    role: inv.role ? inv.role.toLowerCase() : "viewer",
    status: "INVITED" as const,
    passwordHash: null,
    createdAt: inv.createdAt,
    updatedAt: inv.createdAt,
    lastSignedIn: inv.createdAt,
    // Extra invite metadata
    _inviteUid: inv.uid,
    _inviteRole: inv.role,
    _invitedBy: inv.invitedByName,
    _expiresAt: inv.expiresAt,
  }));

  // Merge: real users first, then invited users
  let combined = [...userResults, ...inviteAsUsers];

  // --- 3. Apply search filter in-memory (name/email) ---
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    combined = combined.filter((r: any) =>
      (r.fullName && r.fullName.toLowerCase().includes(q)) ||
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q))
    );
  }

  return combined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function createUser(data: {
  fullName: string;
  email: string;
  role: string;
  password?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check email uniqueness
  const existing = await getUserByEmail(data.email);
  if (existing) throw new Error(`L'email ${data.email} est déjà utilisé.`);

  const dbRole = data.role.toLowerCase() as UserRole;
  const openId = `local_${uuid()}`;
  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

  await db.insert(users).values({
    openId,
    fullName: data.fullName,
    name: data.fullName,
    email: data.email,
    role: dbRole,
    status: "ACTIVE",
    loginMethod: "local",
    passwordHash,
  });

  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function updateUser(id: number, data: {
  fullName?: string;
  email?: string;
  role?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {};
  if (data.fullName) {
    updateSet.full_name = data.fullName;
    updateSet.name = data.fullName;
  }
  if (data.email) updateSet.email = data.email;
  if (data.role) updateSet.role = data.role.toLowerCase();

  if (Object.keys(updateSet).length === 0) throw new Error("Aucun champ à mettre à jour");

  await db.update(users).set(updateSet as any).where(eq(users.id, id));
  return getUserById(id);
}

export async function disableUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ status: "DISABLED" } as any).where(eq(users.id, id));
  return getUserById(id);
}

export async function enableUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ status: "ACTIVE" } as any).where(eq(users.id, id));
  return getUserById(id);
}

export async function resetUserPassword(id: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const hash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash: hash } as any).where(eq(users.id, id));
  return { success: true, message: "Mot de passe réinitialisé avec succès" };
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify user exists
  const user = await getUserById(id);
  if (!user) throw new Error("Utilisateur introuvable");

  // Delete related records first (cascade)
  // userId in userRoles and projectMemberships is varchar, so convert id to string
  const userIdStr = String(id);
  await db.delete(userRoles).where(eq(userRoles.userId, userIdStr));
  await db.delete(projectMemberships).where(eq(projectMemberships.userId, userIdStr));

  // Delete the user
  await db.delete(users).where(eq(users.id, id));

  return { success: true, message: `Utilisateur ${user.email || user.name} supprimé` };
}
