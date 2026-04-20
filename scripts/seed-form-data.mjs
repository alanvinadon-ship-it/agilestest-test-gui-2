#!/usr/bin/env node
/**
 * seed-form-data.mjs — Insérer un dataset FORM_DATA dans le bundle BUNDLE_WEB_PROD_V1
 * 
 * Usage: node scripts/seed-form-data.mjs
 * 
 * Ce script :
 * 1. Crée un dataset type FORM_DATA s'il n'existe pas
 * 2. Crée une instance de dataset FORM_DATA dans le projet de test
 * 3. Ajoute l'instance au bundle BUNDLE_WEB_PROD_V1
 */

import { db } from '../server/db.ts';
import { datasetTypes, datasetInstances, bundleItems } from '../drizzle/schema.ts';
import { v4 as uuidv4 } from 'uuid';

const PROJECT_ID = 'proj-vabf-web-001'; // ID du projet de test
const BUNDLE_ID = 'bundle-web-prod-v1'; // ID du bundle
const DATASET_TYPE_ID = 'form_data';

async function seedFormData() {
  console.log('🌱 Seeding FORM_DATA dataset...\n');

  try {
    // 1. Vérifier/créer le dataset type FORM_DATA
    console.log('1️⃣  Checking dataset type FORM_DATA...');
    let datasetType = await db.query.datasetTypes.findFirst({
      where: (table) => table.datasetTypeId.eq(DATASET_TYPE_ID),
    });

    if (!datasetType) {
      console.log('   ➕ Creating dataset type FORM_DATA...');
      const typeUid = uuidv4();
      await db.insert(datasetTypes).values({
        uid: typeUid,
        datasetTypeId: DATASET_TYPE_ID,
        domain: 'WEB',
        testType: 'VABF',
        name: 'Données de formulaire',
        description: 'Jeu de données pour les tests de soumission de formulaires (inscription, contact, commande).',
        schemaFields: [
          { name: 'field_name', type: 'string', required: true, description: 'Nom du champ', example: 'nom_complet' },
          { name: 'field_value', type: 'string', required: true, description: 'Valeur à saisir', example: 'Marie Bamba' },
          { name: 'field_type', type: 'enum', required: false, description: 'Type de champ HTML', example: 'text', enum_values: ['text', 'email', 'number', 'tel', 'select', 'checkbox', 'textarea', 'date'] },
          { name: 'is_required', type: 'boolean', required: false, description: 'Champ obligatoire', example: 'true' },
          { name: 'validation_regex', type: 'string', required: false, description: 'Pattern de validation', example: '^[A-Za-z ]+$' },
        ],
        examplePlaceholders: {
          field_name: 'champ_{{index}}',
          field_value: 'Valeur test {{index}}',
          field_type: 'text',
          is_required: 'true',
        },
        tags: ['formulaire', 'saisie', 'validation'],
      });
      console.log('   ✅ Dataset type FORM_DATA created\n');
    } else {
      console.log('   ✅ Dataset type FORM_DATA already exists\n');
    }

    // 2. Créer une instance de dataset FORM_DATA pour le projet
    console.log('2️⃣  Creating FORM_DATA instance...');
    const instanceUid = uuidv4();
    const formDataInstance = await db.insert(datasetInstances).values({
      uid: instanceUid,
      projectId: PROJECT_ID,
      datasetTypeId: DATASET_TYPE_ID,
      env: 'PROD',
      version: 1,
      status: 'ACTIVE',
      valuesJson: {
        // Exemples de données de formulaire pour les tests
        nom_complet: 'Jean Kouassi',
        email: 'jean.kouassi@test.ci',
        telephone: '+225 07 01 02 03 04',
        adresse: '123 Rue de la Paix, Abidjan',
        code_postal: '01 BP 1234',
        ville: 'Abidjan',
        pays: 'Côte d\'Ivoire',
        // Champs de formulaire individuels
        champ_1: 'Valeur test 1',
        champ_2: 'Valeur test 2',
        champ_3: 'Valeur test 3',
        // Données de sélection
        titre: 'M.',
        civilite: 'Monsieur',
        secteur_activite: 'Télécommunications',
        // Données de validation
        password: 'Test@Secure!2026',
        password_confirm: 'Test@Secure!2026',
        accepte_conditions: 'true',
        accepte_newsletter: 'false',
      },
      notes: 'Dataset FORM_DATA pour les tests de soumission de formulaires - Environnement PROD',
      createdBy: 'system',
    });
    console.log(`   ✅ FORM_DATA instance created (UID: ${instanceUid})\n`);

    // 3. Ajouter l'instance au bundle
    console.log('3️⃣  Adding FORM_DATA instance to bundle...');
    const bundleItem = await db.insert(bundleItems).values({
      bundleId: BUNDLE_ID,
      datasetId: instanceUid,
      order: 3, // Après CREDENTIALS (0) et URLS (1)
    });
    console.log('   ✅ FORM_DATA instance added to bundle\n');

    console.log('✨ Seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Dataset Type: ${DATASET_TYPE_ID}`);
    console.log(`   - Instance UID: ${instanceUid}`);
    console.log(`   - Bundle: ${BUNDLE_ID}`);
    console.log(`   - Environment: PROD`);
    console.log(`   - Status: ACTIVE`);
    console.log(`\n🎯 Next step: Relancer la génération IA sur le scénario VABF-WEB-003`);
    console.log(`   L'avertissement 'form_data' devrait maintenant disparaître.`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

seedFormData().then(() => process.exit(0));
