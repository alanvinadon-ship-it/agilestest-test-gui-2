import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all tables
  const [tables] = await conn.query("SHOW TABLES");
  const dbName = Object.keys(tables[0])[0];
  const tableNames = tables.map(t => t[dbName]).sort();
  
  const result = {};
  
  for (const table of tableNames) {
    const [columns] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
    result[table] = columns.map(c => ({
      field: c.Field,
      type: c.Type,
      null: c.Null,
      key: c.Key,
      default: c.Default,
    }));
  }
  
  fs.writeFileSync('/tmp/db-columns.json', JSON.stringify(result, null, 2));
  console.log(`Extracted ${tableNames.length} tables:`);
  for (const t of tableNames) {
    console.log(`  ${t}: ${result[t].length} columns → [${result[t].map(c => c.field).join(', ')}]`);
  }
  
  await conn.end();
}

main().catch(console.error);
