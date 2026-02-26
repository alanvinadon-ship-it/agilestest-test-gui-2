/**
 * memoryStore — In-memory store with selective localStorage persistence.
 *
 * Most data lives only in a Map<string, string> (no browser storage).
 * Keys matching PERSIST_PREFIXES are also written to localStorage so they
 * survive page refreshes. This is used for notification settings, templates,
 * rules, and delivery logs — data that is configured by the admin and must
 * persist until a full DB migration is done.
 *
 * This is a transitional layer: once pages are individually migrated
 * to tRPC hooks, this module and the old stores can be deleted.
 */

// Keys with these prefixes will be persisted to localStorage
const PERSIST_PREFIXES = [
  'agilestest_notif_',   // notification settings, templates, rules, delivery logs
  'agilestest_audit_',   // audit log for notifications
];

function shouldPersist(key: string): boolean {
  return PERSIST_PREFIXES.some(prefix => key.startsWith(prefix));
}

const store = new Map<string, string>();

// Hydrate persisted keys from localStorage on startup
try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && shouldPersist(key)) {
      const val = localStorage.getItem(key);
      if (val !== null) store.set(key, val);
    }
  }
} catch {
  // localStorage unavailable — continue with empty store
}

export const memoryStore = {
  getItem(key: string): string | null {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    store.set(key, value);
    if (shouldPersist(key)) {
      try { localStorage.setItem(key, value); } catch { /* storage full */ }
    }
  },
  removeItem(key: string): void {
    store.delete(key);
    if (shouldPersist(key)) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  },
  clear(): void {
    // Only clear non-persisted keys from the map
    for (const key of [...store.keys()]) {
      if (!shouldPersist(key)) {
        store.delete(key);
      }
    }
  },
  /** For debugging */
  keys(): string[] {
    return [...store.keys()];
  },
};
