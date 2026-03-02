import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const statements = [
  // Add community columns to scenario_templates
  `ALTER TABLE scenario_templates
     ADD COLUMN published_by_open_id VARCHAR(128) DEFAULT NULL,
     ADD COLUMN published_by_name VARCHAR(255) DEFAULT NULL,
     ADD COLUMN published_at TIMESTAMP NULL DEFAULT NULL,
     ADD COLUMN avg_rating DOUBLE DEFAULT 0,
     ADD COLUMN rating_count INT DEFAULT 0,
     ADD COLUMN usage_count INT DEFAULT 0`,

  // Create template_ratings table
  `CREATE TABLE IF NOT EXISTS template_ratings (
     id INT AUTO_INCREMENT PRIMARY KEY,
     template_uid VARCHAR(36) NOT NULL,
     user_open_id VARCHAR(128) NOT NULL,
     user_name VARCHAR(255),
     rating INT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
     UNIQUE KEY uq_rating_user_template (template_uid, user_open_id),
     INDEX idx_template_uid (template_uid)
   )`,

  // Create template_comments table
  `CREATE TABLE IF NOT EXISTS template_comments (
     id INT AUTO_INCREMENT PRIMARY KEY,
     uid VARCHAR(36) NOT NULL UNIQUE,
     template_uid VARCHAR(36) NOT NULL,
     user_open_id VARCHAR(128) NOT NULL,
     user_name VARCHAR(255),
     content TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
     INDEX idx_comment_template (template_uid),
     INDEX idx_comment_user (user_open_id)
   )`,
];

for (const sql of statements) {
  try {
    await conn.query(sql);
    console.log("OK:", sql.slice(0, 60) + "...");
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME" || e.message.includes("Duplicate column")) {
      console.log("SKIP (already exists):", sql.slice(0, 60) + "...");
    } else {
      console.error("ERR:", e.message);
    }
  }
}

await conn.end();
console.log("Migration community done.");
