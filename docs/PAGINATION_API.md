# Pagination API — Convention & Usage

## Overview

All list endpoints use a **page/pageSize** pagination model with a standardized response shape.

## Request Parameters

| Parameter | Type | Default | Range | Description |
|---|---|---|---|---|
| `page` | number | 1 | 1–∞ | Current page (1-indexed) |
| `pageSize` | number | 20 | 1–100 | Items per page |

## Response Shape

```ts
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

## Server-Side Helper

`server/lib/pagination.ts` provides `normalizePagination()`:

```ts
import { normalizePagination, countRows } from "../lib/pagination";

// In a tRPC procedure:
const { page, pageSize, offset } = normalizePagination(input);

// Count total rows
const total = await countRows(db, myTable, whereClause);

// Query with LIMIT/OFFSET
const rows = await db.select()
  .from(myTable)
  .where(whereClause)
  .limit(pageSize)
  .offset(offset);

// Return standardized response
return {
  data: rows,
  pagination: {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  },
};
```

## Shared Types

`shared/pagination.ts` exports:

```ts
import { z } from "zod";

export const paginationInput = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationInput>;

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

## Frontend Usage

```tsx
const [page, setPage] = useState(1);
const { data, isLoading } = trpc.projects.list.useQuery({ page, pageSize: 20 });

// data.data → T[]
// data.pagination.totalPages → for pagination controls
```

## Clamping Rules

- `page < 1` → clamped to `1`
- `pageSize < 1` → clamped to `1`
- `pageSize > 100` → clamped to `100`

## Files

| File | Purpose |
|---|---|
| `server/lib/pagination.ts` | `normalizePagination()`, `countRows()` |
| `shared/pagination.ts` | Zod schema + TypeScript types |
