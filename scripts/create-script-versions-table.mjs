import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

await conn.execute(`
  CREATE TABLE IF NOT EXISTS script_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(36) NOT NULL UNIQUE,
    script_id INT NOT NULL,
    version INT NOT NULL,
    code TEXT,
    change_summary VARCHAR(500),
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_script_versions_script_id (script_id),
    INDEX idx_script_versions_version (script_id, version)
  )
`);

console.log('Table script_versions created successfully');
await conn.end();
