/**
 * Tests for auth.loginWithPassword endpoint
 * Covers: success, wrong password, no passwordHash, user not found, disabled account, audit log
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockGetUserByEmail = vi.fn();
const mockUpsertUser = vi.fn();
vi.mock("./db", () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
  getUserByOpenId: vi.fn(),
  upsertUser: (...args: unknown[]) => mockUpsertUser(...args),
  getDb: vi.fn().mockResolvedValue(null),
}));

// ─── Mock bcrypt ────────────────────────────────────────────────────────────
const mockBcryptCompare = vi.fn();
vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
  },
}));

// ─── Mock SDK (session token creation) ──────────────────────────────────────
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token-abc123"),
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

// ─── Helper: create a public context (no auth) ─────────────────────────────
function createPublicContext() {
  const setCookieCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const clearCookieCalls: Array<{ name: string; options: Record<string, unknown> }> = [];

  const req = {
    headers: {},
    protocol: "https",
    hostname: "localhost",
  } as any;

  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      setCookieCalls.push({ name, value, options });
    },
    clearCookie: (name: string, options: Record<string, unknown>) => {
      clearCookieCalls.push({ name, options });
    },
  } as any;

  return { req, res, user: null, setCookieCalls, clearCookieCalls };
}

// ─── Test user fixtures ─────────────────────────────────────────────────────
const ACTIVE_USER = {
  id: 42,
  openId: "invite_abc-def-123",
  name: "Jean Dupont",
  fullName: "Jean Dupont",
  email: "jean@example.com",
  role: "user" as const,
  status: "ACTIVE" as const,
  passwordHash: "$2a$12$validhashhere",
  loginMethod: "invite",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const OAUTH_USER = {
  ...ACTIVE_USER,
  id: 43,
  openId: "oauth_user_456",
  email: "oauth@example.com",
  passwordHash: null,
  loginMethod: "google",
};

const DISABLED_USER = {
  ...ACTIVE_USER,
  id: 44,
  email: "disabled@example.com",
  status: "DISABLED" as const,
};

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("auth.loginWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully logs in with valid email and password", async () => {
    mockGetUserByEmail.mockResolvedValue(ACTIVE_USER);
    mockBcryptCompare.mockResolvedValue(true);
    mockUpsertUser.mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.loginWithPassword({
      email: "jean@example.com",
      password: "MySecureP@ss1",
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe("jean@example.com");
    expect(result.user.name).toBe("Jean Dupont");
    expect(result.user.role).toBe("user");

    // Session cookie should be set
    expect(ctx.setCookieCalls).toHaveLength(1);
    expect(ctx.setCookieCalls[0].name).toBe("app_session_id");
    expect(ctx.setCookieCalls[0].value).toBe("mock-session-token-abc123");

    // Audit log should be written
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: "LOGIN_PASSWORD",
        entity: "user",
        details: expect.objectContaining({ email: "jean@example.com", method: "password" }),
      })
    );

    // Last signed in should be updated
    expect(mockUpsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "invite_abc-def-123",
        lastSignedIn: expect.any(Date),
      })
    );
  });

  it("rejects with UNAUTHORIZED when user not found", async () => {
    mockGetUserByEmail.mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "unknown@example.com",
        password: "anything",
      })
    ).rejects.toThrow("Identifiants invalides.");

    // No cookie should be set
    expect(ctx.setCookieCalls).toHaveLength(0);
    // No audit log
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("rejects when user has no passwordHash (OAuth-only account)", async () => {
    mockGetUserByEmail.mockResolvedValue(OAUTH_USER);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "oauth@example.com",
        password: "anything",
      })
    ).rejects.toThrow("Ce compte utilise la connexion OAuth");

    expect(ctx.setCookieCalls).toHaveLength(0);
  });

  it("rejects when password is wrong", async () => {
    mockGetUserByEmail.mockResolvedValue(ACTIVE_USER);
    mockBcryptCompare.mockResolvedValue(false);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "jean@example.com",
        password: "WrongPassword!",
      })
    ).rejects.toThrow("Identifiants invalides.");

    expect(ctx.setCookieCalls).toHaveLength(0);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("rejects when account is DISABLED", async () => {
    mockGetUserByEmail.mockResolvedValue(DISABLED_USER);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "disabled@example.com",
        password: "anything",
      })
    ).rejects.toThrow("Ce compte a été désactivé");

    expect(ctx.setCookieCalls).toHaveLength(0);
  });

  it("rejects with validation error for empty email", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "",
        password: "something",
      })
    ).rejects.toThrow();
  });

  it("rejects with validation error for invalid email format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "not-an-email",
        password: "something",
      })
    ).rejects.toThrow();
  });

  it("rejects with validation error for empty password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "jean@example.com",
        password: "",
      })
    ).rejects.toThrow();
  });

  it("does not leak whether email exists (same error for not found vs wrong password)", async () => {
    // Not found
    mockGetUserByEmail.mockResolvedValue(undefined);
    const ctx1 = createPublicContext();
    const caller1 = appRouter.createCaller(ctx1);
    let error1: Error | null = null;
    try {
      await caller1.auth.loginWithPassword({ email: "x@x.com", password: "a" });
    } catch (e) {
      error1 = e as Error;
    }

    // Wrong password
    mockGetUserByEmail.mockResolvedValue(ACTIVE_USER);
    mockBcryptCompare.mockResolvedValue(false);
    const ctx2 = createPublicContext();
    const caller2 = appRouter.createCaller(ctx2);
    let error2: Error | null = null;
    try {
      await caller2.auth.loginWithPassword({ email: "jean@example.com", password: "wrong" });
    } catch (e) {
      error2 = e as Error;
    }

    // Both should have the same generic message
    expect(error1).not.toBeNull();
    expect(error2).not.toBeNull();
    expect(error1!.message).toBe(error2!.message);
    expect(error1!.message).toBe("Identifiants invalides.");
  });

  it("router has auth.loginWithPassword procedure", () => {
    // Structural check
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("auth.loginWithPassword");
    expect(procedures).toContain("auth.me");
    expect(procedures).toContain("auth.logout");
  });
});

describe("getUserByEmail (db helper)", () => {
  it("is exported from db module", async () => {
    // Just verify the function exists and is callable
    const dbModule = await import("./db");
    expect(typeof dbModule.getUserByEmail).toBe("function");
  });
});
