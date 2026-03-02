import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { encrypt, decrypt } from "../lib/encryption";

const KeycloakConfigSchema = z.object({
  url: z.string().url("Invalid Keycloak URL"),
  realm: z.string().min(1, "Realm is required"),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
  sessionTimeoutMinutes: z.number().int().min(5).max(10080).default(1440),
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  githubClientId: z.string().optional(),
  githubClientSecret: z.string().optional(),
});

type KeycloakConfig = z.infer<typeof KeycloakConfigSchema>;

// In-memory storage for Keycloak config (encrypted)
let keycloakConfig: KeycloakConfig | null = null;

// Get encryption master key from environment
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_MASTER_KEY environment variable is not set");
  }
  return key;
}

// Encrypt sensitive fields before storage
function encryptConfig(config: KeycloakConfig): KeycloakConfig {
  const key = getEncryptionKey();
  return {
    ...config,
    clientSecret: encrypt(config.clientSecret, key),
    googleClientSecret: config.googleClientSecret
      ? encrypt(config.googleClientSecret, key)
      : undefined,
    githubClientSecret: config.githubClientSecret
      ? encrypt(config.githubClientSecret, key)
      : undefined,
  };
}

// Decrypt sensitive fields after retrieval
function decryptConfig(config: KeycloakConfig): KeycloakConfig {
  const key = getEncryptionKey();
  return {
    ...config,
    clientSecret: decrypt(config.clientSecret, key),
    googleClientSecret: config.googleClientSecret
      ? decrypt(config.googleClientSecret, key)
      : undefined,
    githubClientSecret: config.githubClientSecret
      ? decrypt(config.githubClientSecret, key)
      : undefined,
  };
}

async function testKeycloakConnection(config: KeycloakConfig) {
  try {
    const issuerUrl = `${config.url}/realms/${config.realm}`;
    const response = await axios.get(
      `${issuerUrl}/.well-known/openid-configuration`,
      { timeout: 5000 }
    );

    if (response.status !== 200) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = response.data;
    if (!data.issuer || !data.authorization_endpoint || !data.token_endpoint) {
      return { success: false, error: "Invalid OpenID configuration" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const keycloakRouter = router({
  get: adminProcedure.query(async () => {
    if (!keycloakConfig) {
      const envConfig = {
        url: process.env.KEYCLOAK_URL,
        realm: process.env.KEYCLOAK_REALM,
        clientId: process.env.KEYCLOAK_CLIENT_ID,
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
        sessionTimeoutMinutes: parseInt(
          process.env.KEYCLOAK_SESSION_TIMEOUT_MINUTES || "1440"
        ),
        googleClientId: process.env.KEYCLOAK_GOOGLE_CLIENT_ID,
        googleClientSecret: process.env.KEYCLOAK_GOOGLE_CLIENT_SECRET,
        githubClientId: process.env.KEYCLOAK_GITHUB_CLIENT_ID,
        githubClientSecret: process.env.KEYCLOAK_GITHUB_CLIENT_SECRET,
      };

      if (
        envConfig.url &&
        envConfig.realm &&
        envConfig.clientId &&
        envConfig.clientSecret
      ) {
        keycloakConfig = envConfig as KeycloakConfig;
      }
    }

    if (!keycloakConfig) return null;
    // Return decrypted config (secrets are shown in plaintext for editing)
    return decryptConfig(keycloakConfig);
  }),

  update: adminProcedure
    .input(KeycloakConfigSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const testResult = await testKeycloakConnection(input);
        if (!testResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Connection test failed: ${testResult.error}`,
          });
        }
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to validate Keycloak configuration: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }

      // Encrypt secrets before storing
      keycloakConfig = encryptConfig(input);

      console.log(`[Keycloak] Configuration updated by ${ctx.user.name}`);

      return {
        success: true,
        message: "Keycloak configuration updated successfully",
      };
    }),

  testConnection: adminProcedure
    .input(KeycloakConfigSchema)
    .mutation(async ({ input }) => {
      const result = await testKeycloakConnection(input);
      return result;
    }),

  testSocialProviders: adminProcedure
    .input(
      z.object({
        url: z.string().url(),
        realm: z.string(),
        googleClientId: z.string().optional(),
        githubClientId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const results = {
        google: { configured: false, available: false, error: null as string | null },
        github: { configured: false, available: false, error: null as string | null },
      };

      if (input.googleClientId) {
        results.google.configured = true;
        try {
          const response = await axios.get(
            `${input.url}/realms/${input.realm}/broker/google/endpoint`,
            { timeout: 5000 }
          );
          results.google.available = response.status === 200;
        } catch (error) {
          results.google.error =
            error instanceof Error ? error.message : "Unknown error";
        }
      }

      if (input.githubClientId) {
        results.github.configured = true;
        try {
          const response = await axios.get(
            `${input.url}/realms/${input.realm}/broker/github/endpoint`,
            { timeout: 5000 }
          );
          results.github.available = response.status === 200;
        } catch (error) {
          results.github.error =
            error instanceof Error ? error.message : "Unknown error";
        }
      }

      return results;
    }),

  // Get encryption status
  getEncryptionStatus: adminProcedure.query(() => {
    try {
      getEncryptionKey();
      return { encrypted: true, keyConfigured: true };
    } catch {
      return { encrypted: false, keyConfigured: false };
    }
  }),
});
