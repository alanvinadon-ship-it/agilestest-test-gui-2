/**
 * Tests for auth.uploadAvatar and auth.removeAvatar endpoints
 * Covers: upload success, file size validation, mime type validation, remove, remove when no avatar,
 *         structural checks, audit logging
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockUpdateUserAvatar = vi.fn().mockResolvedValue(undefined);
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
  updateUserPassword: vi.fn(),
  updateUserAvatar: (...args: unknown[]) => mockUpdateUserAvatar(...args),
  createPasswordResetToken: vi.fn(),
  getValidResetToken: vi.fn(),
  markResetTokenUsed: vi.fn(),
}));

// ─── Mock bcrypt ────────────────────────────────────────────────────────────
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
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

// ─── Mock storage ───────────────────────────────────────────────────────────
const mockStoragePut = vi.fn().mockResolvedValue({
  key: "avatars/42-abc12345.jpg",
  url: "https://storage.example.com/avatars/42-abc12345.jpg",
});
vi.mock("./storage", () => ({
  storagePut: (...args: unknown[]) => mockStoragePut(...args),
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
const USER_WITH_AVATAR = {
  id: 42,
  openId: "invite_abc-def-123",
  name: "Jean Dupont",
  fullName: "Jean Dupont",
  email: "jean@example.com",
  role: "user" as const,
  status: "ACTIVE" as const,
  passwordHash: "$2a$12$existinghashhere",
  loginMethod: "invite",
  avatarUrl: "https://storage.example.com/avatars/42-old.jpg",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const USER_WITHOUT_AVATAR = {
  ...USER_WITH_AVATAR,
  id: 43,
  openId: "invite_xyz-789",
  avatarUrl: null,
};

// ─── Helper: create an authenticated context ────────────────────────────────
function createAuthContext(user: typeof USER_WITH_AVATAR) {
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

// ─── Generate a valid base64 image (small 1x1 JPEG) ────────────────────────
// Minimal valid JPEG: 267 bytes
const VALID_JPEG_BASE64 = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=",
  "base64"
).toString("base64");

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("auth.uploadAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully uploads an avatar image", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.uploadAvatar({
      imageBase64: VALID_JPEG_BASE64,
      mimeType: "image/jpeg",
    });

    expect(result.success).toBe(true);
    expect(result.avatarUrl).toBe("https://storage.example.com/avatars/42-abc12345.jpg");

    // Storage should be called
    expect(mockStoragePut).toHaveBeenCalledWith(
      expect.stringMatching(/^avatars\/43-[a-f0-9]+\.jpg$/),
      expect.any(Buffer),
      "image/jpeg"
    );

    // DB should be updated
    expect(mockUpdateUserAvatar).toHaveBeenCalledWith(43, "https://storage.example.com/avatars/42-abc12345.jpg");

    // Audit log
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 43,
        action: "AVATAR_UPLOADED",
        entity: "user",
        entityId: "43",
        details: expect.objectContaining({
          mimeType: "image/jpeg",
        }),
      })
    );
  });

  it("rejects when image exceeds 2 MB", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    // Create a base64 string that decodes to > 2 MB
    const largeBase64 = Buffer.alloc(2.5 * 1024 * 1024).toString("base64");

    await expect(
      caller.auth.uploadAvatar({
        imageBase64: largeBase64,
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow("2 Mo");

    expect(mockStoragePut).not.toHaveBeenCalled();
    expect(mockUpdateUserAvatar).not.toHaveBeenCalled();
  });

  it("rejects when image is too small (corrupt/empty)", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    // Tiny base64 that decodes to < 100 bytes
    const tinyBase64 = Buffer.from("tiny").toString("base64");

    await expect(
      caller.auth.uploadAvatar({
        imageBase64: tinyBase64,
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow("invalide ou vide");

    expect(mockStoragePut).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.uploadAvatar({
        imageBase64: VALID_JPEG_BASE64,
        mimeType: "image/svg+xml" as any,
      })
    ).rejects.toThrow();

    expect(mockStoragePut).not.toHaveBeenCalled();
  });

  it("accepts PNG mime type", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.uploadAvatar({
      imageBase64: VALID_JPEG_BASE64,
      mimeType: "image/png",
    });

    expect(result.success).toBe(true);
    expect(mockStoragePut).toHaveBeenCalledWith(
      expect.stringMatching(/\.png$/),
      expect.any(Buffer),
      "image/png"
    );
  });

  it("accepts WebP mime type", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.uploadAvatar({
      imageBase64: VALID_JPEG_BASE64,
      mimeType: "image/webp",
    });

    expect(result.success).toBe(true);
    expect(mockStoragePut).toHaveBeenCalledWith(
      expect.stringMatching(/\.webp$/),
      expect.any(Buffer),
      "image/webp"
    );
  });

  it("accepts GIF mime type", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.uploadAvatar({
      imageBase64: VALID_JPEG_BASE64,
      mimeType: "image/gif",
    });

    expect(result.success).toBe(true);
    expect(mockStoragePut).toHaveBeenCalledWith(
      expect.stringMatching(/\.gif$/),
      expect.any(Buffer),
      "image/gif"
    );
  });

  it("rejects empty imageBase64", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.uploadAvatar({
        imageBase64: "",
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow();
  });

  it("requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.uploadAvatar({
        imageBase64: VALID_JPEG_BASE64,
        mimeType: "image/jpeg",
      })
    ).rejects.toThrow();
  });
});

describe("auth.removeAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully removes an existing avatar", async () => {
    const ctx = createAuthContext(USER_WITH_AVATAR);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.removeAvatar();

    expect(result.success).toBe(true);
    expect(mockUpdateUserAvatar).toHaveBeenCalledWith(42, null);

    // Audit log
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        action: "AVATAR_REMOVED",
        entity: "user",
        entityId: "42",
        details: expect.objectContaining({
          previousUrl: "https://storage.example.com/avatars/42-old.jpg",
        }),
      })
    );
  });

  it("rejects when user has no avatar", async () => {
    const ctx = createAuthContext(USER_WITHOUT_AVATAR);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.removeAvatar()).rejects.toThrow("Aucun avatar");

    expect(mockUpdateUserAvatar).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.removeAvatar()).rejects.toThrow();
  });
});

describe("avatar router structure", () => {
  it("router has auth.uploadAvatar and auth.removeAvatar procedures", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("auth.uploadAvatar");
    expect(procedures).toContain("auth.removeAvatar");
  });
});
