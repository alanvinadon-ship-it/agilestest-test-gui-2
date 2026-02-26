import { sql, SQL } from "drizzle-orm";
import type { MySqlSelect } from "drizzle-orm/mysql-core";

/**
 * Pagination helper — works with any Drizzle MySQL select query.
 *
 * Usage:
 *   const result = await paginate(db.select().from(users), { page: 1, pageSize: 20 });
 *   // result = { data: [...], pagination: { page, pageSize, total, totalPages } }
 */

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function normalizePagination(input?: PaginationInput) {
  const page = Math.max(1, input?.page ?? DEFAULT_PAGE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input?.pageSize ?? DEFAULT_PAGE_SIZE));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * Generic paginate function for Drizzle queries.
 * Accepts a base query builder and a count query, applies LIMIT/OFFSET, returns paginated result.
 */
export async function paginate<T>(
  query: MySqlSelect,
  countQuery: Promise<{ count: number }[]>,
  input?: PaginationInput,
): Promise<PaginatedResult<T>> {
  const { page, pageSize, offset } = normalizePagination(input);

  const [data, countResult] = await Promise.all([
    query.limit(pageSize).offset(offset) as Promise<T[]>,
    countQuery,
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data,
    pagination: { page, pageSize, total, totalPages },
  };
}

/**
 * Helper to build a COUNT(*) query from a table with optional where clause.
 */
export function countRows(db: any, table: any, where?: SQL) {
  const q = db.select({ count: sql<number>`count(*)` }).from(table);
  return where ? q.where(where) : q;
}
