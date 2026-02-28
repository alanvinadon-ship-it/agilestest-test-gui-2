// ============================================================================
// AI Config Crypto — AES-256-GCM encryption for API keys
// Master key from ENV: AI_CONFIG_MASTER_KEY or AI_CONFIG_MASTER_KEY_FILE
// ============================================================================

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { readSecret } from "./readSecret";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96 bits recommended for GCM
const TAG_LEN = 16; // 128-bit auth tag
const KEY_LEN = 32; // 256 bits

// ── Master Key Resolution ─────────────────────────────────────────────────────────

let _masterKey: Buffer | null = null;

function resolveMasterKey(): Buffer {
  if (_masterKey) return _masterKey;

  // Use readSecret: checks AI_CONFIG_MASTER_KEY_FILE first, then AI_CONFIG_MASTER_KEY
  const keyHex = readSecret("AI_CONFIG_MASTER_KEY");
  if (keyHex && keyHex.length > 0) {
    if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
      throw new Error(
        "AI_CONFIG_MASTER_KEY must be a hex string. Got non-hex characters."
      );
    }
    const buf = Buffer.from(keyHex, "hex");
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `AI_CONFIG_MASTER_KEY must be ${KEY_LEN * 2} hex chars (${KEY_LEN} bytes). Got ${buf.length} bytes.`
      );
    }
    _masterKey = buf;
    return _masterKey;
  }

  throw new Error(
    "AI encryption master key not configured. Set AI_CONFIG_MASTER_KEY (64 hex chars) or AI_CONFIG_MASTER_KEY_FILE."
  );
}

/**
 * Check if a master key is available without throwing.
 */
export function hasMasterKey(): boolean {
  try {
    resolveMasterKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset cached master key (useful for testing).
 */
export function resetMasterKeyCache(): void {
  _masterKey = null;
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────

/**
 * Encrypt a plaintext secret using AES-256-GCM.
 * Returns a base64-encoded string: iv(12) + ciphertext + authTag(16)
 */
export function encryptSecret(plaintext: string): { ciphertext: string; keyId: string } {
  const key = resolveMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + ciphertext + authTag
  const packed = Buffer.concat([iv, encrypted, authTag]);
  return {
    ciphertext: packed.toString("base64"),
    keyId: "v1", // For future key rotation tracking
  };
}

/**
 * Decrypt a ciphertext produced by encryptSecret.
 */
export function decryptSecret(ciphertextB64: string): string {
  const key = resolveMasterKey();
  const packed = Buffer.from(ciphertextB64, "base64");

  if (packed.length < IV_LEN + TAG_LEN) {
    throw new Error("Invalid ciphertext: too short");
  }

  const iv = packed.subarray(0, IV_LEN);
  const authTag = packed.subarray(packed.length - TAG_LEN);
  const encrypted = packed.subarray(IV_LEN, packed.length - TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}

/**
 * Generate a random master key (for initial setup / documentation).
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_LEN).toString("hex");
}
