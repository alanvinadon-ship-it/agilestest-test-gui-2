// ============================================================================
// AI Engines Router — Admin-only CRUD for multi-engine AI configuration
// Supports: list, get, create, update, rotateKey, setPrimary, disable, testConnection
// ============================================================================

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { router, adminProcedure } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { aiEngines } from "../../drizzle/schema";
import { encryptSecret, decryptSecret, hasMasterKey } from "../lib/aiCrypto";
import { writeAuditLog } from "../lib/auditLog";

// ── Constants ────────────────────────────────────────────────────────────

export const AI_PROVIDERS = ["OPENAI", "GEMINI", "ANTHROPIC", "CUSTOM_HTTP"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"],
  GEMINI: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  ANTHROPIC: ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
  CUSTOM_HTTP: [],
};

// ── Zod Schemas ──────────────────────────────────────────────────────────

const providerEnum = z.enum(AI_PROVIDERS);

const orgInput = z.object({ orgId: z.string().min(1) });
const engineUidInput = z.object({ engineUid: z.string().uuid() });

const createInput = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1).max(128).transform((s) => s.trim()),
  provider: providerEnum,
  model: z.string().min(1).max(128),
  enabled: z.boolean().optional().default(true),
  isPrimary: z.boolean().optional().default(false),
  baseUrl: z.string().max(512).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional().default(30000),
  maxRetries: z.number().int().min(0).max(10).optional().default(2),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxOutputTokens: z.number().int().min(1).nullable().optional(),
  extraJson: z.record(z.string(), z.unknown()).nullable().optional(),
  apiKey: z.string().min(1).max(512).optional(),
});

const updateInput = z.object({
  engineUid: z.string().uuid(),
  name: z.string().min(1).max(128).transform((s) => s.trim()).optional(),
  provider: providerEnum.optional(),
  model: z.string().min(1).max(128).optional(),
  enabled: z.boolean().optional(),
  baseUrl: z.string().max(512).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxOutputTokens: z.number().int().min(1).nullable().optional(),
  extraJson: z.record(z.string(), z.unknown()).nullable().optional(),
  apiKey: z.string().min(1).max(512).optional(),
});

const rotateKeyInput = z.object({
  engineUid: z.string().uuid(),
  apiKey: z.string().min(1).max(512),
});

const setPrimaryInput = z.object({
  engineUid: z.string().uuid(),
});

// ── Helpers ──────────────────────────────────────────────────────────────

function assertNotLocked() {
  if (ENV.aiConfigLocked) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "AI configuration is locked (AI_CONFIG_LOCKED=true).",
    });
  }
}

function assertMasterKey() {
  if (!hasMasterKey()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "MASTER_KEY_MISSING",
    });
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

/** Strip secret fields from engine row for API response */
function sanitizeEngine(row: typeof aiEngines.$inferSelect) {
  return {
    uid: row.uid,
    orgId: row.orgId,
    name: row.name,
    provider: row.provider,
    enabled: row.enabled,
    isPrimary: row.isPrimary,
    model: row.model,
    baseUrl: row.baseUrl,
    timeoutMs: row.timeoutMs,
    maxRetries: row.maxRetries,
    temperature: row.temperature ? Number(row.temperature) : null,
    maxOutputTokens: row.maxOutputTokens,
    extraJson: row.extraJson as Record<string, unknown> | null,
    hasSecret: !!row.secretCiphertext,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Router ───────────────────────────────────────────────────────────────

export const aiEnginesRouter = router({
  /** List all engines for an org (secrets stripped) */
  list: adminProcedure.input(orgInput).query(async ({ input }) => {
    const db = await requireDb();
    const rows = await db.select().from(aiEngines)
      .where(eq(aiEngines.orgId, input.orgId))
      .orderBy(desc(aiEngines.updatedAt));

    const engines = rows.map(sanitizeEngine);
    const primaryUid = engines.find((e) => e.isPrimary)?.uid ?? null;
    return { engines, primaryUid };
  }),

  /** Get a single engine (secret stripped) */
  get: adminProcedure.input(engineUidInput).query(async ({ input }) => {
    const db = await requireDb();
    const [row] = await db.select().from(aiEngines)
      .where(eq(aiEngines.uid, input.engineUid))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Engine not found" });
    return sanitizeEngine(row);
  }),

  /** Create a new engine */
  create: adminProcedure.input(createInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const uid = randomUUID();
    const userId = ctx.user.openId;

    // Encrypt API key if provided
    let secretCiphertext: string | null = null;
    if (input.apiKey) {
      assertMasterKey();
      const { ciphertext } = encryptSecret(input.apiKey);
      secretCiphertext = ciphertext;
    }

    // If setting as primary, unset other primaries
    if (input.isPrimary) {
      await db.update(aiEngines)
        .set({ isPrimary: false })
        .where(eq(aiEngines.orgId, input.orgId));
    }

    await db.insert(aiEngines).values({
      uid,
      orgId: input.orgId,
      name: input.name,
      provider: input.provider,
      enabled: input.enabled,
      isPrimary: input.isPrimary,
      model: input.model,
      baseUrl: input.baseUrl ?? null,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
      temperature: input.temperature != null ? String(input.temperature) : null,
      maxOutputTokens: input.maxOutputTokens ?? null,
      extraJson: input.extraJson ?? null,
      secretCiphertext,
      createdBy: userId,
    });

    await writeAuditLog({
      userId,
      action: "AI_ENGINE_CREATE",
      entity: "ai_engine",
      entityId: uid,
      details: { name: input.name, provider: input.provider, model: input.model },
    });

    return { uid };
  }),

  /** Update an existing engine */
  update: adminProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const userId = ctx.user.openId;

    const [existing] = await db.select().from(aiEngines)
      .where(eq(aiEngines.uid, input.engineUid))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Engine not found" });

    // Build update payload
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.provider !== undefined) patch.provider = input.provider;
    if (input.model !== undefined) patch.model = input.model;
    if (input.enabled !== undefined) patch.enabled = input.enabled;
    if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl;
    if (input.timeoutMs !== undefined) patch.timeoutMs = input.timeoutMs;
    if (input.maxRetries !== undefined) patch.maxRetries = input.maxRetries;
    if (input.temperature !== undefined) patch.temperature = input.temperature != null ? String(input.temperature) : null;
    if (input.maxOutputTokens !== undefined) patch.maxOutputTokens = input.maxOutputTokens;
    if (input.extraJson !== undefined) patch.extraJson = input.extraJson;

    // Encrypt new API key if provided
    if (input.apiKey) {
      assertMasterKey();
      const { ciphertext } = encryptSecret(input.apiKey);
      patch.secretCiphertext = ciphertext;
    }

    if (Object.keys(patch).length > 0) {
      await db.update(aiEngines)
        .set(patch)
        .where(eq(aiEngines.id, existing.id));
    }

    await writeAuditLog({
      userId,
      action: "AI_ENGINE_UPDATE",
      entity: "ai_engine",
      entityId: input.engineUid,
      details: { fields: Object.keys(patch) },
    });

    return { ok: true };
  }),

  /** Rotate API key for an engine */
  rotateKey: adminProcedure.input(rotateKeyInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    assertMasterKey();
    const db = await requireDb();
    const userId = ctx.user.openId;

    const [existing] = await db.select({ id: aiEngines.id })
      .from(aiEngines)
      .where(eq(aiEngines.uid, input.engineUid))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Engine not found" });

    const { ciphertext } = encryptSecret(input.apiKey);
    await db.update(aiEngines)
      .set({ secretCiphertext: ciphertext })
      .where(eq(aiEngines.id, existing.id));

    await writeAuditLog({
      userId,
      action: "AI_ENGINE_ROTATE_KEY",
      entity: "ai_engine",
      entityId: input.engineUid,
    });

    return { ok: true };
  }),

  /** Set an engine as primary (unsets all others for the org) */
  setPrimary: adminProcedure.input(setPrimaryInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const userId = ctx.user.openId;

    const [engine] = await db.select().from(aiEngines)
      .where(eq(aiEngines.uid, input.engineUid))
      .limit(1);
    if (!engine) throw new TRPCError({ code: "NOT_FOUND", message: "Engine not found" });
    if (!engine.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot set disabled engine as primary" });

    // Unset all primaries for this org
    await db.update(aiEngines)
      .set({ isPrimary: false })
      .where(eq(aiEngines.orgId, engine.orgId));

    // Set this one as primary
    await db.update(aiEngines)
      .set({ isPrimary: true })
      .where(eq(aiEngines.id, engine.id));

    await writeAuditLog({
      userId,
      action: "AI_ENGINE_SET_PRIMARY",
      entity: "ai_engine",
      entityId: input.engineUid,
      details: { orgId: engine.orgId },
    });

    return { ok: true };
  }),

  /** Disable an engine */
  disable: adminProcedure.input(engineUidInput).mutation(async ({ input, ctx }) => {
    assertNotLocked();
    const db = await requireDb();
    const userId = ctx.user.openId;

    const [existing] = await db.select({ id: aiEngines.id, isPrimary: aiEngines.isPrimary })
      .from(aiEngines)
      .where(eq(aiEngines.uid, input.engineUid))
      .limit(1);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Engine not found" });

    await db.update(aiEngines)
      .set({ enabled: false, isPrimary: false })
      .where(eq(aiEngines.id, existing.id));

    await writeAuditLog({
      userId,
      action: "AI_ENGINE_DISABLE",
      entity: "ai_engine",
      entityId: input.engineUid,
    });

    return { ok: true };
  }),

  /** Test connection to an engine */
  testConnection: adminProcedure.input(engineUidInput).mutation(async ({ input, ctx }) => {
    const db = await requireDb();
    const userId = ctx.user.openId;

    const [engine] = await db.select().from(aiEngines)
      .where(eq(aiEngines.uid, input.engineUid))
      .limit(1);
    if (!engine) throw new TRPCError({ code: "NOT_FOUND", message: "Engine not found" });

    // Decrypt API key
    let apiKey = "";
    if (engine.secretCiphertext && hasMasterKey()) {
      try {
        apiKey = decryptSecret(engine.secretCiphertext);
      } catch {
        return { ok: false, latencyMs: 0, error: "Failed to decrypt API key" };
      }
    }

    // If no key from DB, try ENV fallback
    if (!apiKey) apiKey = ENV.forgeApiKey || "";
    if (!apiKey) return { ok: false, latencyMs: 0, error: "No API key configured" };

    // Resolve URL
    const url = resolveTestUrl(engine, apiKey);

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const body = buildTestBody(engine.provider as AiProvider, engine.model);
      const headers = buildTestHeaders(engine.provider as AiProvider, apiKey);

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        await writeAuditLog({ userId, action: "AI_ENGINE_TEST_FAIL", entity: "ai_engine", entityId: input.engineUid, details: { status: res.status } });
        return { ok: false, latencyMs, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }

      await writeAuditLog({ userId, action: "AI_ENGINE_TEST_OK", entity: "ai_engine", entityId: input.engineUid, details: { latencyMs } });
      return {
        ok: true,
        latencyMs,
        info: { provider: engine.provider, model: engine.model, name: engine.name },
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      await writeAuditLog({ userId, action: "AI_ENGINE_TEST_FAIL", entity: "ai_engine", entityId: input.engineUid, details: { error: err.message } });
      return { ok: false, latencyMs, error: err.message || "Connection failed" };
    }
  }),
});

// ── Test Connection Helpers ──────────────────────────────────────────────

function resolveTestUrl(engine: typeof aiEngines.$inferSelect, apiKey: string): string {
  const extra = engine.extraJson as Record<string, string> | null;
  const provider = engine.provider as AiProvider;

  if (provider === "GEMINI") {
    const base = (engine.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    return `${base}/v1beta/models/${engine.model}:generateContent?key=${apiKey}`;
  }
  if (provider === "ANTHROPIC") {
    const base = (engine.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    return `${base}/v1/messages`;
  }
  if (provider === "CUSTOM_HTTP") {
    const customUrl = extra?.customHttpUrl || engine.baseUrl || "";
    return customUrl.replace(/\/$/, "");
  }
  // OpenAI
  if (extra?.azureEndpoint) {
    const base = extra.azureEndpoint.replace(/\/$/, "");
    const deployment = extra.azureDeployment || engine.model;
    const version = extra.azureApiVersion || "2024-02-01";
    return `${base}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  }
  const base = (engine.baseUrl || ENV.forgeApiUrl || "https://api.openai.com").replace(/\/$/, "");
  return `${base}/v1/chat/completions`;
}

function buildTestHeaders(provider: AiProvider, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "ANTHROPIC") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider === "GEMINI") {
    // API key is in URL for Gemini
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

function buildTestBody(provider: AiProvider, model: string): Record<string, unknown> {
  if (provider === "ANTHROPIC") {
    return {
      model,
      max_tokens: 10,
      messages: [{ role: "user", content: "ping" }],
    };
  }
  if (provider === "GEMINI") {
    return {
      contents: [{ parts: [{ text: "ping" }] }],
      generationConfig: { maxOutputTokens: 10 },
    };
  }
  // OpenAI / Custom
  return {
    model,
    max_tokens: 10,
    messages: [{ role: "user", content: "ping" }],
  };
}
