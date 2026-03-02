import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { normalizePagination } from "./lib/pagination";

// ─── Helpers ────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ─── 1. Pagination helper ───────────────────────────────────────────────────

describe("normalizePagination", () => {
  it("returns defaults when no input is provided", () => {
    const result = normalizePagination();
    expect(result).toEqual({ page: 1, pageSize: 20, offset: 0 });
  });

  it("clamps page to minimum 1", () => {
    const result = normalizePagination({ page: -5, pageSize: 10 });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it("clamps pageSize to maximum 100", () => {
    const result = normalizePagination({ page: 1, pageSize: 500 });
    expect(result.pageSize).toBe(100);
  });

  it("calculates offset correctly", () => {
    const result = normalizePagination({ page: 3, pageSize: 25 });
    expect(result.offset).toBe(50);
  });

  it("clamps pageSize to minimum 1", () => {
    const result = normalizePagination({ page: 1, pageSize: 0 });
    expect(result.pageSize).toBe(1);
  });
});

// ─── 2. RBAC: adminProcedure ────────────────────────────────────────────────

describe("RBAC: adminProcedure", () => {
  it("rejects unauthenticated users on admin.listUsers", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.admin.listUsers({ page: 1, pageSize: 10 })).rejects.toThrow();
  });

  it("rejects non-admin users on admin.listUsers", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ role: "user" })));
    await expect(caller.admin.listUsers({ page: 1, pageSize: 10 })).rejects.toThrow();
  });

  it("allows admin users on admin.listUsers (may fail on DB but not on auth)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ role: "admin" })));
    try {
      await caller.admin.listUsers({ page: 1, pageSize: 10 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("allows owner (even with role=user) on admin.listUsers", async () => {
    const ownerOpenId = process.env.OWNER_OPEN_ID || "";
    if (!ownerOpenId) return; // Skip if no owner configured
    const caller = appRouter.createCaller(makeCtx(makeUser({ role: "user", openId: ownerOpenId })));
    try {
      await caller.admin.listUsers({ page: 1, pageSize: 10 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });
});

// ─── 3. protectedProcedure ──────────────────────────────────────────────────

describe("RBAC: protectedProcedure", () => {
  it("rejects unauthenticated users on projects.list", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    await expect(caller.projects.list({ page: 1, pageSize: 10 })).rejects.toThrow();
  });

  it("allows authenticated users on projects.list (may fail on DB but not on auth)", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    try {
      await caller.projects.list({ page: 1, pageSize: 10 });
    } catch (e: any) {
      expect(e.code).not.toBe("UNAUTHORIZED");
    }
  });
});

// ─── 4. Router structure ────────────────────────────────────────────────────

describe("Router structure", () => {
  it("has auth.me and auth.logout", () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    expect(typeof caller.auth.me).toBe("function");
    expect(typeof caller.auth.logout).toBe("function");
  });

  it("has admin sub-routes", () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ role: "admin" })));
    expect(typeof caller.admin.listUsers).toBe("function");
    expect(typeof caller.admin.getUser).toBe("function");
    expect(typeof caller.admin.updateUser).toBe("function");
    expect(typeof caller.admin.deleteUser).toBe("function");
    expect(typeof caller.admin.listInvites).toBe("function");
    expect(typeof caller.admin.createInvite).toBe("function");
    expect(typeof caller.admin.revokeInvite).toBe("function");
    expect(typeof caller.admin.listAuditLogs).toBe("function");
  });

  it("has projects sub-routes", () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    expect(typeof caller.projects.list).toBe("function");
    expect(typeof caller.projects.get).toBe("function");
    expect(typeof caller.projects.create).toBe("function");
    expect(typeof caller.projects.update).toBe("function");
    expect(typeof caller.projects.delete).toBe("function");
  });

  it("has testing domain sub-routes", () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    expect(typeof caller.profiles.list).toBe("function");
    expect(typeof caller.profiles.create).toBe("function");
    expect(typeof caller.scenarios.list).toBe("function");
    expect(typeof caller.scenarios.create).toBe("function");
    expect(typeof caller.datasets.list).toBe("function");
    expect(typeof caller.datasets.create).toBe("function");
    expect(typeof caller.executions.list).toBe("function");
    expect(typeof caller.executions.create).toBe("function");
    expect(typeof caller.captures.list).toBe("function");
    expect(typeof caller.captures.create).toBe("function");
    expect(typeof caller.probes.list).toBe("function");
    expect(typeof caller.probes.create).toBe("function");
    expect(typeof caller.scripts.list).toBe("function");
    expect(typeof caller.scripts.create).toBe("function");
  });
});

// ─── 5. Input validation ────────────────────────────────────────────────────

describe("Input validation", () => {
  it("rejects invalid email in admin.createInvite", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ role: "admin" })));
    await expect(
      caller.admin.createInvite({ email: "not-an-email", role: "VIEWER" })
    ).rejects.toThrow();
  });

  it("rejects empty project name in projects.create", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      caller.projects.create({ name: "", domain: "WEB" })
    ).rejects.toThrow();
  });

  it("rejects invalid role in admin.updateUser", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser({ role: "admin" })));
    await expect(
      // @ts-expect-error: testing invalid role
      caller.admin.updateUser({ userId: 1, role: "superadmin" })
    ).rejects.toThrow();
  });

  it("rejects invalid status in executions.updateStatus", async () => {
    const caller = appRouter.createCaller(makeCtx(makeUser()));
    await expect(
      // @ts-expect-error: testing invalid status
      caller.executions.updateStatus({ executionId: 1, status: "INVALID" })
    ).rejects.toThrow();
  });
});

// ─── 6. auth.me returns user ────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns null for unauthenticated context", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated context", async () => {
    const user = makeUser();
    const caller = appRouter.createCaller(makeCtx(user));
    const result = await caller.auth.me();
    expect(result).toEqual(user);
  });
});
