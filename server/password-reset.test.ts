/**
 * Tests for password reset flow:
 * - auth.requestPasswordReset
 * - auth.verifyResetToken
 * - auth.resetPassword
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockGetUserByEmail = vi.fn();
const mockGetUserByOpenId = vi.fn();
const mockUpsertUser = vi.fn();
const mockCreatePasswordResetToken = vi.fn();
const mockGetValidResetToken = vi.fn();
const mockMarkResetTokenUsed = vi.fn();
const mockUpdateUserPassword = vi.fn();

vi.mock("./db", () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
  getUserByOpenId: (...args: unknown[]) => mockGetUserByOpenId(...args),
  upsertUser: (...args: unknown[]) => mockUpsertUser(...args),
  getDb: vi.fn().mockResolvedValue(null),
  createPasswordResetToken: (...args: unknown[]) => mockCreatePasswordResetToken(...args),
  getValidResetToken: (...args: unknown[]) => mockGetValidResetToken(...args),
  markResetTokenUsed: (...args: unknown[]) => mockMarkResetTokenUsed(...args),
  updateUserPassword: (...args: unknown[]) => mockUpdateUserPassword(...args),
}));

// ─── Mock bcrypt ────────────────────────────────────────────────────────────
const mockBcryptHash = vi.fn().mockResolvedValue("$2a$12$newhashed");
const mockBcryptCompare = vi.fn();
vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: (...args: unknown[]) => mockBcryptHash(...args),
  },
}));

// ─── Mock crypto ────────────────────────────────────────────────────────────
vi.mock("crypto", () => ({
  default: {
    randomBytes: () => ({
      toString: () => "a".repeat(128), // 64 bytes → 128 hex chars
    }),
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

// ─── Mock email service ─────────────────────────────────────────────────────
const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
vi.mock("./emailService", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
  sendTestEmail: vi.fn(),
  verifySmtpConnection: vi.fn(),
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

// ─── Helper: create a public context ────────────────────────────────────────
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

// ─── Fixtures ───────────────────────────────────────────────────────────────
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

const SMTP_CONFIG = {
  host: "smtp.test.com",
  port: 587,
  secure: "STARTTLS" as const,
  username: "user@test.com",
  password: "smtp-pass",
  from_email: "noreply@test.com",
  from_name: "AgilesTest",
};

const VALID_TOKEN = {
  id: 1,
  userId: 42,
  email: "jean@example.com",
  token: "a".repeat(128),
  expiresAt: new Date(Date.now() + 3600000),
  usedAt: null,
  createdAt: new Date(),
};

// ═══════════════════════════════════════════════════════════════════════════
// auth.requestPasswordReset
// ═══════════════════════════════════════════════════════════════════════════
describe("auth.requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePasswordResetToken.mockResolvedValue(undefined);
  });

  it("sends reset email for valid user with password", async () => {
    mockGetUserByEmail.mockResolvedValue(ACTIVE_USER);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({
      email: "jean@example.com",
      origin: "https://app.example.com",
      smtp: SMTP_CONFIG,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Si cette adresse est enregistrée");

    // Token should be created
    expect(mockCreatePasswordResetToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        email: "jean@example.com",
        token: expect.any(String),
        expiresAt: expect.any(Date),
      })
    );

    // Email should be sent
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.test.com" }),
      expect.objectContaining({
        to: "jean@example.com",
        subject: expect.stringContaining("Réinitialisation"),
        html: expect.stringContaining("https://app.example.com/reset-password?token="),
      })
    );

    // Audit log
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: "PASSWORD_RESET_REQUESTED",
      })
    );
  });

  it("silently succeeds when user not found (prevents email enumeration)", async () => {
    mockGetUserByEmail.mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({
      email: "unknown@example.com",
      origin: "https://app.example.com",
      smtp: SMTP_CONFIG,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("Si cette adresse est enregistrée");

    // No token, no email, no audit
    expect(mockCreatePasswordResetToken).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("silently succeeds when user has no passwordHash (OAuth-only)", async () => {
    mockGetUserByEmail.mockResolvedValue(OAUTH_USER);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({
      email: "oauth@example.com",
      origin: "https://app.example.com",
      smtp: SMTP_CONFIG,
    });

    expect(result.success).toBe(true);
    expect(mockCreatePasswordResetToken).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("silently succeeds when user is DISABLED", async () => {
    mockGetUserByEmail.mockResolvedValue(DISABLED_USER);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.requestPasswordReset({
      email: "disabled@example.com",
      origin: "https://app.example.com",
      smtp: SMTP_CONFIG,
    });

    expect(result.success).toBe(true);
    expect(mockCreatePasswordResetToken).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("throws INTERNAL_SERVER_ERROR when SMTP fails", async () => {
    mockGetUserByEmail.mockResolvedValue(ACTIVE_USER);
    mockSendEmail.mockRejectedValue(new Error("SMTP connection failed"));

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.requestPasswordReset({
        email: "jean@example.com",
        origin: "https://app.example.com",
        smtp: SMTP_CONFIG,
      })
    ).rejects.toThrow("Erreur lors de l'envoi de l'email");
  });

  it("rejects invalid email format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.requestPasswordReset({
        email: "not-an-email",
        origin: "https://app.example.com",
        smtp: SMTP_CONFIG,
      })
    ).rejects.toThrow();
  });

  it("rejects invalid origin URL", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.requestPasswordReset({
        email: "jean@example.com",
        origin: "not-a-url",
        smtp: SMTP_CONFIG,
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auth.verifyResetToken
// ═══════════════════════════════════════════════════════════════════════════
describe("auth.verifyResetToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid=true for a valid, unexpired, unused token", async () => {
    mockGetValidResetToken.mockResolvedValue(VALID_TOKEN);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.verifyResetToken({ token: "a".repeat(128) });

    expect(result.valid).toBe(true);
    expect(result.email).toBe("jean@example.com");
  });

  it("returns valid=false for an invalid/expired/used token", async () => {
    mockGetValidResetToken.mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.verifyResetToken({ token: "invalid-token" });

    expect(result.valid).toBe(false);
    expect(result.email).toBeNull();
  });

  it("rejects empty token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.verifyResetToken({ token: "" })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auth.resetPassword
// ═══════════════════════════════════════════════════════════════════════════
describe("auth.resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUserPassword.mockResolvedValue(undefined);
    mockMarkResetTokenUsed.mockResolvedValue(undefined);
  });

  it("successfully resets password with valid token", async () => {
    mockGetValidResetToken.mockResolvedValue(VALID_TOKEN);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.resetPassword({
      token: "a".repeat(128),
      newPassword: "NewSecure1Pass",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("réinitialisé avec succès");

    // Password should be hashed and updated
    expect(mockBcryptHash).toHaveBeenCalledWith("NewSecure1Pass", 12);
    expect(mockUpdateUserPassword).toHaveBeenCalledWith(42, "$2a$12$newhashed");

    // Token should be marked as used
    expect(mockMarkResetTokenUsed).toHaveBeenCalledWith("a".repeat(128));

    // Audit log
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: "PASSWORD_RESET_COMPLETED",
        entity: "user",
        details: expect.objectContaining({ email: "jean@example.com" }),
      })
    );
  });

  it("rejects with BAD_REQUEST when token is invalid/expired", async () => {
    mockGetValidResetToken.mockResolvedValue(undefined);

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "expired-token",
        newPassword: "NewSecure1Pass",
      })
    ).rejects.toThrow("Ce lien de réinitialisation est invalide ou a expiré");

    expect(mockUpdateUserPassword).not.toHaveBeenCalled();
    expect(mockMarkResetTokenUsed).not.toHaveBeenCalled();
  });

  it("rejects password shorter than 8 characters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "a".repeat(128),
        newPassword: "Short1",
      })
    ).rejects.toThrow();
  });

  it("rejects password without uppercase letter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "a".repeat(128),
        newPassword: "alllowercase1",
      })
    ).rejects.toThrow();
  });

  it("rejects password without lowercase letter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "a".repeat(128),
        newPassword: "ALLUPPERCASE1",
      })
    ).rejects.toThrow();
  });

  it("rejects password without digit", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "a".repeat(128),
        newPassword: "NoDigitsHere",
      })
    ).rejects.toThrow();
  });

  it("rejects empty token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.resetPassword({
        token: "",
        newPassword: "ValidPass1",
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Structural checks
// ═══════════════════════════════════════════════════════════════════════════
describe("Password reset procedures structure", () => {
  it("router has all password reset procedures", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("auth.requestPasswordReset");
    expect(procedures).toContain("auth.verifyResetToken");
    expect(procedures).toContain("auth.resetPassword");
  });

  it("DB helpers are exported", async () => {
    const dbModule = await import("./db");
    expect(typeof dbModule.createPasswordResetToken).toBe("function");
    expect(typeof dbModule.getValidResetToken).toBe("function");
    expect(typeof dbModule.markResetTokenUsed).toBe("function");
    expect(typeof dbModule.updateUserPassword).toBe("function");
  });
});
