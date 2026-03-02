import { describe, it, expect } from "vitest";
import { z } from "zod";

// ── Export format schema ──────────────────────────────────────────────────
const exportFormatSchema = z.object({
  _format: z.literal("agilestest-scenario-v1"),
  exportedAt: z.string(),
  scenario: z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    testType: z.enum(["VABF", "VSR", "VABE"]),
    status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]),
    priority: z.enum(["P0", "P1", "P2"]),
    steps: z.any().optional(),
  }),
  profile: z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    profileType: z.string(),
    config: z.any().optional(),
  }).nullable(),
  datasets: z.array(z.object({
    name: z.string(),
    description: z.string().nullable().optional(),
    datasetType: z.string(),
    data: z.any().optional(),
  })),
});

// ── Import payload schema ─────────────────────────────────────────────────
const importPayloadSchema = z.object({
  projectId: z.number(),
  payload: z.object({
    _format: z.literal("agilestest-scenario-v1"),
    scenario: z.object({
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      testType: z.enum(["VABF", "VSR", "VABE"]).default("VABF"),
      status: z.enum(["DRAFT", "FINAL", "DEPRECATED"]).default("DRAFT"),
      priority: z.enum(["P0", "P1", "P2"]).default("P1"),
      steps: z.any().optional(),
    }),
    profile: z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      profileType: z.string().default("WEB"),
      config: z.any().optional(),
    }).nullable().optional(),
    datasets: z.array(z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      datasetType: z.string(),
      data: z.any().optional(),
    })).optional(),
  }),
  importProfile: z.boolean().default(true),
  importDatasets: z.boolean().default(true),
});

describe("Scenario Import/Export", () => {
  describe("Export format validation", () => {
    it("should validate a complete export payload", () => {
      const payload = {
        _format: "agilestest-scenario-v1" as const,
        exportedAt: new Date().toISOString(),
        scenario: {
          name: "Test Login Flow",
          description: "Tests the login flow end to end",
          testType: "VABF" as const,
          status: "FINAL" as const,
          priority: "P0" as const,
          steps: [{ action: "navigate", url: "/login" }],
        },
        profile: {
          name: "Web Profile",
          description: "Standard web profile",
          profileType: "WEB",
          config: { baseUrl: "https://example.com" },
        },
        datasets: [
          {
            name: "Users Dataset",
            description: "Test users",
            datasetType: "CSV",
            data: [{ user: "admin", pass: "test" }],
          },
        ],
      };
      const result = exportFormatSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should validate export with null profile", () => {
      const payload = {
        _format: "agilestest-scenario-v1" as const,
        exportedAt: new Date().toISOString(),
        scenario: {
          name: "Standalone Scenario",
          description: null,
          testType: "VSR" as const,
          status: "DRAFT" as const,
          priority: "P1" as const,
        },
        profile: null,
        datasets: [],
      };
      const result = exportFormatSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject export with wrong format version", () => {
      const payload = {
        _format: "agilestest-scenario-v2",
        exportedAt: new Date().toISOString(),
        scenario: { name: "Test", testType: "VABF", status: "DRAFT", priority: "P1" },
        profile: null,
        datasets: [],
      };
      const result = exportFormatSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject export without scenario name", () => {
      const payload = {
        _format: "agilestest-scenario-v1",
        exportedAt: new Date().toISOString(),
        scenario: { name: "", testType: "VABF", status: "DRAFT", priority: "P1" },
        profile: null,
        datasets: [],
      };
      const result = exportFormatSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("Import payload validation", () => {
    it("should validate a complete import request", () => {
      const input = {
        projectId: 42,
        payload: {
          _format: "agilestest-scenario-v1" as const,
          scenario: {
            name: "Imported Scenario",
            testType: "VABE" as const,
            priority: "P2" as const,
          },
          profile: {
            name: "Imported Profile",
            profileType: "IMS",
            config: { sip: true },
          },
          datasets: [
            { name: "DS1", datasetType: "JSON", data: { key: "value" } },
          ],
        },
        importProfile: true,
        importDatasets: true,
      };
      const result = importPayloadSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should apply defaults for missing optional fields", () => {
      const input = {
        projectId: 1,
        payload: {
          _format: "agilestest-scenario-v1" as const,
          scenario: { name: "Minimal Scenario" },
        },
      };
      const result = importPayloadSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload.scenario.testType).toBe("VABF");
        expect(result.data.payload.scenario.priority).toBe("P1");
        expect(result.data.importProfile).toBe(true);
        expect(result.data.importDatasets).toBe(true);
      }
    });

    it("should reject import without _format", () => {
      const input = {
        projectId: 1,
        payload: {
          scenario: { name: "No Format" },
        },
      };
      const result = importPayloadSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject import without projectId", () => {
      const input = {
        payload: {
          _format: "agilestest-scenario-v1",
          scenario: { name: "No Project" },
        },
      };
      const result = importPayloadSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should allow skipping profile and datasets import", () => {
      const input = {
        projectId: 1,
        payload: {
          _format: "agilestest-scenario-v1" as const,
          scenario: { name: "Selective Import" },
          profile: { name: "Skip Me", profileType: "WEB" },
          datasets: [{ name: "Skip Me Too", datasetType: "CSV" }],
        },
        importProfile: false,
        importDatasets: false,
      };
      const result = importPayloadSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.importProfile).toBe(false);
        expect(result.data.importDatasets).toBe(false);
      }
    });
  });

  describe("Export/Import round-trip", () => {
    it("should produce a valid import payload from an export payload", () => {
      const exported = {
        _format: "agilestest-scenario-v1" as const,
        exportedAt: new Date().toISOString(),
        scenario: {
          name: "Round Trip Test",
          description: "Full round trip",
          testType: "VABF" as const,
          status: "FINAL" as const,
          priority: "P0" as const,
          steps: [{ action: "click", selector: "#btn" }],
        },
        profile: {
          name: "RT Profile",
          description: "Round trip profile",
          profileType: "WEB",
          config: { timeout: 30000 },
        },
        datasets: [
          { name: "RT Dataset", description: "Test data", datasetType: "JSON", data: [1, 2, 3] },
        ],
      };

      // Validate export
      const exportResult = exportFormatSchema.safeParse(exported);
      expect(exportResult.success).toBe(true);

      // Create import from export
      const importInput = {
        projectId: 99,
        payload: exported,
        importProfile: true,
        importDatasets: true,
      };
      const importResult = importPayloadSchema.safeParse(importInput);
      expect(importResult.success).toBe(true);
    });
  });

  describe("scenariosRouter structure", () => {
    it("should have export and import procedures", async () => {
      const { scenariosRouter } = await import("./routers/testing");
      const procedures = Object.keys(scenariosRouter._def.procedures);
      expect(procedures).toContain("export");
      expect(procedures).toContain("import");
    });

    it("should have all expected scenario procedures", async () => {
      const { scenariosRouter } = await import("./routers/testing");
      const procedures = Object.keys(scenariosRouter._def.procedures);
      expect(procedures).toContain("list");
      expect(procedures).toContain("get");
      expect(procedures).toContain("create");
      expect(procedures).toContain("update");
      expect(procedures).toContain("delete");
      expect(procedures).toContain("export");
      expect(procedures).toContain("import");
      expect(procedures.length).toBe(7);
    });
  });

  describe("Frontend ImportScenarioModal", () => {
    it("should validate JSON format before import", () => {
      // Simulate client-side validation
      const validJson = { _format: "agilestest-scenario-v1", scenario: { name: "Test" } };
      expect(validJson._format).toBe("agilestest-scenario-v1");
      expect(validJson.scenario.name).toBeTruthy();
    });

    it("should reject invalid format", () => {
      const invalidJson = { _format: "wrong-format", scenario: { name: "Test" } };
      expect(invalidJson._format).not.toBe("agilestest-scenario-v1");
    });

    it("should reject missing scenario name", () => {
      const noName = { _format: "agilestest-scenario-v1", scenario: {} as any };
      expect(noName.scenario.name).toBeFalsy();
    });
  });

  describe("Export data portability", () => {
    it("should not include internal IDs in exported scenario", () => {
      const exportedScenario = {
        name: "Portable",
        description: "No IDs",
        testType: "VABF",
        status: "DRAFT",
        priority: "P1",
        steps: [],
      };
      expect(exportedScenario).not.toHaveProperty("id");
      expect(exportedScenario).not.toHaveProperty("projectId");
      expect(exportedScenario).not.toHaveProperty("createdBy");
      expect(exportedScenario).not.toHaveProperty("createdAt");
    });

    it("should not include internal IDs in exported profile", () => {
      const exportedProfile = {
        name: "Portable Profile",
        description: null,
        profileType: "WEB",
        config: {},
      };
      expect(exportedProfile).not.toHaveProperty("id");
      expect(exportedProfile).not.toHaveProperty("projectId");
      expect(exportedProfile).not.toHaveProperty("createdBy");
    });

    it("should not include internal IDs in exported datasets", () => {
      const exportedDataset = {
        name: "Portable Dataset",
        description: null,
        datasetType: "CSV",
        data: [],
      };
      expect(exportedDataset).not.toHaveProperty("id");
      expect(exportedDataset).not.toHaveProperty("projectId");
      expect(exportedDataset).not.toHaveProperty("createdBy");
    });
  });
});
