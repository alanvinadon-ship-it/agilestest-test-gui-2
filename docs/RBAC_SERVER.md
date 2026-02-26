# RBAC Server — Architecture & Usage

## Overview

AgilesTest uses a **procedure-level RBAC** model built on top of tRPC middleware. Access control is enforced at the tRPC procedure layer, not at the HTTP route level.

## Procedure Types

| Procedure | Auth Required | Role Check | Use Case |
|---|---|---|---|
| `publicProcedure` | No | None | Public endpoints (auth.me) |
| `protectedProcedure` | Yes | None | Any authenticated user (projects, testing) |
| `adminProcedure` | Yes | `role === 'admin'` OR `openId === OWNER_OPEN_ID` | Admin-only endpoints (user management, audit) |

## Owner Privilege

The application owner (`OWNER_OPEN_ID` env var) is **always** treated as admin, regardless of the `role` field in the `users` table. This is enforced in `server/_core/trpc.ts`:

```ts
const isOwner = ctx.user.openId === ENV.OWNER_OPEN_ID;
const isAdmin = ctx.user.role === "admin" || isOwner;
```

## Adding a New Protected Endpoint

```ts
// server/routers/myFeature.ts
import { z } from "zod";
import { protectedProcedure } from "../_core/trpc";

export const myFeatureRouter = router({
  list: protectedProcedure
    .input(z.object({ page: z.number().min(1).default(1) }))
    .query(async ({ ctx, input }) => {
      // ctx.user is guaranteed non-null
      return db.listItems(ctx.user.id, input.page);
    }),
});
```

## Adding an Admin-Only Endpoint

```ts
import { adminProcedure } from "../_core/trpc";

export const adminRouter = router({
  dangerousAction: adminProcedure
    .input(z.object({ targetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // ctx.user is admin or owner
      return db.doSomethingDangerous(input.targetId);
    }),
});
```

## Wiring a New Router

In `server/routers.ts`:

```ts
import { myFeatureRouter } from "./routers/myFeature";

export const appRouter = router({
  // ... existing routers
  myFeature: myFeatureRouter,
});
```

## Testing RBAC

See `server/backend-socle.test.ts` for patterns:

- Create contexts with `makeCtx(makeUser({ role: "admin" }))` or `makeCtx(null)` for unauthenticated.
- Use `appRouter.createCaller(ctx)` to call procedures directly.
- Assert `FORBIDDEN` or `UNAUTHORIZED` error codes.

## Files

| File | Purpose |
|---|---|
| `server/_core/trpc.ts` | Defines `publicProcedure`, `protectedProcedure`, `adminProcedure` |
| `server/_core/context.ts` | Builds `ctx.user` from session cookie |
| `server/routers.ts` | Wires all routers into `appRouter` |
| `server/routers/admin.ts` | Admin-only endpoints |
| `server/routers/projects.ts` | Project CRUD (protectedProcedure) |
| `server/routers/testing.ts` | Testing domain CRUD (protectedProcedure) |
