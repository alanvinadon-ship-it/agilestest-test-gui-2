import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";
import { randomUUID } from "crypto";

interface AuditLogEntry {
  userId: number | string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string;
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 * Accepts userId as number or string and converts to string for DB.
 */
export async function writeAuditLog(entry: AuditLogEntry) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values({
      uid: randomUUID(),
      userId: String(entry.userId),
      action: entry.action,
      entity: entry.entity || "SYSTEM",
      entityId: entry.entityId || null,
      details: entry.details || null,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write:", err);
  }
}
