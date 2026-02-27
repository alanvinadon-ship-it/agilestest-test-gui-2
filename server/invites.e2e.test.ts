/**
 * E2E Test: Invite Flow (Create → Send → Accept)
 *
 * Validates the full invitation lifecycle against the real database:
 *   1. Setup: admin creates an invite → DB status=PENDING, token present, expiresAt set
 *   2. Send: resend invite → new token generated, expiry extended
 *   3. Accept: invited user accepts → status=ACCEPTED, user created, audit log written
 *   4. Edge cases: invalid token, expired token, double accept, revoked invite, duplicate email
 *
 * Uses real DB (no mocks) via tRPC callers, following the import-export.e2e.test.ts pattern.
 */
import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { invites, users, auditLogs } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "e2e-invite-admin",
    email: "admin@e2e-invite.test",
    name: "E2E Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

/** Unique email per test run to avoid collisions */
const TEST_RUN_ID = Date.now().toString(36);
function testEmail(suffix: string): string {
  return `e2e-invite-${suffix}-${TEST_RUN_ID}@test.local`;
}

// Track resources for cleanup
const createdInviteIds: number[] = [];
const createdUserEmails: string[] = [];

afterAll(async () => {
  const db = await getDb();
  if (!db) return;

  // Cleanup invites
  for (const id of createdInviteIds) {
    try {
      await db.delete(invites).where(eq(invites.id, id));
    } catch {}
  }

  // Cleanup users created by invite acceptance
  for (const email of createdUserEmails) {
    try {
      await db.delete(users).where(eq(users.email, email));
    } catch {}
  }

  // Cleanup audit logs from E2E tests
  try {
    await db.delete(auditLogs).where(eq(auditLogs.action, "INVITE_CREATED"));
  } catch {}
  try {
    await db.delete(auditLogs).where(eq(auditLogs.action, "INVITE_ACCEPTED"));
  } catch {}
  try {
    await db.delete(auditLogs).where(eq(auditLogs.action, "INVITE_REVOKED"));
  } catch {}
  try {
    await db.delete(auditLogs).where(eq(auditLogs.action, "INVITE_RESENT"));
  } catch {}
});

// ─── 1. Setup: Create Invite ─────────────────────────────────────────────────

describe("E2E Invite Flow — 1. Create Invite", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);
  const email = testEmail("create");

  let inviteUid: string;

  it("should create an invite with status=PENDING", async () => {
    const result = await adminCaller.admin.createInvite({
      email,
      role: "VIEWER",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(32);
    inviteUid = result.uid;

    // Verify in DB
    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.status).toBe("PENDING");
    expect(invite.token).toBe(result.token);
    expect(invite.role).toBe("VIEWER");
    expect(invite.expiresAt).toBeDefined();
    expect(invite.invitedBy).toBe("1");
    expect(invite.invitedByName).toBe("E2E Admin");
    expect(invite.uid).toBeDefined();

    // Token should expire in ~7 days
    const expiresMs = new Date(invite.expiresAt).getTime();
    const nowMs = Date.now();
    const diffDays = (expiresMs - nowMs) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6);
    expect(diffDays).toBeLessThanOrEqual(7.1);

    createdInviteIds.push(invite.id);
  });

  it("should write an audit log for INVITE_CREATED", async () => {
    const db = await getDb();
    const [log] = await db!.select().from(auditLogs)
      .where(and(eq(auditLogs.action, "INVITE_CREATED"), eq(auditLogs.entityId, inviteUid)))
      .orderBy(desc(auditLogs.id))
      .limit(1);

    expect(log).toBeDefined();
    expect(log.action).toBe("INVITE_CREATED");
    expect(log.entityId).toBe(inviteUid);
  });

  it("should reject duplicate PENDING invite for same email", async () => {
    await expect(
      adminCaller.admin.createInvite({ email, role: "ADMIN" })
    ).rejects.toThrow(/déjà en attente/);
  });

  it("should create invite with ADMIN role", async () => {
    const adminEmail = testEmail("admin-role");
    const result = await adminCaller.admin.createInvite({
      email: adminEmail,
      role: "ADMIN",
    });

    expect(result.success).toBe(true);

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, adminEmail))
      .limit(1);

    expect(invite.role).toBe("ADMIN");
    createdInviteIds.push(invite.id);
  });

  it("should create invite with MANAGER role", async () => {
    const mgrEmail = testEmail("mgr-role");
    const result = await adminCaller.admin.createInvite({
      email: mgrEmail,
      role: "MANAGER",
    });

    expect(result.success).toBe(true);

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, mgrEmail))
      .limit(1);

    expect(invite.role).toBe("MANAGER");
    createdInviteIds.push(invite.id);
  });
});

// ─── 2. Send: Resend Invite ──────────────────────────────────────────────────

describe("E2E Invite Flow — 2. Resend Invite", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);
  const email = testEmail("resend");

  let inviteId: number;
  let originalToken: string;

  it("setup: create invite for resend test", async () => {
    const result = await adminCaller.admin.createInvite({
      email,
      role: "VIEWER",
    });
    originalToken = result.token;

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    inviteId = invite.id;
    createdInviteIds.push(inviteId);
  });

  it("should resend invite with new token and extended expiry", async () => {
    const result = await adminCaller.admin.resendInvite({ inviteId });

    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
    expect(result.token).not.toBe(originalToken); // New token
    expect(result.email).toBe(email);
    expect(result.role).toBe("VIEWER");

    // Verify DB updated
    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.id, inviteId))
      .limit(1);

    expect(invite.token).toBe(result.token);
    expect(invite.status).toBe("PENDING"); // Still pending

    // New expiry should be ~7 days from now
    const expiresMs = new Date(invite.expiresAt).getTime();
    const diffDays = (expiresMs - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6);
  });

  it("should write INVITE_RESENT audit log", async () => {
    const db = await getDb();
    const [log] = await db!.select().from(auditLogs)
      .where(and(eq(auditLogs.action, "INVITE_RESENT"), eq(auditLogs.entityId, String(inviteId))))
      .orderBy(desc(auditLogs.id))
      .limit(1);

    expect(log).toBeDefined();
    expect(log.action).toBe("INVITE_RESENT");
  });

  it("old token should no longer work after resend", async () => {
    const publicCaller = appRouter.createCaller(createPublicContext());
    const result = await publicCaller.invite.verifyToken({ token: originalToken });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("NOT_FOUND");
  });
});

// ─── 3. Accept: Full Flow ────────────────────────────────────────────────────

describe("E2E Invite Flow — 3. Accept Invite", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);
  const publicCaller = appRouter.createCaller(createPublicContext());
  const email = testEmail("accept");

  let token: string;
  let inviteId: number;

  it("setup: create invite for acceptance", async () => {
    const result = await adminCaller.admin.createInvite({
      email,
      role: "VIEWER",
    });
    token = result.token;

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    inviteId = invite.id;
    createdInviteIds.push(inviteId);
  });

  it("should verify token returns valid=true with invite info", async () => {
    const result = await publicCaller.invite.verifyToken({ token });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.email).toBe(email);
      expect(result.role).toBe("VIEWER");
      expect(result.invitedByName).toBe("E2E Admin");
      expect(result.expiresAt).toBeDefined();
    }
  });

  it("should accept invite and create user account", async () => {
    const result = await publicCaller.invite.accept({
      token,
      fullName: "E2E Invited User",
      password: "SecureP@ss123!",
    });

    expect(result.success).toBe(true);
    expect(result.email).toBe(email);
    expect(result.fullName).toBe("E2E Invited User");

    createdUserEmails.push(email);
  });

  it("invite should be marked ACCEPTED with acceptedAt", async () => {
    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.id, inviteId))
      .limit(1);

    expect(invite.status).toBe("ACCEPTED");
    expect(invite.acceptedAt).toBeDefined();
    expect(invite.acceptedAt).not.toBeNull();
  });

  it("user should exist in DB with correct attributes", async () => {
    const db = await getDb();
    const [user] = await db!.select().from(users)
      .where(eq(users.email, email))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.fullName).toBe("E2E Invited User");
    expect(user.status).toBe("ACTIVE");
    expect(user.loginMethod).toBe("invite");
    expect(user.role).toBe("user"); // VIEWER maps to 'user' role
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash!.length).toBeGreaterThan(0);
    expect(user.openId).toMatch(/^invite_/);
  });

  it("should write INVITE_ACCEPTED audit log", async () => {
    const db = await getDb();
    const [log] = await db!.select().from(auditLogs)
      .where(and(eq(auditLogs.action, "INVITE_ACCEPTED"), eq(auditLogs.entityId, String(inviteId))))
      .orderBy(desc(auditLogs.id))
      .limit(1);

    expect(log).toBeDefined();
    expect(log.action).toBe("INVITE_ACCEPTED");
  });

  it("verifyToken should return ALREADY_ACCEPTED after acceptance", async () => {
    const result = await publicCaller.invite.verifyToken({ token });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("ALREADY_ACCEPTED");
    if (!result.valid && result.reason === "ALREADY_ACCEPTED") {
      expect(result.email).toBe(email);
    }
  });
});

// ─── 3b. Accept with ADMIN role ──────────────────────────────────────────────

describe("E2E Invite Flow — 3b. Accept with ADMIN role", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());
  const email = testEmail("accept-admin");

  let token: string;

  it("setup + accept ADMIN invite", async () => {
    const result = await adminCaller.admin.createInvite({ email, role: "ADMIN" });
    token = result.token;

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    createdInviteIds.push(invite.id);

    const acceptResult = await publicCaller.invite.accept({
      token,
      fullName: "E2E Admin Invitee",
      password: "AdminP@ss456!",
    });
    expect(acceptResult.success).toBe(true);
    createdUserEmails.push(email);
  });

  it("ADMIN invite should create user with admin role", async () => {
    const db = await getDb();
    const [user] = await db!.select().from(users)
      .where(eq(users.email, email))
      .limit(1);

    expect(user).toBeDefined();
    expect(user.role).toBe("admin");
  });
});

// ─── 4. Edge Cases ───────────────────────────────────────────────────────────

describe("E2E Invite Flow — 4a. Invalid Token", () => {
  const publicCaller = appRouter.createCaller(createPublicContext());

  it("verifyToken with random token returns NOT_FOUND", async () => {
    const result = await publicCaller.invite.verifyToken({
      token: "totally-invalid-token-that-does-not-exist-in-db",
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("NOT_FOUND");
  });

  it("accept with invalid token throws NOT_FOUND", async () => {
    await expect(
      publicCaller.invite.accept({
        token: "nonexistent-token-12345",
        fullName: "Hacker",
        password: "password123!",
      })
    ).rejects.toThrow(/non trouvée|invalide/i);
  });

  it("accept with empty token is rejected by Zod", async () => {
    await expect(
      publicCaller.invite.accept({
        token: "",
        fullName: "Hacker",
        password: "password123!",
      })
    ).rejects.toThrow();
  });
});

describe("E2E Invite Flow — 4b. Expired Token", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());
  const email = testEmail("expired");

  let token: string;
  let inviteId: number;

  it("setup: create invite then manually expire it", async () => {
    const result = await adminCaller.admin.createInvite({ email, role: "VIEWER" });
    token = result.token;

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    inviteId = invite.id;
    createdInviteIds.push(inviteId);

    // Manually set expiresAt to the past
    await db!.update(invites)
      .set({ expiresAt: new Date(Date.now() - 1000 * 60 * 60) }) // 1 hour ago
      .where(eq(invites.id, inviteId));
  });

  it("verifyToken should return EXPIRED", async () => {
    const result = await publicCaller.invite.verifyToken({ token });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("EXPIRED");
  });

  it("accept should throw BAD_REQUEST for expired invite", async () => {
    await expect(
      publicCaller.invite.accept({
        token,
        fullName: "Late User",
        password: "password123!",
      })
    ).rejects.toThrow(/expiré|plus valide/i);
  });

  it("invite should be auto-marked EXPIRED in DB", async () => {
    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.id, inviteId))
      .limit(1);

    expect(invite.status).toBe("EXPIRED");
  });
});

describe("E2E Invite Flow — 4c. Double Accept (idempotence)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());
  const email = testEmail("double");

  let token: string;

  it("setup: create and accept invite", async () => {
    const result = await adminCaller.admin.createInvite({ email, role: "VIEWER" });
    token = result.token;

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    createdInviteIds.push(invite.id);

    await publicCaller.invite.accept({
      token,
      fullName: "Double Accept User",
      password: "password123!",
    });
    createdUserEmails.push(email);
  });

  it("second accept should throw BAD_REQUEST (not PENDING)", async () => {
    await expect(
      publicCaller.invite.accept({
        token,
        fullName: "Double Accept User 2",
        password: "password456!",
      })
    ).rejects.toThrow(/plus valide/i);
  });

  it("should NOT create a duplicate user", async () => {
    const db = await getDb();
    const userRows = await db!.select().from(users)
      .where(eq(users.email, email));

    expect(userRows.length).toBe(1); // Only one user
  });
});

describe("E2E Invite Flow — 4d. Revoked Invite", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());
  const email = testEmail("revoked");

  let token: string;
  let inviteId: number;

  it("setup: create then revoke invite", async () => {
    const result = await adminCaller.admin.createInvite({ email, role: "VIEWER" });
    token = result.token;

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    inviteId = invite.id;
    createdInviteIds.push(inviteId);

    await adminCaller.admin.revokeInvite({ inviteId });
  });

  it("verifyToken should return REVOKED", async () => {
    const result = await publicCaller.invite.verifyToken({ token });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("REVOKED");
  });

  it("accept should throw BAD_REQUEST for revoked invite", async () => {
    await expect(
      publicCaller.invite.accept({
        token,
        fullName: "Revoked User",
        password: "password123!",
      })
    ).rejects.toThrow(/plus valide/i);
  });

  it("INVITE_REVOKED audit log should exist", async () => {
    const db = await getDb();
    const [log] = await db!.select().from(auditLogs)
      .where(and(eq(auditLogs.action, "INVITE_REVOKED"), eq(auditLogs.entityId, String(inviteId))))
      .orderBy(desc(auditLogs.id))
      .limit(1);

    expect(log).toBeDefined();
    expect(log.action).toBe("INVITE_REVOKED");
  });

  it("should not be possible to resend a revoked invite", async () => {
    await expect(
      adminCaller.admin.resendInvite({ inviteId })
    ).rejects.toThrow(/en attente/i);
  });
});

describe("E2E Invite Flow — 4e. Accept with existing user (re-activation)", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());
  const email = testEmail("existing-user");

  let token: string;

  it("setup: create user first, then invite same email", async () => {
    const db = await getDb();

    // Create a user with this email first
    await db!.insert(users).values({
      openId: `pre-existing-${TEST_RUN_ID}`,
      name: "Pre-existing User",
      email,
      loginMethod: "manus",
      role: "user",
      status: "DISABLED",
    });
    createdUserEmails.push(email);

    const result = await adminCaller.admin.createInvite({ email, role: "VIEWER" });
    token = result.token;

    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    createdInviteIds.push(invite.id);
  });

  it("accept should update existing user (not create duplicate)", async () => {
    const result = await publicCaller.invite.accept({
      token,
      fullName: "Reactivated User",
      password: "newpassword123!",
    });

    expect(result.success).toBe(true);

    const db = await getDb();
    const userRows = await db!.select().from(users)
      .where(eq(users.email, email));

    // Should NOT create a duplicate
    expect(userRows.length).toBe(1);

    const user = userRows[0];
    expect(user.fullName).toBe("Reactivated User");
    expect(user.status).toBe("ACTIVE");
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash!.length).toBeGreaterThan(0);
  });
});

describe("E2E Invite Flow — 4f. Token one-time use", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const publicCaller = appRouter.createCaller(createPublicContext());
  const email = testEmail("one-time");

  it("token should not be reusable after acceptance", async () => {
    const result = await adminCaller.admin.createInvite({ email, role: "VIEWER" });
    const token = result.token;

    const db = await getDb();
    const [invite] = await db!.select().from(invites)
      .where(eq(invites.email, email))
      .limit(1);
    createdInviteIds.push(invite.id);

    // First accept succeeds
    await publicCaller.invite.accept({
      token,
      fullName: "One-Time User",
      password: "password123!",
    });
    createdUserEmails.push(email);

    // Second accept fails
    await expect(
      publicCaller.invite.accept({
        token,
        fullName: "One-Time User Again",
        password: "password456!",
      })
    ).rejects.toThrow();

    // Verify returns ALREADY_ACCEPTED
    const verifyResult = await publicCaller.invite.verifyToken({ token });
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.reason).toBe("ALREADY_ACCEPTED");
  });
});

describe("E2E Invite Flow — 4g. Input validation", () => {
  const publicCaller = appRouter.createCaller(createPublicContext());

  it("accept rejects password shorter than 8 chars", async () => {
    await expect(
      publicCaller.invite.accept({
        token: "some-token",
        fullName: "User",
        password: "short",
      })
    ).rejects.toThrow();
  });

  it("accept rejects fullName shorter than 2 chars", async () => {
    await expect(
      publicCaller.invite.accept({
        token: "some-token",
        fullName: "X",
        password: "password123!",
      })
    ).rejects.toThrow();
  });

  it("createInvite rejects invalid email", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    await expect(
      adminCaller.admin.createInvite({
        email: "not-an-email",
        role: "VIEWER",
      })
    ).rejects.toThrow();
  });

  it("createInvite rejects invalid role", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    await expect(
      adminCaller.admin.createInvite({
        email: "valid@test.com",
        role: "SUPERADMIN" as any,
      })
    ).rejects.toThrow();
  });
});

// ─── 5. Security: Non-admin cannot create invites ────────────────────────────

describe("E2E Invite Flow — 5. RBAC enforcement", () => {
  it("non-authenticated user cannot create invite", async () => {
    const publicCaller = appRouter.createCaller(createPublicContext());
    await expect(
      (publicCaller as any).admin.createInvite({
        email: "hacker@test.com",
        role: "VIEWER",
      })
    ).rejects.toThrow();
  });

  it("non-admin user cannot create invite", async () => {
    const userCtx: TrpcContext = {
      user: {
        id: 999,
        openId: "e2e-regular-user",
        email: "regular@test.com",
        name: "Regular User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const userCaller = appRouter.createCaller(userCtx);

    await expect(
      userCaller.admin.createInvite({
        email: "hacker2@test.com",
        role: "VIEWER",
      })
    ).rejects.toThrow();
  });

  it("non-admin user cannot revoke invite", async () => {
    const userCtx: TrpcContext = {
      user: {
        id: 999,
        openId: "e2e-regular-user-2",
        email: "regular2@test.com",
        name: "Regular User 2",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    };
    const userCaller = appRouter.createCaller(userCtx);

    await expect(
      userCaller.admin.revokeInvite({ inviteId: 1 })
    ).rejects.toThrow();
  });
});
