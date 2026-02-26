# Frontend Storage Policy

## Golden Rule

> **Business data goes through tRPC/Postgres. UI preferences go through `uiStorage`. Raw `localStorage` is forbidden.**

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  tRPC hooks  │  │  uiStorage   │  │  memoryStore        │ │
│  │  (business)  │  │  (UI prefs)  │  │  (transitional)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────────────┘ │
│         │                 │                  │                │
│         ▼                 ▼                  ▼                │
│     Postgres         localStorage      In-memory Map         │
│     (via API)        (whitelisted)     (no persistence)      │
└──────────────────────────────────────────────────────────────┘
```

## Three Storage Tiers

| Tier | Module | Persistence | Use Case | Example |
|---|---|---|---|---|
| **tRPC** | `trpc.*` hooks | Postgres (permanent) | Business data, user data, CRUD | Projects, users, executions |
| **uiStorage** | `lib/uiStorage.ts` | localStorage (whitelisted) | UI preferences only | Theme, sidebar state, table page size |
| **memoryStore** | `api/memoryStore.ts` | In-memory (session only) | Transitional layer for legacy stores | localStore, adminStore (being migrated) |

## What Goes Where

### Use tRPC (Postgres)
- User accounts, roles, permissions
- Projects, test profiles, scenarios, datasets
- Executions, captures, probes, artifacts
- Audit logs, invitations
- Any data that must survive page refresh

### Use uiStorage (localStorage with whitelist)
- Theme preference (`theme`)
- Sidebar collapsed state (`sidebar_collapsed`)
- Table page size preference (`table_page_size`)
- Last selected project ID (`last_project_id`)

### Use memoryStore (transitional)
- Legacy stores (`localStore.ts`, `adminStore.ts`) that haven't been fully migrated to tRPC yet
- Data is lost on page refresh — this is intentional as a migration stepping stone

## Forbidden Patterns

```ts
// ❌ FORBIDDEN — raw localStorage
localStorage.setItem("key", value);
localStorage.getItem("key");
sessionStorage.setItem("key", value);

// ❌ FORBIDDEN — storing business data in localStorage
localStorage.setItem("users", JSON.stringify(users));
localStorage.setItem("access_token", token);

// ✅ ALLOWED — uiStorage for UI preferences
import { uiStorage } from "@/lib/uiStorage";
uiStorage.set("theme", "dark");
const theme = uiStorage.get("theme");

// ✅ ALLOWED — tRPC for business data
const { data } = trpc.projects.list.useQuery({ page: 1 });
const mutation = trpc.projects.create.useMutation();
```

## Enforcement

### Automated Audit Script

```bash
pnpm audit:storage
```

This script scans all `.ts/.tsx/.js/.jsx` files under `client/src/` and reports any raw `localStorage` or `sessionStorage` usage outside of the allowed files.

**Allowed files** (excluded from audit):
- `lib/uiStorage.ts` — the uiStorage wrapper itself
- `api/memoryStore.ts` — the memoryStore wrapper
- `_core/hooks/useAuth.ts` — framework internal (sessionStorage for runtime info)

**Exit codes:**
- `0` — clean, no violations
- `1` — violations found (blocks CI)

### CI Integration

Add to your CI pipeline:

```yaml
- name: Audit storage usage
  run: pnpm audit:storage
```

## Migration Status

| Store | Status | Notes |
|---|---|---|
| `localStore.ts` | ✅ Migrated to memoryStore | 28 collections, no longer uses localStorage |
| `adminStore.ts` | ✅ Migrated to memoryStore | Users, memberships, audit, invites |
| `permissions.ts` | ✅ Migrated to memoryStore | Custom roles, RBAC checks |
| `localNotificationsStore.ts` | ✅ Migrated to memoryStore | Settings, templates, rules, logs |
| `scriptRepository.ts` | ✅ Migrated to memoryStore | AI-generated scripts |
| `api/client.ts` | ✅ Migrated to cookies | No more token in localStorage |
| `AuthContext.tsx` | ✅ Migrated to tRPC auth.me | No more localStorage for auth state |
| `theme-provider.tsx` | ✅ Migrated to uiStorage | Theme preference |
| `ThemeContext.tsx` | ✅ Migrated to uiStorage | Theme preference |
| `projectStore.tsx` | ✅ Migrated to uiStorage | Last project ID |

## Files

| File | Purpose |
|---|---|
| `client/src/lib/uiStorage.ts` | Type-safe wrapper for UI preferences (Zod whitelist) |
| `client/src/api/memoryStore.ts` | In-memory Map replacing localStorage for legacy stores |
| `scripts/audit-storage.mjs` | CI-ready audit script |
| `server/storage-migration.test.ts` | Vitest tests for storage migration |
