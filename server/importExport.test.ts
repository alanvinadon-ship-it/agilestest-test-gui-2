import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-import-export-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return { ctx };
}

describe("projects.exportProject", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("should return structured export data for a valid project", async () => {
    // First create a project to export
    const created = await caller.projects.create({
      name: "Export Test Project",
      description: "Test project for export",
      domain: "IMS",
    });
    expect(created.uid).toBeTruthy();

    const result = await caller.projects.exportProject({ projectId: created.uid });

    // Verify export structure
    expect(result).toHaveProperty("version", "1.0");
    expect(result).toHaveProperty("exportedAt");
    expect(result).toHaveProperty("project");
    expect(result.project.name).toBe("Export Test Project");
    expect(result.project.domain).toBe("IMS");

    // Verify all sections exist (even if empty)
    expect(result).toHaveProperty("profiles");
    expect(result).toHaveProperty("scenarios");
    expect(result).toHaveProperty("datasetTypes");
    expect(result).toHaveProperty("datasetInstances");
    expect(result).toHaveProperty("bundles");
    expect(result).toHaveProperty("scripts");
    expect(Array.isArray(result.profiles)).toBe(true);
    expect(Array.isArray(result.scenarios)).toBe(true);
    expect(Array.isArray(result.datasetInstances)).toBe(true);
    expect(Array.isArray(result.bundles)).toBe(true);
    expect(Array.isArray(result.scripts)).toBe(true);

    // Cleanup
    await caller.projects.delete({ projectId: created.uid });
  });

  it("should throw NOT_FOUND for non-existent project", async () => {
    await expect(
      caller.projects.exportProject({ projectId: "non-existent-uid" })
    ).rejects.toThrow();
  });
});

describe("projects.importProject", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  const validExportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    project: {
      name: "Imported Test Project",
      description: "A project imported from JSON",
      domain: "5GC",
      status: "ACTIVE",
    },
    profiles: [
      {
        uid: "profile-uid-001",
        name: "SIP Profile",
        description: "Test SIP profile",
        protocol: "SIP",
        testType: "VABF",
        domain: "IMS",
        profileType: "FUNCTIONAL",
        targetHost: "10.0.0.1",
        targetPort: 5060,
        parameters: { timeout: 30 },
        config: { retries: 3 },
      },
    ],
    scenarios: [
      {
        uid: "scenario-uid-001",
        scenarioCode: "SC-IMP001",
        name: "Registration Test",
        description: "Test SIP registration",
        testType: "VABF",
        status: "DRAFT",
        version: 1,
        steps: [{ action: "REGISTER", expected: "200 OK" }],
        requiredDatasetTypes: ["sip-credentials"],
        profileId: "profile-uid-001",
      },
    ],
    datasetInstances: [],
    bundles: [],
    scripts: [],
  };

  it("should create a new project from valid export data", async () => {
    const result = await caller.projects.importProject({ data: validExportData });

    expect(result.success).toBe(true);
    expect(result.projectId).toBeTruthy();

    // Verify the project was created
    const project = await caller.projects.get({ projectId: result.projectId! });
    expect(project.name).toBe("Imported Test Project (import)");
    expect(project.domain).toBe("5GC");

    // Cleanup
    await caller.projects.delete({ projectId: result.projectId! });
  });

  it("should import into an existing project when targetProjectId is provided", async () => {
    // Create target project first
    const target = await caller.projects.create({
      name: "Target Project",
      domain: "IMS",
    });

    const result = await caller.projects.importProject({
      data: validExportData,
      targetProjectId: target.uid,
    });

    expect(result.success).toBe(true);
    expect(result.projectId).toBe(target.uid);

    // Cleanup
    await caller.projects.delete({ projectId: target.uid });
  });

  it("should reject invalid export format", async () => {
    await expect(
      caller.projects.importProject({ data: { invalid: true } })
    ).rejects.toThrow();
  });

  it("should reject export data without version", async () => {
    await expect(
      caller.projects.importProject({ data: { project: { name: "Test" } } })
    ).rejects.toThrow();
  });

  it("should reject export data without project", async () => {
    await expect(
      caller.projects.importProject({ data: { version: "1.0" } })
    ).rejects.toThrow();
  });

  it("should handle empty arrays gracefully", async () => {
    const emptyData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      project: { name: "Empty Project", domain: "WEB", status: "ACTIVE" },
      profiles: [],
      scenarios: [],
      datasetInstances: [],
      bundles: [],
      scripts: [],
    };

    const result = await caller.projects.importProject({ data: emptyData });
    expect(result.success).toBe(true);

    // Cleanup
    await caller.projects.delete({ projectId: result.projectId! });
  });
});

describe("projects export → import roundtrip", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  it("should preserve data through export → import cycle", async () => {
    // 1. Create a project
    const original = await caller.projects.create({
      name: "Roundtrip Test",
      description: "Testing export→import cycle",
      domain: "IMS",
    });

    // 2. Export it
    const exported = await caller.projects.exportProject({ projectId: original.uid });
    expect(exported.project.name).toBe("Roundtrip Test");

    // 3. Import the exported data as a new project
    const imported = await caller.projects.importProject({ data: exported });
    expect(imported.success).toBe(true);

    // 4. Verify the imported project
    const importedProject = await caller.projects.get({ projectId: imported.projectId! });
    expect(importedProject.name).toBe("Roundtrip Test (import)");
    expect(importedProject.domain).toBe("IMS");

    // Cleanup
    await caller.projects.delete({ projectId: original.uid });
    await caller.projects.delete({ projectId: imported.projectId! });
  });
});
