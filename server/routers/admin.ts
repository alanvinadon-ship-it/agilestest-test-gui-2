import { z } from "zod";
import { eq, desc, and, like, sql, or, SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { router, adminProcedure, publicProcedure } from "../_core/trpc";
import bcrypt from "bcryptjs";
import { getDb } from "../db";
import {
  users, invites, auditLogs, projectMemberships,
  type User,
} from "../../drizzle/schema";
import { paginationInput } from "../../shared/pagination";
import { normalizePagination, countRows } from "../lib/pagination";
import { writeAuditLog } from "../lib/auditLog";
import { ENV } from "../_core/env";

// ─── Input schemas ──────────────────────────────────────────────────────────

const listUsersInput = z.object({
  ...paginationInput.shape,
  search: z.string().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

const updateUserInput = z.object({
  userId: z.number(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

const deleteUserInput = z.object({ userId: z.number() });

const createInviteInput = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "VIEWER"]).default("VIEWER"),
});

const listInvitesInput = z.object({
  ...paginationInput.shape,
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]).optional(),
});

const revokeInviteInput = z.object({ inviteId: z.number() });
const resendInviteInput = z.object({ inviteId: z.number() });

const listAuditLogsInput = z.object({
  ...paginationInput.shape,
  action: z.string().optional(),
  entity: z.string().optional(),
  userId: z.number().optional(),
});

// ─── Public Invite Router (no auth required) ───────────────────────────────

export const invitePublicRouter = router({
  /** Verify an invite token — returns invite info if valid */
  verifyToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [invite] = await db.select().from(invites)
        .where(eq(invites.token, input.token))
        .limit(1);

      if (!invite) {
        return { valid: false as const, reason: "NOT_FOUND" as const };
      }

      if (invite.status === "ACCEPTED") {
        return { valid: false as const, reason: "ALREADY_ACCEPTED" as const, email: invite.email };
      }

      if (invite.status === "REVOKED") {
        return { valid: false as const, reason: "REVOKED" as const };
      }

      if (invite.status === "EXPIRED" || (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now())) {
        // Auto-mark expired if not already
        if (invite.status !== "EXPIRED") {
          await db.update(invites).set({ status: "EXPIRED" }).where(eq(invites.id, invite.id));
        }
        return {
          valid: false as const,
          reason: "EXPIRED" as const,
          email: invite.email,
          expiresAt: invite.expiresAt?.toISOString() ?? null,
          invitedByName: invite.invitedByName,
        };
      }

      return {
        valid: true as const,
        email: invite.email,
        role: invite.role,
        invitedByName: invite.invitedByName,
        expiresAt: invite.expiresAt?.toISOString() ?? null,
      };
    }),

  /** Accept an invite — creates user account with password */
  accept: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      fullName: z.string().min(2),
      password: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [invite] = await db.select().from(invites)
        .where(eq(invites.token, input.token))
        .limit(1);

      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation non trouvée ou lien invalide." });
      }

      if (invite.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cette invitation n'est plus valide." });
      }

      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        await db.update(invites).set({ status: "EXPIRED" }).where(eq(invites.id, invite.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cette invitation a expiré." });
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(input.password, 12);

      // Check if user already exists by email
      const [existingUser] = await db.select().from(users)
        .where(eq(users.email, invite.email))
        .limit(1);

      if (existingUser) {
        // Update existing user
        await db.update(users).set({
          fullName: input.fullName,
          name: input.fullName,
          passwordHash,
          status: "ACTIVE",
        }).where(eq(users.id, existingUser.id));
      } else {
        // Create new user
        const openId = `invite_${crypto.randomUUID()}`;
        const userRole = invite.role === "ADMIN" ? "admin" as const : "user" as const;
        await db.insert(users).values({
          openId,
          name: input.fullName,
          fullName: input.fullName,
          email: invite.email,
          loginMethod: "invite",
          role: userRole,
          status: "ACTIVE",
          passwordHash,
        });
      }

      // Mark invite as accepted
      await db.update(invites).set({
        status: "ACCEPTED",
        acceptedAt: new Date(),
      }).where(eq(invites.id, invite.id));

      await writeAuditLog({
        userId: existingUser?.id ?? 0,
        action: "INVITE_ACCEPTED",
        entity: "invite",
        entityId: String(invite.id),
        details: { email: invite.email, fullName: input.fullName },
      });

      return { success: true, email: invite.email, fullName: input.fullName };
    }),
});

// ─── Admin Router (auth required) ───────────────────────────────────────────

export const adminRouter = router({
  // ── Users ───────────────────────────────────────────────────────────────
  listUsers: adminProcedure.input(listUsersInput).query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [];

    if (input.search) {
      const pattern = `%${input.search}%`;
      conditions.push(or(like(users.name, pattern), like(users.email, pattern))!);
    }
    if (input.role) {
      conditions.push(eq(users.role, input.role));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const baseQuery = where
      ? db.select().from(users).where(where)
      : db.select().from(users);

    const [data, countResult] = await Promise.all([
      baseQuery.orderBy(desc(users.createdAt)).limit(pageSize).offset(offset),
      countRows(db, users, where),
    ]);

    const total = countResult[0]?.count ?? 0;

    // Fetch project counts per user via Drizzle query builder
    const openIds = data.map((u: User) => u.openId).filter(Boolean);
    let projectCountMap: Record<string, number> = {};
    if (openIds.length > 0) {
      try {
        const { count, inArray } = await import("drizzle-orm");
        const rows = await db
          .select({
            userId: projectMemberships.userId,
            cnt: count(projectMemberships.id),
          })
          .from(projectMemberships)
          .where(inArray(projectMemberships.userId, openIds))
          .groupBy(projectMemberships.userId);
        for (const row of rows) {
          projectCountMap[row.userId] = Number(row.cnt);
        }
      } catch {
        // Table may not exist yet — gracefully return 0 counts
      }
    }

    const enrichedData = data.map((u: User) => ({
      ...u,
      role: u.openId === ENV.ownerOpenId ? ("admin" as const) : u.role,
      isOwner: u.openId === ENV.ownerOpenId,
      projectsCount: projectCountMap[u.openId] ?? 0,
    }));

    return {
      data: enrichedData,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }),

  getUser: adminProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const result = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (result.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });
    return result[0];
  }),

  updateUser: adminProcedure.input(updateUserInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const existing = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });

    if (existing[0].openId === ENV.ownerOpenId && input.role && input.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Impossible de modifier le rôle du propriétaire" });
    }

    const updateSet: Record<string, unknown> = {};
    if (input.name !== undefined) updateSet.name = input.name;
    if (input.email !== undefined) updateSet.email = input.email;
    if (input.role !== undefined) updateSet.role = input.role;

    if (Object.keys(updateSet).length > 0) {
      await db.update(users).set(updateSet).where(eq(users.id, input.userId));
    }

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "USER_UPDATED",
      entity: "user",
      entityId: String(input.userId),
      details: { changes: updateSet },
    });

    return { success: true };
  }),

  deleteUser: adminProcedure.input(deleteUserInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const existing = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable" });

    if (existing[0].openId === ENV.ownerOpenId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Impossible de supprimer le propriétaire" });
    }

    if (existing[0].email) {
      await db.delete(invites).where(eq(invites.email, existing[0].email));
    }
    await db.delete(projectMemberships).where(eq(projectMemberships.userId, String(input.userId)));
    await db.delete(auditLogs).where(eq(auditLogs.userId, String(input.userId)));
    await db.delete(users).where(eq(users.id, input.userId));

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "USER_DELETED",
      entity: "user",
      entityId: String(input.userId),
      details: { email: existing[0].email, name: existing[0].name },
    });

    return { success: true };
  }),

  // ── Invites ─────────────────────────────────────────────────────────────
  listInvites: adminProcedure.input(listInvitesInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [];
    if (input.status) conditions.push(eq(invites.status, input.status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const baseQuery = where
      ? db.select().from(invites).where(where)
      : db.select().from(invites);

    const [data, countResult] = await Promise.all([
      baseQuery.orderBy(desc(invites.createdAt)).limit(pageSize).offset(offset),
      countRows(db, invites, where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }),

  createInvite: adminProcedure.input(createInviteInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const existing = await db.select().from(invites)
      .where(and(eq(invites.email, input.email), eq(invites.status, "PENDING")))
      .limit(1);

    if (existing.length > 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Une invitation est déjà en attente pour cet email" });
    }

    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const uid = crypto.randomUUID();
    await db.insert(invites).values({
      uid,
      email: input.email,
      role: input.role,
      token,
      status: "PENDING",
      invitedBy: String(ctx.user!.id),
      invitedByName: ctx.user!.name ?? null,
      expiresAt,
    });

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "INVITE_CREATED",
      entity: "invite",
      entityId: uid,
      details: { email: input.email, role: input.role },
    });

    return { success: true, token, uid };
  }),

  revokeInvite: adminProcedure.input(revokeInviteInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const existing = await db.select().from(invites).where(eq(invites.id, input.inviteId)).limit(1);
    if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation introuvable" });
    if (existing[0].status !== "PENDING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Seules les invitations en attente peuvent être révoquées" });
    }

    await db.update(invites).set({ status: "REVOKED" }).where(eq(invites.id, input.inviteId));

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "INVITE_REVOKED",
      entity: "invite",
      entityId: String(input.inviteId),
      details: { email: existing[0].email },
    });

    return { success: true };
  }),

  /** Resend an invite — regenerate token, extend expiry, return new token */
  resendInvite: adminProcedure.input(resendInviteInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const existing = await db.select().from(invites).where(eq(invites.id, input.inviteId)).limit(1);
    if (existing.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation introuvable" });
    if (existing[0].status !== "PENDING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Seules les invitations en attente peuvent \u00eatre renvoy\u00e9es" });
    }

    const newToken = crypto.randomBytes(48).toString("hex");
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.update(invites).set({
      token: newToken,
      expiresAt: newExpiresAt,
    }).where(eq(invites.id, input.inviteId));

    await writeAuditLog({
      userId: ctx.user!.id,
      action: "INVITE_RESENT",
      entity: "invite",
      entityId: String(input.inviteId),
      details: { email: existing[0].email },
    });

    return { success: true, token: newToken, email: existing[0].email, role: existing[0].role };
  }),

  // ── Audit Logs ──────────────────────────────────────────────────────────
  listAuditLogs: adminProcedure.input(listAuditLogsInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const { page, pageSize, offset } = normalizePagination(input);
    const conditions: SQL[] = [];
    if (input.action) conditions.push(eq(auditLogs.action, input.action));
    if (input.entity) conditions.push(eq(auditLogs.entity, input.entity));
    if (input.userId) conditions.push(eq(auditLogs.userId, String(input.userId)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const baseQuery = where
      ? db.select().from(auditLogs).where(where)
      : db.select().from(auditLogs);

    const [data, countResult] = await Promise.all([
      baseQuery.orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
      countRows(db, auditLogs, where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }),
});
