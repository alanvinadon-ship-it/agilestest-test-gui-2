import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as adminDb from "../db/admin";

export const adminRouter = router({
  // ── Invites ──
  listInvites: protectedProcedure
    .input(z.object({ status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]).optional() }))
    .query(({ input }) => adminDb.listInvites(input.status)),

  getInviteByToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => adminDb.getInviteByToken(input.token)),

  createInvite: protectedProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(["ADMIN", "MANAGER", "VIEWER"]).optional(),
      invitedBy: z.string().optional(),
      invitedByName: z.string().optional(),
      expiresAt: z.coerce.date(),
    }))
    .mutation(({ input }) => adminDb.createInvite(input)),

  updateInviteStatus: protectedProcedure
    .input(z.object({
      uid: z.string(),
      status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]),
      acceptedAt: z.coerce.date().optional(),
    }))
    .mutation(({ input }) => adminDb.updateInviteStatus(input.uid, input.status, input.acceptedAt)),

  revokeInvite: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => adminDb.revokeInvite(input.uid)),

  // ── Project Memberships ──
  listProjectMemberships: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => adminDb.listProjectMemberships(input.projectId)),

  listUserMemberships: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => adminDb.listUserMemberships(input.userId)),

  createMembership: protectedProcedure
    .input(z.object({
      projectId: z.string(), userId: z.string(),
      projectName: z.string().optional(), userEmail: z.string().optional(),
      userName: z.string().optional(),
      projectRole: z.enum(["PROJECT_ADMIN", "PROJECT_EDITOR", "PROJECT_VIEWER"]).optional(),
      addedBy: z.string().optional(),
    }))
    .mutation(({ input }) => adminDb.createMembership(input)),

  updateMembership: protectedProcedure
    .input(z.object({
      uid: z.string(),
      projectRole: z.enum(["PROJECT_ADMIN", "PROJECT_EDITOR", "PROJECT_VIEWER"]).optional(),
    }))
    .mutation(({ input }) => { const { uid, ...d } = input; return adminDb.updateMembership(uid, d); }),

  deleteMembership: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => adminDb.deleteMembership(input.uid)),

  // ── Roles (RBAC) ──
  listRoles: protectedProcedure.query(() => adminDb.listRoles()),

  getRole: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .query(({ input }) => adminDb.getRoleByUid(input.uid)),

  createRole: protectedProcedure
    .input(z.object({
      name: z.string().min(1), description: z.string().optional(),
      scope: z.enum(["GLOBAL", "PROJECT"]).optional(),
      isSystem: z.boolean().optional(),
    }))
    .mutation(({ input }) => adminDb.createRole(input)),

  updateRole: protectedProcedure
    .input(z.object({
      uid: z.string(), name: z.string().optional(),
      description: z.string().optional(),
      scope: z.enum(["GLOBAL", "PROJECT"]).optional(),
    }))
    .mutation(({ input }) => { const { uid, ...d } = input; return adminDb.updateRole(uid, d); }),

  deleteRole: protectedProcedure
    .input(z.object({ uid: z.string() }))
    .mutation(({ input }) => adminDb.deleteRole(input.uid)),

  // ── Permissions ──
  listPermissions: protectedProcedure.query(() => adminDb.listPermissions()),

  createPermission: protectedProcedure
    .input(z.object({
      module: z.string(), action: z.string(), description: z.string().optional(),
    }))
    .mutation(({ input }) => adminDb.createPermission(input)),

  // ── Role-Permission Mapping ──
  getRolePermissions: protectedProcedure
    .input(z.object({ roleId: z.string() }))
    .query(({ input }) => adminDb.getRolePermissions(input.roleId)),

  addPermissionToRole: protectedProcedure
    .input(z.object({ roleId: z.string(), permissionId: z.string() }))
    .mutation(({ input }) => adminDb.addPermissionToRole(input.roleId, input.permissionId)),

  removePermissionFromRole: protectedProcedure
    .input(z.object({ roleId: z.string(), permissionId: z.string() }))
    .mutation(({ input }) => adminDb.removePermissionFromRole(input.roleId, input.permissionId)),

  // ── User-Role Mapping ──
  getUserRoles: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input }) => adminDb.getUserRoles(input.userId)),

  addRoleToUser: protectedProcedure
    .input(z.object({ userId: z.string(), roleId: z.string() }))
    .mutation(({ input }) => adminDb.addRoleToUser(input.userId, input.roleId)),

  removeRoleFromUser: protectedProcedure
    .input(z.object({ userId: z.string(), roleId: z.string() }))
    .mutation(({ input }) => adminDb.removeRoleFromUser(input.userId, input.roleId)),

  // ── Audit Logs ──
  listAuditLogs: protectedProcedure
    .input(z.object({
      actorId: z.string().optional(), entityType: z.string().optional(),
      action: z.string().optional(), limit: z.number().optional(),
    }))
    .query(({ input }) => adminDb.listAuditLogs(input)),

  createAuditLog: protectedProcedure
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
