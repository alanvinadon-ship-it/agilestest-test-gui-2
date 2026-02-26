/**
 * memoryStore — In-memory replacement for localStorage.
 *
 * All data lives in a Map<string, string>. No browser storage is touched.
 * The stores (localStore, adminStore) call getItem/setItem/removeItem
 * on this module instead of window.localStorage.
 *
 * This is a transitional layer: once pages are individually migrated
 * to tRPC hooks, this module and the old stores can be deleted.
 */

const store = new Map<string, string>();

export const memoryStore = {
  getItem(key: string): string | null {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    store.set(key, value);
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  clear(): void {
    store.clear();
  },
  /** For debugging */
  keys(): string[] {
    return [...store.keys()];
  },
};
