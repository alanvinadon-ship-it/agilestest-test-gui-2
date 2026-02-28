/**
 * E2E Validation: Import/Export Project
 *
 * Seeds a fully populated project (5 profiles, 10 scenarios, 6 dataset types,
 * 20 dataset instances, 3 bundles with items, 5 scripts), exports it,
 * imports into a new project, then verifies:
 *   - Counts match
 *   - FK integrity (no stale source UIDs)
 *   - Content equality (ignoring non-deterministic fields: uid, id, created_at, updated_at)
 *   - Idempotence: inject into existing project without breakage
 */
import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "e2e-import-export-user",
    email: "e2e@test.com",
    name: "E2E Tester",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    ctx: {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    },
  };
}

/** Strip non-deterministic fields for comparison */
function normalize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(normalize);
  if (obj && typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (["uid", "id", "createdAt", "updatedAt", "created_at", "updated_at", "exportedAt", "profileId", "scenarioId", "datasetId", "bundleId"].includes(k)) continue;
      out[k] = normalize(v);
    }
    return out;
  }
  return obj;
}

describe("E2E Import/Export Validation", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  // Track created resources for cleanup
  const projectUids: string[] = [];
  const datasetTypeIds: string[] = [];

  afterAll(async () => {
    // Cleanup projects
    for (const uid of projectUids) {
      try { await caller.projects.delete({ projectId: uid }); } catch {}
    }
    // Cleanup dataset types
    for (const dtId of datasetTypeIds) {
      try { await caller.datasetTypes.delete({ datasetTypeId: dtId }); } catch {}
    }
  });

  // ─── Helper: Seed a fully populated project ────────────────────────────
  async function seedPopulatedProject() {
    // 1) Create project
    const project = await caller.projects.create({
      name: "E2E Populated Project",
      description: "Project with all entity types for E2E validation",
      domain: "IMS",
    });
    projectUids.push(project.uid);

    // 2) Create 5 profiles
    const profileUids: string[] = [];
    const protocols = ["SIP", "HTTP", "DIAMETER", "RADIUS", "SSH"];
    const testTypes = ["VABF", "VABE", "VSR", "VABF", "VABE"] as const;
    for (let i = 0; i < 5; i++) {
      const p = await caller.profiles.create({
        projectId: project.uid,
        name: `Profile ${i + 1} - ${protocols[i]}`,
        description: `Test profile #${i + 1} for ${protocols[i]}`,
        profileType: "WEB",
        testType: testTypes[i],
        protocol: protocols[i],
        targetHost: `host-${i + 1}.example.com`,
        targetPort: 5060 + i,
        parameters: { timeout: 30, retries: 3, index: i },
      });
      profileUids.push(p.uid);
    }

    // 3) Create 10 scenarios with varied steps and tags
    const scenarioUids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const s = await caller.scenarios.create({
        projectId: project.uid,
        name: `Scenario ${i + 1} - Test Case`,
        description: `E2E scenario #${i + 1} with ${(i % 3) + 2} steps`,
        profileId: profileUids[i % 5],
        testType: testTypes[i % 3],
        status: i < 7 ? "DRAFT" : "FINAL",
        steps: Array.from({ length: (i % 3) + 2 }, (_, j) => ({
          order: j + 1,
          action: `step_${j + 1}_action`,
          expected: `Expected result for step ${j + 1}`,
          protocol: protocols[i % 5],
          data: { key: `value_${i}_${j}` },
        })),
        requiredDatasetTypes: [`DT-E2E-${(i % 6) + 1}`],
      });
      scenarioUids.push(s.uid);
    }

    // 4) Create 6 dataset types (global, not project-scoped)
    for (let i = 0; i < 6; i++) {
      const dtId = `DT-E2E-${i + 1}`;
      datasetTypeIds.push(dtId);
      try {
        await caller.datasetTypes.create({
          datasetTypeId: dtId,
          name: `Dataset Type ${i + 1}`,
          description: `E2E dataset type #${i + 1}`,
          domain: i < 3 ? "IMS" : "5GC",
          testType: testTypes[i % 3],
          schemaFields: [
            { name: "field_a", type: "string", required: true },
            { name: "field_b", type: "number", required: false },
            { name: `field_${i}`, type: "string", required: true },
          ],
        });
      } catch {
        // May already exist from a previous run
      }
    }

    // 5) Create 20 dataset instances
    const instanceUids: string[] = [];
    const envs = ["DEV", "PREPROD", "PILOT_ORANGE", "PROD"] as const;
    for (let i = 0; i < 20; i++) {
      const di = await caller.datasetInstances.create({
        projectId: project.uid,
        datasetTypeId: `DT-E2E-${(i % 6) + 1}`,
        env: envs[i % 4],
        valuesJson: { field_a: `value_${i}`, field_b: i * 10, field_extra: `extra_${i}` },
        notes: `Instance #${i + 1} notes`,
        status: i < 15 ? "DRAFT" : "ACTIVE",
      });
      instanceUids.push(di.datasetId);
    }

    // 6) Create 3 bundles with items
    const bundleUids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const b = await caller.bundles.create({
        projectId: project.uid,
        name: `Bundle ${i + 1} - ${envs[i]}`,
        env: envs[i],
        tags: [`tag-${i}`, "e2e"],
      });
      bundleUids.push(b.bundleId);

      // Add items to each bundle (varying count)
      const itemCount = 3 + i * 2; // 3, 5, 7 items
      for (let j = 0; j < Math.min(itemCount, instanceUids.length); j++) {
        try {
          await caller.bundleItems.add({
            bundleId: b.bundleId,
            datasetId: instanceUids[(i * 5 + j) % instanceUids.length],
          });
        } catch {
          // Skip duplicates
        }
      }
    }

    // 7) Create 5 scripts
    for (let i = 0; i < 5; i++) {
      await caller.scripts.create({
        projectId: project.uid,
        name: `Script ${i + 1}`,
        framework: i < 3 ? "playwright" : "cypress",
        language: "typescript",
        code: `// Generated script ${i + 1}\nimport { test } from '@playwright/test';\ntest('test ${i + 1}', async ({ page }) => {\n  await page.goto('https://example.com');\n});`,
      });
    }

    return { projectUid: project.uid, profileUids, scenarioUids, instanceUids, bundleUids };
  }

  // ─── Test 1: Export produces correct counts ────────────────────────────
  let exportData: any;
  let sourceProjectUid: string;
  let sourceProfileUids: string[];
  let sourceScenarioUids: string[];
  let sourceInstanceUids: string[];
  let sourceBundleUids: string[];

  it("should seed a populated project and export it with correct counts", async () => {
    const seed = await seedPopulatedProject();
    sourceProjectUid = seed.projectUid;
    sourceProfileUids = seed.profileUids;
    sourceScenarioUids = seed.scenarioUids;
    sourceInstanceUids = seed.instanceUids;
    sourceBundleUids = seed.bundleUids;

    exportData = await caller.projects.exportProject({ projectId: sourceProjectUid });

    // Verify structure
    expect(exportData.version).toBe("1.0");
    expect(exportData.exportedAt).toBeTruthy();
    expect(exportData.project.name).toBe("E2E Populated Project");
    expect(exportData.project.domain).toBe("IMS");

    // Verify counts
    expect(exportData.profiles).toHaveLength(5);
    expect(exportData.scenarios).toHaveLength(10);
    expect(exportData.datasetInstances).toHaveLength(20);
    expect(exportData.bundles).toHaveLength(3);
    expect(exportData.scripts).toHaveLength(5);
    // datasetTypes are global, so count may vary
    expect(exportData.datasetTypes.length).toBeGreaterThanOrEqual(6);
  }, 30000);

  // ─── Test 2: Export content integrity ──────────────────────────────────
  it("should export profiles with correct content", () => {
    for (const p of exportData.profiles) {
      expect(p.name).toBeTruthy();
      expect(p.protocol).toBeTruthy();
      expect(p.parameters).toBeTruthy();
      expect(p.uid).toBeTruthy();
    }
    // Verify specific profile content
    const sipProfile = exportData.profiles.find((p: any) => p.name.includes("SIP"));
    expect(sipProfile).toBeTruthy();
    expect(sipProfile.protocol).toBe("SIP");
    expect(sipProfile.targetPort).toBe(5060);
    expect(sipProfile.parameters.timeout).toBe(30);
  });

  it("should export scenarios with steps and profile references", () => {
    for (const s of exportData.scenarios) {
      expect(s.name).toBeTruthy();
      expect(s.steps).toBeTruthy();
      expect(Array.isArray(s.steps)).toBe(true);
      expect(s.steps.length).toBeGreaterThanOrEqual(2);
      // Each step should have order, action, expected
      for (const step of s.steps) {
        expect(step.order).toBeTruthy();
        expect(step.action).toBeTruthy();
        expect(step.expected).toBeTruthy();
      }
    }
    // Verify profileId references exist in exported profiles
    const exportedProfileUids = new Set(exportData.profiles.map((p: any) => p.uid));
    for (const s of exportData.scenarios) {
      if (s.profileId) {
        expect(exportedProfileUids.has(s.profileId)).toBe(true);
      }
    }
  });

  it("should export bundles with items referencing dataset instances", () => {
    let totalItems = 0;
    for (const b of exportData.bundles) {
      expect(b.name).toBeTruthy();
      expect(b.env).toBeTruthy();
      expect(Array.isArray(b.items)).toBe(true);
      totalItems += b.items.length;
    }
    expect(totalItems).toBeGreaterThan(0);
  });

  it("should export scripts with code content", () => {
    for (const s of exportData.scripts) {
      expect(s.framework).toBeTruthy();
      expect(s.language).toBe("typescript");
      expect(s.code).toContain("import");
    }
    const playwrightScripts = exportData.scripts.filter((s: any) => s.framework === "playwright");
    const cypressScripts = exportData.scripts.filter((s: any) => s.framework === "cypress");
    expect(playwrightScripts.length).toBe(3);
    expect(cypressScripts.length).toBe(2);
  });

  // ─── Test 3: Import into new project ───────────────────────────────────
  let importedProjectUid: string;

  it("should import into a new project with correct counts", async () => {
    const result = await caller.projects.importProject({ data: exportData });
    expect(result.success).toBe(true);
    expect(result.projectId).toBeTruthy();
    importedProjectUid = result.projectId!;
    projectUids.push(importedProjectUid);

    // Re-export the imported project to verify counts
    const reExport = await caller.projects.exportProject({ projectId: importedProjectUid });

    expect(reExport.profiles).toHaveLength(5);
    expect(reExport.scenarios).toHaveLength(10);
    expect(reExport.datasetInstances).toHaveLength(20);
    expect(reExport.bundles).toHaveLength(3);
    expect(reExport.scripts).toHaveLength(5);
  }, 30000);

  // ─── Test 4: FK integrity — no stale source UIDs ──────────────────────
  it("should have no stale source UIDs in imported project", async () => {
    const reExport = await caller.projects.exportProject({ projectId: importedProjectUid });

    // All profile UIDs in imported project should be NEW (not from source)
    const sourceUids = new Set(sourceProfileUids);
    for (const p of reExport.profiles) {
      expect(sourceUids.has(p.uid)).toBe(false);
    }

    // All scenario UIDs should be NEW
    const sourceScenUids = new Set(sourceScenarioUids);
    for (const s of reExport.scenarios) {
      expect(sourceScenUids.has(s.uid)).toBeFalsy();
    }

    // All dataset instance UIDs should be NEW
    const sourceInstUids = new Set(sourceInstanceUids);
    for (const di of reExport.datasetInstances) {
      expect(sourceInstUids.has(di.uid)).toBe(false);
    }

    // All bundle UIDs should be NEW
    const sourceBndUids = new Set(sourceBundleUids);
    for (const b of reExport.bundles) {
      expect(sourceBndUids.has(b.uid)).toBe(false);
    }
  }, 15000);

  // ─── Test 5: Content equality (normalized) ─────────────────────────────
  it("should preserve profile content through export→import cycle", async () => {
    const reExport = await caller.projects.exportProject({ projectId: importedProjectUid });

    // Compare normalized profiles (sorted by name for deterministic comparison)
    const srcProfiles = exportData.profiles
      .map(normalize)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    const dstProfiles = reExport.profiles
      .map(normalize)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    expect(dstProfiles).toHaveLength(srcProfiles.length);
    for (let i = 0; i < srcProfiles.length; i++) {
      expect(dstProfiles[i].name).toBe(srcProfiles[i].name);
      expect(dstProfiles[i].protocol).toBe(srcProfiles[i].protocol);
      expect(dstProfiles[i].testType).toBe(srcProfiles[i].testType);
      expect(dstProfiles[i].targetHost).toBe(srcProfiles[i].targetHost);
      expect(dstProfiles[i].targetPort).toBe(srcProfiles[i].targetPort);
      expect(dstProfiles[i].parameters).toEqual(srcProfiles[i].parameters);
    }
  }, 15000);

  it("should preserve scenario steps_json through export→import cycle", async () => {
    const reExport = await caller.projects.exportProject({ projectId: importedProjectUid });

    const srcScenarios = exportData.scenarios
      .map(normalize)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    const dstScenarios = reExport.scenarios
      .map(normalize)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    expect(dstScenarios).toHaveLength(srcScenarios.length);
    for (let i = 0; i < srcScenarios.length; i++) {
      expect(dstScenarios[i].name).toBe(srcScenarios[i].name);
      expect(dstScenarios[i].testType).toBe(srcScenarios[i].testType);
      // Steps should be identical
      expect(dstScenarios[i].steps).toEqual(srcScenarios[i].steps);
      expect(dstScenarios[i].requiredDatasetTypes).toEqual(srcScenarios[i].requiredDatasetTypes);
    }
  }, 15000);

  it("should preserve dataset instance values through export→import cycle", async () => {
    const reExport = await caller.projects.exportProject({ projectId: importedProjectUid });

    const srcInstances = exportData.datasetInstances
      .map(normalize)
      .sort((a: any, b: any) => JSON.stringify(a.valuesJson).localeCompare(JSON.stringify(b.valuesJson)));
    const dstInstances = reExport.datasetInstances
      .map(normalize)
      .sort((a: any, b: any) => JSON.stringify(a.valuesJson).localeCompare(JSON.stringify(b.valuesJson)));

    expect(dstInstances).toHaveLength(srcInstances.length);
    for (let i = 0; i < srcInstances.length; i++) {
      expect(dstInstances[i].datasetTypeId).toBe(srcInstances[i].datasetTypeId);
      expect(dstInstances[i].env).toBe(srcInstances[i].env);
      expect(dstInstances[i].valuesJson).toEqual(srcInstances[i].valuesJson);
      expect(dstInstances[i].notes).toBe(srcInstances[i].notes);
    }
  }, 15000);

  it("should preserve script code through export→import cycle", async () => {
    const reExport = await caller.projects.exportProject({ projectId: importedProjectUid });

    const srcScripts = exportData.scripts
      .map(normalize)
      .sort((a: any, b: any) => a.code.localeCompare(b.code));
    const dstScripts = reExport.scripts
      .map(normalize)
      .sort((a: any, b: any) => a.code.localeCompare(b.code));

    expect(dstScripts).toHaveLength(srcScripts.length);
    for (let i = 0; i < srcScripts.length; i++) {
      expect(dstScripts[i].framework).toBe(srcScripts[i].framework);
      expect(dstScripts[i].language).toBe(srcScripts[i].language);
      expect(dstScripts[i].code).toBe(srcScripts[i].code);
    }
  }, 15000);

  // ─── Test 6: Profile references are remapped correctly ─────────────────
  it("should remap scenario profileId references to new profile UIDs", async () => {
    const reExport = await caller.projects.exportProject({ projectId: importedProjectUid });

    const importedProfileUids = new Set(reExport.profiles.map((p: any) => p.uid));

    for (const s of reExport.scenarios) {
      if (s.profileId && s.profileId !== "") {
        // profileId should point to one of the imported profiles, not source
        expect(importedProfileUids.has(s.profileId)).toBe(true);
      }
    }
  }, 15000);

  // ─── Test 7: Idempotence — inject into existing project ────────────────
  it("should inject into an existing project without errors", async () => {
    // Create a target project
    const target = await caller.projects.create({
      name: "E2E Inject Target",
      description: "Target for inject test",
      domain: "5GC",
    });
    projectUids.push(target.uid);

    // Import into existing project
    const result = await caller.projects.importProject({
      data: exportData,
      targetProjectId: target.uid,
    });
    expect(result.success).toBe(true);
    expect(result.projectId).toBe(target.uid);

    // Verify the target project now has the imported data
    const targetExport = await caller.projects.exportProject({ projectId: target.uid });
    expect(targetExport.profiles).toHaveLength(5);
    expect(targetExport.scenarios).toHaveLength(10);
    expect(targetExport.datasetInstances).toHaveLength(20);
    expect(targetExport.bundles).toHaveLength(3);
    expect(targetExport.scripts).toHaveLength(5);

    // Project metadata should remain unchanged
    expect(targetExport.project.name).toBe("E2E Inject Target");
    expect(targetExport.project.domain).toBe("5GC");
  }, 30000);

  // ─── Test 8: Double inject doesn't break ───────────────────────────────
  it("should handle double inject without errors (additive)", async () => {
    // Create a fresh target
    const target = await caller.projects.create({
      name: "E2E Double Inject",
      description: "Target for double inject test",
      domain: "IMS",
    });
    projectUids.push(target.uid);

    // First inject
    const r1 = await caller.projects.importProject({
      data: exportData,
      targetProjectId: target.uid,
    });
    expect(r1.success).toBe(true);

    // Second inject (same data)
    const r2 = await caller.projects.importProject({
      data: exportData,
      targetProjectId: target.uid,
    });
    expect(r2.success).toBe(true);

    // Should have doubled counts (additive import)
    const doubleExport = await caller.projects.exportProject({ projectId: target.uid });
    expect(doubleExport.profiles).toHaveLength(10); // 5 + 5
    expect(doubleExport.scenarios).toHaveLength(20); // 10 + 10
    expect(doubleExport.datasetInstances).toHaveLength(40); // 20 + 20
    expect(doubleExport.scripts).toHaveLength(10); // 5 + 5
  }, 60000);

  // ─── Test 9: Export of empty project ───────────────────────────────────
  it("should handle export of empty project gracefully", async () => {
    const empty = await caller.projects.create({
      name: "E2E Empty Project",
      description: "Empty project for edge case",
      domain: "API",
    });
    projectUids.push(empty.uid);

    const emptyExport = await caller.projects.exportProject({ projectId: empty.uid });
    expect(emptyExport.profiles).toHaveLength(0);
    expect(emptyExport.scenarios).toHaveLength(0);
    expect(emptyExport.datasetInstances).toHaveLength(0);
    expect(emptyExport.bundles).toHaveLength(0);
    expect(emptyExport.scripts).toHaveLength(0);
  }, 15000);

  // ─── Test 10: Import of empty data ─────────────────────────────────────
  it("should handle import of empty arrays gracefully", async () => {
    const result = await caller.projects.importProject({
      data: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        project: { name: "Empty Import", domain: "IMS" },
        profiles: [],
        scenarios: [],
        datasetTypes: [],
        datasetInstances: [],
        bundles: [],
        scripts: [],
      },
    });
    expect(result.success).toBe(true);
    projectUids.push(result.projectId!);

    const emptyExport = await caller.projects.exportProject({ projectId: result.projectId! });
    expect(emptyExport.profiles).toHaveLength(0);
    expect(emptyExport.scenarios).toHaveLength(0);
  }, 15000);
});
