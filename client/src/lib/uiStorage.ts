/**
 * uiStorage — Type-safe localStorage wrapper for UI-only preferences.
 *
 * RULES:
 * 1. Only UI preferences go here (theme, sidebar state, locale, table page size…).
 * 2. Business data MUST use tRPC/Postgres — NEVER localStorage.
 * 3. Every key must be declared in UI_KEYS below with a Zod schema.
 * 4. All keys are prefixed with "agilestest.ui." to avoid collisions.
 */

import { z } from "zod";

// ─── Whitelist of allowed UI keys + their Zod schemas ───────────────────────

const sidebarAccordionsSchema = z.object({
  configuration: z.boolean(),
  execution: z.boolean(),
  driveTest: z.boolean(),
  administration: z.boolean(),
});

export type SidebarAccordionState = z.infer<typeof sidebarAccordionsSchema>;

const UI_KEYS = {
  theme: z.enum(["light", "dark", "system"]),
  sidebarCollapsed: z.boolean(),
  sidebarMini: z.boolean(),
  locale: z.enum(["fr", "en"]),
  tablePageSize: z.number().int().min(5).max(100),
  lastProjectId: z.string().nullable(),
  dashboardLayout: z.enum(["grid", "list"]),
  probesMonitorView: z.enum(["grid", "compact"]),
  sidebarAccordions: sidebarAccordionsSchema,
} as const;

type UIKeyName = keyof typeof UI_KEYS;
type UIKeyValue<K extends UIKeyName> = z.infer<(typeof UI_KEYS)[K]>;

const PREFIX = "agilestest.ui.";

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULTS: { [K in UIKeyName]: UIKeyValue<K> } = {
  theme: "dark",
  sidebarCollapsed: false,
  sidebarMini: false,
  locale: "fr",
  tablePageSize: 20,
  lastProjectId: null,
  dashboardLayout: "grid",
  probesMonitorView: "grid",
  sidebarAccordions: {
    configuration: false,
    execution: false,
    driveTest: false,
    administration: false,
  },
};

// ─── Public API ─────────────────────────────────────────────────────────────

export function uiGet<K extends UIKeyName>(key: K): UIKeyValue<K> {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return DEFAULTS[key];
    const parsed = JSON.parse(raw);
    const result = UI_KEYS[key].safeParse(parsed);
    if (result.success) return result.data as UIKeyValue<K>;
    // Invalid value → return default and clean up
    localStorage.removeItem(PREFIX + key);
    return DEFAULTS[key];
  } catch {
    return DEFAULTS[key];
  }
}

export function uiSet<K extends UIKeyName>(key: K, value: UIKeyValue<K>): void {
  const result = UI_KEYS[key].safeParse(value);
  if (!result.success) {
    console.warn(`[uiStorage] Invalid value for "${key}":`, result.error.issues);
    return;
  }
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function uiRemove<K extends UIKeyName>(key: K): void {
  localStorage.removeItem(PREFIX + key);
}

/**
 * Returns all known UI keys and their current values (for debugging).
 */
export function uiDump(): Record<UIKeyName, unknown> {
  const result = {} as Record<UIKeyName, unknown>;
  for (const key of Object.keys(UI_KEYS) as UIKeyName[]) {
    result[key] = uiGet(key);
  }
  return result;
}

/**
 * Returns the list of allowed key names (for audit scripts).
 */
export function uiAllowedKeys(): UIKeyName[] {
  return Object.keys(UI_KEYS) as UIKeyName[];
}

export type { UIKeyName, UIKeyValue };
