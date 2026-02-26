import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// ─── 1. audit-storage script ───────────────────────────────────────────────

describe("audit-storage script", () => {
  it("exits 0 (no violations) when run from project root", () => {
    // This will throw if exit code !== 0
    const output = execSync("node scripts/audit-storage.mjs", {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(output).toContain("No forbidden localStorage/sessionStorage usage found");
  });
});

// ─── 2. No raw localStorage in stores ──────────────────────────────────────

describe("localStorage elimination in stores", () => {
  const storePaths = [
    "client/src/api/localStore.ts",
    "client/src/admin/adminStore.ts",
    "client/src/admin/permissions.ts",
    "client/src/notifications/localNotificationsStore.ts",
    "client/src/ai/scriptRepository.ts",
    "client/src/api/client.ts",
    "client/src/security/PermissionGate.tsx",
    "client/src/pages/AdminRolesPage.tsx",
  ];

  for (const rel of storePaths) {
    it(`${rel} does not contain raw localStorage calls`, () => {
      const fullPath = join(ROOT, rel);
      if (!existsSync(fullPath)) {
        // File may have been deleted during migration — that's fine
        return;
      }
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      const violations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Skip comments
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
        // Check for raw localStorage usage
        if (/localStorage\s*[.\[]/.test(lines[i]) || /window\.localStorage/.test(lines[i])) {
          violations.push(`Line ${i + 1}: ${trimmed}`);
        }
      }

      expect(violations).toEqual([]);
    });
  }
});

// ─── 3. memoryStore module exists and exports correct API ──────────────────

describe("memoryStore module", () => {
  it("exports getItem, setItem, removeItem, clear, keys", () => {
    const fullPath = join(ROOT, "client/src/api/memoryStore.ts");
    expect(existsSync(fullPath)).toBe(true);
    const content = readFileSync(fullPath, "utf-8");
    expect(content).toContain("getItem");
    expect(content).toContain("setItem");
    expect(content).toContain("removeItem");
    expect(content).toContain("clear");
    expect(content).toContain("keys");
  });

  it("does not use window.localStorage internally", () => {
    const fullPath = join(ROOT, "client/src/api/memoryStore.ts");
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
      expect(line).not.toMatch(/window\.localStorage/);
    }
  });
});

// ─── 4. uiStorage module exists ────────────────────────────────────────────

describe("uiStorage module", () => {
  it("exists and exports typed API", () => {
    const fullPath = join(ROOT, "client/src/lib/uiStorage.ts");
    expect(existsSync(fullPath)).toBe(true);
    const content = readFileSync(fullPath, "utf-8");
    expect(content).toContain("uiStorage");
    // Should use Zod or a whitelist pattern
    expect(content).toMatch(/z\.|whitelist|schema|ALLOWED/i);
  });
});

// ─── 5. stores import memoryStore ──────────────────────────────────────────

describe("stores import memoryStore", () => {
  const storesWithMemoryStore = [
    "client/src/api/localStore.ts",
    "client/src/admin/adminStore.ts",
    "client/src/admin/permissions.ts",
    "client/src/notifications/localNotificationsStore.ts",
    "client/src/ai/scriptRepository.ts",
  ];

  for (const rel of storesWithMemoryStore) {
    it(`${rel} imports memoryStore`, () => {
      const fullPath = join(ROOT, rel);
      if (!existsSync(fullPath)) return;
      const content = readFileSync(fullPath, "utf-8");
      expect(content).toContain("memoryStore");
    });
  }
});

// ─── 6. api/client.ts no longer stores tokens ─────────────────────────────

describe("api/client.ts auth migration", () => {
  it("does not store or read access_token from localStorage", () => {
    const fullPath = join(ROOT, "client/src/api/client.ts");
    const content = readFileSync(fullPath, "utf-8");
    expect(content).not.toContain("access_token");
    expect(content).toContain("withCredentials"); // Uses cookies instead
  });
});
