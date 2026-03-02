#!/usr/bin/env node
// Generate Drizzle schema definitions from actual DB columns
import { readFileSync } from "fs";

const data = JSON.parse(readFileSync("/tmp/db_cols.json", "utf-8"));

function toCamelCase(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function toExportName(tableName) {
  return toCamelCase(tableName);
}

function mapType(col) {
  const { COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA } = col;
  const camel = toCamelCase(COLUMN_NAME);
  let drizzleType;

  // Detect enum
  if (DATA_TYPE === "enum") {
    const vals = COLUMN_TYPE.match(/enum\((.+)\)/)?.[1];
    if (vals) {
      const items = vals.split(",").map(v => v.replace(/'/g, "").trim());
      drizzleType = `mysqlEnum("${COLUMN_NAME}", [${items.map(i => `"${i}"`).join(", ")}])`;
    }
  }

  if (!drizzleType) {
    switch (DATA_TYPE) {
      case "int":
      case "integer":
        drizzleType = `int("${COLUMN_NAME}")`;
        break;
      case "bigint":
        drizzleType = `bigint("${COLUMN_NAME}", { mode: "number" })`;
        break;
      case "varchar":
        const len = COLUMN_TYPE.match(/varchar\((\d+)\)/)?.[1] || "255";
        drizzleType = `varchar("${COLUMN_NAME}", { length: ${len} })`;
        break;
      case "text":
      case "longtext":
      case "mediumtext":
        drizzleType = `text("${COLUMN_NAME}")`;
        break;
      case "json":
        drizzleType = `json("${COLUMN_NAME}")`;
        break;
      case "timestamp":
      case "datetime":
        drizzleType = `timestamp("${COLUMN_NAME}")`;
        break;
      case "tinyint":
        drizzleType = `boolean("${COLUMN_NAME}")`;
        break;
      case "double":
      case "float":
        drizzleType = `double("${COLUMN_NAME}")`;
        break;
      case "decimal":
        const match = COLUMN_TYPE.match(/decimal\((\d+),(\d+)\)/);
        if (match) {
          drizzleType = `decimal("${COLUMN_NAME}", { precision: ${match[1]}, scale: ${match[2]} })`;
        } else {
          drizzleType = `decimal("${COLUMN_NAME}")`;
        }
        break;
      default:
        drizzleType = `/* UNKNOWN: ${DATA_TYPE} */ varchar("${COLUMN_NAME}", { length: 255 })`;
    }
  }

  // Chains
  let chains = [];
  if (EXTRA.includes("auto_increment")) chains.push(".autoincrement()");
  if (COLUMN_KEY === "PRI") chains.push(".primaryKey()");
  if (COLUMN_KEY === "UNI") chains.push(".unique()");
  if (IS_NULLABLE === "NO" && !EXTRA.includes("auto_increment")) chains.push(".notNull()");

  // Defaults
  if (COLUMN_DEFAULT !== null) {
    if (COLUMN_DEFAULT === "CURRENT_TIMESTAMP") {
      chains.push(".defaultNow()");
    } else if (DATA_TYPE === "tinyint") {
      chains.push(`.default(${COLUMN_DEFAULT === "1" ? "true" : "false"})`);
    } else if (DATA_TYPE === "int" || DATA_TYPE === "bigint") {
      chains.push(`.default(${COLUMN_DEFAULT})`);
    } else if (DATA_TYPE === "enum" || DATA_TYPE === "varchar") {
      chains.push(`.default("${COLUMN_DEFAULT}")`);
    }
  }

  // onUpdateNow
  if (EXTRA.includes("on update CURRENT_TIMESTAMP")) {
    chains.push(".onUpdateNow()");
  }

  return `  ${camel}: ${drizzleType}${chains.join("")},`;
}

for (const [table, cols] of Object.entries(data)) {
  const exportName = toExportName(table);
  const typeName = exportName.charAt(0).toUpperCase() + exportName.slice(1);
  
  console.log(`// ─── ${typeName} ${"─".repeat(Math.max(1, 70 - typeName.length))}`)
  console.log(`export const ${exportName} = mysqlTable("${table}", {`);
  for (const col of cols) {
    console.log(mapType(col));
  }
  console.log(`});`);
  console.log(`export type ${typeName} = typeof ${exportName}.$inferSelect;`);
  console.log();
}
