import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import {
  viewerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation,
} from "../rbac/middleware";
import * as adminDb from "../db/admin";
import { paginationInput, paginate, paginateInMemory, dateRangeFilter } from "../pagination";
import { getDb } from "../db";
import { auditLogs, invites } from "../../drizzle/schema";

// ─── Allowed sort fields ─────────────────────────────────────────────────
const AUDIT_SORT_FIELDS = ["timestamp", "action", "entityType", "actorName"];
const INVITE_SORT_FIELDS = ["createdAt", "email", "status"];

export const adminRouter = router({
  // ══════════════════════════════════════════════════
  //  Invites — SQL-native pagination, ORG_ADMIN only
  // ══════════════════════════════════════════════════
  listInvites: orgAdminProcedure
    .input(z.object({
      status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]).optional(),
    }).merge(paginationInput))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      const where: any[] = [];
      if (input.status) where.push(eq(invites.status, input.status));

      return paginate(
        db.select().from(invites).$dynamic(),
        invites,
        input,
        {
          allowedSortFields: INVITE_SORT_FIELDS,
          defaultSort: { by: "createdAt", dir: "desc" },
          where: where.length > 0 ? where : undefined,
        },
      );
    }),

  getInviteByToken: viewerProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => adminDb.getInviteByToken(input.token)),

  // ── Public endpoints for invitation acceptance (no auth required) ──
  validateInviteToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const invite = await adminDb.getInviteByToken(input.token);
      if (!invite) return { valid: false, reason: "invalid" as const, invite: null };
      if (invite.status === "ACCEPTED") return { valid: false, reason: "already" as const, invite: { email: invite.email, role: invite.role, invitedByName: invite.invitedByName } };
      if (invite.status === "REVOKED") return { valid: false, reason: "revoked" as const, invite: null };
      if (invite.status === "EXPIRED" || (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())) {
        return { valid: false, reason: "expired" as const, invite: { email: invite.email, invitedByName: invite.invitedByName, expiresAt: invite.expiresAt } };
      }
      return {
        valid: true,
        reason: "ok" as const,
        invite: { email: invite.email, role: invite.role, invitedByName: invite.invitedByName, expiresAt: invite.expiresAt },
      };
    }),

  acceptInvite: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      fullName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
      password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
    }))
    .mutation(({ input }) => adminDb.acceptInvite(input.token, input.fullName, input.password)),

  createInvite: orgAdminProcedure
    .use(auditMutation("CREATE", "invite"))
    .input(z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "MANAGER", "VIEWER"]).optional(),
      invitedBy: z.string().optional(),
      invitedByName: z.string().optional(),
      expiresAt: z.coerce.date(),
    }))
    .mutation(({ input }) => adminDb.createInvite(input)),

  updateInviteStatus: orgAdminProcedure
    .use(auditMutation("UPDATE_STATUS", "invite"))
    .input(z.object({
      uid: z.string(),
      status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]),
      acceptedAt: z.coerce.date().optional(),
    }))
    .mutation(({ input }) => adminDb.updateInviteStatus(input.uid, input.status, input.acceptedAt)),

  revokeInvite: orgAdminProcedure
    .use(auditMutation("REVOKE", "invite"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => adminDb.revokeInvite(input.uid)),

  // ══════════════════════════════════════════════════
  //  Project Memberships — paginated
  // ══════════════════════════════════════════════════
  listProjectMemberships: qaManagerProcedure
    .input(z.object({ projectId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await adminDb.listProjectMemberships(input.projectId);
      return paginateInMemory(all, input);
    }),

  listUserMemberships: qaManagerProcedure
    .input(z.object({ userId: z.string() }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await adminDb.listUserMemberships(input.userId);
      return paginateInMemory(all, input);
    }),

  createMembership: orgAdminProcedure
    .use(auditMutation("CREATE", "project_membership"))
    .input(z.object({
      projectId: z.string(), userId: z.string(),
      projectName: z.string().optional(), userEmail: z.string().optional(),
      userName: z.string().optional(),
      projectRole: z.enum(["PROJECT_ADMIN", "PROJECT_EDITOR", "PROJECT_VIEWER"]).optional(),
      addedBy: z.string().optional(),
    }))
    .mutation(({ input }) => adminDb.createMembership(input)),

  updateMembership: orgAdminProcedure
    .use(auditMutation("UPDATE", "project_membership"))
    .input(z.object({
      uid: z.string(),
      projectRole: z.enum(["PROJECT_ADMIN", "PROJECT_EDITOR", "PROJECT_VIEWER"]).optional(),
    }))
    .mutation(({ input }) => { const { uid, ...d } = input; return adminDb.updateMembership(uid, d); }),

  deleteMembership: orgAdminProcedure
    .use(auditMutation("DELETE", "project_membership"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => adminDb.deleteMembership(input.uid)),

  // ══════════════════════════════════════════════════
  //  Roles (RBAC) — ORG_ADMIN only
  // ══════════════════════════════════════════════════
  listRoles: qaManagerProcedure.query(() => adminDb.listRoles()),

  getRole: qaManagerProcedure
    .input(z.object({ uid: z.string() }))
    .query(({ input }) => adminDb.getRoleByUid(input.uid)),

  createRole: orgAdminProcedure
    .use(auditMutation("CREATE", "role"))
    .input(z.object({
      name: z.string().min(1), description: z.string().optional(),
      scope: z.enum(["GLOBAL", "PROJECT"]).optional(),
      isSystem: z.boolean().optional(),
    }))
    .mutation(({ input }) => adminDb.createRole(input)),

  updateRole: orgAdminProcedure
    .use(auditMutation("UPDATE", "role"))
    .input(z.object({
      uid: z.string(), name: z.string().optional(),
      description: z.string().optional(),
      scope: z.enum(["GLOBAL", "PROJECT"]).optional(),
    }))
    .mutation(({ input }) => { const { uid, ...d } = input; return adminDb.updateRole(uid, d); }),

  deleteRole: orgAdminProcedure
    .use(auditMutation("DELETE", "role"))
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => adminDb.deleteRole(input.uid)),

  // ══════════════════════════════════════════════════
  //  Permissions — ORG_ADMIN only
  // ══════════════════════════════════════════════════
  listPermissions: qaManagerProcedure.query(() => adminDb.listPermissions()),

  createPermission: orgAdminProcedure
    .use(auditMutation("CREATE", "permission"))
    .input(z.object({
      module: z.string(), action: z.string(), description: z.string().optional(),
    }))
    .mutation(({ input }) => adminDb.createPermission(input)),

  // ══════════════════════════════════════════════════
  //  Role-Permission Mapping — ORG_ADMIN only
  // ══════════════════════════════════════════════════
  getRolePermissions: qaManagerProcedure
    .input(z.object({ roleId: z.string() }))
    .query(({ input }) => adminDb.getRolePermissions(input.roleId)),

  addPermissionToRole: orgAdminProcedure
    .use(auditMutation("ADD_PERMISSION", "role"))
    .input(z.object({ roleId: z.string(), permissionId: z.string() }))
    .mutation(({ input }) => adminDb.addPermissionToRole(input.roleId, input.permissionId)),

  removePermissionFromRole: orgAdminProcedure
    .use(auditMutation("REMOVE_PERMISSION", "role"))
    .input(z.object({ roleId: z.string(), permissionId: z.string() }))
    .mutation(({ input }) => adminDb.removePermissionFromRole(input.roleId, input.permissionId)),

  // ══════════════════════════════════════════════════
  //  User-Role Mapping — ORG_ADMIN only
  // ══════════════════════════════════════════════════
  getUserRoles: qaManagerProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => adminDb.getUserRoles(input.userId)),

  addRoleToUser: orgAdminProcedure
    .use(auditMutation("ADD_ROLE", "user"))
    .input(z.object({ userId: z.string(), roleId: z.string() }))
    .mutation(({ input }) => adminDb.addRoleToUser(input.userId, input.roleId)),

  removeRoleFromUser: orgAdminProcedure
    .use(auditMutation("REMOVE_ROLE", "user"))
    .input(z.object({ userId: z.string(), roleId: z.string() }))
    .mutation(({ input }) => adminDb.removeRoleFromUser(input.userId, input.roleId)),

  // ══════════════════════════════════════════════════
  //  Audit Logs — SQL-native pagination + filters (high volume)
  // ══════════════════════════════════════════════════
  listAuditLogs: qaManagerProcedure
    .input(z.object({
      actorId: z.string().optional(),
      entityType: z.string().optional(),
      action: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).merge(paginationInput))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };

      const where: any[] = [];
      if (input.actorId) where.push(eq(auditLogs.actorId, input.actorId));
      if (input.entityType) where.push(eq(auditLogs.entityType, input.entityType));
      if (input.action) where.push(eq(auditLogs.action, input.action));
      where.push(...dateRangeFilter(auditLogs.timestamp, input.dateFrom, input.dateTo));

      return paginate(
        db.select().from(auditLogs).$dynamic(),
        auditLogs,
        input,
        {
          allowedSortFields: AUDIT_SORT_FIELDS,
          defaultSort: { by: "timestamp", dir: "desc" },
          where: where.length > 0 ? where : undefined,
        },
      );
    }),

  createAuditLog: orgAdminProcedure
    .input(z.object({
      actorId: z.string().optional(), actorName: z.string().optional(),
      actorEmail: z.string().optional(), action: z.string(),
      entityType: z.string(), entityId: z.string().optional(),
      targetLabel: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      traceId: z.string().optional(),
    }))
    .mutation(({ input }) => adminDb.createAuditLog(input)),

  // ══════════════════════════════════════════════════
  //  Users Management — ORG_ADMIN only
  // ══════════════════════════════════════════════════
  listUsers: orgAdminProcedure
    .input(z.object({
      search: z.string().optional(),
      role: z.string().optional(),
      status: z.enum(["ACTIVE", "DISABLED", "INVITED"]).optional(),
    }).merge(paginationInput))
    .query(async ({ input }) => {
      const all = await adminDb.listUsers({
        search: input.search,
        role: input.role,
        status: input.status,
      });
      return paginateInMemory(all, input);
    }),

  getUser: orgAdminProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => adminDb.getUserById(input.id)),

  createUser: orgAdminProcedure
    .use(auditMutation("CREATE", "user"))
    .input(z.object({
      fullName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
      email: z.string().email("Adresse email invalide"),
      role: z.enum(["ADMIN", "MANAGER", "VIEWER"]),
      password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").optional(),
    }))
    .mutation(({ input }) => adminDb.createUser(input)),

  updateUser: orgAdminProcedure
    .use(auditMutation("UPDATE", "user"))
    .input(z.object({
      id: z.number(),
      fullName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      role: z.enum(["ADMIN", "MANAGER", "VIEWER"]).optional(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return adminDb.updateUser(id, data);
    }),

  disableUser: orgAdminProcedure
    .use(auditMutation("DISABLE", "user"))
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => adminDb.disableUser(input.id)),

  enableUser: orgAdminProcedure
    .use(auditMutation("ENABLE", "user"))
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => adminDb.enableUser(input.id)),

  resetUserPassword: orgAdminProcedure
    .use(auditMutation("PASSWORD_RESET", "user"))
    .input(z.object({
      id: z.number(),
      newPassword: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    }))
    .mutation(({ input }) => adminDb.resetUserPassword(input.id, input.newPassword)),

  deleteUser: orgAdminProcedure
    .use(auditMutation("DELETE", "user"))
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => adminDb.deleteUser(input.id)),
});
