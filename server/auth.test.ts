/**
 * Auth Tests — Validates server-persistent authentication via tRPC.
 *
 * Tests cover:
 * 1. auth.me returns enriched user when authenticated (cookie session valid)
 * 2. auth.me returns null when not authenticated (no cookie)
 * 3. auth.logout clears the session cookie
 * 4. auth.me returns RBAC fields (appRoles, effectiveRole, permissions, isAdmin, canWrite)
 * 5. Protected procedures reject unauthenticated requests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 1,
    openId: "auth-test-user-001",
    email: "auth-test@agilestest.io",
    name: "Auth Test User",
    fullName: "Auth Test User",
    loginMethod: "manus",
    role: "admin",
    status: "ACTIVE",
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createAuthenticatedContext(userOverrides?: Partial<AuthenticatedUser>): TrpcContext {
  return {
    user: createMockUser(userOverrides),
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// auth.me
// ═══════════════════════════════════════════════════════════════════════════

describe("auth.me", () => {
  it("returns null when not authenticated", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns enriched user when authenticated", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result!.id).toBe("1");
    expect(result!.email).toBe("auth-test@agilestest.io");
    expect(result!.full_name).toBe("Auth Test User");
    expect(result!.openId).toBe("auth-test-user-001");
  });

  it("returns RBAC fields", async () => {
    const ctx = createAuthenticatedContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();

    // RBAC fields must be present
    expect(result).toHaveProperty("role");
    expect(result).toHaveProperty("appRoles");
    expect(result).toHaveProperty("effectiveRole");
    expect(result).toHaveProperty("permissions");
    expect(result).toHaveProperty("isAdmin");
    expect(result).toHaveProperty("canWrite");
    expect(result).toHaveProperty("isActive");

    // appRoles must be an array
    expect(Array.isArray(result!.appRoles)).toBe(true);
    // permissions must be an array
    expect(Array.isArray(result!.permissions)).toBe(true);
  });

  it("admin user has isAdmin=true and canWrite=true", async () => {
    const ctx = createAuthenticatedContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result!.isAdmin).toBe(true);
    expect(result!.canWrite).toBe(true);
    expect(result!.effectiveRole).toBe("ORG_ADMIN");
  });

  it("regular user has isAdmin=false", async () => {
    // Use a unique openId to avoid RBAC role cache from previous tests
    const ctx = createAuthenticatedContext({ role: "user", openId: "regular-user-no-admin-" + Date.now() });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result!.isAdmin).toBe(false);
    // VIEWER has canWrite=false
    expect(result!.canWrite).toBe(false);
    expect(result!.effectiveRole).toBe("VIEWER");
  });

  it("returns proper date fields as ISO strings", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    // createdAt, updatedAt, lastSignedIn should be ISO strings
    expect(typeof result!.createdAt).toBe("string");
    expect(typeof result!.updatedAt).toBe("string");
    expect(typeof result!.lastSignedIn).toBe("string");
    // Should be valid ISO date strings
    expect(new Date(result!.createdAt).toISOString()).toBe(result!.createdAt);
  });

  it("returns isActive based on user status", async () => {
    const activeCtx = createAuthenticatedContext({ status: "ACTIVE" });
    const activeCaller = appRouter.createCaller(activeCtx);
    const activeResult = await activeCaller.auth.me();
    expect(activeResult!.isActive).toBe(true);

    const inactiveCtx = createAuthenticatedContext({ status: "SUSPENDED" });
    const inactiveCaller = appRouter.createCaller(inactiveCtx);
    const inactiveResult = await inactiveCaller.auth.me();
    expect(inactiveResult!.isActive).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// auth.logout
// ═══════════════════════════════════════════════════════════════════════════

describe("auth.logout", () => {
  it("clears the session cookie", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });

    // Verify clearCookie was called
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });

  it("works even when not authenticated", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });

  it("clears cookie with correct options (maxAge: -1)", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await caller.auth.logout();

    // clearCookie should be called with maxAge: -1
    const callArgs = (ctx.res.clearCookie as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs).toBeDefined();
    // First arg is cookie name, second is options with maxAge: -1
    expect(callArgs[1]).toHaveProperty("maxAge", -1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Protected procedures reject unauthenticated
// ═══════════════════════════════════════════════════════════════════════════

describe("protected procedures reject unauthenticated", () => {
  it("projects.create rejects unauthenticated", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.projects.create({
        name: "Test",
        domain: "IMS",
        description: "Test",
      })
    ).rejects.toThrow();
  });

  it("profiles.list works for authenticated users", async () => {
    const ctx = createAuthenticatedContext({ role: "admin" });
    const caller = appRouter.createCaller(ctx);

    // Should not throw
    const result = await caller.profiles.list({ projectId: "test-project" });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Session persistence (cookie-based)
// ═══════════════════════════════════════════════════════════════════════════

describe("session persistence", () => {
  it("no token in response body (cookie-only auth)", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    // Ensure no token/secret is leaked in the response
    const resultStr = JSON.stringify(result);
    expect(resultStr).not.toContain("access_token");
    expect(resultStr).not.toContain("refresh_token");
    expect(resultStr).not.toContain("passwordHash");
    expect(resultStr).not.toContain("jwt");
  });

  it("auth.me is idempotent (multiple calls return same user)", async () => {
    const ctx = createAuthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result1 = await caller.auth.me();
    const result2 = await caller.auth.me();
    expect(result1!.id).toBe(result2!.id);
    expect(result1!.email).toBe(result2!.email);
    expect(result1!.effectiveRole).toBe(result2!.effectiveRole);
  });
});
