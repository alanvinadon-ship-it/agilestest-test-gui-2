import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, generateMasterKey, validateMasterKey } from "./encryption";

describe("Encryption Module", () => {
  let masterKey: string;

  beforeAll(() => {
    masterKey = generateMasterKey();
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt plaintext correctly", () => {
      const plaintext = "my-secret-value";
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle empty strings", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle long strings", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle special characters", () => {
      const plaintext = '{"key": "value", "special": "!@#$%^&*()_+-=[]{}|;:,.<>?"}';
      const encrypted = encrypt(plaintext, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for same plaintext (due to random IV and salt)", () => {
      const plaintext = "same-plaintext";
      const encrypted1 = encrypt(plaintext, masterKey);
      const encrypted2 = encrypt(plaintext, masterKey);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1, masterKey)).toBe(plaintext);
      expect(decrypt(encrypted2, masterKey)).toBe(plaintext);
    });

    it("should fail to decrypt with wrong master key", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext, masterKey);
      const wrongKey = generateMasterKey();

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it("should fail to decrypt with tampered ciphertext", () => {
      const plaintext = "secret";
      const encrypted = encrypt(plaintext, masterKey);
      const tampered = encrypted.slice(0, -5) + "xxxxx";

      expect(() => decrypt(tampered, masterKey)).toThrow();
    });

    it("should fail with invalid ciphertext format", () => {
      const invalid = "not:a:valid:format:with:too:many:parts";

      expect(() => decrypt(invalid, masterKey)).toThrow();
    });
  });

  describe("generateMasterKey", () => {
    it("should generate a 64-character hex string", () => {
      const key = generateMasterKey();

      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true);
    });

    it("should generate different keys each time", () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe("validateMasterKey", () => {
    it("should validate correct master key format", () => {
      const key = generateMasterKey();

      expect(validateMasterKey(key)).toBe(true);
    });

    it("should reject non-hex strings", () => {
      expect(validateMasterKey("not-a-hex-string-at-all-1234567890")).toBe(false);
    });

    it("should reject wrong length", () => {
      expect(validateMasterKey("0123456789abcdef")).toBe(false); // 16 chars instead of 64
    });

    it("should reject empty string", () => {
      expect(validateMasterKey("")).toBe(false);
    });

    it("should accept uppercase hex", () => {
      const key = "0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

      expect(validateMasterKey(key)).toBe(true);
    });

    it("should accept lowercase hex", () => {
      const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      expect(validateMasterKey(key)).toBe(true);
    });
  });

  describe("OAuth credentials encryption", () => {
    it("should encrypt and decrypt OAuth client secret", () => {
      const clientSecret = "gcp_client_secret_abc123xyz789";
      const encrypted = encrypt(clientSecret, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(decrypted).toBe(clientSecret);
      expect(encrypted).not.toBe(clientSecret); // Should be encrypted
    });

    it("should encrypt and decrypt GitHub OAuth token", () => {
      const githubToken = "gho_16C7e42F292c6912E7710c838347Ae178B4a";
      const encrypted = encrypt(githubToken, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(decrypted).toBe(githubToken);
    });

    it("should encrypt and decrypt complex JSON credentials", () => {
      const credentials = JSON.stringify({
        client_id: "123456789",
        client_secret: "secret_xyz",
        redirect_uri: "https://example.com/callback",
        scopes: ["openid", "profile", "email"],
      });
      const encrypted = encrypt(credentials, masterKey);
      const decrypted = decrypt(encrypted, masterKey);

      expect(JSON.parse(decrypted)).toEqual(JSON.parse(credentials));
    });
  });
});
