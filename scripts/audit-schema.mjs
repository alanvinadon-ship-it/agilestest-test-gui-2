#!/usr/bin/env node
/**
 * audit-schema.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Compares the live MySQL database schema (via information_schema) against the
 * Drizzle ORM table definitions in drizzle/schema.ts.
 *
 * Checks:
 *   • Tables present in Drizzle but missing from DB
 *   • Columns present in Drizzle but missing from DB
 *   • Columns present in DB but missing from Drizzle (for Drizzle-managed tables)
 *   • Column type mismatches (with tolerant mapping)
 *   • Nullability mismatches
 *
 * Usage:
 *   node scripts/audit-schema.mjs            # human-readable output
 *   node scripts/audit-schema.mjs --json     # JSON output for CI / snapshot
 *
 * Exit codes:
 *   0 — no mismatches
 *   1 — mismatches found
 *
 * Requires:
 *   - DATABASE_URL env var (mysql://user:pass@host:port/dbname)
 *   - mysql2 (already in project dependencies)
 *   - tsx (already in project devDependencies, used to load TS schema)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

const JSON_MODE = process.argv.includes("--json");

// ─── 1. Parse DATABASE_URL ──────────────────────────────────────────────────

function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306", 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  };
}

// ─── 2. Extract DB schema from information_schema ───────────────────────────

async function extractDbSchema(conn, dbName) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, IS_NULLABLE,
            CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, COLUMN_DEFAULT
     FROM information_schema.columns
     WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [dbName]
  );

  /** @type {Map<string, Map<string, {type: string, dataType: string, nullable: boolean, maxLength: number|null, default: string|null}>>} */
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.TABLE_NAME)) tables.set(row.TABLE_NAME, new Map());
    tables.get(row.TABLE_NAME).set(row.COLUMN_NAME, {
      type: row.COLUMN_TYPE,
      dataType: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === "YES",
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
      default: row.COLUMN_DEFAULT,
    });
  }
  return tables;
}

// ─── 3. Extract Drizzle schema via tsx subprocess ───────────────────────────

function extractDrizzleSchema() {
  const helperScript = resolve(__dirname, "_extract-drizzle-schema.ts");
  const output = execSync(`npx tsx ${helperScript}`, {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    timeout: 30_000,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  }).trim();

  return JSON.parse(output);
}

// ─── 4. Type mapping: Drizzle columnType → normalized MySQL types ───────────

/**
 * Maps a Drizzle column type to a set of acceptable MySQL DATA_TYPE values.
 * This is intentionally tolerant to avoid false positives.
 */
function drizzleTypeToMysqlTypes(drizzleCol) {
  const ct = drizzleCol.columnType;
  switch (ct) {
    case "MySqlInt":
      return ["int", "integer"];
    case "MySqlBigInt53":
    case "MySqlBigInt64":
      return ["bigint"];
    case "MySqlDouble":
      return ["double", "float", "decimal"];
    case "MySqlBoolean":
      return ["tinyint", "boolean", "bool"];
    case "MySqlVarChar":
      return ["varchar"];
    case "MySqlText":
      // MySqlText can map to text, mediumtext, longtext, tinytext
      return ["text", "mediumtext", "longtext", "tinytext"];
    case "MySqlJson":
      return ["json", "longtext", "text"];
    case "MySqlTimestamp":
      return ["timestamp", "datetime"];
    case "MySqlEnumColumn":
      return ["enum"];
    default:
      // Unknown type — accept anything but warn
      return null;
  }
}

// ─── 5. Comparison engine ───────────────────────────────────────────────────

function compareSchemas(dbSchema, drizzleSchema) {
  const issues = [];

  for (const [tableName, tableInfo] of Object.entries(drizzleSchema)) {
    const dbTable = dbSchema.get(tableName);

    // Table missing from DB
    if (!dbTable) {
      issues.push({
        level: "error",
        table: tableName,
        type: "TABLE_MISSING_IN_DB",
        message: `Table "${tableName}" defined in Drizzle (export: ${tableInfo.exportName}) but missing from database`,
      });
      continue;
    }

    const drizzleCols = tableInfo.columns;
    const dbColNames = new Set(dbTable.keys());
    const drizzleColNames = new Set(Object.keys(drizzleCols));

    // Columns in Drizzle but missing from DB
    for (const colName of drizzleColNames) {
      if (!dbTable.has(colName)) {
        issues.push({
          level: "error",
          table: tableName,
          column: colName,
          type: "COLUMN_MISSING_IN_DB",
          message: `Column "${tableName}.${colName}" defined in Drizzle but missing from database`,
        });
      }
    }

    // Columns in DB but missing from Drizzle
    for (const colName of dbColNames) {
      if (!drizzleColNames.has(colName)) {
        issues.push({
          level: "warning",
          table: tableName,
          column: colName,
          type: "COLUMN_MISSING_IN_DRIZZLE",
          message: `Column "${tableName}.${colName}" exists in database but not in Drizzle schema`,
        });
      }
    }

    // Type and nullability comparison for shared columns
    for (const [colName, drizzleCol] of Object.entries(drizzleCols)) {
      const dbCol = dbTable.get(colName);
      if (!dbCol) continue; // Already reported as missing

      // Type check
      const acceptableTypes = drizzleTypeToMysqlTypes(drizzleCol);
      if (acceptableTypes !== null) {
        const dbDataType = dbCol.dataType.toLowerCase();
        if (!acceptableTypes.includes(dbDataType)) {
          issues.push({
            level: "error",
            table: tableName,
            column: colName,
            type: "TYPE_MISMATCH",
            message: `Column "${tableName}.${colName}" type mismatch: Drizzle=${drizzleCol.columnType} expects [${acceptableTypes.join(",")}], DB has "${dbCol.dataType}" (${dbCol.type})`,
            expected: acceptableTypes,
            actual: dbCol.dataType,
          });
        }
      }

      // Nullability check
      const drizzleNotNull = drizzleCol.notNull;
      const dbNullable = dbCol.nullable;
      if (drizzleNotNull && dbNullable) {
        issues.push({
          level: "error",
          table: tableName,
          column: colName,
          type: "NULLABILITY_MISMATCH",
          message: `Column "${tableName}.${colName}" is NOT NULL in Drizzle but NULLABLE in database`,
          expected: "NOT NULL",
          actual: "NULLABLE",
        });
      }
      if (!drizzleNotNull && !dbNullable) {
        // DB is NOT NULL but Drizzle says nullable — this is a warning (Drizzle is more permissive)
        issues.push({
          level: "warning",
          table: tableName,
          column: colName,
          type: "NULLABILITY_MISMATCH",
          message: `Column "${tableName}.${colName}" is NULLABLE in Drizzle but NOT NULL in database (Drizzle is more permissive)`,
          expected: "NULLABLE",
          actual: "NOT NULL",
        });
      }
    }
  }

  return issues;
}

// ─── 6. Output formatting ───────────────────────────────────────────────────

function formatHuman(issues) {
  if (issues.length === 0) {
    console.log("\n✅  Schema audit passed — Drizzle schema matches database.\n");
    return;
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                   SCHEMA AUDIT REPORT                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (errors.length > 0) {
    console.log(`❌  ${errors.length} ERROR(S):\n`);
    for (const e of errors) {
      console.log(`  [ERROR] ${e.message}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`⚠️   ${warnings.length} WARNING(S):\n`);
    for (const w of warnings) {
      console.log(`  [WARN]  ${w.message}`);
    }
    console.log();
  }

  // Summary table
  const tableIssues = {};
  for (const i of issues) {
    if (!tableIssues[i.table]) tableIssues[i.table] = { errors: 0, warnings: 0 };
    if (i.level === "error") tableIssues[i.table].errors++;
    else tableIssues[i.table].warnings++;
  }

  console.log("┌─────────────────────────────┬────────┬──────────┐");
  console.log("│ Table                       │ Errors │ Warnings │");
  console.log("├─────────────────────────────┼────────┼──────────┤");
  for (const [table, counts] of Object.entries(tableIssues)) {
    console.log(
      `│ ${table.padEnd(27)} │ ${String(counts.errors).padStart(6)} │ ${String(counts.warnings).padStart(8)} │`
    );
  }
  console.log("└─────────────────────────────┴────────┴──────────┘");
  console.log(
    `\nTotal: ${errors.length} error(s), ${warnings.length} warning(s)\n`
  );
}

// ─── 7. Main ────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  const dbConfig = parseDatabaseUrl(dbUrl);
  if (!JSON_MODE) {
    console.log(`🔍  Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`);
  }

  let conn;
  try {
    conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      ssl: dbConfig.ssl,
    });
  } catch (err) {
    console.error(`ERROR: Cannot connect to database: ${err.message}`);
    process.exit(1);
  }

  try {
    // Step 1: Extract DB schema
    if (!JSON_MODE) console.log("📦  Extracting database schema from information_schema...");
    const dbSchema = await extractDbSchema(conn, dbConfig.database);
    if (!JSON_MODE) console.log(`    Found ${dbSchema.size} table(s) in database.`);

    // Step 2: Extract Drizzle schema
    if (!JSON_MODE) console.log("📐  Extracting Drizzle schema definitions...");
    const drizzleSchema = extractDrizzleSchema();
    const drizzleTableCount = Object.keys(drizzleSchema).length;
    if (!JSON_MODE) console.log(`    Found ${drizzleTableCount} table(s) in Drizzle schema.`);

    // Step 3: Compare
    if (!JSON_MODE) console.log("🔎  Comparing schemas...");
    const issues = compareSchemas(dbSchema, drizzleSchema);

    // Step 4: Output
    if (JSON_MODE) {
      const output = {
        timestamp: new Date().toISOString(),
        database: dbConfig.database,
        dbTableCount: dbSchema.size,
        drizzleTableCount,
        errors: issues.filter((i) => i.level === "error"),
        warnings: issues.filter((i) => i.level === "warning"),
        passed: issues.filter((i) => i.level === "error").length === 0,
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      formatHuman(issues);
    }

    // Step 5: Exit code (only errors cause failure, warnings are informational)
    const errorCount = issues.filter((i) => i.level === "error").length;
    process.exit(errorCount > 0 ? 1 : 0);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
