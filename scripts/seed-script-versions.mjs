/**
 * Seed script_versions table with 2 versions for script 240001
 * so the diff viewer can be tested.
 */
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get current code from generated_scripts id=240001
const [scripts] = await conn.execute('SELECT id, code FROM generated_scripts WHERE id = 240001');
if (!scripts.length) {
  console.log('Script 240001 not found');
  await conn.end();
  process.exit(1);
}

const currentCode = scripts[0].code;

// Parse the code to create a slightly different version 1
let v1Code;
try {
  const parsed = JSON.parse(currentCode);
  // Create v1 with slightly different content (add a comment)
  const v1Parsed = JSON.parse(JSON.stringify(parsed));
  if (v1Parsed.files && v1Parsed.files.length > 0) {
    v1Parsed.files[0].content = '// Version 1 - Initial generated code\n' + v1Parsed.files[0].content;
  }
  v1Code = JSON.stringify(v1Parsed);
} catch {
  v1Code = '// Version 1\n' + currentCode;
}

// Insert version 1
await conn.execute(
  'INSERT INTO script_versions (uid, script_id, version, code, change_summary, created_by) VALUES (?, 240001, 1, ?, ?, ?)',
  [randomUUID(), v1Code, 'Génération initiale par IA', 'system']
);
console.log('Version 1 inserted');

// Insert version 2 (current code)
await conn.execute(
  'INSERT INTO script_versions (uid, script_id, version, code, change_summary, created_by) VALUES (?, 240001, 2, ?, ?, ?)',
  [randomUUID(), currentCode, 'Corrections manuelles des sélecteurs', 'system']
);
console.log('Version 2 inserted');

await conn.end();
console.log('Done - 2 versions seeded for script 240001');
