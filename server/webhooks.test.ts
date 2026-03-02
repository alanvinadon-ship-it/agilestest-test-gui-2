import { describe, it, expect } from "vitest";

// ─── Webhooks Router Tests ──────────────────────────────────────────────────

describe("Webhooks — webhooksRouter structure", () => {
  it("should export webhooksRouter from routers/webhooks.ts", async () => {
    const mod = await import("./routers/webhooks");
    expect(mod.webhooksRouter).toBeDefined();
    expect(mod.webhooksRouter._def).toBeDefined();
  });

  it("webhooksRouter should have all CRUD + delivery procedures", async () => {
    const mod = await import("./routers/webhooks");
    const procedures = Object.keys(mod.webhooksRouter._def.procedures);
    expect(procedures).toContain("list");
    expect(procedures).toContain("create");
    expect(procedures).toContain("update");
    expect(procedures).toContain("delete");
    expect(procedures).toContain("regenerateSecret");
    expect(procedures).toContain("deliveries");
    expect(procedures).toContain("test");
    expect(procedures).toHaveLength(7);
  });
});

// ─── HMAC Signature Tests ───────────────────────────────────────────────────

describe("Webhooks — HMAC signature", () => {
  it("signPayload should produce consistent HMAC-SHA256", async () => {
    const { signPayload } = await import("./routers/webhooks");
    const secret = "test-secret-123";
    const payload = '{"event":"test"}';
    const sig1 = signPayload(secret, payload);
    const sig2 = signPayload(secret, payload);
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64); // SHA256 hex = 64 chars
  });

  it("signPayload should produce different signatures for different secrets", async () => {
    const { signPayload } = await import("./routers/webhooks");
    const payload = '{"event":"test"}';
    const sig1 = signPayload("secret-a", payload);
    const sig2 = signPayload("secret-b", payload);
    expect(sig1).not.toBe(sig2);
  });

  it("signPayload should produce different signatures for different payloads", async () => {
    const { signPayload } = await import("./routers/webhooks");
    const secret = "same-secret";
    const sig1 = signPayload(secret, '{"a":1}');
    const sig2 = signPayload(secret, '{"b":2}');
    expect(sig1).not.toBe(sig2);
  });
});

// ─── Event Types Tests ──────────────────────────────────────────────────────

describe("Webhooks — event types", () => {
  it("should export WEBHOOK_EVENT_TYPES array", async () => {
    const { WEBHOOK_EVENT_TYPES } = await import("./routers/webhooks");
    expect(Array.isArray(WEBHOOK_EVENT_TYPES)).toBe(true);
    expect(WEBHOOK_EVENT_TYPES.length).toBeGreaterThanOrEqual(5);
  });

  it("should include run.completed and probe.alert.red events", async () => {
    const { WEBHOOK_EVENT_TYPES } = await import("./routers/webhooks");
    expect(WEBHOOK_EVENT_TYPES).toContain("run.completed");
    expect(WEBHOOK_EVENT_TYPES).toContain("run.failed");
    expect(WEBHOOK_EVENT_TYPES).toContain("probe.alert.red");
    expect(WEBHOOK_EVENT_TYPES).toContain("probe.status.changed");
    expect(WEBHOOK_EVENT_TYPES).toContain("incident.created");
  });
});

// ─── Dispatch function Tests ────────────────────────────────────────────────

describe("Webhooks — dispatchWebhookEvent", () => {
  it("should export dispatchWebhookEvent function", async () => {
    const mod = await import("./routers/webhooks");
    expect(typeof mod.dispatchWebhookEvent).toBe("function");
  });

  it("should export processWebhookDeliveries function", async () => {
    const mod = await import("./routers/webhooks");
    expect(typeof mod.processWebhookDeliveries).toBe("function");
  });
});

// ─── appRouter integration ──────────────────────────────────────────────────

describe("Webhooks — appRouter integration", () => {
  it("appRouter should include webhooks router", async () => {
    const mod = await import("./routers");
    const procedures = Object.keys(mod.appRouter._def.procedures);
    expect(procedures.some(p => p.startsWith("webhooks"))).toBe(true);
  });
});

// ─── Frontend Tests ─────────────────────────────────────────────────────────

describe("Webhooks — WebhooksPage frontend", () => {
  it("WebhooksPage should exist and export default component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/WebhooksPage.tsx");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export default function WebhooksPage");
  });

  it("WebhooksPage should use trpc.webhooks hooks", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/WebhooksPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("trpc.webhooks.list.useQuery");
    expect(content).toContain("trpc.webhooks.create.useMutation");
    expect(content).toContain("trpc.webhooks.delete.useMutation");
    expect(content).toContain("trpc.webhooks.test.useMutation");
  });

  it("WebhooksPage should display event labels in French", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/WebhooksPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Exécution terminée");
    expect(content).toContain("Sonde en alerte RED");
    expect(content).toContain("Incident créé");
  });

  it("WebhooksPage should have secret display with copy functionality", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/WebhooksPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Secret du webhook");
    expect(content).toContain("navigator.clipboard.writeText");
  });

  it("WebhooksPage should have delivery logs table", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/pages/WebhooksPage.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("DeliveryLogs");
    expect(content).toContain("Historique des livraisons");
  });
});

// ─── Route integration ──────────────────────────────────────────────────────

describe("Webhooks — route integration", () => {
  it("App.tsx should have /webhooks route", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/App.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("/webhooks");
    expect(content).toContain("WebhooksPage");
  });

  it("Sidebar should have Webhooks link", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../client/src/components/DashboardLayout.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Webhooks");
    expect(content).toContain("/webhooks");
  });
});
