-- seed-form-data.sql — Insérer un dataset FORM_DATA dans le bundle BUNDLE_WEB_PROD_V1
-- 
-- Usage: 
--   export DATABASE_URL="mysql://user:password@localhost:3306/agilestest"
--   mysql -h localhost -u user -p agilestest < scripts/seed-form-data.sql
-- 
-- Ce script :
-- 1. Crée un dataset type FORM_DATA s'il n'existe pas
-- 2. Crée une instance de dataset FORM_DATA dans le projet de test
-- 3. Ajoute l'instance au bundle BUNDLE_WEB_PROD_V1

-- ─── 1. Vérifier/créer le dataset type FORM_DATA ───────────────────────────

INSERT IGNORE INTO dataset_types (uid, dataset_type_id, domain, test_type, name, description, schema_fields, example_placeholders, tags, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'form_data',
  'WEB',
  'VABF',
  'Données de formulaire',
  'Jeu de données pour les tests de soumission de formulaires (inscription, contact, commande).',
  '[{"name":"field_name","type":"string","required":true,"description":"Nom du champ","example":"nom_complet"},{"name":"field_value","type":"string","required":true,"description":"Valeur à saisir","example":"Marie Bamba"},{"name":"field_type","type":"enum","required":false,"description":"Type de champ HTML","example":"text","enum_values":["text","email","number","tel","select","checkbox","textarea","date"]},{"name":"is_required","type":"boolean","required":false,"description":"Champ obligatoire","example":"true"},{"name":"validation_regex","type":"string","required":false,"description":"Pattern de validation","example":"^[A-Za-z ]+$"}]',
  '{"field_name":"champ_{{index}}","field_value":"Valeur test {{index}}","field_type":"text","is_required":"true"}',
  '["formulaire","saisie","validation"]',
  NOW(),
  NOW()
);

-- ─── 2. Créer une instance de dataset FORM_DATA ────────────────────────────

-- Récupérer l'ID du projet VABF-WEB-001 (ou le premier projet disponible)
SELECT @project_uid := uid FROM projects WHERE name LIKE '%VABF%' OR name LIKE '%WEB%' LIMIT 1;

-- Si aucun projet trouvé, utiliser un ID par défaut
SET @project_uid = COALESCE(@project_uid, 'proj-vabf-web-001');

-- Insérer l'instance FORM_DATA
INSERT INTO dataset_instances (uid, project_id, dataset_type_id, env, version, status, values_json, notes, created_by, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  @project_uid,
  'form_data',
  'PROD',
  1,
  'ACTIVE',
  '{"nom_complet":"Jean Kouassi","email":"jean.kouassi@test.ci","telephone":"+225 07 01 02 03 04","adresse":"123 Rue de la Paix, Abidjan","code_postal":"01 BP 1234","ville":"Abidjan","pays":"Côte d\'Ivoire","champ_1":"Valeur test 1","champ_2":"Valeur test 2","champ_3":"Valeur test 3","titre":"M.","civilite":"Monsieur","secteur_activite":"Télécommunications","password":"Test@Secure!2026","password_confirm":"Test@Secure!2026","accepte_conditions":"true","accepte_newsletter":"false"}',
  'Dataset FORM_DATA pour les tests de soumission de formulaires - Environnement PROD',
  'system',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ─── 3. Ajouter l'instance au bundle BUNDLE_WEB_PROD_V1 ──────────────────

-- Récupérer l'ID du bundle
SELECT @bundle_uid := uid FROM dataset_bundles WHERE name = 'BUNDLE_WEB_PROD_V1' LIMIT 1;

-- Insérer dans bundle_items si le bundle existe
INSERT INTO bundle_items (bundle_id, dataset_id, `order`)
SELECT @bundle_uid, '550e8400-e29b-41d4-a716-446655440002', 3
WHERE @bundle_uid IS NOT NULL
ON DUPLICATE KEY UPDATE `order` = 3;

-- ─── Résumé ───────────────────────────────────────────────────────────────

SELECT 'Seeding FORM_DATA completed!' AS 'Status';
SELECT COUNT(*) AS 'Dataset Types (form_data)' FROM dataset_types WHERE dataset_type_id = 'form_data';
SELECT COUNT(*) AS 'FORM_DATA Instances (PROD)' FROM dataset_instances WHERE dataset_type_id = 'form_data' AND env = 'PROD';
SELECT COUNT(*) AS 'Bundle Items with FORM_DATA' FROM bundle_items WHERE dataset_id = '550e8400-e29b-41d4-a716-446655440002';
