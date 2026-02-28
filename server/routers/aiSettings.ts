// ============================================================================
// AI Settings Router — Admin-only CRUD for AI provider configuration
// Encrypted API key storage, ENV lock support, connection testing
// ============================================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { router, adminProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { aiProviderConfigs } from "../../drizzle/schema";
import { encryptSecret, decryptSecret, hasMasterKey } from "../lib/aiCrypto";
import { writeAuditLog } from "../lib/auditLog";

// ── Zod Schemas ───────────────────────────────────────────────────────────

const providerEnum = z.enum(["OPENAI", "AZURE_OPENAI", "ANTHROPIC", "CUSTOM_HTTP"]);

const upsertInput = z.object({
  orgId: z.string().min(1),
  enabled: z.boolean(),
  provider: providerEnum,
  model: z.string().min(1).max(128),
  baseUrl: z.string().max(512).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional().default(30000),
  maxRetries: z.number().int().min(0).max(10).optional().default(2),
  temperature: z.number().min(0).max(2).nullable().optional(),
  azureEndpoint: z.string().max(512).nullable().optional(),
  azureApiVersion: z.string().max(32).nullable().optional(),
  azureDeployment: z.string().max(128).nullable().optional(),
  customHttpUrl: z.string().max(512).nullable().optional(),
  apiKey: z.string().min(1).max(512).optional(), // plaintext, never stored raw
});

const rotateKeyInput = z.object({
  orgId: z.string().min(1),
  apiKey: z.string().min(1).max(512),
});

const orgInput = z.object({
  orgId: z.string().min(1),
});

// ── Helpers ───────────────────────────────────────────────────────────────

function assertNotLocked() {
  if (ENV.aiConfigLocked) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "AI configuration is locked (AI_CONFIG_LOCKED=true). Changes must be made via environment variables.",
    });
  }
}

function assertMasterKey() {
  if (!hasMasterKey()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI encryption master key not configured. Set AI_CONFIG_MASTER_KEY or AI_CONFIG_MASTER_KEY_FILE.",
    });
  }
}

// ── Router ────────────────────────────────────────────────────────────────

export const aiSettingsRouter = router({
  /**
   * Quick status check for AI config (lightweight, no DB query).
   * Used by UI to show/hide warnings.
   */
  configStatus: adminProcedure.input(orgInput).query(async ({ input }) => {
    const db = await getDb();
    const locked = ENV.aiConfigLocked;
    const masterKeyAvailable = hasMasterKey();

    let hasSecret = false;
    let source: "DB" | "ENV" | "DISABLED" = "DISABLED";

    if (locked) {
      source = ENV.forgeApiKey ? "ENV" : "DISABLED";
      hasSecret = !!ENV.forgeApiKey;
    } else if (db) {
      const [config] = await db.select({
        enabled: aiProviderConfigs.enabled,
        hasCipher: aiProviderConfigs.secretCiphertext,
      }).from(aiProviderConfigs)
        .where(eq(aiProviderConfigs.orgId, input.orgId))
        .limit(1);

      if (config && config.enabled) {
        source = "DB";
        hasSecret = !!config.hasCipher;
      } else {
        source = ENV.forgeApiKey ? "ENV" : "DISABLED";
        hasSecret = !!ENV.forgeApiKey;
      }
    }

    return {
      missingMasterKey: !locked && !masterKeyAvailable,
      locked,
      source,
      hasSecret,
    };
  }),

  /**
   * Get current AI config for an org.
   * NEVER returns the API key.
   */
  get: adminProcedure.input(orgInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Determine source
    const locked = ENV.aiConfigLocked;

    if (locked) {
      // ENV-only mode: return ENV-based config info
      return {
        locked: true,
        source: ENV.forgeApiKey ? "ENV" as const : "DISABLED" as const,
        enabled: !!ENV.forgeApiKey,
        provider: "OPENAI" as const,
        model: "gemini-2.5-flash",
        baseUrl: ENV.forgeApiUrl || null,
        timeoutMs: 30000,
        maxRetries: 2,
        temperature: null,
        azureEndpoint: null,
        azureApiVersion: null,
        azureDeployment: null,
        customHttpUrl: null,
        hasSecret: !!ENV.forgeApiKey,
        hasMasterKey: false,
        updatedAt: null,
      };
    }

    const [config] = await db.select().from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.orgId, input.orgId))
      .limit(1);

    if (!config) {
      return {
        locked: false,
        source: ENV.forgeApiKey ? "ENV" as const : "DISABLED" as const,
        enabled: false,
        provider: "OPENAI" as const,
        model: "gpt-4o",
        baseUrl: null,
        timeoutMs: 30000,
        maxRetries: 2,
        temperature: null,
        azureEndpoint: null,
        azureApiVersion: null,
        azureDeployment: null,
        customHttpUrl: null,
        hasSecret: !!ENV.forgeApiKey,
        hasMasterKey: hasMasterKey(),
        updatedAt: null,
      };
    }

    return {
      locked: false,
      source: config.enabled ? "DB" as const : (ENV.forgeApiKey ? "ENV" as const : "DISABLED" as const),
      enabled: config.enabled,
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      temperature: config.temperature ? Number(config.temperature) : null,
      azureEndpoint: config.azureEndpoint,
      azureApiVersion: config.azureApiVersion,
      azureDeployment: config.azureDeployment,
      customHttpUrl: config.customHttpUrl,
      hasSecret: !!config.secretCiphertext,
      hasMasterKey: hasMasterKey(),
      updatedAt: config.updatedAt,
    };
  }),

  /**
   * Create or update AI config for an org.
   * If apiKey is provided, it's encrypted before storage.
   */
  upsert: adminProcedure.input(upsertInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Encrypt API key if provided
    let secretCiphertext: string | null = null;
    let secretKeyId: string | null = null;
    if (input.apiKey) {
      assertMasterKey();
      const encrypted = encryptSecret(input.apiKey);
      secretCiphertext = encrypted.ciphertext;
      secretKeyId = encrypted.keyId;
    }

    // Check if config exists
    const [existing] = await db.select({ id: aiProviderConfigs.id })
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.orgId, input.orgId))
      .limit(1);

    if (existing) {
      // Update
      const updateData: Record<string, unknown> = {
        enabled: input.enabled,
        provider: input.provider,
        model: input.model,
        baseUrl: input.baseUrl ?? null,
        timeoutMs: input.timeoutMs,
        maxRetries: input.maxRetries,
        temperature: input.temperature != null ? String(input.temperature) : null,
        azureEndpoint: input.azureEndpoint ?? null,
        azureApiVersion: input.azureApiVersion ?? null,
        azureDeployment: input.azureDeployment ?? null,
        customHttpUrl: input.customHttpUrl ?? null,
      };
      if (secretCiphertext) {
        updateData.secretCiphertext = secretCiphertext;
        updateData.secretKeyId = secretKeyId;
      }
      await db.update(aiProviderConfigs)
        .set(updateData)
        .where(eq(aiProviderConfigs.id, existing.id));

      await writeAuditLog({
        userId: ctx.user.openId,
        action: "AI_CONFIG_UPDATE",
        entity: "AI_PROVIDER_CONFIG",
        entityId: input.orgId,
        details: { provider: input.provider, model: input.model, enabled: input.enabled, keyChanged: !!input.apiKey },
      });
    } else {
      // Insert
      await db.insert(aiProviderConfigs).values({
        uid: randomUUID(),
        orgId: input.orgId,
        enabled: input.enabled,
        provider: input.provider,
        model: input.model,
        baseUrl: input.baseUrl ?? null,
        timeoutMs: input.timeoutMs ?? 30000,
        maxRetries: input.maxRetries ?? 2,
        temperature: input.temperature != null ? String(input.temperature) : null,
        azureEndpoint: input.azureEndpoint ?? null,
        azureApiVersion: input.azureApiVersion ?? null,
        azureDeployment: input.azureDeployment ?? null,
        customHttpUrl: input.customHttpUrl ?? null,
        secretCiphertext,
        secretKeyId,
        createdBy: ctx.user.openId,
      });

      await writeAuditLog({
        userId: ctx.user.openId,
        action: "AI_CONFIG_CREATE",
        entity: "AI_PROVIDER_CONFIG",
        entityId: input.orgId,
        details: { provider: input.provider, model: input.model, enabled: input.enabled },
      });
    }

    return { ok: true };
  }),

  /**
   * Rotate the API key without changing other settings.
   */
  rotateKey: adminProcedure.input(rotateKeyInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    assertMasterKey();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [existing] = await db.select({ id: aiProviderConfigs.id })
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.orgId, input.orgId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No AI config found for this org. Create one first." });
    }

    const encrypted = encryptSecret(input.apiKey);
    await db.update(aiProviderConfigs)
      .set({
        secretCiphertext: encrypted.ciphertext,
        secretKeyId: encrypted.keyId,
      })
      .where(eq(aiProviderConfigs.id, existing.id));

    await writeAuditLog({
      userId: ctx.user.openId,
      action: "AI_CONFIG_ROTATE_KEY",
      entity: "AI_PROVIDER_CONFIG",
      entityId: input.orgId,
    });

    return { ok: true };
  }),

  /**
   * Disable AI for an org.
   */
  disable: adminProcedure.input(orgInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [existing] = await db.select({ id: aiProviderConfigs.id })
      .from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.orgId, input.orgId))
      .limit(1);

    if (!existing) {
      return { ok: true }; // Nothing to disable
    }

    await db.update(aiProviderConfigs)
      .set({ enabled: false })
      .where(eq(aiProviderConfigs.id, existing.id));

    await writeAuditLog({
      userId: ctx.user.openId,
      action: "AI_CONFIG_DISABLE",
      entity: "AI_PROVIDER_CONFIG",
      entityId: input.orgId,
    });

    return { ok: true };
  }),

  /**
   * Test AI provider connectivity.
   * Makes a lightweight call to verify the API key works.
   */
  testConnection: adminProcedure.input(orgInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    let apiKey: string;
    let baseUrl: string;
    let provider: string;
    let model: string;

    if (ENV.aiConfigLocked) {
      // Use ENV config
      if (!ENV.forgeApiKey) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No AI API key configured in environment." });
      }
      apiKey = ENV.forgeApiKey;
      baseUrl = ENV.forgeApiUrl || "https://forge.manus.im";
      provider = "OPENAI";
      model = "gemini-2.5-flash";
    } else {
      // Use DB config
      const [config] = await db.select().from(aiProviderConfigs)
        .where(eq(aiProviderConfigs.orgId, input.orgId))
        .limit(1);

      if (!config || !config.secretCiphertext) {
        // Fallback to ENV
        if (!ENV.forgeApiKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No AI API key configured (neither DB nor ENV)." });
        }
        apiKey = ENV.forgeApiKey;
        baseUrl = ENV.forgeApiUrl || "https://forge.manus.im";
        provider = "OPENAI";
        model = "gemini-2.5-flash";
      } else {
        assertMasterKey();
        apiKey = decryptSecret(config.secretCiphertext);
        provider = config.provider;
        model = config.model;

        // Resolve base URL per provider
        if (config.provider === "AZURE_OPENAI" && config.azureEndpoint) {
          baseUrl = config.azureEndpoint;
        } else if (config.provider === "CUSTOM_HTTP" && config.customHttpUrl) {
          baseUrl = config.customHttpUrl;
        } else {
          baseUrl = config.baseUrl || ENV.forgeApiUrl || "https://api.openai.com";
        }
      }
    }

    // Perform lightweight test call
    const start = Date.now();
    try {
      const testUrl = resolveTestUrl(provider, baseUrl);
      const response = await fetch(testUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Respond with exactly: OK" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        await writeAuditLog({
          userId: ctx.user.openId,
          action: "AI_CONFIG_TEST_FAIL",
          entity: "AI_PROVIDER_CONFIG",
          entityId: input.orgId,
          details: { status: response.status, latencyMs },
        });
        return {
          ok: false,
          latencyMs,
          error: `Provider returned ${response.status}: ${errText.substring(0, 200)}`,
          providerInfo: { provider, model },
        };
      }

      await writeAuditLog({
        userId: ctx.user.openId,
        action: "AI_CONFIG_TEST_OK",
        entity: "AI_PROVIDER_CONFIG",
        entityId: input.orgId,
        details: { latencyMs },
      });

      return {
        ok: true,
        latencyMs,
        providerInfo: { provider, model },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      await writeAuditLog({
        userId: ctx.user.openId,
        action: "AI_CONFIG_TEST_FAIL",
        entity: "AI_PROVIDER_CONFIG",
        entityId: input.orgId,
        details: { error: err.message?.substring(0, 200), latencyMs },
      });
      return {
        ok: false,
        latencyMs,
        error: err.message?.substring(0, 200) || "Connection failed",
        providerInfo: { provider, model },
      };
    }
  }),
});

// ── URL Resolution ────────────────────────────────────────────────────────

function resolveTestUrl(provider: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, "");
  if (provider === "AZURE_OPENAI") {
    // Azure uses a different endpoint pattern
    return `${cleanBase}/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-01`;
  }
  if (provider === "ANTHROPIC") {
    return `${cleanBase}/v1/messages`;
  }
  // OpenAI / Custom HTTP
  return `${cleanBase}/v1/chat/completions`;
}
