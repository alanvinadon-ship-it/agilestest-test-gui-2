import { z } from "zod";
import { router } from "../_core/trpc";
import {
  viewerProcedure, qaManagerProcedure, orgAdminProcedure,
  auditMutation,
} from "../rbac/middleware";
import * as adminDb from "../db/admin";

export const adminRouter = router({
  // ══════════════════════════════════════════════════
  //  Invites — ORG_ADMIN only (manage users)
  // ══════════════════════════════════════════════════
  listInvites: orgAdminProcedure
    .input(z.object({ status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]).optional() }))
    .query(({ input }) => adminDb.listInvites(input.status)),

  getInviteByToken: viewerProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => adminDb.getInviteByToken(input.token)),

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
  //  Project Memberships — ORG_ADMIN only
  // ══════════════════════════════════════════════════
  listProjectMemberships: qaManagerProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => adminDb.listProjectMemberships(input.projectId)),

  listUserMemberships: qaManagerProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => adminDb.listUserMemberships(input.userId)),

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
  //  Audit Logs — QA_MANAGER+ can read, only system can write
  // ══════════════════════════════════════════════════
  listAuditLogs: qaManagerProcedure
    .input(z.object({
      actorId: z.string().optional(), entityType: z.string().optional(),
      action: z.string().optional(), limit: z.number().optional(),
    }))
    .query(({ input }) => adminDb.listAuditLogs(input)),

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
});
