/**
 * Tests for auth.changePassword endpoint
 * Covers: success, wrong current password, no passwordHash (OAuth), same password,
 *         validation, audit log, structural checks
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockUpdateUserPassword = vi.fn().mockResolvedValue(undefined);
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
  updateUserPassword: (...args: unknown[]) => mockUpdateUserPassword(...args),
  createPasswordResetToken: vi.fn(),
  getValidResetToken: vi.fn(),
  markResetTokenUsed: vi.fn(),
}));

// ─── Mock bcrypt ────────────────────────────────────────────────────────────
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn().mockResolvedValue("$2a$12$newhashedpassword");
vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: (...args: unknown[]) => mockBcryptHash(...args),
  },
}));

// ─── Mock SDK ───────────────────────────────────────────────────────────────
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
    authenticateRequest: vi.fn().mockRejectedValue(new Error("No session")),
    verifySession: vi.fn().mockResolvedValue(null),
  },
}));

// ─── Mock audit log ─────────────────────────────────────────────────────────
const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock("./lib/auditLog", () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

// ─── Mock ENV ───────────────────────────────────────────────────────────────
vi.mock("./_core/env", () => ({
  ENV: {
    appId: "test-app",
    cookieSecret: "test-secret-32-chars-minimum-ok!",
    ownerOpenId: "owner_123",
    isProduction: false,
    rateLimitLoginMax: 10,
    rateLimitLoginWindowMs: 900000,
  },
}));

// ─── Test user fixtures ─────────────────────────────────────────────────────
const INVITE_USER = {
  id: 42,
  openId: "invite_abc-def-123",
  name: "Jean Dupont",
  fullName: "Jean Dupont",
  email: "jean@example.com",
  role: "user" as const,
  status: "ACTIVE" as const,
  passwordHash: "$2a$12$existinghashhere",
  loginMethod: "invite",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const OAUTH_USER = {
  ...INVITE_USER,
  id: 43,
  openId: "oauth_user_456",
  email: "oauth@example.com",
  passwordHash: null,
  loginMethod: "google",
};

// ─── Helper: create an authenticated context ────────────────────────────────
function createAuthContext(user: typeof INVITE_USER | typeof OAUTH_USER) {
  const req = {
    headers: {},
    protocol: "https",
    hostname: "localhost",
  } as any;

  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;

  return { req, res, user };
}

// ─── Helper: create a public context (no auth) ─────────────────────────────
function createPublicContext() {
  const req = {
    headers: {},
    protocol: "https",
    hostname: "localhost",
  } as any;

  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;

  return { req, res, user: null };
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("auth.changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully changes password with valid current password", async () => {
    // First compare: currentPassword vs hash → true
    // Second compare: newPassword vs hash → false (different)
    mockBcryptCompare
      .mockResolvedValueOnce(true)   // current password correct
      .mockResolvedValueOnce(false); // new password is different

    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.changePassword({
      currentPassword: "OldPassword1",
      newPassword: "NewSecure1Pass",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("modifié avec succès");

    // Password should be hashed and updated
    expect(mockBcryptHash).toHaveBeenCalledWith("NewSecure1Pass", 12);
    expect(mockUpdateUserPassword).toHaveBeenCalledWith(42, "$2a$12$newhashedpassword");

    // Audit log should be written
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: "PASSWORD_CHANGED",
        entity: "user",
        entityId: "42",
        details: expect.objectContaining({ email: "jean@example.com", method: "self-service" }),
      })
    );
  });

  it("rejects when current password is wrong", async () => {
    mockBcryptCompare.mockResolvedValueOnce(false); // current password wrong

    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "WrongPassword1",
        newPassword: "NewSecure1Pass",
      })
    ).rejects.toThrow("Le mot de passe actuel est incorrect");

    expect(mockUpdateUserPassword).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("rejects when user has no passwordHash (OAuth account)", async () => {
    const ctx = createAuthContext(OAUTH_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "anything",
        newPassword: "NewSecure1Pass",
      })
    ).rejects.toThrow("connexion OAuth");

    expect(mockBcryptCompare).not.toHaveBeenCalled();
    expect(mockUpdateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects when new password is the same as current", async () => {
    mockBcryptCompare
      .mockResolvedValueOnce(true)  // current password correct
      .mockResolvedValueOnce(true); // new password is the same

    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "SamePassword1",
        newPassword: "SamePassword1",
      })
    ).rejects.toThrow("différent de l'ancien");

    expect(mockUpdateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects when new password is too short", async () => {
    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "OldPassword1",
        newPassword: "Short1",
      })
    ).rejects.toThrow();

    expect(mockBcryptCompare).not.toHaveBeenCalled();
  });

  it("rejects when new password lacks uppercase", async () => {
    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "OldPassword1",
        newPassword: "nouppercase1",
      })
    ).rejects.toThrow();
  });

  it("rejects when new password lacks lowercase", async () => {
    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "OldPassword1",
        newPassword: "NOLOWERCASE1",
      })
    ).rejects.toThrow();
  });

  it("rejects when new password lacks digit", async () => {
    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "OldPassword1",
        newPassword: "NoDigitHere",
      })
    ).rejects.toThrow();
  });

  it("rejects when current password is empty", async () => {
    const ctx = createAuthContext(INVITE_USER);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "",
        newPassword: "NewSecure1Pass",
      })
    ).rejects.toThrow();
  });

  it("requires authentication (fails for unauthenticated user)", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.changePassword({
        currentPassword: "OldPassword1",
        newPassword: "NewSecure1Pass",
      })
    ).rejects.toThrow();
  });

  it("router has auth.changePassword procedure", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("auth.changePassword");
  });
});
