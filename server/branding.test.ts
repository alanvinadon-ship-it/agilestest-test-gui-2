/**
 * Tests for branding endpoints (branding.get, uploadLogo, removeLogo, uploadFavicon, removeFavicon)
 * Covers: get defaults, upload logo/favicon, remove, validation (size, mime), admin-only access
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockGetAppSettings = vi.fn();
const mockSetAppSetting = vi.fn();
vi.mock("./db", () => ({
  getAppSettings: (...args: unknown[]) => mockGetAppSettings(...args),
  setAppSetting: (...args: unknown[]) => mockSetAppSetting(...args),
  getUserByEmail: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getDb: vi.fn().mockResolvedValue(null),
}));

// ─── Mock storage ──────────────────────────────────────────────────────────
const mockStoragePut = vi.fn();
vi.mock("./storage", () => ({
  storagePut: (...args: unknown[]) => mockStoragePut(...args),
}));

// ─── Mock bcrypt ────────────────────────────────────────────────────────────
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(false),
    hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
  },
}));

// ─── Mock SDK ──────────────────────────────────────────────────────────────
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-token"),
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
vi.mock("./emailService", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
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

// ─── Helpers ────────────────────────────────────────────────────────────────
function createPublicContext() {
  const req = { headers: {}, protocol: "https", hostname: "localhost" } as any;
  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;
  return { req, res, user: null };
}

function createAdminContext() {
  const req = { headers: {}, protocol: "https", hostname: "localhost" } as any;
  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;
  return {
    req,
    res,
    user: {
      id: 1,
      openId: "admin_001",
      name: "Admin",
      fullName: "Admin User",
      email: "admin@example.com",
      role: "admin" as const,
      status: "ACTIVE" as const,
      passwordHash: null,
      loginMethod: "oauth",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      avatarUrl: null,
    },
  };
}

function createUserContext() {
  const req = { headers: {}, protocol: "https", hostname: "localhost" } as any;
  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;
  return {
    req,
    res,
    user: {
      id: 2,
      openId: "user_002",
      name: "Regular",
      fullName: "Regular User",
      email: "user@example.com",
      role: "user" as const,
      status: "ACTIVE" as const,
      passwordHash: null,
      loginMethod: "oauth",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      avatarUrl: null,
    },
  };
}

const caller = (ctx: any) => appRouter.createCaller(ctx);

// Small valid PNG (1x1 pixel, ~67 bytes)
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("branding.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null defaults when no branding is set", async () => {
    mockGetAppSettings.mockResolvedValue({
      branding_logo_url: null,
      branding_favicon_url: null,
    });

    const result = await caller(createPublicContext()).branding.get();
    expect(result.logoUrl).toBeNull();
    expect(result.faviconUrl).toBeNull();
    expect(mockGetAppSettings).toHaveBeenCalledWith(["branding_logo_url", "branding_favicon_url"]);
  });

  it("returns stored URLs when branding is set", async () => {
    mockGetAppSettings.mockResolvedValue({
      branding_logo_url: "https://s3.example.com/logo.png",
      branding_favicon_url: "https://s3.example.com/favicon.ico",
    });

    const result = await caller(createPublicContext()).branding.get();
    expect(result.logoUrl).toBe("https://s3.example.com/logo.png");
    expect(result.faviconUrl).toBe("https://s3.example.com/favicon.ico");
  });

  it("is accessible without authentication (public)", async () => {
    mockGetAppSettings.mockResolvedValue({
      branding_logo_url: null,
      branding_favicon_url: null,
    });

    // Should not throw
    const result = await caller(createPublicContext()).branding.get();
    expect(result).toBeDefined();
  });
});

describe("branding.uploadLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoragePut.mockResolvedValue({ key: "branding/logo.png", url: "https://s3.example.com/branding/logo.png" });
    mockSetAppSetting.mockResolvedValue(undefined);
  });

  it("uploads a logo successfully (admin)", async () => {
    const result = await caller(createAdminContext()).branding.uploadLogo({
      base64: TINY_PNG_BASE64,
      mimeType: "image/png",
    });

    expect(result.logoUrl).toBe("https://s3.example.com/branding/logo.png");
    expect(mockStoragePut).toHaveBeenCalledTimes(1);
    expect(mockSetAppSetting).toHaveBeenCalledWith("branding_logo_url", "https://s3.example.com/branding/logo.png", "admin_001");
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BRANDING_LOGO_UPDATED" })
    );
  });

  it("rejects non-admin users", async () => {
    await expect(
      caller(createUserContext()).branding.uploadLogo({
        base64: TINY_PNG_BASE64,
        mimeType: "image/png",
      })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    await expect(
      caller(createPublicContext()).branding.uploadLogo({
        base64: TINY_PNG_BASE64,
        mimeType: "image/png",
      })
    ).rejects.toThrow();
  });

  it("rejects files larger than 2 MB", async () => {
    // Create a base64 string that decodes to > 2 MB
    const largeBase64 = Buffer.alloc(2.5 * 1024 * 1024).toString("base64");

    await expect(
      caller(createAdminContext()).branding.uploadLogo({
        base64: largeBase64,
        mimeType: "image/png",
      })
    ).rejects.toThrow(/2 Mo/);
  });

  it("rejects unsupported mime types", async () => {
    await expect(
      caller(createAdminContext()).branding.uploadLogo({
        base64: TINY_PNG_BASE64,
        mimeType: "image/gif" as any,
      })
    ).rejects.toThrow();
  });

  it("accepts SVG format", async () => {
    const svgBase64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>').toString("base64");
    mockStoragePut.mockResolvedValue({ key: "branding/logo.svg", url: "https://s3.example.com/branding/logo.svg" });

    const result = await caller(createAdminContext()).branding.uploadLogo({
      base64: svgBase64,
      mimeType: "image/svg+xml",
    });

    expect(result.logoUrl).toBe("https://s3.example.com/branding/logo.svg");
  });
});

describe("branding.removeLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppSetting.mockResolvedValue(undefined);
  });

  it("removes the logo (admin)", async () => {
    const result = await caller(createAdminContext()).branding.removeLogo();
    expect(result.success).toBe(true);
    expect(mockSetAppSetting).toHaveBeenCalledWith("branding_logo_url", null, "admin_001");
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BRANDING_LOGO_REMOVED" })
    );
  });

  it("rejects non-admin users", async () => {
    await expect(
      caller(createUserContext()).branding.removeLogo()
    ).rejects.toThrow();
  });
});

describe("branding.uploadFavicon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoragePut.mockResolvedValue({ key: "branding/favicon.png", url: "https://s3.example.com/branding/favicon.png" });
    mockSetAppSetting.mockResolvedValue(undefined);
  });

  it("uploads a favicon successfully (admin)", async () => {
    const result = await caller(createAdminContext()).branding.uploadFavicon({
      base64: TINY_PNG_BASE64,
      mimeType: "image/png",
    });

    expect(result.faviconUrl).toBe("https://s3.example.com/branding/favicon.png");
    expect(mockStoragePut).toHaveBeenCalledTimes(1);
    expect(mockSetAppSetting).toHaveBeenCalledWith("branding_favicon_url", "https://s3.example.com/branding/favicon.png", "admin_001");
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BRANDING_FAVICON_UPDATED" })
    );
  });

  it("rejects files larger than 512 KB", async () => {
    const largeBase64 = Buffer.alloc(600 * 1024).toString("base64");

    await expect(
      caller(createAdminContext()).branding.uploadFavicon({
        base64: largeBase64,
        mimeType: "image/png",
      })
    ).rejects.toThrow(/512 Ko/);
  });

  it("rejects non-admin users", async () => {
    await expect(
      caller(createUserContext()).branding.uploadFavicon({
        base64: TINY_PNG_BASE64,
        mimeType: "image/png",
      })
    ).rejects.toThrow();
  });

  it("accepts ICO format", async () => {
    mockStoragePut.mockResolvedValue({ key: "branding/favicon.ico", url: "https://s3.example.com/branding/favicon.ico" });

    const result = await caller(createAdminContext()).branding.uploadFavicon({
      base64: TINY_PNG_BASE64,
      mimeType: "image/x-icon",
    });

    expect(result.faviconUrl).toBe("https://s3.example.com/branding/favicon.ico");
  });
});

describe("branding.removeFavicon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetAppSetting.mockResolvedValue(undefined);
  });

  it("removes the favicon (admin)", async () => {
    const result = await caller(createAdminContext()).branding.removeFavicon();
    expect(result.success).toBe(true);
    expect(mockSetAppSetting).toHaveBeenCalledWith("branding_favicon_url", null, "admin_001");
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "BRANDING_FAVICON_REMOVED" })
    );
  });

  it("rejects non-admin users", async () => {
    await expect(
      caller(createUserContext()).branding.removeFavicon()
    ).rejects.toThrow();
  });
});

describe("branding — structural", () => {
  it("appRouter has branding namespace", () => {
    expect(appRouter._def.procedures).toHaveProperty("branding.get");
    expect(appRouter._def.procedures).toHaveProperty("branding.uploadLogo");
    expect(appRouter._def.procedures).toHaveProperty("branding.removeLogo");
    expect(appRouter._def.procedures).toHaveProperty("branding.uploadFavicon");
    expect(appRouter._def.procedures).toHaveProperty("branding.removeFavicon");
  });
});
