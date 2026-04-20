-- Script SQL pour ajouter des datasets avec des valeurs au bundle BUNDLE_WEB_PROD_V1
-- Exécutez ce script directement dans MySQL

-- 1. Récupérer l'ID du projet (utiliser le premier projet)
SET @project_id = (SELECT uid FROM projects LIMIT 1);

-- 2. Récupérer l'ID du bundle BUNDLE_WEB_PROD_V1
SET @bundle_id = (SELECT uid FROM dataset_bundles WHERE name = 'BUNDLE_WEB_PROD_V1' LIMIT 1);

-- 3. Vérifier que le projet et le bundle existent
SELECT @project_id AS project_id, @bundle_id AS bundle_id;

-- 4. Créer les UUIDs pour les datasets
SET @search_data_uid = UUID();
SET @auth_data_uid = UUID();
SET @form_data_uid = UUID();

-- 5. Insérer les dataset types s'ils n'existent pas
INSERT IGNORE INTO dataset_types (uid, dataset_type_id, domain, test_type, name, description, schema_fields, example_placeholders, tags, created_at, updated_at)
VALUES 
  (UUID(), 'search_data', 'WEB', 'VABF', 'Données de recherche', 'Jeu de données pour les tests de recherche et filtrage', 
   JSON_ARRAY(
     JSON_OBJECT('name', 'search_term', 'type', 'string', 'required', true, 'description', 'Terme de recherche', 'example', 'Playwright'),
     JSON_OBJECT('name', 'filter_category', 'type', 'string', 'required', false, 'description', 'Catégorie de filtre', 'example', 'Automation'),
     JSON_OBJECT('name', 'expected_results_count', 'type', 'number', 'required', false, 'description', 'Nombre de résultats attendus', 'example', '10')
   ),
   JSON_OBJECT('search_term', 'terme_{{index}}', 'filter_category', 'categorie_{{index}}'),
   JSON_ARRAY('recherche', 'filtrage', 'test'),
   NOW(), NOW()),
  (UUID(), 'auth_data', 'WEB', 'VABF', 'Données d''authentification', 'Jeu de données pour les tests de connexion et authentification',
   JSON_ARRAY(
     JSON_OBJECT('name', 'username', 'type', 'string', 'required', true, 'description', 'Nom d''utilisateur', 'example', 'test_user'),
     JSON_OBJECT('name', 'password', 'type', 'string', 'required', true, 'description', 'Mot de passe', 'example', 'SecurePass123!'),
     JSON_OBJECT('name', 'email', 'type', 'string', 'required', false, 'description', 'Email', 'example', 'test@example.com')
   ),
   JSON_OBJECT('username', 'user_{{index}}', 'password', 'pass_{{index}}', 'email', 'email_{{index}}@test.com'),
   JSON_ARRAY('authentification', 'connexion', 'login'),
   NOW(), NOW());

-- 6. Insérer les instances de dataset avec des valeurs
INSERT INTO dataset_instances (uid, project_id, dataset_type_id, env, version, status, values_json, notes, created_by, created_at, updated_at)
VALUES
  (@search_data_uid, @project_id, 'search_data', 'PROD', 1, 'ACTIVE',
   JSON_OBJECT(
     'search_term_1', 'Playwright',
     'search_term_2', 'Cypress',
     'search_term_3', 'Selenium',
     'filter_category_1', 'Automation',
     'filter_category_2', 'Testing',
     'expected_results_count_1', '100',
     'expected_results_count_2', '50'
   ),
   'Dataset de recherche pour tests PROD',
   'SYSTEM',
   NOW(), NOW()),
  (@auth_data_uid, @project_id, 'auth_data', 'PROD', 1, 'ACTIVE',
   JSON_OBJECT(
     'username', 'test_user_prod',
     'password', 'SecurePassword123!',
     'email', 'testuser@agilestest.com',
     'username_invalid', 'invalid_user',
     'password_invalid', 'wrongpass'
   ),
   'Dataset d''authentification pour tests PROD',
   'SYSTEM',
   NOW(), NOW()),
  (@form_data_uid, @project_id, 'form_data', 'PROD', 1, 'ACTIVE',
   JSON_OBJECT(
     'nom_complet', 'Jean Kouassi',
     'email', 'jean.kouassi@test.ci',
     'telephone', '+225 07 01 02 03 04',
     'adresse', '123 Rue de la Paix, Abidjan',
     'code_postal', '01 BP 1234',
     'ville', 'Abidjan',
     'pays', 'Côte d''Ivoire',
     'password', 'Test@Secure!2026',
     'password_confirm', 'Test@Secure!2026'
   ),
   'Dataset de formulaire pour tests PROD',
   'SYSTEM',
   NOW(), NOW());

-- 7. Ajouter les datasets au bundle (si le bundle existe)
INSERT IGNORE INTO bundle_items (bundle_id, dataset_id)
SELECT @bundle_id, @search_data_uid
WHERE @bundle_id IS NOT NULL;

INSERT IGNORE INTO bundle_items (bundle_id, dataset_id)
SELECT @bundle_id, @auth_data_uid
WHERE @bundle_id IS NOT NULL;

INSERT IGNORE INTO bundle_items (bundle_id, dataset_id)
SELECT @bundle_id, @form_data_uid
WHERE @bundle_id IS NOT NULL;

-- 8. Vérifier le résultat
SELECT 'Datasets créés et ajoutés au bundle' AS status;
SELECT COUNT(*) AS dataset_count FROM bundle_items WHERE bundle_id = @bundle_id;
SELECT ds.uid, ds.dataset_type_id, JSON_LENGTH(ds.values_json) AS value_count
FROM dataset_instances ds
JOIN bundle_items bi ON ds.uid = bi.dataset_id
WHERE bi.bundle_id = @bundle_id;
