#!/usr/bin/env node
/**
 * verify-datasets.mjs — Vérifier que les datasets sont persistés en base de données
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parser la DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  port: url.port || 3306,
  ssl: url.hostname.includes('rds') || url.hostname.includes('tidb') ? { rejectUnauthorized: false } : undefined,
};

async function verifyDatasets() {
  let connection;
  try {
    connection = await mysql.createConnection(config);
    
    console.log('✓ Connecté à la base de données');
    
    // 1. Vérifier les dataset types
    const [datasetTypes] = await connection.query(
      'SELECT uid, dataset_type_id, name FROM dataset_types WHERE dataset_type_id IN (?, ?, ?)',
      ['search_data', 'auth_data', 'form_data']
    );
    console.log(`✓ Dataset types trouvés: ${datasetTypes.length}`);
    datasetTypes.forEach(dt => {
      console.log(`  - ${dt.dataset_type_id}: ${dt.name}`);
    });
    
    // 2. Vérifier les dataset instances
    const [datasetInstances] = await connection.query(
      'SELECT uid, dataset_type_id, env, status FROM dataset_instances WHERE dataset_type_id IN (?, ?, ?)',
      ['search_data', 'auth_data', 'form_data']
    );
    console.log(`✓ Dataset instances trouvés: ${datasetInstances.length}`);
    datasetInstances.forEach(di => {
      console.log(`  - ${di.dataset_type_id} (${di.env}): ${di.status}`);
    });
    
    // 3. Vérifier les bundle items
    const [bundleItems] = await connection.query(
      `SELECT bi.bundle_id as bundleId, bi.dataset_id as datasetId, di.dataset_type_id
       FROM bundle_items bi
       JOIN dataset_instances di ON bi.dataset_id = di.uid
       WHERE di.dataset_type_id IN (?, ?, ?)`,
      ['search_data', 'auth_data', 'form_data']
    );
    console.log(`✓ Bundle items trouvés: ${bundleItems.length}`);
    bundleItems.forEach(bi => {
      console.log(`  - Bundle ${bi.bundleId.substring(0, 8)}... → Dataset ${bi.dataset_type_id}`);
    });
    
    // 4. Vérifier les valeurs des datasets
    const [instancesWithValues] = await connection.query(
      'SELECT uid, dataset_type_id, values_json FROM dataset_instances WHERE dataset_type_id IN (?, ?, ?)',
      ['search_data', 'auth_data', 'form_data']
    );
    console.log(`✓ Valeurs des datasets:`);
    instancesWithValues.forEach(iv => {
      let values = {};
      try {
        if (typeof iv.values_json === 'string') {
          values = JSON.parse(iv.values_json);
        } else if (typeof iv.values_json === 'object') {
          values = iv.values_json;
        }
      } catch (e) {
        console.log(`    Erreur parsing: ${e.message}`);
      }
      const valueCount = Object.keys(values).length;
      console.log(`  - ${iv.dataset_type_id}: ${valueCount} clés`);
      if (valueCount > 0) {
        console.log(`    Exemples: ${Object.keys(values).slice(0, 3).join(', ')}`);
      }
    });
    
    console.log('\n✅ Vérification complétée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verifyDatasets();
