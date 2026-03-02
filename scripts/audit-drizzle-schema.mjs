import fs from 'fs';

const schemaContent = fs.readFileSync('/home/ubuntu/agilestest-test-gui/drizzle/schema.ts', 'utf-8');

// Parse all mysqlTable definitions
const tableRegex = /export const (\w+)\s*=\s*mysqlTable\(\s*"([^"]+)"/g;
const tables = {};
let match;

while ((match = tableRegex.exec(schemaContent)) !== null) {
  const varName = match[1];
  const tableName = match[2];
  
  // Find the block for this table
  const startIdx = match.index;
  let braceCount = 0;
  let inBlock = false;
  let endIdx = startIdx;
  
  for (let i = startIdx; i < schemaContent.length; i++) {
    if (schemaContent[i] === '{') {
      braceCount++;
      inBlock = true;
    } else if (schemaContent[i] === '}') {
      braceCount--;
      if (inBlock && braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  
  const block = schemaContent.substring(startIdx, endIdx);
  
  // Parse column definitions: jsName: type("dbColumnName"
  const colRegex = /(\w+)\s*:\s*(?:int|varchar|text|mysqlEnum|timestamp|json|boolean|bigint|float|double|decimal|datetime|tinyint)\s*\(\s*"([^"]+)"/g;
  const columns = {};
  let colMatch;
  
  while ((colMatch = colRegex.exec(block)) !== null) {
    const jsName = colMatch[1];
    const dbName = colMatch[2];
    columns[jsName] = dbName;
  }
  
  tables[tableName] = { varName, columns };
}

// Load DB columns
const dbColumns = JSON.parse(fs.readFileSync('/tmp/db-columns.json', 'utf-8'));

// Compare
const report = [];
let totalMismatches = 0;
let totalMissing = 0;
let totalExtra = 0;

for (const [tableName, tableInfo] of Object.entries(tables).sort((a, b) => a[0].localeCompare(b[0]))) {
  const dbCols = dbColumns[tableName];
  if (!dbCols) {
    report.push(`\n❌ TABLE "${tableName}" (var: ${tableInfo.varName}) — NOT FOUND IN DB`);
    continue;
  }
  
  const dbColNames = new Set(dbCols.map(c => c.field));
  const drizzleDbNames = new Set(Object.values(tableInfo.columns));
  
  const issues = [];
  
  // Check each Drizzle column maps to a real DB column
  for (const [jsName, dbName] of Object.entries(tableInfo.columns)) {
    if (!dbColNames.has(dbName)) {
      issues.push(`  ⚠️  Drizzle "${jsName}" → DB "${dbName}" — COLUMN NOT FOUND IN DB`);
      totalMismatches++;
    }
  }
  
  // Check DB columns not mapped in Drizzle
  for (const dbCol of dbColNames) {
    if (!drizzleDbNames.has(dbCol)) {
      issues.push(`  📌 DB column "${dbCol}" — NOT MAPPED in Drizzle schema`);
      totalMissing++;
    }
  }
  
  if (issues.length > 0) {
    report.push(`\n🔍 TABLE "${tableName}" (var: ${tableInfo.varName})`);
    report.push(`   Drizzle columns: [${Object.values(tableInfo.columns).join(', ')}]`);
    report.push(`   DB columns:      [${[...dbColNames].join(', ')}]`);
    issues.forEach(i => report.push(i));
  } else {
    report.push(`\n✅ TABLE "${tableName}" (var: ${tableInfo.varName}) — OK (${Object.keys(tableInfo.columns).length} cols matched)`);
  }
}

// Check DB tables not in Drizzle
const drizzleTables = new Set(Object.keys(tables));
for (const dbTable of Object.keys(dbColumns).sort()) {
  if (!drizzleTables.has(dbTable)) {
    report.push(`\n📌 DB TABLE "${dbTable}" — NOT IN DRIZZLE SCHEMA`);
    totalExtra++;
  }
}

console.log('=== DRIZZLE ↔ DB AUDIT REPORT ===');
report.forEach(l => console.log(l));
console.log('\n=== SUMMARY ===');
console.log(`Tables in Drizzle: ${Object.keys(tables).length}`);
console.log(`Tables in DB: ${Object.keys(dbColumns).length}`);
console.log(`Column mismatches (Drizzle → non-existent DB col): ${totalMismatches}`);
console.log(`DB columns not in Drizzle: ${totalMissing}`);
console.log(`DB tables not in Drizzle: ${totalExtra}`);

fs.writeFileSync('/tmp/audit-report.txt', report.join('\n'));
