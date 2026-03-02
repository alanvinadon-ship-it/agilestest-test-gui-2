/**
 * Helper script: extracts Drizzle table definitions as JSON to stdout.
 * Called by audit-schema.mjs via `npx tsx scripts/_extract-drizzle-schema.ts`.
 */
import { getTableConfig, MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../drizzle/schema.ts";

const result: Record<string, any> = {};

for (const [key, val] of Object.entries(schema)) {
  if (val instanceof MySqlTable) {
    const cfg = getTableConfig(val);
    const columns: Record<string, any> = {};
    for (const col of cfg.columns) {
      columns[col.name] = {
        columnType: col.columnType,
        dataType: col.dataType,
        notNull: col.notNull,
        hasDefault: col.hasDefault,
        enumValues: col.enumValues || null,
        length: (col.config as any)?.length || null,
        textType: (col.config as any)?.textType || null,
        unsigned: (col.config as any)?.unsigned || false,
      };
    }
    result[cfg.name] = { exportName: key, columns };
  }
}

console.log(JSON.stringify(result));
