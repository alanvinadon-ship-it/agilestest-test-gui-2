/**
 * Catalogue de Dataset Types (gabarits) prédéfinis.
 * Chaque gabarit définit un schéma de données standardisé
 * que les scénarios IA peuvent référencer via required_dataset_types.
 */

import type { DatasetTypeField } from '../types';

export interface DatasetTypeSeed {
  dataset_type_id: string;
  domain: string;
  test_type?: 'VABF' | 'VSR' | 'VABE';
  name: string;
  description: string;
  schema_fields: DatasetTypeField[];
  example_placeholders: Record<string, string>;
  tags: string[];
}

// ─── WEB / API Domain ─────────────────────────────────────────────────────

const USERS: DatasetTypeSeed = {
  dataset_type_id: 'users',
  domain: 'WEB',
  name: 'Utilisateurs',
  description: 'Jeu de données d\'utilisateurs pour les tests d\'authentification, de profils et de gestion de comptes.',
  schema_fields: [
    { name: 'email', type: 'email', required: true, description: 'Adresse e-mail de l\'utilisateur', example: 'user01@test.ci' },
    { name: 'password', type: 'string', required: true, description: 'Mot de passe', example: 'P@ssw0rd!2026' },
    { name: 'full_name', type: 'string', required: true, description: 'Nom complet', example: 'Jean Kouassi' },
    { name: 'role', type: 'enum', required: false, description: 'Rôle utilisateur', example: 'USER', enum_values: ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] },
    { name: 'is_active', type: 'boolean', required: false, description: 'Compte actif', example: 'true' },
    { name: 'phone', type: 'phone', required: false, description: 'Numéro de téléphone', example: '+225 07 01 02 03 04' },
  ],
  example_placeholders: {
    email: 'user{{index}}@test.ci',
    password: 'Test@{{index}}!2026',
    full_name: 'Utilisateur Test {{index}}',
    role: 'USER',
    is_active: 'true',
    phone: '+225 07 00 00 {{index}}',
  },
  tags: ['auth', 'login', 'profil', 'compte'],
};

const USER_ADMIN: DatasetTypeSeed = {
  dataset_type_id: 'user_admin',
  domain: 'WEB',
  name: 'Utilisateurs Administrateurs',
  description: 'Jeu de données d\'administrateurs pour les tests de gestion et de droits d\'accès.',
  schema_fields: [
    { name: 'email', type: 'email', required: true, description: 'Adresse e-mail admin', example: 'admin01@test.ci' },
    { name: 'password', type: 'string', required: true, description: 'Mot de passe admin', example: 'Admin@Secure!2026' },
    { name: 'full_name', type: 'string', required: true, description: 'Nom complet', example: 'Admin Koné' },
    { name: 'permissions', type: 'string', required: false, description: 'Permissions (CSV)', example: 'users.manage,projects.admin,reports.view' },
  ],
  example_placeholders: {
    email: 'admin{{index}}@test.ci',
    password: 'Admin@{{index}}!2026',
    full_name: 'Admin Test {{index}}',
    permissions: 'users.manage,projects.admin',
  },
  tags: ['admin', 'rbac', 'permissions'],
};

const FORM_DATA: DatasetTypeSeed = {
  dataset_type_id: 'form_data',
  domain: 'WEB',
  name: 'Données de formulaire',
  description: 'Jeu de données pour les tests de soumission de formulaires (inscription, contact, commande).',
  schema_fields: [
    { name: 'field_name', type: 'string', required: true, description: 'Nom du champ', example: 'nom_complet' },
    { name: 'field_value', type: 'string', required: true, description: 'Valeur à saisir', example: 'Marie Bamba' },
    { name: 'field_type', type: 'enum', required: false, description: 'Type de champ HTML', example: 'text', enum_values: ['text', 'email', 'number', 'tel', 'select', 'checkbox', 'textarea', 'date'] },
    { name: 'is_required', type: 'boolean', required: false, description: 'Champ obligatoire', example: 'true' },
    { name: 'validation_regex', type: 'string', required: false, description: 'Pattern de validation', example: '^[A-Za-z ]+$' },
  ],
  example_placeholders: {
    field_name: 'champ_{{index}}',
    field_value: 'Valeur test {{index}}',
    field_type: 'text',
    is_required: 'true',
  },
  tags: ['formulaire', 'saisie', 'validation'],
};

const SEARCH_DATA: DatasetTypeSeed = {
  dataset_type_id: 'search_data',
  domain: 'WEB',
  name: 'Données de recherche',
  description: 'Jeu de données pour les tests de recherche, filtrage et pagination.',
  schema_fields: [
    { name: 'query', type: 'string', required: true, description: 'Terme de recherche', example: 'forfait internet' },
    { name: 'expected_count', type: 'number', required: false, description: 'Nombre de résultats attendus', example: '5', min: 0 },
    { name: 'filters', type: 'string', required: false, description: 'Filtres à appliquer (JSON)', example: '{"category":"mobile","price_max":5000}' },
    { name: 'sort_by', type: 'string', required: false, description: 'Champ de tri', example: 'price_asc' },
  ],
  example_placeholders: {
    query: 'recherche test {{index}}',
    expected_count: '{{index}}',
    filters: '{}',
  },
  tags: ['recherche', 'filtre', 'pagination'],
};

const RESOURCE_DATA: DatasetTypeSeed = {
  dataset_type_id: 'resource_data',
  domain: 'API',
  name: 'Ressources API',
  description: 'Jeu de données pour les tests CRUD d\'API REST (création, lecture, mise à jour, suppression de ressources).',
  schema_fields: [
    { name: 'name', type: 'string', required: true, description: 'Nom de la ressource', example: 'Produit Alpha' },
    { name: 'payload', type: 'string', required: true, description: 'Corps JSON de la requête', example: '{"name":"Produit Alpha","price":1500,"category":"mobile"}' },
    { name: 'expected_status', type: 'number', required: false, description: 'Code HTTP attendu', example: '201', min: 100, max: 599 },
    { name: 'method', type: 'enum', required: false, description: 'Méthode HTTP', example: 'POST', enum_values: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    { name: 'headers', type: 'string', required: false, description: 'Headers additionnels (JSON)', example: '{"X-Custom":"value"}' },
  ],
  example_placeholders: {
    name: 'Ressource {{index}}',
    payload: '{"name":"Ressource {{index}}","value":{{index}}}',
    expected_status: '201',
    method: 'POST',
  },
  tags: ['api', 'crud', 'rest', 'payload'],
};

const INVALID_DATA: DatasetTypeSeed = {
  dataset_type_id: 'invalid_data',
  domain: 'API',
  name: 'Données invalides',
  description: 'Jeu de données invalides pour les tests négatifs (validation, erreurs 4xx, injection).',
  schema_fields: [
    { name: 'payload', type: 'string', required: true, description: 'Corps JSON invalide', example: '{"email":"not-an-email","age":-5}' },
    { name: 'expected_status', type: 'number', required: true, description: 'Code HTTP d\'erreur attendu', example: '422', min: 400, max: 599 },
    { name: 'expected_error_field', type: 'string', required: false, description: 'Champ en erreur attendu', example: 'email' },
    { name: 'injection_type', type: 'enum', required: false, description: 'Type d\'injection', example: 'none', enum_values: ['none', 'sql', 'xss', 'xxe', 'path_traversal'] },
  ],
  example_placeholders: {
    payload: '{"field":"invalid_{{index}}"}',
    expected_status: '422',
    expected_error_field: 'field_{{index}}',
  },
  tags: ['négatif', 'validation', 'erreur', 'sécurité'],
};

const LOAD_TEST_DATA: DatasetTypeSeed = {
  dataset_type_id: 'load_test_data',
  domain: 'API',
  test_type: 'VABE',
  name: 'Données de charge',
  description: 'Jeu de données pour les tests de performance et de charge (k6, JMeter).',
  schema_fields: [
    { name: 'endpoint', type: 'url', required: true, description: 'URL de l\'endpoint à tester', example: '/api/v2/products' },
    { name: 'method', type: 'enum', required: true, description: 'Méthode HTTP', example: 'GET', enum_values: ['GET', 'POST', 'PUT', 'DELETE'] },
    { name: 'payload', type: 'string', required: false, description: 'Corps de la requête (JSON)', example: '{"page":1,"limit":50}' },
    { name: 'expected_p95_ms', type: 'number', required: false, description: 'Latence P95 max (ms)', example: '500', min: 0 },
    { name: 'expected_rps', type: 'number', required: false, description: 'RPS minimum attendu', example: '100', min: 0 },
    { name: 'vus', type: 'number', required: false, description: 'Nombre d\'utilisateurs virtuels', example: '50', min: 1 },
  ],
  example_placeholders: {
    endpoint: '/api/v2/resource_{{index}}',
    method: 'GET',
    expected_p95_ms: '500',
    expected_rps: '100',
    vus: '50',
  },
  tags: ['performance', 'charge', 'k6', 'jmeter', 'latence'],
};

// ─── Telecom IMS Domain ────────────────────────────────────────────────────

const SUBSCRIBERS: DatasetTypeSeed = {
  dataset_type_id: 'subscribers',
  domain: 'IMS',
  name: 'Abonnés IMS',
  description: 'Jeu de données d\'abonnés pour les tests SIP/IMS (enregistrement, appels, SMS).',
  schema_fields: [
    { name: 'msisdn', type: 'phone', required: true, description: 'Numéro MSISDN', example: '+22507010203' },
    { name: 'imsi', type: 'string', required: true, description: 'IMSI de l\'abonné', example: '612030000000001' },
    { name: 'sip_uri', type: 'string', required: true, description: 'SIP URI', example: 'sip:+22507010203@ims.orange.ci' },
    { name: 'auth_password', type: 'string', required: true, description: 'Mot de passe SIP', example: 'SipAuth!001' },
    { name: 'profile_type', type: 'enum', required: false, description: 'Type de profil abonné', example: 'PREPAID', enum_values: ['PREPAID', 'POSTPAID', 'HYBRID', 'ENTERPRISE'] },
    { name: 'service_profile', type: 'string', required: false, description: 'Profil de service IMS', example: 'VOLTE_BASIC' },
  ],
  example_placeholders: {
    msisdn: '+2250701{{index}}',
    imsi: '61203000000{{index}}',
    sip_uri: 'sip:+2250701{{index}}@ims.orange.ci',
    auth_password: 'SipAuth!{{index}}',
    profile_type: 'PREPAID',
  },
  tags: ['ims', 'sip', 'abonné', 'volte'],
};

const SUBSCRIBERS_4G: DatasetTypeSeed = {
  dataset_type_id: 'subscribers_4g',
  domain: 'EPC',
  name: 'Abonnés 4G/LTE',
  description: 'Jeu de données d\'abonnés 4G pour les tests EPC (attach, bearer, handover).',
  schema_fields: [
    { name: 'imsi', type: 'string', required: true, description: 'IMSI', example: '612030000000001' },
    { name: 'msisdn', type: 'phone', required: true, description: 'MSISDN', example: '+22507010203' },
    { name: 'apn', type: 'string', required: true, description: 'APN', example: 'internet.orange.ci' },
    { name: 'qci', type: 'number', required: false, description: 'QCI (1-9)', example: '9', min: 1, max: 9 },
    { name: 'ambr_dl', type: 'number', required: false, description: 'AMBR DL (Mbps)', example: '100' },
    { name: 'ambr_ul', type: 'number', required: false, description: 'AMBR UL (Mbps)', example: '50' },
    { name: 'rat_type', type: 'enum', required: false, description: 'Type RAT', example: 'EUTRAN', enum_values: ['EUTRAN', 'UTRAN', 'GERAN'] },
  ],
  example_placeholders: {
    imsi: '61203000000{{index}}',
    msisdn: '+2250701{{index}}',
    apn: 'internet.orange.ci',
    qci: '9',
    ambr_dl: '100',
    ambr_ul: '50',
  },
  tags: ['4g', 'lte', 'epc', 'attach', 'bearer'],
};

const SUBSCRIBERS_5G: DatasetTypeSeed = {
  dataset_type_id: 'subscribers_5g',
  domain: '5GC',
  name: 'Abonnés 5G',
  description: 'Jeu de données d\'abonnés 5G pour les tests 5GC (registration, PDU session, slicing).',
  schema_fields: [
    { name: 'supi', type: 'string', required: true, description: 'SUPI (imsi-...)', example: 'imsi-612030000000001' },
    { name: 'gpsi', type: 'string', required: true, description: 'GPSI (msisdn-...)', example: 'msisdn-22507010203' },
    { name: 'dnn', type: 'string', required: true, description: 'DNN', example: 'internet' },
    { name: 'snssai_sst', type: 'number', required: true, description: 'S-NSSAI SST', example: '1', min: 0, max: 255 },
    { name: 'snssai_sd', type: 'string', required: false, description: 'S-NSSAI SD', example: '000001' },
    { name: 'auth_method', type: 'enum', required: false, description: 'Méthode d\'authentification', example: '5G_AKA', enum_values: ['5G_AKA', 'EAP_AKA_PRIME', 'EAP_TLS'] },
    { name: 'key', type: 'string', required: true, description: 'Clé K (hex)', example: '000102030405060708090a0b0c0d0e0f' },
    { name: 'opc', type: 'string', required: true, description: 'OPc (hex)', example: '0f0e0d0c0b0a09080706050403020100' },
    { name: 'ambr_dl', type: 'string', required: false, description: 'AMBR DL', example: '1 Gbps' },
    { name: 'ambr_ul', type: 'string', required: false, description: 'AMBR UL', example: '500 Mbps' },
  ],
  example_placeholders: {
    supi: 'imsi-61203000000{{index}}',
    gpsi: 'msisdn-2250701{{index}}',
    dnn: 'internet',
    snssai_sst: '1',
    auth_method: '5G_AKA',
    key: '000102030405060708090a0b0c0d0e0f',
    opc: '0f0e0d0c0b0a09080706050403020100',
  },
  tags: ['5g', '5gc', 'registration', 'pdu', 'slice'],
};

// ─── Cross-domain ──────────────────────────────────────────────────────────

const SUBSCRIBER_PAYLOAD_VALID: DatasetTypeSeed = {
  dataset_type_id: 'subscriber_payload_valid',
  domain: 'API',
  name: 'Payloads abonnés valides',
  description: 'Jeu de payloads valides pour la création/modification d\'abonnés via API.',
  schema_fields: [
    { name: 'msisdn', type: 'phone', required: true, description: 'MSISDN', example: '+22507010203' },
    { name: 'offer_code', type: 'string', required: true, description: 'Code offre', example: 'PREPAID_BASIC' },
    { name: 'activation_date', type: 'date', required: false, description: 'Date d\'activation', example: '2026-03-01' },
    { name: 'payload_json', type: 'string', required: true, description: 'Payload complet (JSON)', example: '{"msisdn":"+22507010203","offer":"PREPAID_BASIC"}' },
    { name: 'expected_status', type: 'number', required: false, description: 'Code HTTP attendu', example: '201' },
  ],
  example_placeholders: {
    msisdn: '+2250701{{index}}',
    offer_code: 'PREPAID_BASIC',
    activation_date: '2026-03-01',
    payload_json: '{"msisdn":"+2250701{{index}}","offer":"PREPAID_BASIC"}',
    expected_status: '201',
  },
  tags: ['abonné', 'api', 'provisioning'],
};

const NETWORK_ENDPOINTS: DatasetTypeSeed = {
  dataset_type_id: 'network_endpoints',
  domain: 'API',
  test_type: 'VSR',
  name: 'Endpoints réseau',
  description: 'Jeu de données d\'endpoints réseau pour les tests de résilience et de connectivité.',
  schema_fields: [
    { name: 'host', type: 'string', required: true, description: 'Hôte ou IP', example: '10.0.1.100' },
    { name: 'port', type: 'number', required: true, description: 'Port', example: '8080', min: 1, max: 65535 },
    { name: 'protocol', type: 'enum', required: true, description: 'Protocole', example: 'HTTPS', enum_values: ['HTTP', 'HTTPS', 'TCP', 'UDP', 'GRPC', 'WS', 'WSS'] },
    { name: 'health_path', type: 'string', required: false, description: 'Chemin healthcheck', example: '/health' },
    { name: 'expected_latency_ms', type: 'number', required: false, description: 'Latence max (ms)', example: '200' },
  ],
  example_placeholders: {
    host: '10.0.1.{{index}}',
    port: '8080',
    protocol: 'HTTPS',
    health_path: '/health',
  },
  tags: ['réseau', 'endpoint', 'résilience', 'connectivité'],
};

// ─── Export ────────────────────────────────────────────────────────────────

export const DATASET_TYPE_CATALOG: DatasetTypeSeed[] = [
  USERS,
  USER_ADMIN,
  FORM_DATA,
  SEARCH_DATA,
  RESOURCE_DATA,
  INVALID_DATA,
  LOAD_TEST_DATA,
  SUBSCRIBERS,
  SUBSCRIBERS_4G,
  SUBSCRIBERS_5G,
  SUBSCRIBER_PAYLOAD_VALID,
  NETWORK_ENDPOINTS,
];

import { DRIVE_TEST_DATASET_TYPES } from './driveTestCatalog';

// Merge Drive Test dataset types into the main catalog
DATASET_TYPE_CATALOG.push(...DRIVE_TEST_DATASET_TYPES);

/** Lookup rapide par dataset_type_id */
export const DATASET_TYPE_BY_ID: Record<string, DatasetTypeSeed> = Object.fromEntries(
  DATASET_TYPE_CATALOG.map(dt => [dt.dataset_type_id, dt])
);

/** Filtrer les dataset types par domaine et/ou test_type */
export function filterDatasetTypes(opts?: {
  domain?: string;
  test_type?: string;
}): DatasetTypeSeed[] {
  let result = [...DATASET_TYPE_CATALOG];
  if (opts?.domain) {
    result = result.filter(dt =>
      dt.domain === opts.domain ||
      dt.domain === 'API' // API est cross-domain
    );
  }
  if (opts?.test_type) {
    result = result.filter(dt =>
      !dt.test_type || dt.test_type === opts.test_type
    );
  }
  return result;
}
