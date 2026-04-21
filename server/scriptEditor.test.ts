import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-editor-user",
    email: "editor@test.com",
    name: "Test Editor",
    loginMethod: "manus",
    role: "user",
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("scripts router — editor features", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);
  let scriptId: number;

  // Create a test script first
  beforeAll(async () => {
    const result = await caller.scripts.create({
      projectId: "test-editor-project-uid",
      name: "editor-test-script",
      framework: "playwright",
      language: "typescript",
      code: JSON.stringify({
        files: [
          { path: "tests/login.spec.ts", content: "test('login', async () => { /* v0 */ });" },
          { path: "pages/loginPage.ts", content: "export class LoginPage { /* v0 */ }" },
        ],
        plan: { steps: ["navigate", "fill", "submit"] },
        notes: "Initial generation",
        warnings: null,
        env: "PROD",
        bundleId: "test-bundle",
      }),
    });
    scriptId = result.scriptId;
  });

  it("get — retrieves the created script", async () => {
    const script = await caller.scripts.get({ scriptId });
    expect(script).toBeDefined();
    expect(script.id).toBe(scriptId);
    expect(script.framework).toBe("playwright");
    expect(script.language).toBe("typescript");
    // Verify code is valid JSON with files
    const payload = JSON.parse(script.code!);
    expect(payload.files).toHaveLength(2);
    expect(payload.files[0].path).toBe("tests/login.spec.ts");
  });

  it("autoSave — updates code without creating a version", async () => {
    const newCode = JSON.stringify({
      files: [
        { path: "tests/login.spec.ts", content: "test('login', async () => { /* auto-saved */ });" },
        { path: "pages/loginPage.ts", content: "export class LoginPage { /* auto-saved */ }" },
      ],
      plan: null,
      notes: null,
      warnings: null,
      env: "PROD",
      bundleId: "test-bundle",
    });

    const result = await caller.scripts.autoSave({ scriptId, code: newCode });
    expect(result.success).toBe(true);
    expect(result.savedAt).toBeDefined();

    // Verify code was updated
    const script = await caller.scripts.get({ scriptId });
    const payload = JSON.parse(script.code!);
    expect(payload.files[0].content).toContain("auto-saved");
  });

  it("saveVersion — creates a version snapshot", async () => {
    const result = await caller.scripts.saveVersion({
      scriptId,
      changeSummary: "Ajout du test de login",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(1);
  });

  it("saveVersion — increments version number", async () => {
    // Update code first
    await caller.scripts.autoSave({
      scriptId,
      code: JSON.stringify({
        files: [{ path: "tests/login.spec.ts", content: "test('login v2', async () => {});" }],
        plan: null, notes: null, warnings: null, env: "PROD", bundleId: "test-bundle",
      }),
    });

    const result = await caller.scripts.saveVersion({
      scriptId,
      changeSummary: "Version 2 — refactoring",
    });
    expect(result.success).toBe(true);
    expect(result.version).toBe(2);
  });

  it("getVersionHistory — lists all versions in descending order", async () => {
    const history = await caller.scripts.getVersionHistory({ scriptId });
    expect(history.data).toBeDefined();
    expect(history.data.length).toBeGreaterThanOrEqual(2);
    // Most recent first
    expect(history.data[0].version).toBeGreaterThan(history.data[1].version);
    expect(history.data[0].changeSummary).toBe("Version 2 — refactoring");
    expect(history.data[1].changeSummary).toBe("Ajout du test de login");
  });

  it("restoreVersion — restores a previous version and auto-saves current", async () => {
    const history = await caller.scripts.getVersionHistory({ scriptId });
    const v1 = history.data.find((v: any) => v.version === 1);
    expect(v1).toBeDefined();

    const result = await caller.scripts.restoreVersion({
      scriptId,
      versionId: v1!.id,
    });
    expect(result.success).toBe(true);
    expect(result.restoredVersion).toBe(1);

    // Verify code was restored to v1 content
    const script = await caller.scripts.get({ scriptId });
    const payload = JSON.parse(script.code!);
    expect(payload.files[0].content).toContain("auto-saved");

    // Verify a new auto-save version was created
    const newHistory = await caller.scripts.getVersionHistory({ scriptId });
    expect(newHistory.data.length).toBeGreaterThan(history.data.length);
    expect(newHistory.data[0].changeSummary).toContain("Auto-save before restore");
  });

  it("update — changes script status", async () => {
    const result = await caller.scripts.update({
      scriptId,
      status: "VALIDATED",
    });
    expect(result.success).toBe(true);

    const script = await caller.scripts.get({ scriptId });
    expect(script.status).toBe("VALIDATED");
  });

  // Cleanup
  it("delete — removes the test script", async () => {
    const result = await caller.scripts.delete({ scriptId });
    expect(result.success).toBe(true);
  });
});
