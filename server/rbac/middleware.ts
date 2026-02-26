/**
 * RBAC Middleware for tRPC — AgilesTest
 *
 * Provides composable middlewares:
 *   requireAuth()          — user must be authenticated
 *   requireRole(...roles)  — user must hold one of the listed application roles
 *   requirePermission(...) — user must hold a specific permission (module.action)
 *   requireProjectAccess() — multi-tenant: user must be a member of the target project
 *   auditMutation()        — automatically log mutations to audit_logs
 *
 * Application roles (resolved from user_roles + roles tables):
 *   ORG_ADMIN, QA_MANAGER, TEST_ENGINEER, SECURITY_ANALYST, VIEWER
 *
 * Fallback: users.role === 'admin' is treated as ORG_ADMIN.
 */

import { TRPCError } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "../_core/context";
import { ENV } from "../_core/env";
import * as adminDb from "../db/admin";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Application-level roles (not the DB enum which is just user/admin) */
export type AppRole =
  | "ORG_ADMIN"
  | "QA_MANAGER"
  | "TEST_ENGINEER"
  | "SECURITY_ANALYST"
  | "VIEWER";

/** Project-level roles from project_memberships */
export type ProjectRole = "PROJECT_ADMIN" | "PROJECT_EDITOR" | "PROJECT_VIEWER";

/** Resolved RBAC context injected by middlewares */
export interface RbacContext {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  appRoles: AppRole[];
  /** Highest effective role for quick checks */
  effectiveRole: AppRole;
}

/** Context after project access check */
export interface ProjectRbacContext extends RbacContext {
  projectId: string;
  projectRole: ProjectRole;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE HIERARCHY (higher index = more privileges)
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_HIERARCHY: Record<AppRole, number> = {
  VIEWER: 0,
  TEST_ENGINEER: 1,
  SECURITY_ANALYST: 2,
  QA_MANAGER: 3,
  ORG_ADMIN: 4,
};

const PROJECT_ROLE_HIERARCHY: Record<ProjectRole, number> = {
  PROJECT_VIEWER: 0,
  PROJECT_EDITOR: 1,
  PROJECT_ADMIN: 2,
};

// ═══════════════════════════════════════════════════════════════════════════
// ROLE RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/** In-memory cache for user roles (TTL 60s) */
const roleCache = new Map<string, { roles: AppRole[]; ts: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Resolve application roles for a user.
 * 1. Query user_roles → roles tables
 * 2. Fallback: users.role === 'admin' → ORG_ADMIN
 * 3. Default: VIEWER
 */
export async function resolveAppRoles(userId: string, dbRole?: string): Promise<AppRole[]> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.roles;
  }

  const appRoles: AppRole[] = [];

  try {
    // Query user_roles → join roles to get role names
    const userRoleRows = await adminDb.getUserRoles(userId);
    if (userRoleRows.length > 0) {
      const allRoles = await adminDb.listRoles();
      const roleMap = new Map(allRoles.map(r => [r.uid, r.name]));
      for (const ur of userRoleRows) {
        const roleName = roleMap.get(ur.roleId);
        if (roleName && isAppRole(roleName)) {
          appRoles.push(roleName);
        }
      }
    }
  } catch {
    // DB not available — fall through to fallback
  }

  // Fallback 1: App owner (OWNER_OPEN_ID) is always ORG_ADMIN
  if (ENV.ownerOpenId && userId === ENV.ownerOpenId && !appRoles.includes("ORG_ADMIN")) {
    appRoles.push("ORG_ADMIN");
  }

  // Fallback 2: users.role === 'admin' → ORG_ADMIN
  if (dbRole === "admin" && !appRoles.includes("ORG_ADMIN")) {
    appRoles.push("ORG_ADMIN");
  }

  // Default: at least VIEWER
  if (appRoles.length === 0) {
    appRoles.push("VIEWER");
  }

  roleCache.set(userId, { roles: appRoles, ts: Date.now() });
  return appRoles;
}

function isAppRole(name: string): name is AppRole {
  return name in ROLE_HIERARCHY;
}

function getEffectiveRole(roles: AppRole[]): AppRole {
  let highest: AppRole = "VIEWER";
  for (const r of roles) {
    if (ROLE_HIERARCHY[r] > ROLE_HIERARCHY[highest]) {
      highest = r;
    }
  }
  return highest;
}

/** Clear role cache for a user (call after role changes) */
export function invalidateRoleCache(userId?: string) {
  if (userId) {
    roleCache.delete(userId);
  } else {
    roleCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT ACCESS RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a user has access to a specific project.
 * ORG_ADMIN bypasses membership check.
 */
export async function resolveProjectAccess(
  userId: string,
  projectId: string,
  effectiveRole: AppRole
): Promise<ProjectRole | null> {
  // ORG_ADMIN has full access to all projects
  if (effectiveRole === "ORG_ADMIN") {
    return "PROJECT_ADMIN";
  }

  try {
    const memberships = await adminDb.listUserMemberships(userId);
    const membership = memberships.find(m => m.projectId === projectId);
    if (membership) {
      return membership.projectRole as ProjectRole;
    }
  } catch {
    // DB not available
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════

/** In-memory cache for role→permissions (TTL 60s) */
const permCache = new Map<string, { perms: string[]; ts: number }>();

/**
 * Resolve permissions for a set of role UIDs.
 * Returns array of "module.action" strings.
 */
export async function resolvePermissions(roleUids: string[]): Promise<string[]> {
  const cacheKey = roleUids.sort().join(",");
  const cached = permCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.perms;
  }

  const allPerms: string[] = [];
  try {
    const allPermissions = await adminDb.listPermissions();
    const permMap = new Map(allPermissions.map(p => [p.uid, `${p.module}.${p.action}`]));

    for (const roleUid of roleUids) {
      const rps = await adminDb.getRolePermissions(roleUid);
      for (const rp of rps) {
        const permStr = permMap.get(rp.permissionId);
        if (permStr && !allPerms.includes(permStr)) {
          allPerms.push(permStr);
        }
      }
    }
  } catch {
    // DB not available
  }

  permCache.set(cacheKey, { perms: allPerms, ts: Date.now() });
  return allPerms;
}

/** Clear permission cache */
export function invalidatePermCache() {
  permCache.clear();
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT HELPER
// ═══════════════════════════════════════════════════════════════════════════

export async function logAudit(data: {
  actorId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  targetLabel?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await adminDb.createAuditLog({
      actorId: data.actorId,
      actorName: data.actorName ?? undefined,
      actorEmail: data.actorEmail ?? undefined,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      targetLabel: data.targetLabel,
      metadata: data.metadata,
    });
  } catch {
    // Audit logging should never block the main operation
    console.error("[RBAC] Failed to write audit log", data.action, data.entityType);
  }
}

export async function logAccessDenied(data: {
  actorId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await adminDb.createAuditLog({
      actorId: data.actorId,
      actorName: data.actorName ?? undefined,
      actorEmail: data.actorEmail ?? undefined,
      action: "ACCESS_DENIED",
      entityType: data.entityType,
      entityId: undefined,
      targetLabel: `${data.action} — ${data.reason}`,
      metadata: { attemptedAction: data.action, reason: data.reason, ...data.metadata },
    });
  } catch {
    console.error("[RBAC] Failed to write access denied log", data.action);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// tRPC MIDDLEWARE FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

/**
 * requireAuth — Ensures user is authenticated and resolves RBAC context.
 * Injects `ctx.rbac` with userId, appRoles, effectiveRole.
 */
export const requireAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required (10001)",
    });
  }

  const appRoles = await resolveAppRoles(ctx.user.openId, ctx.user.role);
  const effectiveRole = getEffectiveRole(appRoles);

  const rbac: RbacContext = {
    userId: ctx.user.openId,
    userName: ctx.user.name ?? ctx.user.fullName ?? null,
    userEmail: ctx.user.email ?? null,
    appRoles,
    effectiveRole,
  };

  return next({ ctx: { ...ctx, user: ctx.user, rbac } });
});

/**
 * requireRole — Checks that the user holds at least one of the specified roles.
 * Must be chained after requireAuth.
 */
export function requireRole(...allowedRoles: AppRole[]) {
  return t.middleware(async ({ ctx, next }) => {
    const rbac = (ctx as any).rbac as RbacContext | undefined;
    if (!rbac) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RBAC context missing" });
    }

    const hasRole = rbac.appRoles.some(r => allowedRoles.includes(r));
    if (!hasRole) {
      // Log access denied
      await logAccessDenied({
        actorId: rbac.userId,
        actorName: rbac.userName,
        actorEmail: rbac.userEmail,
        action: "requireRole",
        entityType: "rbac",
        reason: `Required roles: [${allowedRoles.join(", ")}], user has: [${rbac.appRoles.join(", ")}]`,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Insufficient role. Required: ${allowedRoles.join(" or ")} (10002)`,
      });
    }

    return next({ ctx });
  });
}

/**
 * requirePermission — Checks that the user holds specific permissions (module.action).
 * Must be chained after requireAuth.
 */
export function requirePermission(...requiredPerms: string[]) {
  return t.middleware(async ({ ctx, next }) => {
    const rbac = (ctx as any).rbac as RbacContext | undefined;
    if (!rbac) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RBAC context missing" });
    }

    // ORG_ADMIN bypasses permission checks
    if (rbac.effectiveRole === "ORG_ADMIN") {
      return next({ ctx });
    }

    // Resolve role UIDs for this user
    let roleUids: string[] = [];
    try {
      const userRoleRows = await adminDb.getUserRoles(rbac.userId);
      roleUids = userRoleRows.map(ur => ur.roleId);
    } catch {
      // DB not available — deny
    }

    const userPerms = await resolvePermissions(roleUids);
    const missing = requiredPerms.filter(p => !userPerms.includes(p));

    if (missing.length > 0) {
      await logAccessDenied({
        actorId: rbac.userId,
        actorName: rbac.userName,
        actorEmail: rbac.userEmail,
        action: "requirePermission",
        entityType: "rbac",
        reason: `Missing permissions: [${missing.join(", ")}]`,
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permissions: ${missing.join(", ")} (10003)`,
      });
    }

    return next({ ctx });
  });
}

/**
 * requireProjectAccess — Multi-tenant enforcement.
 * Checks that the user is a member of the target project.
 * Expects input.projectId to be present.
 * Must be chained after requireAuth.
 */
export function requireProjectAccess(minProjectRole: ProjectRole = "PROJECT_VIEWER") {
  return t.middleware(async ({ ctx, input, next }) => {
    const rbac = (ctx as any).rbac as RbacContext | undefined;
    if (!rbac) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RBAC context missing" });
    }

    // Extract projectId from input (supports various shapes)
    const inp = input as Record<string, unknown> | undefined;
    const projectId = inp?.projectId as string | undefined;

    if (!projectId) {
      // No projectId in input — skip project-level check (global endpoints)
      return next({ ctx });
    }

    const projectRole = await resolveProjectAccess(rbac.userId, projectId, rbac.effectiveRole);

    if (!projectRole) {
      await logAccessDenied({
        actorId: rbac.userId,
        actorName: rbac.userName,
        actorEmail: rbac.userEmail,
        action: "requireProjectAccess",
        entityType: "project",
        reason: `No membership for project ${projectId}`,
        metadata: { projectId },
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Access denied to project ${projectId} (10004)`,
      });
    }

    // Check minimum project role
    if (PROJECT_ROLE_HIERARCHY[projectRole] < PROJECT_ROLE_HIERARCHY[minProjectRole]) {
      await logAccessDenied({
        actorId: rbac.userId,
        actorName: rbac.userName,
        actorEmail: rbac.userEmail,
        action: "requireProjectAccess",
        entityType: "project",
        reason: `Required project role: ${minProjectRole}, user has: ${projectRole}`,
        metadata: { projectId, projectRole, minProjectRole },
      });

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Insufficient project role. Required: ${minProjectRole} (10005)`,
      });
    }

    const projectRbac: ProjectRbacContext = {
      ...rbac,
      projectId,
      projectRole,
    };

    return next({ ctx: { ...ctx, rbac: projectRbac } });
  });
}

/**
 * auditMutation — Logs successful mutations to audit_logs.
 * Must be chained after requireAuth.
 */
export function auditMutation(action: string, entityType: string) {
  return t.middleware(async ({ ctx, input, next }) => {
    const result = await next({ ctx });

    // Log after successful execution
    const rbac = (ctx as any).rbac as RbacContext | undefined;
    if (rbac) {
      const inp = input as Record<string, unknown> | undefined;
      const entityId = (inp?.uid ?? inp?.id ?? inp?.projectId) as string | undefined;
      const targetLabel = (inp?.name ?? inp?.email ?? inp?.templateId) as string | undefined;

      await logAudit({
        actorId: rbac.userId,
        actorName: rbac.userName,
        actorEmail: rbac.userEmail,
        action,
        entityType,
        entityId,
        targetLabel,
        metadata: inp ? { input: inp } : undefined,
      });
    }

    return result;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSABLE PROCEDURE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

/** Base authenticated procedure with RBAC context */
export const authedProcedure = t.procedure.use(requireAuth);

/** Procedure restricted to ORG_ADMIN */
export const orgAdminProcedure = authedProcedure
  .use(requireRole("ORG_ADMIN"));

/** Procedure restricted to QA_MANAGER or higher */
export const qaManagerProcedure = authedProcedure
  .use(requireRole("ORG_ADMIN", "QA_MANAGER"));

/** Procedure restricted to TEST_ENGINEER or higher */
export const testEngineerProcedure = authedProcedure
  .use(requireRole("ORG_ADMIN", "QA_MANAGER", "TEST_ENGINEER"));

/** Procedure restricted to SECURITY_ANALYST or higher */
export const securityAnalystProcedure = authedProcedure
  .use(requireRole("ORG_ADMIN", "SECURITY_ANALYST"));

/** Procedure for read-only access (any authenticated user) */
export const viewerProcedure = authedProcedure
  .use(requireRole("ORG_ADMIN", "QA_MANAGER", "TEST_ENGINEER", "SECURITY_ANALYST", "VIEWER"));

// Re-export for convenience
export { t as trpcInstance, TRPCError };
