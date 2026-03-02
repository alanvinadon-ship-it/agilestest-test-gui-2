#!/usr/bin/env node
/**
 * audit-storage — Scan the client source for forbidden localStorage / sessionStorage usage.
 *
 * Allowed patterns:
 *   - client/src/lib/uiStorage.ts (the wrapper itself)
 *
 * Exit code 0 = clean, 1 = violations found.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const CLIENT_SRC = join(process.cwd(), "client", "src");
const ALLOWED_FILES = new Set([
  "lib/uiStorage.ts",
  "api/memoryStore.ts",       // The memoryStore wrapper itself (replaces localStorage)
  "_core/hooks/useAuth.ts",   // Framework internal: sessionStorage for runtime user info
]);

const FORBIDDEN_PATTERNS = [
  /localStorage\s*\./g,
  /localStorage\s*\[/g,
  /sessionStorage\s*\./g,
  /sessionStorage\s*\[/g,
  /window\.localStorage/g,
  /window\.sessionStorage/g,
];

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

async function main() {
  const violations = [];

  for await (const filePath of walk(CLIENT_SRC)) {
    const rel = relative(CLIENT_SRC, filePath);
    if (ALLOWED_FILES.has(rel)) continue;

    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      // Skip comments (single-line and JSDoc/block comment lines)
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      for (const pattern of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(lines[i])) {
          violations.push({
            file: rel,
            line: i + 1,
            text: trimmed,
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("✅ audit-storage: No forbidden localStorage/sessionStorage usage found.");
    process.exit(0);
  }

  console.error(`❌ audit-storage: ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.text}`);
  }
  console.error(
    "\n💡 Use client/src/lib/uiStorage.ts for UI preferences only."
  );
  console.error("   Business data must go through tRPC/Postgres.\n");
  process.exit(1);
}

main();
