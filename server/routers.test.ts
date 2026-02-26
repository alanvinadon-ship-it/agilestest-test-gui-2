import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@agilestest.io",
    name: "Test User",
    fullName: "Test User",
    loginMethod: "manus",
    role: "admin",
    status: "ACTIVE",
    passwordHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

// ─── Projects ───────────────────────────────────────────────────────────────

describe("projects", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("creates a project", async () => {
    const result = await caller.projects.create({
      name: "Projet Test Vitest",
      domain: "TELECOM_IMS",
      description: "Projet créé par les tests Vitest",
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
    expect(result.name).toBe("Projet Test Vitest");
    expect(result.domain).toBe("TELECOM_IMS");
  });

  it("lists projects", async () => {
    const results = await caller.projects.list();
    expect(Array.isArray(results)).toBe(true);
  });

  it("creates and retrieves a project by uid", async () => {
    const created = await caller.projects.create({
      name: "Projet Retrieve Test",
      domain: "API",
    });
    const fetched = await caller.projects.getByUid({ uid: created.uid });
    expect(fetched).toBeDefined();
    expect(fetched?.name).toBe("Projet Retrieve Test");
  });

  it("updates a project", async () => {
    const created = await caller.projects.create({
      name: "Projet Update Test",
      domain: "WEB",
    });
    const updated = await caller.projects.update({
      uid: created.uid,
      name: "Projet Updated",
      status: "ARCHIVED",
    });
    expect(updated).toBeDefined();
  });

  it("deletes a project", async () => {
    const created = await caller.projects.create({
      name: "Projet Delete Test",
      domain: "MOBILE",
    });
    await caller.projects.delete({ uid: created.uid });
    const fetched = await caller.projects.getByUid({ uid: created.uid });
    expect(fetched).toBeUndefined();
  });
});

// ─── Profiles ───────────────────────────────────────────────────────────────

describe("profiles", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let projectUid: string;

  beforeEach(async () => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
    const project = await caller.projects.create({
      name: "Profile Test Project",
      domain: "TELECOM_IMS",
    });
    projectUid = project.uid;
  });

  it("creates a profile", async () => {
    const result = await caller.profiles.create({
      projectId: projectUid,
      name: "Profil IMS VoLTE",
      testType: "VABF",
      protocol: "SIP",
      domain: "TELECOM_IMS",
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
    expect(result.name).toBe("Profil IMS VoLTE");
  });

  it("lists profiles by project", async () => {
    await caller.profiles.create({
      projectId: projectUid,
      name: "Profil List Test",
      testType: "VABF",
      protocol: "HTTP",
      domain: "API",
    });
    const results = await caller.profiles.list({ projectId: projectUid });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Scenarios ──────────────────────────────────────────────────────────────

describe("scenarios", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let projectUid: string;
  let profileUid: string;

  beforeEach(async () => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
    const project = await caller.projects.create({
      name: "Scenario Test Project",
      domain: "API",
    });
    projectUid = project.uid;
    const profile = await caller.profiles.create({
      projectId: projectUid,
      name: "Profil Scenario Test",
      testType: "VABF",
      protocol: "HTTP",
      domain: "API",
    });
    profileUid = profile.uid;
  });

  it("creates a scenario", async () => {
    const result = await caller.scenarios.create({
      projectId: projectUid,
      profileId: profileUid,
      scenarioCode: "VABF-API-001",
      name: "Test API Login",
      description: "Vérifie le flux de login API",
      testType: "VABF",
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
    expect(result.name).toBe("Test API Login");
  });

  it("lists scenarios by project", async () => {
    await caller.scenarios.create({
      projectId: projectUid,
      profileId: profileUid,
      scenarioCode: "VABF-API-002",
      name: "Test API List",
      testType: "VABF",
    });
    const results = await caller.scenarios.list({ projectId: projectUid });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("updates a scenario status", async () => {
    const created = await caller.scenarios.create({
      projectId: projectUid,
      profileId: profileUid,
      scenarioCode: "VABF-API-003",
      name: "Test API Update",
      testType: "VABF",
    });
    const updated = await caller.scenarios.update({
      uid: created.uid,
      status: "FINAL",
    });
    expect(updated).toBeDefined();
  });
});

// ─── Executions ─────────────────────────────────────────────────────────────

describe("executions", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let projectUid: string;
  let profileUid: string;
  let scenarioUid: string;

  beforeEach(async () => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
    const project = await caller.projects.create({
      name: "Execution Test Project",
      domain: "WEB",
    });
    projectUid = project.uid;
    const profile = await caller.profiles.create({
      projectId: projectUid,
      name: "Profil Exec Test",
      testType: "VABF",
      protocol: "HTTP",
      domain: "WEB",
    });
    profileUid = profile.uid;
    const scenario = await caller.scenarios.create({
      projectId: projectUid,
      profileId: profile.uid,
      scenarioCode: "VABF-WEB-001",
      name: "Test Exec Scenario",
      testType: "VABF",
    });
    scenarioUid = scenario.uid;
  });

  it("creates an execution", async () => {
    const result = await caller.executions.create({
      projectId: projectUid,
      profileId: profileUid,
      scenarioId: scenarioUid,
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
  });

  it("lists executions by project", async () => {
    await caller.executions.create({
      projectId: projectUid,
      profileId: profileUid,
      scenarioId: scenarioUid,
    });
    const results = await caller.executions.list({ projectId: projectUid });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Captures ───────────────────────────────────────────────────────────────

describe("captures", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("creates a capture source", async () => {
    const result = await caller.captures.createSource({
      captureId: `cap-${Date.now()}`,
      namespace: "default",
      host: "probe-01.local",
      sshPort: 22,
      sshUser: "root",
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
  });

  it("lists capture sources", async () => {
    const created = await caller.captures.createSource({
      captureId: `cap-list-${Date.now()}`,
      namespace: "default",
    });
    const results = await caller.captures.listSources({ captureId: created.captureId ?? `cap-list-${Date.now()}` });
    expect(Array.isArray(results)).toBe(true);
  });
});

// ─── Probes ─────────────────────────────────────────────────────────────────

describe("probes", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
  });

  it("creates a probe", async () => {
    const result = await caller.probes.create({
      site: "Paris-DC1",
      zone: "EU-WEST",
      type: "LINUX_EDGE",
      capabilities: ["PCAP", "SIP", "HTTP"],
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
  });

  it("lists probes", async () => {
    const results = await caller.probes.list({});
    expect(Array.isArray(results)).toBe(true);
  });
});

// ─── Datasets ───────────────────────────────────────────────────────────────

describe("datasets", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let projectUid: string;

  beforeEach(async () => {
    const { ctx } = createAuthContext();
    caller = appRouter.createCaller(ctx);
    const project = await caller.projects.create({
      name: "Dataset Test Project",
      domain: "TELECOM_IMS",
    });
    projectUid = project.uid;
  });

  it("creates a dataset type", async () => {
    const result = await caller.datasets.createType({
      datasetTypeId: `dt-${Date.now()}`,
      domain: "TELECOM_IMS",
      name: "SIP Credentials",
      testType: "VABF",
      schemaFields: [
        { name: "username", type: "string", required: true },
        { name: "password", type: "secret", required: true },
      ],
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
    expect(result.name).toBe("SIP Credentials");
  });

  it("lists dataset types", async () => {
    const results = await caller.datasets.listTypes({});
    expect(Array.isArray(results)).toBe(true);
  });

  it("creates a dataset instance", async () => {
    const dtype = await caller.datasets.createType({
      datasetTypeId: `dt-inst-${Date.now()}`,
      domain: "API",
      name: "HTTP Headers",
      schemaFields: [{ name: "Authorization", type: "string", required: true }],
    });
    const result = await caller.datasets.createInstance({
      projectId: projectUid,
      datasetTypeId: dtype.uid,
      env: "DEV",
      valuesJson: { Authorization: "Bearer test-token" },
    });
    expect(result).toBeDefined();
    expect(result.uid).toBeTruthy();
  });
});

// ─── Auth.me ────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.openId).toBe("test-user-001");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});
