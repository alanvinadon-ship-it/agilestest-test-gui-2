/**
 * Tests for Playwright runner, dataset resolver, and execution engine REAL mode integration.
 */
import { describe, it, expect } from "vitest";

// ─── playwrightRunner — module structure ────────────────────────────────

describe("playwrightRunner module", () => {
  it("should export runWithPlaywright function", async () => {
    const mod = await import("./playwrightRunner");
    expect(mod.runWithPlaywright).toBeDefined();
    expect(typeof mod.runWithPlaywright).toBe("function");
  });

  it("should export buildLocator function", async () => {
    const mod = await import("./playwrightRunner");
    expect(mod.buildLocator).toBeDefined();
    expect(typeof mod.buildLocator).toBe("function");
  });

  it("should export resolveBindingValue function", async () => {
    const mod = await import("./playwrightRunner");
    expect(mod.resolveBindingValue).toBeDefined();
    expect(typeof mod.resolveBindingValue).toBe("function");
  });

  it("should export executeAction function", async () => {
    const mod = await import("./playwrightRunner");
    expect(mod.executeAction).toBeDefined();
    expect(typeof mod.executeAction).toBe("function");
  });
});

// ─── resolveBindingValue — unit tests ───────────────────────────────────

describe("resolveBindingValue", () => {
  it("should return the value as-is when no bindings provided", async () => {
    const { resolveBindingValue } = await import("./playwrightRunner");
    expect(resolveBindingValue("users.email", undefined)).toBe("users.email");
    expect(resolveBindingValue("users.email", {})).toBe("users.email");
  });

  it("should resolve exact match from bindings", async () => {
    const { resolveBindingValue } = await import("./playwrightRunner");
    const bindings = {
      "users.email": "john@example.com",
      "users.password": "secret123",
    };
    expect(resolveBindingValue("users.email", bindings)).toBe("john@example.com");
    expect(resolveBindingValue("users.password", bindings)).toBe("secret123");
  });

  it("should return original value when no binding found", async () => {
    const { resolveBindingValue } = await import("./playwrightRunner");
    const bindings = { "users.email": "john@example.com" };
    expect(resolveBindingValue("unknown.field", bindings)).toBe("unknown.field");
  });

  it("should handle empty value", async () => {
    const { resolveBindingValue } = await import("./playwrightRunner");
    expect(resolveBindingValue("", { "users.email": "john@example.com" })).toBe("");
  });

  it("should handle trimmed values", async () => {
    const { resolveBindingValue } = await import("./playwrightRunner");
    const bindings = { "users.email": "john@example.com" };
    expect(resolveBindingValue("  users.email  ", bindings)).toBe("john@example.com");
  });
});

// ─── datasetResolver — module structure ─────────────────────────────────

describe("datasetResolver module", () => {
  it("should export resolveBindings function", async () => {
    const mod = await import("./datasetResolver");
    expect(mod.resolveBindings).toBeDefined();
    expect(typeof mod.resolveBindings).toBe("function");
  });

  it("should export flattenObject function", async () => {
    const mod = await import("./datasetResolver");
    expect(mod.flattenObject).toBeDefined();
    expect(typeof mod.flattenObject).toBe("function");
  });
});

// ─── flattenObject — unit tests ─────────────────────────────────────────

describe("flattenObject", () => {
  it("should flatten a simple object", async () => {
    const { flattenObject } = await import("./datasetResolver");
    const result: Record<string, string> = {};
    flattenObject({ email: "john@example.com", password: "secret" }, "users", result);
    expect(result).toEqual({
      "users.email": "john@example.com",
      "users.password": "secret",
    });
  });

  it("should flatten nested objects", async () => {
    const { flattenObject } = await import("./datasetResolver");
    const result: Record<string, string> = {};
    flattenObject({ full: { login: "/login", dashboard: "/dashboard" } }, "web_urls", result);
    expect(result).toEqual({
      "web_urls.full.login": "/login",
      "web_urls.full.dashboard": "/dashboard",
    });
  });

  it("should skip null and undefined values", async () => {
    const { flattenObject } = await import("./datasetResolver");
    const result: Record<string, string> = {};
    flattenObject({ email: "john@example.com", phone: null, fax: undefined }, "users", result);
    expect(result).toEqual({ "users.email": "john@example.com" });
  });

  it("should convert numbers and booleans to strings", async () => {
    const { flattenObject } = await import("./datasetResolver");
    const result: Record<string, string> = {};
    flattenObject({ port: 8080, active: true }, "config", result);
    expect(result).toEqual({
      "config.port": "8080",
      "config.active": "true",
    });
  });

  it("should handle deeply nested objects", async () => {
    const { flattenObject } = await import("./datasetResolver");
    const result: Record<string, string> = {};
    flattenObject({ a: { b: { c: { d: "deep" } } } }, "root", result);
    expect(result).toEqual({ "root.a.b.c.d": "deep" });
  });

  it("should handle empty objects", async () => {
    const { flattenObject } = await import("./datasetResolver");
    const result: Record<string, string> = {};
    flattenObject({}, "prefix", result);
    expect(result).toEqual({});
  });
});

// ─── executionEngine — REAL mode integration ────────────────────────────

describe("executionEngine — REAL mode integration", () => {
  it("should import resolveBindings in executionEngine", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain('import { resolveBindings } from "./datasetResolver"');
  });

  it("should import runWithPlaywright in executionEngine", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain('import { runWithPlaywright');
  });

  it("should import storagePut for screenshot artifacts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain('import { storagePut } from "./storage"');
  });

  it("should have realExecution function for REAL mode", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("async function realExecution(");
  });

  it("should call realExecution when mode is REAL", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("result = await realExecution(");
  });

  it("should pass profileId and datasetBundleId to realExecution", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("exec.profileId");
    expect(content).toContain("exec.datasetBundleId");
  });

  it("should save screenshot artifacts in realExecution", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("saveScreenshotArtifact");
  });

  it("should include locatorStrategy in step parsing", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("locatorStrategy: s.locatorStrategy || s.locator_strategy");
  });

  it("should not fallback to simulation in REAL mode", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    // The old fallback warning should be gone
    expect(content).not.toContain("Mode REAL non encore implémenté — fallback sur SIMULATED");
  });
});

// ─── playwrightRunner — action mapping ──────────────────────────────────

describe("playwrightRunner — action mapping coverage", () => {
  it("should handle all AgilesTest actions in executeAction", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    const actions = ["NAVIGATE", "FILL", "CLICK", "SELECT", "ASSERT", "CHECK", "UNCHECK", "UPLOAD", "WAIT"];
    for (const action of actions) {
      expect(content).toContain(`case "${action}"`);
    }
  });

  it("should support all locator strategies", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    const strategies = ["role", "label", "text", "placeholder", "ref", "testid", "data-testid", "xpath", "css"];
    for (const strategy of strategies) {
      expect(content).toContain(`case "${strategy}"`);
    }
  });

  it("should use page.goto for NAVIGATE", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    expect(content).toContain("page.goto(url");
  });

  it("should use locator.fill for FILL", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    expect(content).toContain("locator.fill(fillValue)");
  });

  it("should use locator.click for CLICK", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    expect(content).toContain("locator.click(");
  });

  it("should take screenshots per step", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    expect(content).toContain("page.screenshot(");
  });

  it("should handle error screenshots", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    // Should take screenshot on failure too
    const screenshotMatches = content.match(/page\.screenshot\(/g);
    expect(screenshotMatches).not.toBeNull();
    expect(screenshotMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("should close browser in finally block", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/playwrightRunner.ts", "utf-8");
    expect(content).toContain("browser.close()");
    expect(content).toContain("context.close()");
  });
});

// ─── Playwright integration smoke test ──────────────────────────────────

describe("Playwright — chromium availability", () => {
  it("should be able to import playwright", async () => {
    const pw = await import("playwright");
    expect(pw.chromium).toBeDefined();
    expect(typeof pw.chromium.launch).toBe("function");
  });

  it("should be able to launch and close chromium", async () => {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    expect(browser).toBeDefined();
    expect(browser.isConnected()).toBe(true);
    await browser.close();
    expect(browser.isConnected()).toBe(false);
  }, 15000);
});
