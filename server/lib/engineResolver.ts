// ============================================================================
// Engine Resolver — resolves the best AI engine for a given use case + context
// Priority: rules (by priority) → primary engine → ENV fallback
// Includes a 60-second in-memory cache to avoid repeated DB queries.
// ============================================================================

import { eq, and, asc } from "drizzle-orm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { aiEngines, aiRoutingRules } from "../../drizzle/schema";
import { decryptSecret, hasMasterKey } from "./aiCrypto";
import { matchConditions } from "../routers/aiRouting";

// ── Types ────────────────────────────────────────────────────────────────

export type UseCase = "DRIVE_DIAG" | "ANALYTICS" | "SUMMARIZE" | "INGEST_LONG" | "GENERAL";

export interface ResolvedEngine {
  source: "ENGINE" | "ENV" | "DISABLED";
  engineUid: string | null;
  engineName: string | null;
  provider: "OPENAI" | "GEMINI" | "ANTHROPIC" | "CUSTOM_HTTP";
  model: string;
  apiKey: string;
  baseUrl: string | null;
  timeoutMs: number;
  maxRetries: number;
  temperature: number | null;
  maxOutputTokens: number | null;
  extraJson: Record<string, unknown> | null;
  matchedRuleUid: string | null;
  matchedRuleName: string | null;
}

export interface EngineContext {
  tokenEstimate?: number;
  hasLargeArtifacts?: boolean;
  artifactKinds?: string[];
  preferLongContext?: boolean;
  [key: string]: unknown;
}

// ── Cache ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  engines: typeof aiEngines.$inferSelect[];
  rules: typeof aiRoutingRules.$inferSelect[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function clearEngineCache(orgId?: string): void {
  if (orgId) {
    cache.delete(orgId);
  } else {
    cache.clear();
  }
}

// ── ENV Fallback ─────────────────────────────────────────────────────────

function buildEnvFallback(): ResolvedEngine {
  if (!ENV.forgeApiKey) {
    return {
      source: "DISABLED",
      engineUid: null,
      engineName: null,
      provider: "OPENAI",
      model: "gemini-2.5-flash",
      apiKey: "",
      baseUrl: ENV.forgeApiUrl || null,
      timeoutMs: 30000,
      maxRetries: 2,
      temperature: null,
      maxOutputTokens: null,
      extraJson: null,
      matchedRuleUid: null,
      matchedRuleName: null,
    };
  }
  return {
    source: "ENV",
    engineUid: null,
    engineName: null,
    provider: "OPENAI",
    model: "gemini-2.5-flash",
    apiKey: ENV.forgeApiKey,
    baseUrl: ENV.forgeApiUrl || null,
    timeoutMs: 30000,
    maxRetries: 2,
    temperature: null,
    maxOutputTokens: null,
    extraJson: null,
    matchedRuleUid: null,
    matchedRuleName: null,
  };
}

// ── Core Resolver ────────────────────────────────────────────────────────

async function loadOrgData(orgId: string): Promise<CacheEntry> {
  const cached = cache.get(orgId);
  if (cached && Date.now() < cached.expiresAt) return cached;

  const db = await getDb();
  if (!db) return { engines: [], rules: [], expiresAt: Date.now() + CACHE_TTL_MS };

  const [engines, rules] = await Promise.all([
    db.select().from(aiEngines)
      .where(and(eq(aiEngines.orgId, orgId), eq(aiEngines.enabled, true))),
    db.select().from(aiRoutingRules)
      .where(and(eq(aiRoutingRules.orgId, orgId), eq(aiRoutingRules.enabled, true)))
      .orderBy(asc(aiRoutingRules.priority)),
  ]);

  const entry: CacheEntry = { engines, rules, expiresAt: Date.now() + CACHE_TTL_MS };
  cache.set(orgId, entry);
  return entry;
}

function decryptEngineKey(engine: typeof aiEngines.$inferSelect): string {
  if (!engine.secretCiphertext || !hasMasterKey()) return "";
  try {
    return decryptSecret(engine.secretCiphertext);
  } catch {
    console.error(`[EngineResolver] Failed to decrypt key for engine ${engine.uid}`);
    return "";
  }
}

function engineToResolved(
  engine: typeof aiEngines.$inferSelect,
  apiKey: string,
  ruleUid: string | null,
  ruleName: string | null,
): ResolvedEngine {
  return {
    source: "ENGINE",
    engineUid: engine.uid,
    engineName: engine.name,
    provider: engine.provider as ResolvedEngine["provider"],
    model: engine.model,
    apiKey,
    baseUrl: engine.baseUrl,
    timeoutMs: engine.timeoutMs,
    maxRetries: engine.maxRetries,
    temperature: engine.temperature ? Number(engine.temperature) : null,
    maxOutputTokens: engine.maxOutputTokens,
    extraJson: engine.extraJson as Record<string, unknown> | null,
    matchedRuleUid: ruleUid,
    matchedRuleName: ruleName,
  };
}

/**
 * Resolve the best AI engine for a given org, use case, and context.
 *
 * Resolution order:
 * 1. If AI_CONFIG_LOCKED → ENV only
 * 2. Match routing rules (by priority) → first matching rule with enabled engine
 * 3. Primary engine (fallback)
 * 4. ENV fallback
 */
export async function resolveEngine(
  orgId: string,
  useCase: UseCase,
  context: EngineContext = {},
): Promise<ResolvedEngine> {
  // 1. Locked mode → ENV only
  if (ENV.aiConfigLocked) {
    return buildEnvFallback();
  }

  try {
    const { engines, rules } = await loadOrgData(orgId);

    if (engines.length === 0) {
      return buildEnvFallback();
    }

    const engineMap = new Map(engines.map((e) => [e.uid, e]));

    // 2. Try routing rules for this use case
    const useCaseRules = rules.filter((r) => r.useCase === useCase);
    for (const rule of useCaseRules) {
      const conditions = rule.conditionsJson as Record<string, unknown> | null;
      if (matchConditions(conditions, context)) {
        const engine = engineMap.get(rule.targetEngineUid);
        if (engine && engine.enabled) {
          let apiKey = decryptEngineKey(engine);
          if (!apiKey) apiKey = ENV.forgeApiKey || "";
          if (apiKey) {
            return engineToResolved(engine, apiKey, rule.uid, rule.name);
          }
        }
      }
    }

    // 3. Also try GENERAL rules if useCase is not GENERAL
    if (useCase !== "GENERAL") {
      const generalRules = rules.filter((r) => r.useCase === "GENERAL");
      for (const rule of generalRules) {
        const conditions = rule.conditionsJson as Record<string, unknown> | null;
        if (matchConditions(conditions, context)) {
          const engine = engineMap.get(rule.targetEngineUid);
          if (engine && engine.enabled) {
            let apiKey = decryptEngineKey(engine);
            if (!apiKey) apiKey = ENV.forgeApiKey || "";
            if (apiKey) {
              return engineToResolved(engine, apiKey, rule.uid, rule.name);
            }
          }
        }
      }
    }

    // 4. Fallback to primary engine
    const primary = engines.find((e) => e.isPrimary);
    if (primary) {
      let apiKey = decryptEngineKey(primary);
      if (!apiKey) apiKey = ENV.forgeApiKey || "";
      if (apiKey) {
        return engineToResolved(primary, apiKey, null, null);
      }
    }

    // 5. Fallback to first enabled engine
    const first = engines[0];
    if (first) {
      let apiKey = decryptEngineKey(first);
      if (!apiKey) apiKey = ENV.forgeApiKey || "";
      if (apiKey) {
        return engineToResolved(first, apiKey, null, null);
      }
    }

    // 6. ENV fallback
    return buildEnvFallback();
  } catch (err) {
    console.error("[EngineResolver] Error resolving engine, falling back to ENV:", err);
    return buildEnvFallback();
  }
}

/**
 * Resolve the chat completions URL for a given engine config.
 */
export function resolveEngineUrl(config: ResolvedEngine): string {
  const extra = config.extraJson;

  if (config.provider === "GEMINI") {
    const base = (config.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    return `${base}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  }
  if (config.provider === "ANTHROPIC") {
    const base = (config.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    return `${base}/v1/messages`;
  }
  if (config.provider === "CUSTOM_HTTP") {
    const customUrl = (extra as any)?.customHttpUrl || config.baseUrl || "";
    return customUrl.replace(/\/$/, "");
  }
  // OpenAI (including Azure)
  if (extra && (extra as any).azureEndpoint) {
    const base = ((extra as any).azureEndpoint as string).replace(/\/$/, "");
    const deployment = (extra as any).azureDeployment || config.model;
    const version = (extra as any).azureApiVersion || "2024-02-01";
    return `${base}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  }
  const base = (config.baseUrl || ENV.forgeApiUrl || "https://api.openai.com").replace(/\/$/, "");
  return `${base}/v1/chat/completions`;
}
