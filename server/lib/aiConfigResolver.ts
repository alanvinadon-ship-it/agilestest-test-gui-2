// ============================================================================
// AI Config Resolver — resolves AI provider config from DB or ENV
// Priority: AI_CONFIG_LOCKED → ENV only | DB (if enabled) | ENV fallback
// Includes a 30-second in-memory cache to avoid repeated decryption.
// ============================================================================

import { eq } from "drizzle-orm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { aiProviderConfigs } from "../../drizzle/schema";
import { decryptSecret, hasMasterKey } from "./aiCrypto";

export interface ResolvedAIConfig {
  source: "DB" | "ENV" | "DISABLED";
  enabled: boolean;
  provider: "OPENAI" | "AZURE_OPENAI" | "ANTHROPIC" | "CUSTOM_HTTP";
  model: string;
  apiKey: string;
  baseUrl: string | null;
  timeoutMs: number;
  maxRetries: number;
  temperature: number | null;
  azureEndpoint: string | null;
  azureApiVersion: string | null;
  azureDeployment: string | null;
  customHttpUrl: string | null;
}

// ── Cache ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  config: ResolvedAIConfig;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function clearAiConfigCache(orgId?: string): void {
  if (orgId) {
    cache.delete(orgId);
  } else {
    cache.clear();
  }
}

// ── Resolver ──────────────────────────────────────────────────────────────

function buildEnvConfig(): ResolvedAIConfig {
  if (!ENV.forgeApiKey) {
    return {
      source: "DISABLED",
      enabled: false,
      provider: "OPENAI",
      model: "gemini-2.5-flash",
      apiKey: "",
      baseUrl: ENV.forgeApiUrl || null,
      timeoutMs: 30000,
      maxRetries: 2,
      temperature: null,
      azureEndpoint: null,
      azureApiVersion: null,
      azureDeployment: null,
      customHttpUrl: null,
    };
  }
  return {
    source: "ENV",
    enabled: true,
    provider: "OPENAI",
    model: "gemini-2.5-flash",
    apiKey: ENV.forgeApiKey,
    baseUrl: ENV.forgeApiUrl || null,
    timeoutMs: 30000,
    maxRetries: 2,
    temperature: null,
    azureEndpoint: null,
    azureApiVersion: null,
    azureDeployment: null,
    customHttpUrl: null,
  };
}

/**
 * Resolve the AI configuration for a given org.
 * - If AI_CONFIG_LOCKED=true → always use ENV
 * - If DB config exists and is enabled → use DB (decrypt secret)
 * - Otherwise → fallback to ENV
 */
export async function getResolvedAIConfig(orgId: string): Promise<ResolvedAIConfig> {
  // 1. Locked mode → ENV only
  if (ENV.aiConfigLocked) {
    return buildEnvConfig();
  }

  // 2. Check cache
  const cached = cache.get(orgId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.config;
  }

  // 3. Query DB
  try {
    const db = await getDb();
    if (!db) return buildEnvConfig();

    const [row] = await db.select().from(aiProviderConfigs)
      .where(eq(aiProviderConfigs.orgId, orgId))
      .limit(1);

    if (!row || !row.enabled) {
      const envConfig = buildEnvConfig();
      cache.set(orgId, { config: envConfig, expiresAt: Date.now() + CACHE_TTL_MS });
      return envConfig;
    }

    // Decrypt secret
    let apiKey = "";
    if (row.secretCiphertext && hasMasterKey()) {
      try {
        apiKey = decryptSecret(row.secretCiphertext);
      } catch (err) {
        console.error("[AIConfigResolver] Failed to decrypt secret, falling back to ENV:", err);
        const envConfig = buildEnvConfig();
        cache.set(orgId, { config: envConfig, expiresAt: Date.now() + CACHE_TTL_MS });
        return envConfig;
      }
    } else if (!row.secretCiphertext) {
      // No key stored, fallback to ENV
      const envConfig = buildEnvConfig();
      cache.set(orgId, { config: envConfig, expiresAt: Date.now() + CACHE_TTL_MS });
      return envConfig;
    }

    const resolved: ResolvedAIConfig = {
      source: "DB",
      enabled: true,
      provider: row.provider as ResolvedAIConfig["provider"],
      model: row.model,
      apiKey,
      baseUrl: row.baseUrl,
      timeoutMs: row.timeoutMs,
      maxRetries: row.maxRetries,
      temperature: row.temperature ? Number(row.temperature) : null,
      azureEndpoint: row.azureEndpoint,
      azureApiVersion: row.azureApiVersion,
      azureDeployment: row.azureDeployment,
      customHttpUrl: row.customHttpUrl,
    };

    cache.set(orgId, { config: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
    return resolved;
  } catch (err) {
    console.error("[AIConfigResolver] DB query failed, falling back to ENV:", err);
    return buildEnvConfig();
  }
}

/**
 * Resolve the chat completions URL for a given config.
 */
export function resolveCompletionsUrl(config: ResolvedAIConfig): string {
  if (config.provider === "AZURE_OPENAI" && config.azureEndpoint) {
    const base = config.azureEndpoint.replace(/\/$/, "");
    const deployment = config.azureDeployment || config.model;
    const version = config.azureApiVersion || "2024-02-01";
    return `${base}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  }
  if (config.provider === "ANTHROPIC") {
    const base = (config.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    return `${base}/v1/messages`;
  }
  if (config.provider === "CUSTOM_HTTP" && config.customHttpUrl) {
    return config.customHttpUrl.replace(/\/$/, "");
  }
  // OpenAI or default
  if (config.baseUrl) {
    return `${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }
  return `${(ENV.forgeApiUrl || "https://api.openai.com").replace(/\/$/, "")}/v1/chat/completions`;
}
