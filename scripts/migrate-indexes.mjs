#!/usr/bin/env node
/**
 * Migration: Add performance indexes for cursor-based pagination.
 * Covers: test_profiles, test_scenarios, executions, datasets, probes,
 *         collector_sessions, collector_events, dataset_instances, dataset_bundles.
 *
 * Cursor pagination uses `WHERE id < cursor ORDER BY id DESC LIMIT N+1`.
 * The PRIMARY KEY (id) already covers this pattern for simple queries.
 * These composite indexes cover the common filtered + cursor queries.
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const indexes = [
  // test_profiles: cursor + project + search
  { table: 'test_profiles', name: 'idx_profiles_project_id', columns: '(project_id, id DESC)' },
  
  // test_scenarios: cursor + project + search
  { table: 'test_scenarios', name: 'idx_scenarios_project_id', columns: '(project_id, id DESC)' },
  
  // executions: cursor + project + status + scenario
  { table: 'executions', name: 'idx_exec_project_id', columns: '(project_id, id DESC)' },
  { table: 'executions', name: 'idx_exec_project_status_id', columns: '(project_id, status, id DESC)' },
  { table: 'executions', name: 'idx_exec_project_scenario_id', columns: '(project_id, scenario_id, id DESC)' },
  
  // datasets: cursor + project
  { table: 'datasets', name: 'idx_datasets_project_id', columns: '(project_id, id DESC)' },
  
  // probes: cursor + status
  { table: 'probes', name: 'idx_probes_status_id', columns: '(status, id DESC)' },
  
  // dataset_instances: cursor + project + env + type
  { table: 'dataset_instances', name: 'idx_di_project_id', columns: '(project_id, id DESC)' },
  { table: 'dataset_instances', name: 'idx_di_project_env_id', columns: '(project_id, env, id DESC)' },
  
  // dataset_bundles: cursor + project + env
  { table: 'dataset_bundles', name: 'idx_db_project_id', columns: '(project_id, id DESC)' },
  
  // collector_sessions: composite for filtered cursor
  { table: 'collector_sessions', name: 'idx_cs_capture_id', columns: '(capture_id, id DESC)' },
  { table: 'collector_sessions', name: 'idx_cs_probe_id', columns: '(probe_id, id DESC)' },
  
  // collector_events: composite for filtered cursor
  { table: 'collector_events', name: 'idx_ce_session_id', columns: '(session_id, id DESC)' },
  
  // drive_campaigns: cursor + status
  { table: 'drive_campaigns', name: 'idx_dc_project_id', columns: '(project_id, id DESC)' },
  
  // capture_sessions: cursor (if table exists)
  { table: 'capture_sessions', name: 'idx_csess_project_id', columns: '(project_id, id DESC)', optional: true },
];

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  for (const idx of indexes) {
    try {
      await conn.execute(`CREATE INDEX ${idx.name} ON ${idx.table} ${idx.columns}`);
      console.log(`  ✓ ${idx.name} ON ${idx.table}`);
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log(`  ⊘ ${idx.name} already exists`);
      } else if (e.code === 'ER_NO_SUCH_TABLE' && idx.optional) {
        console.log(`  ⊘ ${idx.table} does not exist (optional)`);
      } else if (e.code === 'ER_KEY_COLUMN_DOES_NOT_EXIST' || e.code === 'ER_NO_SUCH_TABLE') {
        console.log(`  ⊘ ${idx.name} skipped: ${e.message}`);
      } else {
        console.error(`  ✗ ${idx.name}: ${e.message}`);
      }
    }
  }
  
  console.log('\nDone!');
  await conn.end();
}

run().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
