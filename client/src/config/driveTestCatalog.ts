/**
 * Drive Test Catalog — Dataset Types + Scenario Templates
 * Domain: DRIVE_TEST
 */
import type { DatasetTypeSeed } from './datasetTypeCatalog';
import type { DriveScenarioTemplate, ScenarioStep, ArtifactUploadPolicy, TestType } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function step(order: number, action: string, description: string, expected: string): ScenarioStep {
  return { id: `s${order}`, order, action, description, expected_result: expected, parameters: {} };
}

// ═══════════════════════════════════════════════════════════════════════════
// A) DATASET TYPES — 10 gabarits Drive Test
// ═══════════════════════════════════════════════════════════════════════════

export const DT_CAMPAIGN_CONFIG: DatasetTypeSeed = {
  dataset_type_id: 'dt_campaign_config',
  domain: 'DRIVE_TEST',
  name: 'Configuration Campagne',
  description: 'Paramètres globaux de la campagne drive test : réseau cible, zone géographique, fenêtre temporelle.',
  schema_fields: [
    { name: 'network_type', type: 'enum', required: true, description: 'Type de réseau', example: '4G', enum_values: ['4G', '5G_SA', '5G_NSA', 'IMS', 'IP'] },
    { name: 'city', type: 'string', required: true, description: 'Ville ou zone', example: 'Abidjan' },
    { name: 'area_code', type: 'string', required: false, description: 'Code zone', example: 'ABJ-PLATEAU' },
    { name: 'start_date', type: 'date', required: true, description: 'Date de début', example: '2026-03-01' },
    { name: 'end_date', type: 'date', required: true, description: 'Date de fin', example: '2026-03-15' },
    { name: 'time_window_start', type: 'string', required: false, description: 'Heure début collecte', example: '08:00' },
    { name: 'time_window_end', type: 'string', required: false, description: 'Heure fin collecte', example: '20:00' },
  ],
  example_placeholders: { network_type: '4G', city: 'Abidjan', start_date: '2026-03-01', end_date: '2026-03-15' },
  tags: ['campagne', 'config', 'drive'],
};

export const DT_ROUTE_GEOJSON: DatasetTypeSeed = {
  dataset_type_id: 'dt_route_geojson',
  domain: 'DRIVE_TEST',
  name: 'Route GeoJSON',
  description: 'Parcours terrain au format GeoJSON LineString avec checkpoints de mesure.',
  schema_fields: [
    { name: 'route_name', type: 'string', required: true, description: 'Nom du parcours', example: 'Plateau → Cocody' },
    { name: 'route_geojson', type: 'string', required: true, description: 'GeoJSON LineString (JSON string)', example: '{"type":"LineString","coordinates":[[-3.99,5.32],[-3.98,5.34]]}' },
    { name: 'checkpoints_count', type: 'number', required: false, description: 'Nombre de checkpoints', example: '12' },
    { name: 'expected_duration_min', type: 'number', required: true, description: 'Durée estimée (min)', example: '45' },
  ],
  example_placeholders: { route_name: 'Route {{index}}', expected_duration_min: '30' },
  tags: ['route', 'geojson', 'parcours', 'drive'],
};

export const DT_DEVICE_PROFILE: DatasetTypeSeed = {
  dataset_type_id: 'dt_device_profile',
  domain: 'DRIVE_TEST',
  name: 'Profil Équipement',
  description: 'Caractéristiques du terminal de test : type, modèle, OS, capacités diagnostiques.',
  schema_fields: [
    { name: 'device_type', type: 'enum', required: true, description: 'Type d\'équipement', example: 'ANDROID', enum_values: ['ANDROID', 'MODEM', 'CPE', 'LAPTOP'] },
    { name: 'model', type: 'string', required: true, description: 'Modèle', example: 'Samsung Galaxy S24' },
    { name: 'os_version', type: 'string', required: true, description: 'Version OS', example: 'Android 15' },
    { name: 'diag_capable', type: 'boolean', required: true, description: 'Capable de diagnostic radio', example: 'true' },
    { name: 'tools', type: 'string', required: false, description: 'Outils installés (séparés par virgule)', example: 'GNetTrack,NSG' },
    { name: 'imei', type: 'string', required: false, description: 'IMEI du terminal', example: '35xxxxxxxxx' },
  ],
  example_placeholders: { device_type: 'ANDROID', model: 'Samsung Galaxy S24', os_version: 'Android 15', diag_capable: 'true' },
  tags: ['device', 'terminal', 'équipement', 'drive'],
};

export const DT_RADIO_THRESHOLDS: DatasetTypeSeed = {
  dataset_type_id: 'dt_radio_thresholds',
  domain: 'DRIVE_TEST',
  test_type: 'VABE',
  name: 'Seuils Radio',
  description: 'Seuils KPI radio pour la validation : RSRP, SINR, débit, latence, taux de succès.',
  schema_fields: [
    { name: 'rsrp_min_dbm', type: 'number', required: true, description: 'RSRP minimum (dBm)', example: '-100', min: -140, max: -44 },
    { name: 'rsrq_min_db', type: 'number', required: false, description: 'RSRQ minimum (dB)', example: '-12', min: -20, max: -3 },
    { name: 'sinr_min_db', type: 'number', required: true, description: 'SINR minimum (dB)', example: '5', min: -20, max: 30 },
    { name: 'throughput_dl_min_mbps', type: 'number', required: true, description: 'Débit DL minimum (Mbps)', example: '10' },
    { name: 'throughput_ul_min_mbps', type: 'number', required: false, description: 'Débit UL minimum (Mbps)', example: '5' },
    { name: 'latency_max_ms', type: 'number', required: true, description: 'Latence maximum (ms)', example: '50' },
    { name: 'jitter_max_ms', type: 'number', required: false, description: 'Jitter maximum (ms)', example: '10' },
    { name: 'packet_loss_max_pct', type: 'number', required: false, description: 'Perte de paquets max (%)', example: '1', min: 0, max: 100 },
    { name: 'handover_success_rate_min_pct', type: 'number', required: false, description: 'Taux succès handover min (%)', example: '95', min: 0, max: 100 },
    { name: 'attach_success_rate_min_pct', type: 'number', required: false, description: 'Taux succès attach min (%)', example: '99', min: 0, max: 100 },
  ],
  example_placeholders: { rsrp_min_dbm: '-100', sinr_min_db: '5', throughput_dl_min_mbps: '10', latency_max_ms: '50' },
  tags: ['kpi', 'seuils', 'radio', 'performance', 'drive'],
};

export const DT_IPERF_TARGETS: DatasetTypeSeed = {
  dataset_type_id: 'dt_iperf_targets',
  domain: 'DRIVE_TEST',
  test_type: 'VABE',
  name: 'Cibles iperf3',
  description: 'Configuration des serveurs iperf3 pour les mesures de débit.',
  schema_fields: [
    { name: 'server_ip', type: 'ip', required: true, description: 'IP du serveur iperf3', example: '10.0.1.100' },
    { name: 'port', type: 'number', required: true, description: 'Port', example: '5201', min: 1, max: 65535 },
    { name: 'duration_sec', type: 'number', required: true, description: 'Durée du test (sec)', example: '30' },
    { name: 'parallel_streams', type: 'number', required: false, description: 'Flux parallèles', example: '4' },
    { name: 'direction', type: 'enum', required: true, description: 'Direction', example: 'DL', enum_values: ['DL', 'UL', 'BOTH'] },
    { name: 'protocol', type: 'enum', required: false, description: 'Protocole', example: 'TCP', enum_values: ['TCP', 'UDP'] },
  ],
  example_placeholders: { server_ip: '10.0.1.100', port: '5201', duration_sec: '30', direction: 'DL' },
  tags: ['iperf', 'débit', 'performance', 'drive'],
};

export const DT_CAPTURE_POLICY: DatasetTypeSeed = {
  dataset_type_id: 'dt_capture_policy',
  domain: 'DRIVE_TEST',
  name: 'Politique de Capture',
  description: 'Politique de capture réseau : PCAP, traces SIP, protocoles, déclenchement.',
  schema_fields: [
    { name: 'pcap_mode', type: 'enum', required: true, description: 'Mode PCAP', example: 'ON_FAILURE', enum_values: ['ALWAYS', 'ON_FAILURE', 'OFF'] },
    { name: 'sip_trace', type: 'enum', required: false, description: 'Trace SIP', example: 'ON_FAILURE', enum_values: ['ALWAYS', 'ON_FAILURE', 'OFF'] },
    { name: 'protocols', type: 'string', required: false, description: 'Protocoles à capturer (séparés par virgule)', example: 'SIP,DIAMETER,GTPv2' },
    { name: 'max_pcap_size_mb', type: 'number', required: false, description: 'Taille max PCAP (MB)', example: '100' },
    { name: 'retention_days', type: 'number', required: false, description: 'Rétention (jours)', example: '30' },
  ],
  example_placeholders: { pcap_mode: 'ON_FAILURE', protocols: 'SIP,DIAMETER', max_pcap_size_mb: '100' },
  tags: ['capture', 'pcap', 'sip', 'policy', 'drive'],
};

export const DT_APN_DNN_SLICES: DatasetTypeSeed = {
  dataset_type_id: 'dt_apn_dnn_slices',
  domain: 'DRIVE_TEST',
  name: 'APN / DNN / Slices',
  description: 'Configuration APN (4G), DNN (5G) et slices réseau (SST/SD, QoS).',
  schema_fields: [
    { name: 'apn', type: 'string', required: false, description: 'APN (4G)', example: 'internet.orange.ci' },
    { name: 'dnn', type: 'string', required: false, description: 'DNN (5G)', example: 'internet' },
    { name: 'sst', type: 'number', required: false, description: 'Slice/Service Type', example: '1' },
    { name: 'sd', type: 'string', required: false, description: 'Slice Differentiator', example: '0x000001' },
    { name: 'qos_class', type: 'enum', required: false, description: 'Classe QoS', example: 'QCI_9', enum_values: ['QCI_1', 'QCI_5', 'QCI_9', '5QI_1', '5QI_5', '5QI_9'] },
    { name: 'ip_type', type: 'enum', required: false, description: 'Type IP', example: 'IPv4', enum_values: ['IPv4', 'IPv6', 'IPv4v6'] },
  ],
  example_placeholders: { apn: 'internet.orange.ci', dnn: 'internet', sst: '1' },
  tags: ['apn', 'dnn', 'slice', '5g', '4g', 'drive'],
};

export const DT_APPS_UNDER_TEST: DatasetTypeSeed = {
  dataset_type_id: 'dt_apps_under_test',
  domain: 'DRIVE_TEST',
  name: 'Applications Sous Test',
  description: 'Liste des applications à tester pendant le drive test.',
  schema_fields: [
    { name: 'app_name', type: 'string', required: true, description: 'Nom de l\'application', example: 'Orange Money' },
    { name: 'app_type', type: 'enum', required: true, description: 'Type', example: 'MOBILE_APP', enum_values: ['WEB', 'MOBILE_APP', 'VOIP_CLIENT', 'STREAMING'] },
    { name: 'url', type: 'url', required: false, description: 'URL (si web)', example: 'https://money.orange.ci' },
    { name: 'package_name', type: 'string', required: false, description: 'Package Android', example: 'com.orange.money' },
    { name: 'expected_response_time_ms', type: 'number', required: false, description: 'Temps de réponse attendu (ms)', example: '3000' },
  ],
  example_placeholders: { app_name: 'Orange Money', app_type: 'MOBILE_APP', url: 'https://money.orange.ci' },
  tags: ['app', 'application', 'test', 'drive'],
};

export const DT_PROBE_CONFIG_REFS: DatasetTypeSeed = {
  dataset_type_id: 'dt_probe_config_refs',
  domain: 'DRIVE_TEST',
  name: 'Références Sondes',
  description: 'Références vers les sondes de collecte configurées pour la campagne.',
  schema_fields: [
    { name: 'probe_id', type: 'string', required: true, description: 'ID de la sonde', example: 'probe-abj-01' },
    { name: 'location', type: 'enum', required: true, description: 'Emplacement', example: 'RUNNER_HOST', enum_values: ['RUNNER_HOST', 'EDGE_VM', 'K8S_NODE', 'SPAN_PORT', 'MIRROR_TAP'] },
    { name: 'capture_type', type: 'enum', required: true, description: 'Type de capture', example: 'PCAP', enum_values: ['PCAP', 'SIP_TRACE', 'DIAMETER', 'GTPU', 'NGAP', 'NAS', 'HTTP', 'DNS', 'SYSLOG'] },
    { name: 'enabled', type: 'boolean', required: true, description: 'Activée', example: 'true' },
  ],
  example_placeholders: { probe_id: 'probe-abj-{{index}}', location: 'RUNNER_HOST', capture_type: 'PCAP', enabled: 'true' },
  tags: ['sonde', 'probe', 'collecte', 'drive'],
};

export const DT_REPORTING_PROFILE: DatasetTypeSeed = {
  dataset_type_id: 'dt_reporting_profile',
  domain: 'DRIVE_TEST',
  name: 'Profil de Reporting',
  description: 'Configuration du rapport consolidé : fenêtres d\'agrégation, couches carte, seuils d\'alerte.',
  schema_fields: [
    { name: 'aggregation_window_min', type: 'number', required: true, description: 'Fenêtre d\'agrégation (min)', example: '5' },
    { name: 'map_layers', type: 'string', required: false, description: 'Couches carte (séparées par virgule)', example: 'RSRP,SINR,THROUGHPUT_DL' },
    { name: 'alert_on_kpi_breach', type: 'boolean', required: false, description: 'Alerte sur dépassement KPI', example: 'true' },
    { name: 'export_format', type: 'enum', required: false, description: 'Format d\'export', example: 'PDF', enum_values: ['PDF', 'HTML', 'CSV', 'JSON'] },
    { name: 'include_geojson_overlay', type: 'boolean', required: false, description: 'Inclure overlay GeoJSON', example: 'true' },
  ],
  example_placeholders: { aggregation_window_min: '5', map_layers: 'RSRP,SINR', alert_on_kpi_breach: 'true' },
  tags: ['reporting', 'rapport', 'carte', 'drive'],
};

/** Tous les dataset types Drive Test */
export const DRIVE_TEST_DATASET_TYPES: DatasetTypeSeed[] = [
  DT_CAMPAIGN_CONFIG,
  DT_ROUTE_GEOJSON,
  DT_DEVICE_PROFILE,
  DT_RADIO_THRESHOLDS,
  DT_IPERF_TARGETS,
  DT_CAPTURE_POLICY,
  DT_APN_DNN_SLICES,
  DT_APPS_UNDER_TEST,
  DT_PROBE_CONFIG_REFS,
  DT_REPORTING_PROFILE,
];

// ═══════════════════════════════════════════════════════════════════════════
// B) SCENARIO TEMPLATES — 20 templates Drive Test
// ═══════════════════════════════════════════════════════════════════════════

const VABF_ARTIFACT_POLICY: ArtifactUploadPolicy[] = ['log', 'device_logs', 'kpi_series', 'summary_json'];
const VSR_ARTIFACT_POLICY: ArtifactUploadPolicy[] = ['log', 'pcap', 'sip_trace', 'device_logs', 'kpi_series', 'geojson', 'summary_json'];
const VABE_ARTIFACT_POLICY: ArtifactUploadPolicy[] = ['log', 'iperf_results', 'kpi_series', 'pcap', 'geojson', 'summary_json'];

export const DRIVE_SCENARIO_TEMPLATES: DriveScenarioTemplate[] = [
  // ─── VABF (Fonctionnel) ─────────────────────────────────────────────
  {
    template_id: 'dt-vabf-001',
    scenario_code: 'DT-VABF-001',
    test_type: 'VABF',
    name: 'Attach & Data Session',
    description: 'Vérifier l\'attachement au réseau et l\'établissement d\'une session data (PDP/PDU).',
    steps: [
      step(1, 'POWER_ON', 'Allumer le terminal et attendre l\'attachement réseau', 'Terminal attaché au réseau, indicateur signal visible'),
      step(2, 'CHECK_ATTACH', 'Vérifier l\'état d\'attachement via diag ou AT commands', 'Attach réussi, IMSI/GUTI alloué'),
      step(3, 'ACTIVATE_DATA', 'Activer la session data (APN/DNN configuré)', 'Session PDP/PDU établie, IP allouée'),
      step(4, 'PING_TEST', 'Effectuer un ping vers le serveur de test', 'Ping réussi, latence < seuil'),
      step(5, 'RECORD_KPI', 'Enregistrer RSRP, RSRQ, SINR', 'KPI enregistrés dans le rapport'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile', 'dt_apn_dnn_slices'],
    artifact_policy: VABF_ARTIFACT_POLICY,
    kpi_thresholds: { attach_success_rate_min_pct: 99, latency_max_ms: 100 },
  },
  {
    template_id: 'dt-vabf-002',
    scenario_code: 'DT-VABF-002',
    test_type: 'VABF',
    name: 'VoLTE Call Setup & Teardown',
    description: 'Vérifier l\'établissement et la libération d\'un appel VoLTE.',
    steps: [
      step(1, 'REGISTER_IMS', 'Vérifier l\'enregistrement IMS du terminal', 'Enregistrement IMS réussi'),
      step(2, 'INITIATE_CALL', 'Initier un appel VoLTE vers le numéro de test', 'Appel établi, audio bidirectionnel'),
      step(3, 'HOLD_CALL', 'Maintenir l\'appel pendant 60 secondes', 'Appel stable, pas de coupure'),
      step(4, 'CHECK_MOS', 'Mesurer le MOS (Mean Opinion Score)', 'MOS ≥ 3.5'),
      step(5, 'TEARDOWN', 'Raccrocher et vérifier la libération des ressources', 'Appel terminé proprement, ressources libérées'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile', 'dt_capture_policy'],
    artifact_policy: [...VABF_ARTIFACT_POLICY, 'sip_trace'],
    kpi_thresholds: { volte_mos_min: 3.5, volte_setup_time_max_ms: 5000 },
  },
  {
    template_id: 'dt-vabf-003',
    scenario_code: 'DT-VABF-003',
    test_type: 'VABF',
    name: 'SMS over 4G/5G',
    description: 'Vérifier l\'envoi et la réception de SMS via le réseau mobile.',
    steps: [
      step(1, 'SEND_SMS', 'Envoyer un SMS vers le numéro de test', 'SMS envoyé avec succès'),
      step(2, 'RECEIVE_SMS', 'Vérifier la réception du SMS', 'SMS reçu, contenu intact'),
      step(3, 'CHECK_DELIVERY', 'Vérifier l\'accusé de réception', 'Accusé reçu dans les 30 secondes'),
      step(4, 'RECORD_TIMING', 'Enregistrer le délai d\'acheminement', 'Délai < 10 secondes'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile'],
    artifact_policy: VABF_ARTIFACT_POLICY,
    kpi_thresholds: { sms_delivery_time_max_sec: 10 },
  },
  {
    template_id: 'dt-vabf-004',
    scenario_code: 'DT-VABF-004',
    test_type: 'VABF',
    name: 'Web Browsing Session',
    description: 'Vérifier la navigation web (HTTP/HTTPS) sur le réseau mobile.',
    steps: [
      step(1, 'OPEN_BROWSER', 'Ouvrir le navigateur et accéder à l\'URL de test', 'Page chargée avec succès'),
      step(2, 'MEASURE_LOAD', 'Mesurer le temps de chargement complet', 'Temps < seuil configuré'),
      step(3, 'NAVIGATE_PAGES', 'Naviguer sur 5 pages différentes', 'Toutes les pages chargées'),
      step(4, 'CHECK_DNS', 'Vérifier le temps de résolution DNS', 'DNS < 200ms'),
      step(5, 'RECORD_KPI', 'Enregistrer les métriques HTTP', 'Métriques enregistrées'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile', 'dt_apps_under_test'],
    artifact_policy: VABF_ARTIFACT_POLICY,
    kpi_thresholds: { http_response_time_max_ms: 3000, dns_resolution_time_max_ms: 200 },
  },
  {
    template_id: 'dt-vabf-005',
    scenario_code: 'DT-VABF-005',
    test_type: 'VABF',
    name: 'Video Streaming Quality',
    description: 'Vérifier la qualité du streaming vidéo (buffering, résolution, débit).',
    steps: [
      step(1, 'START_STREAM', 'Lancer un flux vidéo de test (720p/1080p)', 'Flux démarré'),
      step(2, 'MONITOR_BUFFER', 'Surveiller le buffering pendant 2 minutes', 'Zéro buffering ou < 2 événements'),
      step(3, 'CHECK_RESOLUTION', 'Vérifier la résolution effective', 'Résolution ≥ 720p'),
      step(4, 'MEASURE_BITRATE', 'Mesurer le bitrate moyen', 'Bitrate ≥ 2 Mbps'),
      step(5, 'STOP_AND_REPORT', 'Arrêter et enregistrer les métriques', 'Rapport généré'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile', 'dt_apps_under_test', 'dt_radio_thresholds'],
    artifact_policy: VABF_ARTIFACT_POLICY,
    kpi_thresholds: { throughput_dl_min_mbps: 2 },
  },
  {
    template_id: 'dt-vabf-006',
    scenario_code: 'DT-VABF-006',
    test_type: 'VABF',
    name: 'App Launch & Transaction',
    description: 'Vérifier le lancement d\'une application mobile et une transaction complète.',
    steps: [
      step(1, 'LAUNCH_APP', 'Lancer l\'application sous test', 'Application ouverte en < 5s'),
      step(2, 'LOGIN', 'Se connecter avec les identifiants de test', 'Connexion réussie'),
      step(3, 'EXECUTE_TX', 'Effectuer une transaction de test', 'Transaction complétée'),
      step(4, 'VERIFY_RESULT', 'Vérifier le résultat de la transaction', 'Résultat conforme'),
      step(5, 'LOGOUT', 'Se déconnecter et fermer l\'application', 'Déconnexion propre'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile', 'dt_apps_under_test'],
    artifact_policy: VABF_ARTIFACT_POLICY,
    kpi_thresholds: { app_launch_time_max_ms: 5000 },
  },
  {
    template_id: 'dt-vabf-007',
    scenario_code: 'DT-VABF-007',
    test_type: 'VABF',
    name: 'CSFB Voice Call (4G→3G)',
    description: 'Vérifier le Circuit Switched Fallback pour un appel voix depuis la 4G.',
    steps: [
      step(1, 'VERIFY_4G', 'Vérifier que le terminal est sur 4G', 'Terminal en LTE'),
      step(2, 'INITIATE_CSFB', 'Initier un appel voix (CSFB)', 'Fallback vers 3G/2G effectué'),
      step(3, 'HOLD_CALL', 'Maintenir l\'appel 30 secondes', 'Appel stable'),
      step(4, 'TEARDOWN', 'Raccrocher', 'Appel terminé'),
      step(5, 'VERIFY_RETURN', 'Vérifier le retour sur 4G', 'Terminal revenu en LTE'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile'],
    artifact_policy: VABF_ARTIFACT_POLICY,
    kpi_thresholds: { csfb_return_time_max_sec: 15 },
  },

  // ─── VSR (Résilience) ───────────────────────────────────────────────
  {
    template_id: 'dt-vsr-001',
    scenario_code: 'DT-VSR-001',
    test_type: 'VSR',
    name: 'Handover Success Under Motion',
    description: 'Vérifier la continuité de session lors de handovers en déplacement.',
    steps: [
      step(1, 'START_SESSION', 'Établir une session data active', 'Session active'),
      step(2, 'START_DRIVE', 'Démarrer le parcours en véhicule (50-80 km/h)', 'Véhicule en mouvement'),
      step(3, 'MONITOR_HANDOVER', 'Surveiller les handovers pendant le parcours', 'Handovers détectés et enregistrés'),
      step(4, 'CHECK_CONTINUITY', 'Vérifier la continuité de la session data', 'Aucune interruption de session'),
      step(5, 'ANALYZE_KPI', 'Analyser RSRP/SINR aux points de handover', 'KPI dans les seuils aux transitions'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_radio_thresholds'],
    artifact_policy: VSR_ARTIFACT_POLICY,
    kpi_thresholds: { handover_success_rate_min_pct: 95 },
  },
  {
    template_id: 'dt-vsr-002',
    scenario_code: 'DT-VSR-002',
    test_type: 'VSR',
    name: 'Session Continuity at Cell Edge',
    description: 'Vérifier la continuité de service en bordure de cellule.',
    steps: [
      step(1, 'IDENTIFY_EDGE', 'Identifier les zones de bordure de cellule sur le parcours', 'Zones identifiées via RSRP < -110 dBm'),
      step(2, 'START_STREAM', 'Lancer un flux data continu (download)', 'Flux actif'),
      step(3, 'TRAVERSE_EDGE', 'Traverser la zone de bordure', 'Traversée effectuée'),
      step(4, 'CHECK_DROP', 'Vérifier s\'il y a eu une coupure', 'Pas de coupure ou reconnexion < 2s'),
      step(5, 'RECORD_METRICS', 'Enregistrer les métriques radio à la bordure', 'Métriques enregistrées'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_radio_thresholds'],
    artifact_policy: VSR_ARTIFACT_POLICY,
    kpi_thresholds: { session_drop_rate_max_pct: 2 },
  },
  {
    template_id: 'dt-vsr-003',
    scenario_code: 'DT-VSR-003',
    test_type: 'VSR',
    name: 'VoLTE Call Under Handover',
    description: 'Vérifier la continuité d\'un appel VoLTE lors de handovers.',
    steps: [
      step(1, 'ESTABLISH_CALL', 'Établir un appel VoLTE', 'Appel actif'),
      step(2, 'START_DRIVE', 'Démarrer le parcours', 'Véhicule en mouvement'),
      step(3, 'MONITOR_QUALITY', 'Surveiller le MOS pendant le parcours', 'MOS enregistré en continu'),
      step(4, 'CHECK_DROPS', 'Vérifier les coupures d\'appel', 'Aucune coupure'),
      step(5, 'ANALYZE', 'Analyser la corrélation handover/qualité', 'Rapport généré'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_capture_policy'],
    artifact_policy: VSR_ARTIFACT_POLICY,
    kpi_thresholds: { drop_call_rate_max_pct: 1, volte_mos_min: 3.0 },
  },
  {
    template_id: 'dt-vsr-004',
    scenario_code: 'DT-VSR-004',
    test_type: 'VSR',
    name: 'Network Recovery After Loss',
    description: 'Vérifier le temps de récupération après une perte de couverture (tunnel, parking).',
    steps: [
      step(1, 'VERIFY_COVERAGE', 'Vérifier la couverture initiale', 'Signal OK'),
      step(2, 'ENTER_DEAD_ZONE', 'Entrer dans une zone sans couverture', 'Signal perdu'),
      step(3, 'EXIT_DEAD_ZONE', 'Sortir de la zone sans couverture', 'Signal retrouvé'),
      step(4, 'MEASURE_RECOVERY', 'Mesurer le temps de récupération', 'Récupération < 10 secondes'),
      step(5, 'VERIFY_SESSION', 'Vérifier la reprise de session', 'Session data restaurée'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile'],
    artifact_policy: VSR_ARTIFACT_POLICY,
    kpi_thresholds: { recovery_time_max_sec: 10 },
  },
  {
    template_id: 'dt-vsr-005',
    scenario_code: 'DT-VSR-005',
    test_type: 'VSR',
    name: 'Inter-RAT Handover (5G→4G→5G)',
    description: 'Vérifier la transition inter-technologie et le retour.',
    steps: [
      step(1, 'VERIFY_5G', 'Vérifier que le terminal est sur 5G', 'Terminal en NR'),
      step(2, 'FORCE_FALLBACK', 'Se déplacer vers une zone 4G only', 'Fallback vers LTE'),
      step(3, 'CHECK_SESSION', 'Vérifier la continuité de session', 'Session maintenue'),
      step(4, 'RETURN_5G', 'Revenir en zone 5G', 'Retour sur NR'),
      step(5, 'VERIFY_PERF', 'Vérifier les performances après retour', 'Débit restauré'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_radio_thresholds'],
    artifact_policy: VSR_ARTIFACT_POLICY,
    kpi_thresholds: { inter_rat_success_rate_min_pct: 95 },
  },
  {
    template_id: 'dt-vsr-006',
    scenario_code: 'DT-VSR-006',
    test_type: 'VSR',
    name: 'Concurrent Voice + Data Under Stress',
    description: 'Vérifier la coexistence voix + data sous charge réseau.',
    steps: [
      step(1, 'START_DATA', 'Lancer un download continu', 'Download actif'),
      step(2, 'START_CALL', 'Initier un appel VoLTE simultané', 'Appel établi'),
      step(3, 'MONITOR_BOTH', 'Surveiller qualité voix + débit data pendant 2 min', 'Les deux services actifs'),
      step(4, 'CHECK_DEGRADATION', 'Vérifier la dégradation acceptable', 'MOS ≥ 3.0, débit ≥ 50% nominal'),
      step(5, 'TEARDOWN', 'Terminer les deux sessions', 'Sessions terminées proprement'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile', 'dt_radio_thresholds', 'dt_iperf_targets'],
    artifact_policy: VSR_ARTIFACT_POLICY,
    kpi_thresholds: { volte_mos_min: 3.0, throughput_dl_degradation_max_pct: 50 },
  },

  // ─── VABE (Performance/Bench) ───────────────────────────────────────
  {
    template_id: 'dt-vabe-001',
    scenario_code: 'DT-VABE-001',
    test_type: 'VABE',
    name: 'Downlink Throughput Sweep',
    description: 'Mesurer le débit descendant sur le parcours avec iperf3.',
    steps: [
      step(1, 'CONFIGURE_IPERF', 'Configurer iperf3 client avec les paramètres du dataset', 'Client configuré'),
      step(2, 'START_DRIVE', 'Démarrer le parcours', 'Véhicule en mouvement'),
      step(3, 'RUN_IPERF_DL', 'Lancer iperf3 en mode download à chaque checkpoint', 'Mesures effectuées'),
      step(4, 'CORRELATE_GPS', 'Corréler les résultats avec la position GPS', 'Données géolocalisées'),
      step(5, 'GENERATE_HEATMAP', 'Générer la heatmap de débit', 'Heatmap GeoJSON générée'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_iperf_targets', 'dt_radio_thresholds'],
    artifact_policy: VABE_ARTIFACT_POLICY,
    kpi_thresholds: { throughput_dl_min_mbps: 10 },
  },
  {
    template_id: 'dt-vabe-002',
    scenario_code: 'DT-VABE-002',
    test_type: 'VABE',
    name: 'Latency / Jitter / Packet Loss Sampling',
    description: 'Mesurer latence, jitter et perte de paquets sur le parcours.',
    steps: [
      step(1, 'CONFIGURE_PING', 'Configurer ping/iperf UDP vers le serveur de test', 'Client configuré'),
      step(2, 'START_DRIVE', 'Démarrer le parcours', 'Véhicule en mouvement'),
      step(3, 'SAMPLE_METRICS', 'Échantillonner latence/jitter/loss toutes les 5 secondes', 'Échantillons collectés'),
      step(4, 'CORRELATE_RADIO', 'Corréler avec les KPI radio (RSRP/SINR)', 'Corrélation établie'),
      step(5, 'ANALYZE_STATS', 'Calculer min/max/avg/p95 par segment', 'Statistiques calculées'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_iperf_targets', 'dt_radio_thresholds'],
    artifact_policy: VABE_ARTIFACT_POLICY,
    kpi_thresholds: { latency_max_ms: 50, jitter_max_ms: 10, packet_loss_max_pct: 1 },
  },
  {
    template_id: 'dt-vabe-003',
    scenario_code: 'DT-VABE-003',
    test_type: 'VABE',
    name: 'Uplink Throughput Sweep',
    description: 'Mesurer le débit montant sur le parcours avec iperf3.',
    steps: [
      step(1, 'CONFIGURE_IPERF', 'Configurer iperf3 client en mode upload', 'Client configuré'),
      step(2, 'START_DRIVE', 'Démarrer le parcours', 'Véhicule en mouvement'),
      step(3, 'RUN_IPERF_UL', 'Lancer iperf3 en mode upload à chaque checkpoint', 'Mesures effectuées'),
      step(4, 'CORRELATE_GPS', 'Corréler avec la position GPS', 'Données géolocalisées'),
      step(5, 'GENERATE_REPORT', 'Générer le rapport de débit UL', 'Rapport généré'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_iperf_targets', 'dt_radio_thresholds'],
    artifact_policy: VABE_ARTIFACT_POLICY,
    kpi_thresholds: { throughput_ul_min_mbps: 5 },
  },
  {
    template_id: 'dt-vabe-004',
    scenario_code: 'DT-VABE-004',
    test_type: 'VABE',
    name: 'Coverage Mapping (RSRP/SINR)',
    description: 'Cartographier la couverture radio sur le parcours.',
    steps: [
      step(1, 'START_COLLECTION', 'Démarrer la collecte radio continue', 'Collecte active'),
      step(2, 'DRIVE_ROUTE', 'Parcourir la route complète', 'Route parcourue'),
      step(3, 'COLLECT_SAMPLES', 'Collecter RSRP/RSRQ/SINR toutes les secondes', 'Échantillons collectés'),
      step(4, 'GENERATE_MAP', 'Générer la carte de couverture GeoJSON', 'Carte générée'),
      step(5, 'IDENTIFY_GAPS', 'Identifier les zones de faible couverture', 'Zones identifiées'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_radio_thresholds', 'dt_reporting_profile'],
    artifact_policy: VABE_ARTIFACT_POLICY,
    kpi_thresholds: { rsrp_min_dbm: -100, sinr_min_db: 5 },
  },
  {
    template_id: 'dt-vabe-005',
    scenario_code: 'DT-VABE-005',
    test_type: 'VABE',
    name: '5G SA vs NSA Comparison',
    description: 'Comparer les performances 5G SA et NSA sur le même parcours.',
    steps: [
      step(1, 'CONFIGURE_SA', 'Configurer le terminal en mode 5G SA', 'Mode SA activé'),
      step(2, 'RUN_BENCH_SA', 'Exécuter le benchmark complet (débit/latence)', 'Résultats SA collectés'),
      step(3, 'CONFIGURE_NSA', 'Reconfigurer en mode 5G NSA', 'Mode NSA activé'),
      step(4, 'RUN_BENCH_NSA', 'Exécuter le même benchmark', 'Résultats NSA collectés'),
      step(5, 'COMPARE', 'Comparer les résultats SA vs NSA', 'Rapport comparatif généré'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_route_geojson', 'dt_device_profile', 'dt_iperf_targets', 'dt_radio_thresholds'],
    artifact_policy: VABE_ARTIFACT_POLICY,
    kpi_thresholds: { throughput_dl_min_mbps: 50 },
  },
  {
    template_id: 'dt-vabe-006',
    scenario_code: 'DT-VABE-006',
    test_type: 'VABE',
    name: 'VoLTE Quality Benchmark',
    description: 'Benchmark complet de la qualité VoLTE : MOS, setup time, jitter audio.',
    steps: [
      step(1, 'SETUP_CALLS', 'Préparer 10 appels VoLTE séquentiels', 'Configuration prête'),
      step(2, 'EXECUTE_CALLS', 'Exécuter les 10 appels (30s chacun)', 'Appels effectués'),
      step(3, 'MEASURE_MOS', 'Mesurer le MOS pour chaque appel', 'MOS enregistré'),
      step(4, 'MEASURE_SETUP', 'Mesurer le temps de setup pour chaque appel', 'Setup times enregistrés'),
      step(5, 'STATISTICAL_REPORT', 'Générer le rapport statistique (min/max/avg/p95)', 'Rapport généré'),
    ],
    required_dataset_types: ['dt_campaign_config', 'dt_device_profile', 'dt_capture_policy', 'dt_radio_thresholds'],
    artifact_policy: [...VABE_ARTIFACT_POLICY, 'sip_trace'],
    kpi_thresholds: { volte_mos_min: 3.5, volte_setup_time_max_ms: 3000 },
  },
];
