import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { resolveAppRoles, type AppRole } from "./rbac/middleware";
import * as adminDb from "./db/admin";

// Feature routers
import { notificationsRouter } from "./routers/notifications";
import { projectsRouter } from "./routers/projects";
import { profilesRouter } from "./routers/profiles";
import { scenariosRouter } from "./routers/scenarios";
import { datasetsRouter } from "./routers/datasets";
import { executionsRouter } from "./routers/executions";
import { capturesRouter } from "./routers/captures";
import { probesRouter } from "./routers/probes";
import { drivetestRouter } from "./routers/drivetest";
import { adminRouter } from "./routers/admin";
import { notifSettingsRouter } from "./routers/notifSettings";

// ═══════════════════════════════════════════════════════════════════════════
// ROLE HIERARCHY for permission derivation
// ═══════════════════════════════════════════════════════════════════════════
const ROLE_HIERARCHY: Record<AppRole, number> = {
  VIEWER: 0,
  TEST_ENGINEER: 1,
  SECURITY_ANALYST: 2,
  QA_MANAGER: 3,
  ORG_ADMIN: 4,
};

function getEffectiveRole(roles: AppRole[]): AppRole {
  let highest: AppRole = "VIEWER";
  for (const r of roles) {
    if (ROLE_HIERARCHY[r] > ROLE_HIERARCHY[highest]) highest = r;
  }
  return highest;
}

export const appRouter = router({
  // System
  system: systemRouter,
  auth: router({
    /**
     * auth.me — returns current user with resolved RBAC roles & permissions.
     * Cookie HTTPOnly session is verified automatically by context.ts.
     * Returns null if not authenticated (no token/expired).
     */
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;

      const user = ctx.user;
      const appRoles = await resolveAppRoles(user.openId, user.role);
      const effectiveRole = getEffectiveRole(appRoles);

      // Resolve permissions from role_permissions
      let permissions: string[] = [];
      try {
        const allRoles = await adminDb.listRoles();
        const userRoleIds = appRoles
          .map(rName => allRoles.find(r => r.name === rName)?.uid)
          .filter(Boolean) as string[];
        if (userRoleIds.length > 0) {
          const allPerms = await adminDb.listPermissions();
          const permIdSet = new Set<string>();
          for (const roleId of userRoleIds) {
            const rolePerms = await adminDb.getRolePermissions(roleId);
            for (const rp of rolePerms) {
              permIdSet.add(rp.permissionId);
            }
          }
          permissions = allPerms
            .filter(p => permIdSet.has(p.uid))
            .map(p => `${p.module}.${p.action}`);
        }
      } catch {
        // permissions table may not be populated yet
      }

      return {
        // Core user fields
        id: String(user.id),
        openId: user.openId,
        email: user.email ?? "",
        full_name: user.fullName ?? user.name ?? "",
        name: user.name ?? "",
        status: user.status,
        loginMethod: user.loginMethod,
        createdAt: user.createdAt?.toISOString() ?? "",
        updatedAt: user.updatedAt?.toISOString() ?? "",
        lastSignedIn: user.lastSignedIn?.toISOString() ?? "",
        // RBAC fields
        role: effectiveRole,
        appRoles,
        effectiveRole,
        permissions,
        // Convenience booleans
        isAdmin: effectiveRole === "ORG_ADMIN",
        canWrite: ROLE_HIERARCHY[effectiveRole] >= ROLE_HIERARCHY["TEST_ENGINEER"],
        isActive: user.status === "ACTIVE",
      };
    }),
    /**
     * auth.logout — clears the session cookie.
     * Also clears any localStorage remnants on the client side.
     */
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Core modules
  projects: projectsRouter,
  profiles: profilesRouter,
  scenarios: scenariosRouter,
  datasets: datasetsRouter,
  executions: executionsRouter,

  // Captures & Probes
  captures: capturesRouter,
  probes: probesRouter,

  // Drive Test
  drivetest: drivetestRouter,

  // Admin (RBAC, Invites, Audit)
  admin: adminRouter,

  // Notifications (SMTP email, settings, templates, rules, delivery)
  notifications: notificationsRouter,
  notifSettings: notifSettingsRouter,
});

export type AppRouter = typeof appRouter;
