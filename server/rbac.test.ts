import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { invalidateRoleCache, invalidatePermCache } from "./rbac/middleware";

// ═══════════════════════════════════════════════════════════════════════════
// TEST HARNESS — Simulate tRPC calls with different user roles
// ═══════════════════════════════════════════════════════════════════════════

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/**
 * Create a tRPC context with a specific user role.
 * The RBAC middleware resolves roles from user_roles table,
 * but falls back to users.role === 'admin' → ORG_ADMIN.
 * For non-admin roles, we rely on the user_roles table seeding.
 */
function createCtx(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: overrides?.openId ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: overrides?.email ?? "test@agilestest.io",
    name: overrides?.name ?? "Test User",
    fullName: overrides?.fullName ?? "Test User",
    loginMethod: "manus",
    role: overrides?.role ?? "user",
    status: "ACTIVE",
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createCaller(ctx: TrpcContext) {
  return appRouter.createCaller(ctx);
}

function unauthCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RBAC SETUP — Seed roles in the DB for each test suite
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Seed a user with a specific application role via admin endpoints.
 * Uses an ORG_ADMIN caller to create the role and assign it.
 */
async function seedUserWithRole(roleName: string, userId: string): Promise<void> {
  const adminCtx = createCtx({ openId: "admin-seeder", role: "admin" });
  const adminCaller = createCaller(adminCtx);

  // Check if role already exists
  const existingRoles = await adminCaller.admin.listRoles();
  let roleUid = existingRoles.find(r => r.name === roleName)?.uid;

  if (!roleUid) {
    const created = await adminCaller.admin.createRole({
      name: roleName,
      description: `Test role: ${roleName}`,
      scope: "GLOBAL",
    });
    roleUid = created.uid;
  }

  // Assign role to user
  try {
    await adminCaller.admin.addRoleToUser({ userId, roleId: roleUid });
  } catch {
    // Role already assigned — ignore
  }

  // Clear caches so the role is picked up immediately
  invalidateRoleCache(userId);
  invalidatePermCache();
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. UNAUTHENTICATED ACCESS — Must be blocked everywhere
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: Unauthenticated access", () => {
  it("rejects unauthenticated user from projects.list", async () => {
    const caller = createCaller(unauthCtx());
    await expect(caller.projects.list()).rejects.toThrow(/10001|Authentication required/);
  });

  it("rejects unauthenticated user from admin.listRoles", async () => {
    const caller = createCaller(unauthCtx());
    await expect(caller.admin.listRoles()).rejects.toThrow(/10001|Authentication required/);
  });

  it("rejects unauthenticated user from executions.create", async () => {
    const caller = createCaller(unauthCtx());
    await expect(
      caller.executions.create({
        projectId: "fake-project",
        profileId: "fake-profile",
        scenarioId: "fake-scenario",
      })
    ).rejects.toThrow(/10001|Authentication required/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. VIEWER ROLE — Read-only, cannot mutate
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: VIEWER role restrictions", () => {
  const viewerId = `viewer-${Date.now()}`;

  beforeEach(async () => {
    await seedUserWithRole("VIEWER", viewerId);
  });

  it("VIEWER can list projects", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    const result = await caller.projects.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("VIEWER cannot delete a project", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.projects.delete({ uid: "nonexistent-project" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("VIEWER cannot create a profile", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.profiles.create({
        projectId: "fake-project",
        name: "Blocked Profile",
        testType: "VABF",
        protocol: "SIP",
        domain: "TELECOM_IMS",
      })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("VIEWER cannot create a scenario", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.scenarios.create({
        projectId: "fake-project",
        profileId: "fake-profile",
        scenarioCode: "BLOCKED-001",
        name: "Blocked Scenario",
        testType: "VABF",
      })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("VIEWER cannot manage users (admin.createInvite)", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.admin.createInvite({
        email: "blocked@test.io",
        expiresAt: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("VIEWER cannot create an execution", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.executions.create({
        projectId: "fake-project",
        profileId: "fake-profile",
        scenarioId: "fake-scenario",
      })
    ).rejects.toThrow(/10002|Insufficient role/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. TEST_ENGINEER ROLE — Can run tests, cannot manage users/roles
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: TEST_ENGINEER role restrictions", () => {
  const engineerId = `engineer-${Date.now()}`;

  beforeEach(async () => {
    await seedUserWithRole("TEST_ENGINEER", engineerId);
  });

  it("TEST_ENGINEER can create an execution", async () => {
    // First create project/profile/scenario as admin
    const adminCtx = createCtx({ openId: "admin-setup", role: "admin" });
    const adminCaller = createCaller(adminCtx);
    const project = await adminCaller.projects.create({
      name: "Engineer Test Project",
      domain: "API",
    });
    const profile = await adminCaller.profiles.create({
      projectId: project.uid,
      name: "Engineer Profile",
      testType: "VABF",
      protocol: "HTTP",
      domain: "API",
    });
    const scenario = await adminCaller.scenarios.create({
      projectId: project.uid,
      profileId: profile.uid,
      scenarioCode: "ENG-001",
      name: "Engineer Scenario",
      testType: "VABF",
    });

    // Now test as TEST_ENGINEER
    const ctx = createCtx({ openId: engineerId });
    const caller = createCaller(ctx);
    const exec = await caller.executions.create({
      projectId: project.uid,
      profileId: profile.uid,
      scenarioId: scenario.uid,
    });
    expect(exec).toBeDefined();
    expect(exec.uid).toBeTruthy();
  });

  it("TEST_ENGINEER cannot manage users (admin.createInvite)", async () => {
    const ctx = createCtx({ openId: engineerId });
    const caller = createCaller(ctx);
    await expect(
      caller.admin.createInvite({
        email: "blocked@test.io",
        expiresAt: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("TEST_ENGINEER cannot delete a project", async () => {
    const ctx = createCtx({ openId: engineerId });
    const caller = createCaller(ctx);
    await expect(
      caller.projects.delete({ uid: "nonexistent" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("TEST_ENGINEER cannot create roles", async () => {
    const ctx = createCtx({ openId: engineerId });
    const caller = createCaller(ctx);
    await expect(
      caller.admin.createRole({ name: "HACKER_ROLE", scope: "GLOBAL" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("TEST_ENGINEER cannot create a profile (requires QA_MANAGER)", async () => {
    const ctx = createCtx({ openId: engineerId });
    const caller = createCaller(ctx);
    await expect(
      caller.profiles.create({
        projectId: "fake-project",
        name: "Blocked Profile",
        testType: "VABF",
        protocol: "SIP",
        domain: "TELECOM_IMS",
      })
    ).rejects.toThrow(/10002|Insufficient role/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. SECURITY_ANALYST ROLE — Specific access pattern
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: SECURITY_ANALYST role restrictions", () => {
  const analystId = `analyst-${Date.now()}`;

  beforeEach(async () => {
    await seedUserWithRole("SECURITY_ANALYST", analystId);
  });

  it("SECURITY_ANALYST cannot create a project", async () => {
    const ctx = createCtx({ openId: analystId });
    const caller = createCaller(ctx);
    await expect(
      caller.projects.create({ name: "Blocked", domain: "API" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("SECURITY_ANALYST cannot delete an organization/project", async () => {
    const ctx = createCtx({ openId: analystId });
    const caller = createCaller(ctx);
    await expect(
      caller.projects.delete({ uid: "nonexistent" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("SECURITY_ANALYST can list projects (read-only)", async () => {
    const ctx = createCtx({ openId: analystId });
    const caller = createCaller(ctx);
    const result = await caller.projects.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. QA_MANAGER ROLE — Can create/edit plans, cannot manage users
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: QA_MANAGER role permissions", () => {
  const managerId = `manager-${Date.now()}`;

  beforeEach(async () => {
    await seedUserWithRole("QA_MANAGER", managerId);
  });

  it("QA_MANAGER can create a project", async () => {
    const ctx = createCtx({ openId: managerId });
    const caller = createCaller(ctx);
    const result = await caller.projects.create({
      name: "Manager Project",
      domain: "TELECOM_IMS",
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
  });

  it("QA_MANAGER can create a profile", async () => {
    const ctx = createCtx({ openId: managerId });
    const caller = createCaller(ctx);
    const project = await caller.projects.create({
      name: "Manager Profile Project",
      domain: "API",
    });
    const profile = await caller.profiles.create({
      projectId: project.uid,
      name: "Manager Profile",
      testType: "VABF",
      protocol: "HTTP",
      domain: "API",
    });
    expect(profile).toBeDefined();
    expect(profile.uid).toBeTruthy();
  });

  it("QA_MANAGER can create a scenario", async () => {
    const ctx = createCtx({ openId: managerId });
    const caller = createCaller(ctx);
    const project = await caller.projects.create({
      name: "Manager Scenario Project",
      domain: "API",
    });
    const profile = await caller.profiles.create({
      projectId: project.uid,
      name: "Manager Scenario Profile",
      testType: "VABF",
      protocol: "HTTP",
      domain: "API",
    });
    const scenario = await caller.scenarios.create({
      projectId: project.uid,
      profileId: profile.uid,
      scenarioCode: "MGR-001",
      name: "Manager Scenario",
      testType: "VABF",
    });
    expect(scenario).toBeDefined();
    expect(scenario.uid).toBeTruthy();
  });

  it("QA_MANAGER cannot delete a project (requires ORG_ADMIN)", async () => {
    const ctx = createCtx({ openId: managerId });
    const caller = createCaller(ctx);
    await expect(
      caller.projects.delete({ uid: "nonexistent" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("QA_MANAGER cannot manage user roles (admin.addRoleToUser)", async () => {
    const ctx = createCtx({ openId: managerId });
    const caller = createCaller(ctx);
    await expect(
      caller.admin.addRoleToUser({ userId: "fake-user", roleId: "fake-role" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("QA_MANAGER can read audit logs", async () => {
    const ctx = createCtx({ openId: managerId });
    const caller = createCaller(ctx);
    const logs = await caller.admin.listAuditLogs({});
    expect(Array.isArray(logs)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. ORG_ADMIN ROLE — Full access
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: ORG_ADMIN full access", () => {
  it("ORG_ADMIN (via users.role=admin) can delete a project", async () => {
    const adminCtx = createCtx({ role: "admin" });
    const caller = createCaller(adminCtx);
    const project = await caller.projects.create({
      name: "Admin Delete Test",
      domain: "API",
    });
    await caller.projects.delete({ uid: project.uid });
    const fetched = await caller.projects.getByUid({ uid: project.uid });
    expect(fetched).toBeUndefined();
  });

  it("ORG_ADMIN can manage user roles", async () => {
    const adminCtx = createCtx({ role: "admin" });
    const caller = createCaller(adminCtx);
    const role = await caller.admin.createRole({
      name: `TEST_ROLE_${Date.now()}`,
      scope: "GLOBAL",
    });
    expect(role).toBeDefined();
    expect(role.uid).toBeTruthy();
  });

  it("ORG_ADMIN can create invites", async () => {
    const adminCtx = createCtx({ role: "admin" });
    const caller = createCaller(adminCtx);
    const invite = await caller.admin.createInvite({
      email: `admin-test-${Date.now()}@agilestest.io`,
      expiresAt: new Date(Date.now() + 86400000),
    });
    expect(invite).toBeDefined();
    expect(invite.uid).toBeTruthy();
  });

  it("ORG_ADMIN can read audit logs", async () => {
    const adminCtx = createCtx({ role: "admin" });
    const caller = createCaller(adminCtx);
    const logs = await caller.admin.listAuditLogs({ limit: 10 });
    expect(Array.isArray(logs)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. CROSS-ROLE ESCALATION — Ensure no privilege escalation
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: Privilege escalation prevention", () => {
  const viewerId = `viewer-esc-${Date.now()}`;

  beforeEach(async () => {
    await seedUserWithRole("VIEWER", viewerId);
  });

  it("VIEWER cannot assign roles to themselves", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.admin.addRoleToUser({ userId: viewerId, roleId: "fake-admin-role" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("VIEWER cannot create permissions", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.admin.createPermission({ module: "admin", action: "delete_all" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });

  it("VIEWER cannot delete memberships", async () => {
    const ctx = createCtx({ openId: viewerId });
    const caller = createCaller(ctx);
    await expect(
      caller.admin.deleteMembership({ uid: "fake-membership" })
    ).rejects.toThrow(/10002|Insufficient role/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. AUDIT LOGGING — Verify mutations are logged
// ═══════════════════════════════════════════════════════════════════════════

describe("RBAC: Audit logging", () => {
  it("successful mutation creates an audit log entry", async () => {
    const adminCtx = createCtx({ role: "admin", openId: "audit-admin" });
    const caller = createCaller(adminCtx);

    // Create a project (this should be audited)
    const project = await caller.projects.create({
      name: "Audit Test Project",
      domain: "API",
    });
    expect(project.uid).toBeTruthy();

    // Check audit logs for this action
    const logs = await caller.admin.listAuditLogs({
      actorId: "audit-admin",
      entityType: "project",
      limit: 5,
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const createLog = logs.find(
      l => l.action === "CREATE" && l.entityType === "project"
    );
    expect(createLog).toBeDefined();
    expect(createLog?.actorId).toBe("audit-admin");
  });
});
