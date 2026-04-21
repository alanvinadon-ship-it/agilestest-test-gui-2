/**
 * Script pour mettre à jour le dataset type form_data avec les champs object
 * et mettre à jour l'instance de dataset avec les valeurs object
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  try {
    // 1. Mettre à jour le schema_fields du dataset type form_data
    const newSchemaFields = JSON.stringify([
      { name: 'field_name', type: 'string', required: true, description: 'Nom du champ', example: 'nom_complet' },
      { name: 'field_value', type: 'string', required: true, description: 'Valeur à saisir', example: 'Marie Bamba' },
      { name: 'field_type', type: 'enum', required: false, description: 'Type de champ HTML', example: 'text', enum_values: ['text', 'email', 'number', 'tel', 'select', 'checkbox', 'textarea', 'date'] },
      { name: 'is_required', type: 'boolean', required: false, description: 'Champ obligatoire', example: 'true' },
      { name: 'validation_regex', type: 'string', required: false, description: 'Pattern de validation', example: '^[A-Za-z ]+$' },
      {
        name: 'user_info',
        type: 'object',
        required: true,
        description: 'Informations utilisateur structurées (prénom, nom, email, téléphone)',
        nested: [
          { name: 'firstName', type: 'string', required: true, description: 'Prénom', example: 'Jean' },
          { name: 'lastName', type: 'string', required: true, description: 'Nom de famille', example: 'Kouassi' },
          { name: 'email', type: 'email', required: true, description: 'Adresse email', example: 'jean@example.com' },
          { name: 'phone', type: 'phone', required: false, description: 'Numéro de téléphone', example: '+225 07 01 02 03 04' },
        ]
      },
      {
        name: 'address',
        type: 'object',
        required: false,
        description: 'Adresse postale complète',
        nested: [
          { name: 'street', type: 'string', required: true, description: 'Rue et numéro', example: '123 Rue de la Paix' },
          { name: 'city', type: 'string', required: true, description: 'Ville', example: 'Abidjan' },
          { name: 'zipCode', type: 'string', required: false, description: 'Code postal', example: '01 BP 1234' },
          { name: 'country', type: 'string', required: true, description: 'Pays', example: "Côte d'Ivoire" },
        ]
      },
    ]);

    const [updateResult] = await conn.execute(
      `UPDATE dataset_types SET schema_fields = ? WHERE dataset_type_id = 'form_data'`,
      [newSchemaFields]
    );
    console.log('Dataset type form_data schema updated:', updateResult.affectedRows, 'row(s)');

    // 2. Mettre à jour les valeurs de l'instance de dataset form_data
    const newValuesJson = JSON.stringify({
      field_name: 'nom_complet',
      field_value: 'Jean Kouassi',
      field_type: 'text',
      is_required: 'true',
      validation_regex: '^[A-Za-z ]+$',
      user_info: {
        firstName: 'Jean',
        lastName: 'Kouassi',
        email: 'jean.kouassi@test.ci',
        phone: '+225 07 01 02 03 04',
      },
      address: {
        street: '123 Rue de la Paix',
        city: 'Abidjan',
        zipCode: '01 BP 1234',
        country: "Côte d'Ivoire",
      },
    });

    const [instanceResult] = await conn.execute(
      `UPDATE dataset_instances SET values_json = ? WHERE dataset_type_id = 'form_data' AND env = 'PROD' LIMIT 1`,
      [newValuesJson]
    );
    console.log('Dataset instance form_data values updated:', instanceResult.affectedRows, 'row(s)');

    // 3. Vérifier le résultat
    const [rows] = await conn.execute(
      `SELECT dataset_type_id, JSON_LENGTH(schema_fields) as field_count FROM dataset_types WHERE dataset_type_id = 'form_data'`
    );
    console.log('Verification:', rows[0]);

    const [instRows] = await conn.execute(
      `SELECT uid, dataset_type_id, env, JSON_KEYS(values_json) as keys_list FROM dataset_instances WHERE dataset_type_id = 'form_data' AND env = 'PROD' LIMIT 1`
    );
    console.log('Instance verification:', instRows[0]);

  } finally {
    await conn.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
