import { eq, and, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, passwordResetTokens, appSettings } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Password Reset Tokens ──────────────────────────────────────────────────

export async function createPasswordResetToken(params: {
  userId: number;
  email: string;
  token: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(passwordResetTokens).values({
    userId: params.userId,
    email: params.email,
    token: params.token,
    expiresAt: params.expiresAt,
  });
}

export async function getValidResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, new Date()),
        isNull(passwordResetTokens.usedAt)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function markResetTokenUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
}

export async function updateUserAvatar(userId: number, avatarUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set({ avatarUrl })
    .where(eq(users.id, userId));
}

// ─── App Settings (Branding) ─────────────────────────────────────────────

export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  return rows[0]?.settingValue ?? null;
}

export async function getAppSettings(keys: string[]): Promise<Record<string, string | null>> {
  const db = await getDb();
  const result: Record<string, string | null> = {};
  for (const k of keys) result[k] = null;
  if (!db) return result;
  const { inArray } = await import("drizzle-orm");
  const rows = await db.select().from(appSettings).where(inArray(appSettings.settingKey, keys));
  for (const row of rows) {
    result[row.settingKey] = row.settingValue;
  }
  return result;
}

export async function setAppSetting(key: string, value: string | null, updatedBy?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set({ settingValue: value, updatedBy: updatedBy ?? null }).where(eq(appSettings.settingKey, key));
  } else {
    await db.insert(appSettings).values({ settingKey: key, settingValue: value, updatedBy: updatedBy ?? null });
  }
}

// TODO: add feature queries here as your schema grows.
