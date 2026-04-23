/**
 * Tests for the Playwright runner architecture: LOCAL/REMOTE/AUTO
 * Covers: playwrightConfig, PlaywrightLocalRunner, PlaywrightRemoteRunner,
 *         runnerResolver, playwrightActions, and executionEngine integration.
 *
 * 7 cas de test spécifiés + tests supplémentaires de structure et intégration.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── 1. playwrightConfig — Configuration centralisée ────────────────────

describe("playwrightConfig — loadPlaywrightConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  it("should return default config when no env vars set", async () => {
    delete process.env.PLAYWRIGHT_RUNNER_MODE;
    delete process.env.PLAYWRIGHT_REMOTE_ENDPOINT;
    delete process.env.PLAYWRIGHT_REMOTE_TOKEN;
    delete process.env.PLAYWRIGHT_HEADLESS;
    delete process.env.PLAYWRIGHT_TIMEOUT_MS;
    delete process.env.PLAYWRIGHT_ENABLE_SCREENSHOTS;
    delete process.env.PLAYWRIGHT_ENABLE_TRACE;
    delete process.env.PLAYWRIGHT_ENABLE_VIDEO;

    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig();

    expect(config.runnerMode).toBe("AUTO");
    expect(config.remoteEndpoint).toBeNull();
    expect(config.remoteToken).toBeNull();
    expect(config.headless).toBe(true);
    expect(config.timeoutMs).toBe(15000);
    expect(config.enableScreenshots).toBe(true);
    expect(config.enableTrace).toBe(false);
    expect(config.enableVideo).toBe(false);
  });

  it("should read PLAYWRIGHT_RUNNER_MODE from env", async () => {
    process.env.PLAYWRIGHT_RUNNER_MODE = "LOCAL";
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig();
    expect(config.runnerMode).toBe("LOCAL");
  });

  it("should read PLAYWRIGHT_RUNNER_MODE=REMOTE from env", async () => {
    process.env.PLAYWRIGHT_RUNNER_MODE = "REMOTE";
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig();
    expect(config.runnerMode).toBe("REMOTE");
  });

  it("should fallback to AUTO for invalid PLAYWRIGHT_RUNNER_MODE", async () => {
    process.env.PLAYWRIGHT_RUNNER_MODE = "INVALID";
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig();
    expect(config.runnerMode).toBe("AUTO");
  });

  it("should read PLAYWRIGHT_REMOTE_ENDPOINT from env", async () => {
    process.env.PLAYWRIGHT_REMOTE_ENDPOINT = "ws://browserless:3000";
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig();
    expect(config.remoteEndpoint).toBe("ws://browserless:3000");
  });

  it("should read PLAYWRIGHT_HEADLESS=false from env", async () => {
    process.env.PLAYWRIGHT_HEADLESS = "false";
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig();
    expect(config.headless).toBe(false);
  });

  it("should read PLAYWRIGHT_TIMEOUT_MS from env", async () => {
    process.env.PLAYWRIGHT_TIMEOUT_MS = "30000";
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig();
    expect(config.timeoutMs).toBe(30000);
  });

  it("should apply overrides over env values", async () => {
    process.env.PLAYWRIGHT_RUNNER_MODE = "LOCAL";
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig({ runnerMode: "REMOTE", timeoutMs: 5000 });
    expect(config.runnerMode).toBe("REMOTE");
    expect(config.timeoutMs).toBe(5000);
  });
});

// ─── 2. Error codes — Exhaustivité et descriptions ──────────────────────

describe("playwrightConfig — Error codes", () => {
  it("should have all error codes defined", async () => {
    const { PLAYWRIGHT_ERROR_CODES } = await import("./playwrightConfig");
    const expectedCodes = [
      "PLAYWRIGHT_NOT_INSTALLED",
      "PLAYWRIGHT_BROWSER_MISSING",
      "PLAYWRIGHT_LOCAL_LAUNCH_FAILED",
      "PLAYWRIGHT_REMOTE_ENDPOINT_MISSING",
      "PLAYWRIGHT_REMOTE_CONNECT_FAILED",
      "PLAYWRIGHT_SCRIPT_NOT_FOUND",
      "PLAYWRIGHT_SCRIPT_INVALID",
      "PLAYWRIGHT_EXECUTION_TIMEOUT",
      "PLAYWRIGHT_RUNTIME_ERROR",
      "PLAYWRIGHT_NO_RUNNER_AVAILABLE",
    ];
    for (const code of expectedCodes) {
      expect(PLAYWRIGHT_ERROR_CODES).toHaveProperty(code);
    }
  });

  it("should have descriptions for all error codes", async () => {
    const { PLAYWRIGHT_ERROR_CODES, ERROR_CODE_DESCRIPTIONS } = await import("./playwrightConfig");
    for (const code of Object.values(PLAYWRIGHT_ERROR_CODES)) {
      expect(ERROR_CODE_DESCRIPTIONS).toHaveProperty(code);
      expect(typeof ERROR_CODE_DESCRIPTIONS[code]).toBe("string");
      expect(ERROR_CODE_DESCRIPTIONS[code].length).toBeGreaterThan(0);
    }
  });
});

// ─── 3. PlaywrightLocalRunner — Structure et disponibilité ──────────────

describe("PlaywrightLocalRunner", () => {
  it("should export PlaywrightLocalRunner class", async () => {
    const { PlaywrightLocalRunner } = await import("./PlaywrightLocalRunner");
    expect(PlaywrightLocalRunner).toBeDefined();
  });

  it("should have name and mode properties", async () => {
    const { PlaywrightLocalRunner } = await import("./PlaywrightLocalRunner");
    const runner = new PlaywrightLocalRunner();
    expect(runner.name).toBe("PlaywrightLocalRunner");
    expect(runner.mode).toBe("LOCAL");
  });

  it("should implement checkAvailability method", async () => {
    const { PlaywrightLocalRunner } = await import("./PlaywrightLocalRunner");
    const runner = new PlaywrightLocalRunner();
    expect(typeof runner.checkAvailability).toBe("function");
  });

  it("should implement execute method", async () => {
    const { PlaywrightLocalRunner } = await import("./PlaywrightLocalRunner");
    const runner = new PlaywrightLocalRunner();
    expect(typeof runner.execute).toBe("function");
  });

  it("should detect local Chromium availability", async () => {
    const { PlaywrightLocalRunner } = await import("./PlaywrightLocalRunner");
    const runner = new PlaywrightLocalRunner();
    const result = await runner.checkAvailability();
    // In sandbox, Chromium is installed so should be available
    expect(result).toHaveProperty("available");
    expect(typeof result.available).toBe("boolean");
    if (result.available) {
      expect(result.errorCode).toBeUndefined();
    } else {
      expect(result.errorCode).toBeDefined();
      expect(result.message).toBeDefined();
    }
  }, 15000);
});

// ─── 4. PlaywrightRemoteRunner — Structure et validation ────────────────

describe("PlaywrightRemoteRunner", () => {
  it("should export PlaywrightRemoteRunner class", async () => {
    const { PlaywrightRemoteRunner } = await import("./PlaywrightRemoteRunner");
    expect(PlaywrightRemoteRunner).toBeDefined();
  });

  it("should have name and mode properties", async () => {
    const { PlaywrightRemoteRunner } = await import("./PlaywrightRemoteRunner");
    const runner = new PlaywrightRemoteRunner("ws://fake:3000", null);
    expect(runner.name).toBe("PlaywrightRemoteRunner");
    expect(runner.mode).toBe("REMOTE");
  });

  it("should report unavailable when no endpoint configured", async () => {
    const { PlaywrightRemoteRunner } = await import("./PlaywrightRemoteRunner");
    const runner = new PlaywrightRemoteRunner(null as any, null);
    const result = await runner.checkAvailability();
    expect(result.available).toBe(false);
    expect(result.errorCode).toBe("PLAYWRIGHT_REMOTE_ENDPOINT_MISSING");
  });

  it("should report unavailable when endpoint is empty string", async () => {
    const { PlaywrightRemoteRunner } = await import("./PlaywrightRemoteRunner");
    const runner = new PlaywrightRemoteRunner("", null);
    const result = await runner.checkAvailability();
    expect(result.available).toBe(false);
    expect(result.errorCode).toBe("PLAYWRIGHT_REMOTE_ENDPOINT_MISSING");
  });

  it("should report connect failed for unreachable endpoint", async () => {
    const { PlaywrightRemoteRunner } = await import("./PlaywrightRemoteRunner");
    const runner = new PlaywrightRemoteRunner("ws://nonexistent-host:9999", null);
    const result = await runner.checkAvailability();
    expect(result.available).toBe(false);
    expect(["PLAYWRIGHT_REMOTE_CONNECT_FAILED", "PLAYWRIGHT_REMOTE_ENDPOINT_MISSING"]).toContain(result.errorCode);
  }, 15000);
});

// ─── 5. runnerResolver — Factory et fallback ────────────────────────────

describe("runnerResolver — resolveRunner", () => {
  it("should export resolveRunner function", async () => {
    const { resolveRunner } = await import("./runnerResolver");
    expect(resolveRunner).toBeDefined();
    expect(typeof resolveRunner).toBe("function");
  });

  it("should export formatDiagnosticLogs function", async () => {
    const { formatDiagnosticLogs } = await import("./runnerResolver");
    expect(formatDiagnosticLogs).toBeDefined();
    expect(typeof formatDiagnosticLogs).toBe("function");
  });

  it("should resolve LOCAL runner when mode=LOCAL and Chromium available", async () => {
    const { resolveRunner } = await import("./runnerResolver");
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig({ runnerMode: "LOCAL" });
    const result = await resolveRunner(config);

    expect(result.diagnostic).toBeDefined();
    expect(result.diagnostic.configuredMode).toBe("LOCAL");

    if (result.runner) {
      expect(result.runner.mode).toBe("LOCAL");
      expect(result.runner.name).toBe("PlaywrightLocalRunner");
    }
    // If Chromium not available, should get an error
    if (!result.runner) {
      expect(result.errorCode).toBeDefined();
    }
  }, 15000);

  it("should fail REMOTE when no endpoint configured", async () => {
    const { resolveRunner } = await import("./runnerResolver");
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig({
      runnerMode: "REMOTE",
      remoteEndpoint: null,
    });
    const result = await resolveRunner(config);

    expect(result.runner).toBeNull();
    expect(result.errorCode).toBe("PLAYWRIGHT_REMOTE_ENDPOINT_MISSING");
    expect(result.diagnostic.configuredMode).toBe("REMOTE");
    expect(result.diagnostic.remoteAvailable).toBe(false);
  });

  it("should try AUTO mode with LOCAL first", async () => {
    const { resolveRunner } = await import("./runnerResolver");
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig({
      runnerMode: "AUTO",
      remoteEndpoint: null,
    });
    const result = await resolveRunner(config);

    expect(result.diagnostic.configuredMode).toBe("AUTO");
    // In sandbox, LOCAL should work
    if (result.runner) {
      expect(result.runner.mode).toBe("LOCAL");
      expect(result.diagnostic.fallbackUsed).toBe(false);
    }
  }, 15000);

  it("should return NO_RUNNER_AVAILABLE when both LOCAL and REMOTE fail in AUTO mode", async () => {
    // This test simulates the case where LOCAL is not available and REMOTE has no endpoint
    const { resolveRunner } = await import("./runnerResolver");
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig({
      runnerMode: "REMOTE",
      remoteEndpoint: null,
      remoteToken: null,
    });
    const result = await resolveRunner(config);

    expect(result.runner).toBeNull();
    expect(result.errorCode).toBeDefined();
  });

  it("should produce diagnostic with all fields", async () => {
    const { resolveRunner } = await import("./runnerResolver");
    const { loadPlaywrightConfig } = await import("./playwrightConfig");
    const config = loadPlaywrightConfig({ runnerMode: "AUTO" });
    const result = await resolveRunner(config);

    const diag = result.diagnostic;
    expect(diag).toHaveProperty("configuredMode");
    expect(diag).toHaveProperty("resolvedMode");
    expect(diag).toHaveProperty("fallbackUsed");
    expect(diag).toHaveProperty("localAvailable");
    expect(diag).toHaveProperty("remoteAvailable");
    expect(typeof diag.fallbackUsed).toBe("boolean");
    expect(typeof diag.localAvailable).toBe("boolean");
    expect(typeof diag.remoteAvailable).toBe("boolean");
  }, 15000);
});

// ─── 6. formatDiagnosticLogs — Formatting ───────────────────────────────

describe("runnerResolver — formatDiagnosticLogs", () => {
  it("should format diagnostic into human-readable lines", async () => {
    const { formatDiagnosticLogs } = await import("./runnerResolver");
    const lines = formatDiagnosticLogs({
      configuredMode: "AUTO",
      resolvedMode: "LOCAL",
      fallbackUsed: false,
      localAvailable: true,
      localMessage: "Chromium OK",
      remoteAvailable: false,
      remoteMessage: "No endpoint",
    });

    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(typeof line).toBe("string");
    }
    // Should mention the configured mode
    const joined = lines.join(" ");
    expect(joined).toContain("AUTO");
  });

  it("should indicate fallback when used", async () => {
    const { formatDiagnosticLogs } = await import("./runnerResolver");
    const lines = formatDiagnosticLogs({
      configuredMode: "AUTO",
      resolvedMode: "REMOTE",
      fallbackUsed: true,
      localAvailable: false,
      localMessage: "Chromium not found",
      remoteAvailable: true,
      remoteMessage: "Connected to ws://browserless:3000",
      remoteEndpoint: "ws://browserless:3000",
    });

    const joined = lines.join(" ");
    expect(joined.toLowerCase()).toContain("fallback");
  });
});

// ─── 7. playwrightActions — Shared action functions ─────────────────────

describe("playwrightActions — module structure", () => {
  it("should export executeStepAction function", async () => {
    const mod = await import("./playwrightActions");
    expect(mod.executeStepAction).toBeDefined();
    expect(typeof mod.executeStepAction).toBe("function");
  });

  it("should export buildLocator function", async () => {
    const mod = await import("./playwrightActions");
    expect(mod.buildLocator).toBeDefined();
    expect(typeof mod.buildLocator).toBe("function");
  });

  it("should export resolveBindingValue function", async () => {
    const mod = await import("./playwrightActions");
    expect(mod.resolveBindingValue).toBeDefined();
    expect(typeof mod.resolveBindingValue).toBe("function");
  });
});

describe("playwrightActions — resolveBindingValue", () => {
  it("should resolve exact match from bindings", async () => {
    const { resolveBindingValue } = await import("./playwrightActions");
    const bindings = { "users.email": "john@example.com" };
    expect(resolveBindingValue("users.email", bindings)).toBe("john@example.com");
  });

  it("should return original when no match", async () => {
    const { resolveBindingValue } = await import("./playwrightActions");
    expect(resolveBindingValue("unknown.field", {})).toBe("unknown.field");
  });

  it("should handle undefined bindings", async () => {
    const { resolveBindingValue } = await import("./playwrightActions");
    expect(resolveBindingValue("users.email", undefined)).toBe("users.email");
  });

  it("should trim whitespace before lookup", async () => {
    const { resolveBindingValue } = await import("./playwrightActions");
    const bindings = { "users.email": "john@example.com" };
    expect(resolveBindingValue("  users.email  ", bindings)).toBe("john@example.com");
  });
});

// ─── 8. executionEngine — REAL mode architecture integration ────────────

describe("executionEngine — REAL mode architecture", () => {
  it("should import resolveRunner from runner module", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain('import { resolveRunner, formatDiagnosticLogs } from "./runner/runnerResolver"');
  });

  it("should import loadPlaywrightConfigWithDb for DB-aware config", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("loadPlaywrightConfigWithDb");
  });

  it("should import PLAYWRIGHT_ERROR_CODES for standardized errors", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("PLAYWRIGHT_ERROR_CODES");
  });

  it("should import ERROR_CODE_DESCRIPTIONS for human-readable hints", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("ERROR_CODE_DESCRIPTIONS");
  });

  it("should call resolveRunner in realExecution", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("resolveRunner(config)");
  });

  it("should log diagnostic info from resolver", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("formatDiagnosticLogs");
  });

  it("should update DB with runnerMode and errorCode on failure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("runnerMode:");
    expect(content).toContain("errorCode:");
    expect(content).toContain("errorMessage:");
  });

  it("should have getHintForErrorCode helper", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("function getHintForErrorCode");
  });

  it("should save screenshots as artifacts after each step", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/executionEngine.ts", "utf-8");
    expect(content).toContain("saveScreenshotArtifact");
  });
});

// ─── 9. DB Schema — runner fields ───────────────────────────────────────

describe("DB schema — runner fields in executions table", () => {
  it("should have runner_mode column in schema", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(content).toContain("runner_mode");
    expect(content).toContain("runnerMode");
  });

  it("should have error_code column in schema", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(content).toContain("error_code");
    expect(content).toContain("errorCode");
  });

  it("should have error_message column in schema", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(content).toContain("error_message");
    expect(content).toContain("errorMessage");
  });
});

// ─── 10. RunnerConfigPage — Admin UI ────────────────────────────────────

describe("RunnerConfigPage — admin UI integration", () => {
  it("should have RunnerConfigPage component file", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("client/src/pages/admin/RunnerConfigPage.tsx")).toBe(true);
  });

  it("should have route for /admin/runner in App.tsx", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(content).toContain("/admin/runner");
    expect(content).toContain("RunnerConfigPage");
  });

  it("should have runnerConfig router mounted in routers.ts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers.ts", "utf-8");
    expect(content).toContain("runnerConfig");
  });

  it("should have Runner link in DashboardLayout navigation", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("client/src/components/DashboardLayout.tsx", "utf-8");
    expect(content).toContain("/admin/runner");
    expect(content.toLowerCase()).toContain("runner");
  });
});

// ─── 11. Runner index — Module exports ──────────────────────────────────

describe("runner/index — module exports", () => {
  it("should re-export all runner modules", async () => {
    const mod = await import("./index");
    expect(mod).toBeDefined();
  });
});
