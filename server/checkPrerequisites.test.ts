/**
 * Tests for checkPrerequisites — verifies that the prerequisite checker
 * correctly identifies blocking, warning, and OK conditions before AI generation.
 *
 * These tests import the pure function directly (no server context needed).
 */
import { describe, expect, it } from "vitest";
import { checkPrerequisites, type CheckPrerequisitesInput } from "../client/src/ai/checkPrerequisites";

// ─── Fixtures ────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<any> = {}): any {
  return {
    id: "proj-001",
    name: "Test Project",
    description: "A test project",
    domain: "WEB",
    status: "ACTIVE",
    created_by: "user-1",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<any> = {}): any {
  return {
    id: "prof-001",
    project_id: "proj-001",
    name: "Web Profile",
    description: "Test profile",
    protocol: "HTTP",
    test_type: "VABF",
    domain: "WEB",
    profile_type: "UI_E2E",
    target_host: "example.com",
    target_port: 443,
    parameters: { runner_type: "playwright" },
    config: { runner_type: "playwright" },
    ...overrides,
  };
}

function makeScenario(overrides: Partial<any> = {}): any {
  return {
    id: "scen-001",
    profile_id: "prof-001",
    project_id: "proj-001",
    name: "Login Test",
    description: "Test login flow",
    scenario_code: "VABF-WEB-001-LOGIN",
    steps: [
      {
        id: "step-1",
        order: 1,
        action: "navigate",
        description: "Go to login page",
        expected_result: "Login page is displayed",
        parameters: { url: "/login" },
      },
      {
        id: "step-2",
        order: 2,
        action: "fill",
        description: "Enter credentials",
        expected_result: "Credentials entered",
        parameters: { username: "test", password: "test" },
      },
    ],
    status: "FINAL",
    version: 1,
    required_dataset_types: ["CREDENTIALS", "URLS"],
    ...overrides,
  };
}

function makeBundle(overrides: Partial<any> = {}): any {
  return {
    uid: "bundle-001",
    bundle_id: "bundle-001",
    project_id: "proj-001",
    name: "BUNDLE_WEB_PROD_V1",
    env: "PROD",
    version: 1,
    status: "ACTIVE",
    tags: [],
    created_by: "user-1",
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    ...overrides,
  };
}

function makeDataset(overrides: Partial<any> = {}): any {
  return {
    uid: "ds-001",
    dataset_type_id: "CREDENTIALS",
    name: "Prod Credentials",
    values_json: { username: "admin", password: "secret123" },
    ...overrides,
  };
}

function makeSecret(overrides: Partial<any> = {}): any {
  return {
    dataset_id: "ds-001",
    key_path: "password",
    is_secret: true,
    ...overrides,
  };
}

function fullInput(overrides: Partial<CheckPrerequisitesInput> = {}): CheckPrerequisitesInput {
  return {
    project: makeProject(),
    profile: makeProfile(),
    scenario: makeScenario(),
    bundle: makeBundle(),
    bundleDatasets: [
      makeDataset({ uid: "ds-001", dataset_type_id: "CREDENTIALS", values_json: { username: "admin", password: "secret" } }),
      makeDataset({ uid: "ds-002", dataset_type_id: "URLS", values_json: { base_url: "https://example.com" } }),
    ],
    secrets: [makeSecret()],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("checkPrerequisites", () => {
  describe("happy path — all prerequisites met", () => {
    it("should return canProceed=true with no blocking items", () => {
      const report = checkPrerequisites(fullInput());
      expect(report.canProceed).toBe(true);
      expect(report.counts.blocking).toBe(0);
      expect(report.counts.ok).toBeGreaterThan(0);
    });

    it("should have items for all categories", () => {
      const report = checkPrerequisites(fullInput());
      const categories = new Set(report.items.map(i => i.category));
      expect(categories.has("project")).toBe(true);
      expect(categories.has("profile")).toBe(true);
      expect(categories.has("scenario")).toBe(true);
      expect(categories.has("bundle")).toBe(true);
      expect(categories.has("dataset")).toBe(true);
      expect(categories.has("secret")).toBe(true);
    });
  });

  describe("project checks", () => {
    it("should block when project is null", () => {
      const report = checkPrerequisites(fullInput({ project: null }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.filter(i => i.category === "project" && i.severity === "BLOCKING");
      expect(blocking.length).toBeGreaterThan(0);
    });

    it("should block when project has no id", () => {
      const report = checkPrerequisites(fullInput({ project: makeProject({ id: "", uid: "" }) }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.filter(i => i.key === "project.id" && i.severity === "BLOCKING");
      expect(blocking.length).toBe(1);
    });

    it("should accept project with uid instead of id", () => {
      const report = checkPrerequisites(fullInput({ project: makeProject({ id: "", uid: "uid-123" }) }));
      expect(report.canProceed).toBe(true);
      const projectItems = report.items.filter(i => i.category === "project");
      expect(projectItems.some(i => i.severity === "OK")).toBe(true);
    });
  });

  describe("profile checks", () => {
    it("should block when profile is null", () => {
      const report = checkPrerequisites(fullInput({ profile: null }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.filter(i => i.category === "profile" && i.severity === "BLOCKING");
      expect(blocking.length).toBeGreaterThan(0);
    });

    it("should warn when profile has no domain", () => {
      const report = checkPrerequisites(fullInput({
        profile: makeProfile({ domain: undefined, protocol: undefined }),
      }));
      const warning = report.items.find(i => i.key === "profile.domain" && i.severity === "WARNING");
      expect(warning).toBeDefined();
      // Should still be able to proceed (not blocking)
      expect(report.canProceed).toBe(true);
    });

    it("should show OK when profile has no runner_type (uses default)", () => {
      const report = checkPrerequisites(fullInput({
        profile: makeProfile({ config: {}, parameters: {} }),
      }));
      const ok = report.items.find(i => i.key === "profile.runner" && i.severity === "OK");
      expect(ok).toBeDefined();
      expect(ok!.message).toContain("playwright");
    });
  });

  describe("scenario checks", () => {
    it("should block when scenario is null", () => {
      const report = checkPrerequisites(fullInput({ scenario: null }));
      expect(report.canProceed).toBe(false);
    });

    it("should block when scenario has no steps", () => {
      const report = checkPrerequisites(fullInput({
        scenario: makeScenario({ steps: [] }),
      }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.find(i => i.key === "scenario.steps" && i.severity === "BLOCKING");
      expect(blocking).toBeDefined();
    });

    it("should warn when steps have no action", () => {
      const report = checkPrerequisites(fullInput({
        scenario: makeScenario({
          steps: [
            { id: "s1", order: 1, action: "", description: "desc", expected_result: "res", parameters: {} },
          ],
        }),
      }));
      const warning = report.items.find(i => i.key === "scenario.steps.action" && i.severity === "WARNING");
      expect(warning).toBeDefined();
    });

    it("should warn when no step has expected_result", () => {
      const report = checkPrerequisites(fullInput({
        scenario: makeScenario({
          steps: [
            { id: "s1", order: 1, action: "click", description: "desc", expected_result: "", parameters: {} },
            { id: "s2", order: 2, action: "fill", description: "desc2", expected_result: "", parameters: {} },
          ],
        }),
      }));
      const warning = report.items.find(i => i.key === "scenario.steps.expected" && i.severity === "WARNING");
      expect(warning).toBeDefined();
    });
  });

  describe("bundle checks", () => {
    it("should block when bundle is null", () => {
      const report = checkPrerequisites(fullInput({ bundle: null }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.filter(i => i.category === "bundle" && i.severity === "BLOCKING");
      expect(blocking.length).toBeGreaterThan(0);
    });

    it("should block when bundle has no id", () => {
      const report = checkPrerequisites(fullInput({
        bundle: makeBundle({ uid: "", bundle_id: "", id: "" }),
      }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.find(i => i.key === "bundle.id" && i.severity === "BLOCKING");
      expect(blocking).toBeDefined();
    });

    it("should warn when bundle status is not ACTIVE", () => {
      const report = checkPrerequisites(fullInput({
        bundle: makeBundle({ status: "DRAFT" }),
      }));
      const warning = report.items.find(i => i.key === "bundle.status" && i.severity === "WARNING");
      expect(warning).toBeDefined();
    });
  });

  describe("dataset checks", () => {
    it("should block when bundle has no datasets", () => {
      const report = checkPrerequisites(fullInput({ bundleDatasets: [] }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.find(i => i.key === "dataset.empty" && i.severity === "BLOCKING");
      expect(blocking).toBeDefined();
    });

    it("should block when all datasets are empty", () => {
      const report = checkPrerequisites(fullInput({
        bundleDatasets: [
          makeDataset({ values_json: {} }),
          makeDataset({ uid: "ds-002", values_json: {} }),
        ],
      }));
      expect(report.canProceed).toBe(false);
      const blocking = report.items.find(i => i.key === "dataset.values" && i.severity === "BLOCKING");
      expect(blocking).toBeDefined();
    });

    it("should block when some datasets are empty", () => {
      const report = checkPrerequisites(fullInput({
        bundleDatasets: [
          makeDataset({ values_json: { key: "val" } }),
          makeDataset({ uid: "ds-002", values_json: {} }),
        ],
      }));
      const blocking = report.items.find(i => i.key === "dataset.values" && i.severity === "BLOCKING");
      expect(blocking).toBeDefined();
      // Cannot proceed when any dataset is empty
      expect(report.canProceed).toBe(false);
    });

    it("should block when required dataset types are not covered", () => {
      const report = checkPrerequisites(fullInput({
        bundleDatasets: [
          makeDataset({ dataset_type_id: "CREDENTIALS", values_json: { user: "a" } }),
          // Missing URLS type
        ],
      }));
      const blocking = report.items.find(i => i.key === "dataset.coverage" && i.severity === "BLOCKING");
      expect(blocking).toBeDefined();
      expect(blocking!.message).toContain("URLS");
      expect(report.canProceed).toBe(false);
    });

    it("should show OK when all required types are covered", () => {
      const report = checkPrerequisites(fullInput());
      const coverage = report.items.find(i => i.key === "dataset.coverage");
      expect(coverage).toBeDefined();
      expect(coverage!.severity).toBe("OK");
      expect(report.canProceed).toBe(true);
    });
  });

  describe("secret checks", () => {
    it("should report secret keys when present", () => {
      const report = checkPrerequisites(fullInput());
      const secretItem = report.items.find(i => i.category === "secret");
      expect(secretItem).toBeDefined();
      expect(secretItem!.severity).toBe("OK");
      expect(secretItem!.message).toContain("password");
    });

    it("should handle no secrets gracefully", () => {
      const report = checkPrerequisites(fullInput({ secrets: [] }));
      // No secret items should be present (or OK with no secrets)
      const secretItems = report.items.filter(i => i.category === "secret");
      expect(secretItems.length).toBe(0);
    });

    it("should handle secrets with is_secret=false", () => {
      const report = checkPrerequisites(fullInput({
        secrets: [makeSecret({ is_secret: false })],
      }));
      const secretItem = report.items.find(i => i.category === "secret");
      expect(secretItem).toBeDefined();
      expect(secretItem!.message).toContain("aucune marquée comme secrète");
    });
  });

  describe("counts and summary", () => {
    it("should correctly count items by severity", () => {
      const report = checkPrerequisites(fullInput());
      const manualOk = report.items.filter(i => i.severity === "OK").length;
      const manualWarn = report.items.filter(i => i.severity === "WARNING").length;
      const manualBlock = report.items.filter(i => i.severity === "BLOCKING").length;
      expect(report.counts.ok).toBe(manualOk);
      expect(report.counts.warning).toBe(manualWarn);
      expect(report.counts.blocking).toBe(manualBlock);
    });

    it("should set canProceed=false when any blocking item exists", () => {
      const report = checkPrerequisites(fullInput({ project: null }));
      expect(report.canProceed).toBe(false);
      expect(report.counts.blocking).toBeGreaterThan(0);
    });

    it("should set canProceed=true when only warnings exist", () => {
      const report = checkPrerequisites(fullInput({
        profile: makeProfile({ domain: undefined, protocol: undefined, config: {}, parameters: {} }),
      }));
      // Should have warnings but no blocking
      expect(report.counts.warning).toBeGreaterThan(0);
      expect(report.counts.blocking).toBe(0);
      expect(report.canProceed).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle completely empty input", () => {
      const report = checkPrerequisites({
        project: null,
        profile: null,
        scenario: null,
        bundle: null,
        bundleDatasets: [],
        secrets: [],
      });
      expect(report.canProceed).toBe(false);
      expect(report.counts.blocking).toBeGreaterThanOrEqual(4); // project, profile, scenario, bundle, datasets
    });

    it("should handle bundle with only uid (Drizzle row format)", () => {
      const drizzleBundle = {
        uid: "abc-123",
        name: "My Bundle",
        env: "PROD",
        version: 2,
        status: "ACTIVE",
        // No bundle_id field — this is the Drizzle format
      };
      const report = checkPrerequisites(fullInput({ bundle: drizzleBundle }));
      const bundleItem = report.items.find(i => i.key === "bundle");
      expect(bundleItem).toBeDefined();
      expect(bundleItem!.severity).toBe("OK");
    });

    it("should handle scenario with undefined steps", () => {
      const report = checkPrerequisites(fullInput({
        scenario: makeScenario({ steps: undefined }),
      }));
      const stepsItem = report.items.find(i => i.key === "scenario.steps" && i.severity === "BLOCKING");
      expect(stepsItem).toBeDefined();
    });

    it("should handle datasets with null values_json", () => {
      const report = checkPrerequisites(fullInput({
        bundleDatasets: [makeDataset({ values_json: null })],
      }));
      // Should not crash — treat null as empty
      expect(report.items.length).toBeGreaterThan(0);
    });
  });
});
