import { auditLogs, type InsertAuditLog } from "../../drizzle/schema";
import { getDb } from "../db";

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
export async function writeAuditLog(entry: Omit<InsertAuditLog, "id" | "createdAt">) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLogs).values(entry);
  } catch (err) {
    console.error("[AuditLog] Failed to write:", err);
  }
}
