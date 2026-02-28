// ============================================================================
// readSecret — Read a secret from Docker secret file (_FILE) or ENV variable
// Priority: <KEY>_FILE → <KEY> → undefined
// ============================================================================

import { readFileSync } from "fs";

/**
 * Read a secret value by key name.
 * 1. Checks `<key>_FILE` env → reads file content (trimmed)
 * 2. Falls back to `<key>` env variable
 * 3. Returns undefined if neither is set
 */
export function readSecret(key: string): string | undefined {
  // 1. Try file-based secret (Docker secrets pattern)
  const filePath = process.env[`${key}_FILE`];
  if (filePath && filePath.length > 0) {
    try {
      const content = readFileSync(filePath, "utf-8").trim();
      if (content.length > 0) {
        return content;
      }
    } catch (err: any) {
      if (err.code === "ENOENT") {
        console.warn(`[readSecret] File not found for ${key}_FILE: ${filePath}`);
      } else {
        console.error(`[readSecret] Error reading ${key}_FILE (${filePath}):`, err.message);
      }
    }
  }

  // 2. Fall back to direct ENV variable
  const envValue = process.env[key];
  if (envValue && envValue.length > 0) {
    return envValue;
  }

  return undefined;
}
