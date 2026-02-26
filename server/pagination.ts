/**
 * Pagination helpers — standardised offset pagination for all list endpoints.
 *
 * Standard chosen: **Offset pagination** (Option A)
 *   input  → { limit (default 25, max 100), offset (default 0), sortBy?, sortDir? }
 *   output → { items: T[], total: number }
 *
 * Usage in a tRPC procedure:
 *   .input(paginationInput.extend({ projectId: z.string() }))
 *   .query(async ({ input }) => {
 *     return paginate(db.select().from(table).$dynamic(), table, input, {
 *       allowedSortFields: ['createdAt', 'name', 'status'],
 *       defaultSort: { by: 'createdAt', dir: 'desc' },
 *       where: eq(table.projectId, input.projectId),
 *     });
 *   })
 */

import { z } from "zod";
import { sql, SQL, and, asc, desc, getTableColumns } from "drizzle-orm";
import type { MySqlSelect, MySqlTable } from "drizzle-orm/mysql-core";
import { getDb } from "./db";

// ─── Zod schemas ────────────────────────────────────────────────────────────

/** Base pagination input — merge into your procedure input with .extend() */
export const paginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof paginationInput>;

/** Standard paginated response */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

// ─── Sort whitelist helper ──────────────────────────────────────────────────

/**
 * Resolve the ORDER BY clause from user input against a whitelist.
 * Falls back to defaultSort if the requested field is not allowed.
 */
function resolveSortClause(
  table: MySqlTable,
  input: PaginationInput,
  opts: PaginateOptions,
): SQL | undefined {
  const allowedFields = opts.allowedSortFields ?? [];
  const defaultSort = opts.defaultSort ?? { by: "createdAt", dir: "desc" };

  const sortField = input.sortBy && allowedFields.includes(input.sortBy)
    ? input.sortBy
    : defaultSort.by;

  const sortDir = input.sortDir ?? defaultSort.dir;

  // Resolve column from table
  const columns = getTableColumns(table);
  const column = columns[sortField];
  if (!column) return undefined;

  return sortDir === "asc" ? asc(column) : desc(column);
}

// ─── Main paginate helper ───────────────────────────────────────────────────

export interface PaginateOptions {
  /** Whitelist of field names the client may sort by */
  allowedSortFields?: string[];
  /** Default sort when client omits sortBy */
  defaultSort?: { by: string; dir: "asc" | "desc" };
  /** WHERE clause(s) — will be ANDed together */
  where?: SQL | SQL[];
}

/**
 * Apply pagination to a Drizzle select query and return { items, total }.
 *
 * @param baseQuery  – a `db.select().from(table).$dynamic()` query
 * @param table      – the Drizzle table reference (for count + sort resolution)
 * @param input      – validated pagination input (limit, offset, sortBy, sortDir)
 * @param opts       – sort whitelist, default sort, where clauses
 */
export async function paginate<T>(
  baseQuery: MySqlSelect,
  table: MySqlTable,
  input: PaginationInput,
  opts: PaginateOptions = {},
): Promise<PaginatedResult<T>> {
  // Build WHERE
  const whereClauses: SQL[] = [];
  if (opts.where) {
    if (Array.isArray(opts.where)) {
      whereClauses.push(...opts.where);
    } else {
      whereClauses.push(opts.where);
    }
  }
  const whereSQL = whereClauses.length > 0
    ? whereClauses.length === 1
      ? whereClauses[0]
      : and(...whereClauses)
    : undefined;

  // Count query
  const database = await getDb();
  if (!database) {
    return { items: [] as T[], total: 0 };
  }

  const countQuery = database
    .select({ count: sql<number>`count(*)` })
    .from(table);

  if (whereSQL) {
    (countQuery as any).where(whereSQL);
  }

  const [countResult] = await countQuery;
  const total = Number(countResult?.count ?? 0);

  // Data query with pagination
  let dataQuery = baseQuery;

  if (whereSQL) {
    dataQuery = (dataQuery as any).where(whereSQL);
  }

  const orderBy = resolveSortClause(table, input, opts);
  if (orderBy) {
    dataQuery = (dataQuery as any).orderBy(orderBy);
  }

  dataQuery = (dataQuery as any).limit(input.limit).offset(input.offset);

  const items = (await dataQuery) as T[];

  return { items, total };
}

// ─── Convenience: wrap an existing DB helper with pagination ────────────────

/**
 * For cases where you already have a DB helper that returns all rows,
 * this wraps it with in-memory pagination. Use only for small datasets
 * or as a migration bridge. Prefer `paginate()` for large tables.
 */
export function paginateInMemory<T>(
  allItems: T[],
  input: PaginationInput,
  sortFn?: (a: T, b: T) => number,
): PaginatedResult<T> {
  let sorted = sortFn ? [...allItems].sort(sortFn) : allItems;
  const total = sorted.length;
  const items = sorted.slice(input.offset, input.offset + input.limit);
  return { items, total };
}
