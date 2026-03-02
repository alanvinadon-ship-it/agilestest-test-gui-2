#!/usr/bin/env node
/**
 * Manual migration: Add collector_sessions, collector_events tables,
 * probeToken column to probes, and performance indexes.
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  console.log('Adding probeToken column to probes...');
  try {
    await conn.execute(`ALTER TABLE probes ADD COLUMN probeToken varchar(128) DEFAULT NULL`);
    console.log('  ✓ probeToken added');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('  ⊘ probeToken already exists');
    } else {
      throw e;
    }
  }

  console.log('Creating collector_sessions table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS collector_sessions (
      id int AUTO_INCREMENT PRIMARY KEY,
      uid varchar(36) NOT NULL UNIQUE,
      capture_id int NOT NULL,
      probe_id int NOT NULL,
      status enum('QUEUED','RUNNING','STOPPED','FAILED') NOT NULL DEFAULT 'QUEUED',
      started_at timestamp NULL,
      stopped_at timestamp NULL,
      last_heartbeat_at timestamp NULL,
      meta_json json,
      created_by varchar(64),
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cs_capture_created (capture_id, created_at DESC),
      INDEX idx_cs_probe_heartbeat (probe_id, last_heartbeat_at DESC),
      INDEX idx_cs_status (status)
    )
  `);
  console.log('  ✓ collector_sessions created');

  console.log('Creating collector_events table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS collector_events (
      id int AUTO_INCREMENT PRIMARY KEY,
      uid varchar(36) NOT NULL UNIQUE,
      session_id int NOT NULL,
      level enum('INFO','WARN','ERROR') NOT NULL DEFAULT 'INFO',
      event_type enum('STARTED','STOPPED','HEARTBEAT','UPLOAD','ERROR','CUSTOM') NOT NULL DEFAULT 'CUSTOM',
      message text,
      data_json json,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ce_session_created (session_id, created_at DESC)
    )
  `);
  console.log('  ✓ collector_events created');

  console.log('Done!');
  await conn.end();
}

run().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
