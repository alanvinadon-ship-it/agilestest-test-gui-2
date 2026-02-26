import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import {
  notificationSettings, notificationTemplates,
  notificationRules, notificationDeliveryLogs
} from "../../drizzle/schema";
import { v4 as uuid } from "uuid";

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS
// ══════════════════════════════════════════════════════════════════════════
export async function getSettings(channel: "SMS" | "EMAIL") {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(notificationSettings).where(eq(notificationSettings.channel, channel)).limit(1);
  return rows[0];
}

export async function listSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationSettings);
}

export async function upsertSettings(data: {
  channel: "SMS" | "EMAIL";
  provider: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  updatedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSettings(data.channel);
  if (existing) {
    const updateSet: Record<string, unknown> = { provider: data.provider };
    if (data.enabled !== undefined) updateSet.enabled = data.enabled;
    if (data.config !== undefined) updateSet.config = data.config;
    if (data.updatedBy !== undefined) updateSet.updatedBy = data.updatedBy;
    await db.update(notificationSettings).set(updateSet).where(eq(notificationSettings.channel, data.channel));
  } else {
    await db.insert(notificationSettings).values(data);
  }
  return getSettings(data.channel);
}

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATION TEMPLATES
// ══════════════════════════════════════════════════════════════════════════
export async function listTemplates(channel?: "SMS" | "EMAIL") {
  const db = await getDb();
  if (!db) return [];
  if (channel) {
    return db.select().from(notificationTemplates).where(eq(notificationTemplates.channel, channel)).orderBy(notificationTemplates.name);
  }
  return db.select().from(notificationTemplates).orderBy(notificationTemplates.name);
}

export async function getTemplateById(templateId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(notificationTemplates).where(eq(notificationTemplates.templateId, templateId)).limit(1);
  return rows[0];
}

export async function upsertTemplate(data: {
  templateId: string;
  channel: "SMS" | "EMAIL";
  name: string;
  description?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  variablesSchema?: Array<{ name: string; description: string; example: string }>;
  isSystem?: boolean;
  status?: "ACTIVE" | "DISABLED";
  updatedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getTemplateById(data.templateId);
  if (existing) {
    const { templateId, ...rest } = data;
    const updateSet: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updateSet[k] = v;
    }
    await db.update(notificationTemplates).set(updateSet).where(eq(notificationTemplates.templateId, templateId));
  } else {
    await db.insert(notificationTemplates).values(data);
  }
  return getTemplateById(data.templateId);
}

export async function deleteTemplate(templateId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(notificationTemplates).where(eq(notificationTemplates.templateId, templateId));
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATION RULES
// ══════════════════════════════════════════════════════════════════════════
export async function listRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationRules).orderBy(notificationRules.eventType);
}

export async function getRuleById(ruleId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(notificationRules).where(eq(notificationRules.ruleId, ruleId)).limit(1);
  return rows[0];
}

export async function upsertRule(data: {
  ruleId: string;
  eventType: string;
  enabled?: boolean;
  channelsEnabled?: string[];
  templateSmsId?: string;
  templateEmailId?: string;
  recipients?: string[];
  customRecipientsEmails?: string[];
  customRecipientsMsisdn?: string[];
  throttlePolicy?: { max_per_hour: number; dedup_window_min: number };
  updatedBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getRuleById(data.ruleId);
  if (existing) {
    const { ruleId, ...rest } = data;
    const updateSet: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updateSet[k] = v;
    }
    await db.update(notificationRules).set(updateSet).where(eq(notificationRules.ruleId, ruleId));
  } else {
    await db.insert(notificationRules).values(data);
  }
  return getRuleById(data.ruleId);
}

export async function deleteRule(ruleId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(notificationRules).where(eq(notificationRules.ruleId, ruleId));
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════
// DELIVERY LOGS
// ══════════════════════════════════════════════════════════════════════════
export async function listDeliveryLogs(filters?: {
  channel?: "SMS" | "EMAIL";
  status?: "SENT" | "FAILED" | "SKIPPED" | "THROTTLED";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.channel) conditions.push(eq(notificationDeliveryLogs.channel, filters.channel));
  if (filters?.status) conditions.push(eq(notificationDeliveryLogs.status, filters.status));

  const query = conditions.length > 0
    ? db.select().from(notificationDeliveryLogs).where(and(...conditions)).orderBy(desc(notificationDeliveryLogs.ts))
    : db.select().from(notificationDeliveryLogs).orderBy(desc(notificationDeliveryLogs.ts));

  return query.limit(filters?.limit ?? 200);
}

export async function createDeliveryLog(data: {
  channel: "SMS" | "EMAIL";
  provider: string;
  eventType: string;
  ruleId?: string;
  templateId?: string;
  recipient: string;
  status: "SENT" | "FAILED" | "SKIPPED" | "THROTTLED";
  errorMessage?: string;
  traceId?: string;
  metadata?: Record<string, string>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const uid = uuid();
  await db.insert(notificationDeliveryLogs).values({ uid, ...data });
  const rows = await db.select().from(notificationDeliveryLogs).where(eq(notificationDeliveryLogs.uid, uid)).limit(1);
  return rows[0];
}
