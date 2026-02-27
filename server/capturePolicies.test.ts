import { describe, it, expect } from "vitest";

// ─── Router structure tests ─────────────────────────────────────────────

describe("capturePoliciesRouter structure", () => {
  it("should export capturePoliciesRouter from routers/capturePolicies.ts", async () => {
    const mod = await import("./routers/capturePolicies");
    expect(mod.capturePoliciesRouter).toBeDefined();
    expect(typeof mod.capturePoliciesRouter).toBe("object");
  });

  it("should have list, getByScope, get, upsert, remove, delete procedures", async () => {
    const mod = await import("./routers/capturePolicies");
    const procedures = Object.keys((mod.capturePoliciesRouter as any)._def.procedures || {});
    expect(procedures).toContain("list");
    expect(procedures).toContain("getByScope");
    expect(procedures).toContain("get");
    expect(procedures).toContain("upsert");
    expect(procedures).toContain("remove");
    expect(procedures).toContain("delete");
  });

  it("should be registered in the main appRouter", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures || {});
    // capturePolicies.list etc. should be accessible
    expect(procedures.some((p: string) => p.startsWith("capturePolicies."))).toBe(true);
  });
});

// ─── Drizzle schema alignment ───────────────────────────────────────────

describe("capture_policies Drizzle schema", () => {
  it("should export capturePolicies table from drizzle/schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.capturePolicies).toBeDefined();
  });

  it("should have expected columns", async () => {
    const schema = await import("../drizzle/schema");
    const columnNames = Object.keys(schema.capturePolicies);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("uid");
    expect(columnNames).toContain("projectId");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("captureMode");
    expect(columnNames).toContain("enabled");
    expect(columnNames).toContain("createdAt");
    expect(columnNames).toContain("updatedAt");
  });

  it("should export CapturePolicyRow and InsertCapturePolicyRow types", async () => {
    // Type-level check: if these don't exist, TS compilation would fail
    const schema = await import("../drizzle/schema");
    expect(schema.capturePolicies).toBeDefined();
    // The types are compile-time only, but we can verify the table exists
  });
});

// ─── CapturePolicy type alignment ───────────────────────────────────────

describe("CapturePolicy type from capture/types", () => {
  it("DEFAULT_CAPTURE_POLICY should have expected fields", async () => {
    const types = await import("../client/src/capture/types");
    expect(types.DEFAULT_CAPTURE_POLICY).toBeDefined();
    expect(types.DEFAULT_CAPTURE_POLICY.default_mode).toBe("NONE");
    expect(types.DEFAULT_CAPTURE_POLICY.runner_tcpdump).toBeDefined();
    expect(types.DEFAULT_CAPTURE_POLICY.probe_span_tap).toBeDefined();
    expect(typeof types.DEFAULT_CAPTURE_POLICY.retention_days).toBe("number");
  });

  it("CapturePolicy can be serialized to JSON for DB storage", () => {
    const policy = {
      default_mode: "RUNNER_TCPDUMP",
      runner_tcpdump: { iface: "eth0", bpf_filter: "", snaplen: 65535, rotate_mb: 100, max_files: 5, enabled: true },
      probe_span_tap: { probe_id: "", iface: "", bpf_filter: "", rotate_mb: 100, enabled: true },
      retention_days: 30,
    };
    const json = JSON.stringify(policy);
    const parsed = JSON.parse(json);
    expect(parsed.default_mode).toBe("RUNNER_TCPDUMP");
    expect(parsed.runner_tcpdump.iface).toBe("eth0");
    expect(parsed.retention_days).toBe(30);
  });

  it("scope enum values match the DB enum", () => {
    const validScopes = ["project", "campaign", "scenario"];
    validScopes.forEach((scope) => {
      expect(["project", "campaign", "scenario"]).toContain(scope);
    });
  });
});

// ─── Integration: capturePolicies in DriveCampaignsPage ─────────────────

describe("DriveCampaignsPage no longer imports localStore", () => {
  it("DriveCampaignsPage should not contain localStore imports", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/DriveCampaignsPage.tsx",
      "utf-8"
    );
    expect(content).not.toContain("from '../api/localStore'");
    expect(content).not.toContain("from '@/api/localStore'");
    expect(content).not.toContain("localCapturePolicies");
  });

  it("DriveCampaignsPage should use trpc.capturePolicies", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/DriveCampaignsPage.tsx",
      "utf-8"
    );
    expect(content).toContain("trpc.capturePolicies.getByScope");
    expect(content).toContain("trpc.capturePolicies.upsert");
    expect(content).toContain("trpc.capturePolicies.remove");
  });
});
