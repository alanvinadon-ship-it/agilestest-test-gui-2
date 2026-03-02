import crypto from "crypto";

/**
 * Encryption utility for AES-256-GCM encryption/decryption
 * Used to secure sensitive data like OAuth credentials and API keys
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits for key derivation

/**
 * Derive a 256-bit key from a master key and salt using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, "sha256");
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: salt:iv:encryptedData:authTag (all base64 encoded and separated by colons)
 */
export function encrypt(plaintext: string, masterKey: string): string {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive encryption key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const encryptedBuffer = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: salt:iv:encrypted:authTag (all base64)
    const saltB64 = salt.toString("base64");
    const ivB64 = iv.toString("base64");
    const encryptedB64 = encryptedBuffer.toString("base64");
    const authTagB64 = authTag.toString("base64");

    return `${saltB64}:${ivB64}:${encryptedB64}:${authTagB64}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Decrypt data using AES-256-GCM
 * Input format: salt:iv:encryptedData:authTag (all base64 encoded and separated by colons)
 */
export function decrypt(ciphertext: string, masterKey: string): string {
  try {
    // Parse components
    const parts = ciphertext.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid ciphertext format");
    }

    const salt = Buffer.from(parts[0], "base64");
    const iv = Buffer.from(parts[1], "base64");
    const encrypted = Buffer.from(parts[2], "base64");
    const authTag = Buffer.from(parts[3], "base64");

    // Validate component sizes
    if (salt.length !== SALT_LENGTH) {
      throw new Error(`Invalid salt length: expected ${SALT_LENGTH}, got ${salt.length}`);
    }
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
    }

    // Derive decryption key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    const decryptedBuffer = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    const decrypted = decryptedBuffer.toString("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate a random encryption master key (256 bits)
 * Used for initializing ENCRYPTION_MASTER_KEY environment variable
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Validate that a master key is properly formatted (64 hex characters = 256 bits)
 */
export function validateMasterKey(key: string): boolean {
  return /^[0-9a-f]{64}$/i.test(key);
}
