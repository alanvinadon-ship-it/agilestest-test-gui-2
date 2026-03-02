/**
 * profileDomains.ts — Configuration Domain-first pour les profils de test.
 *
 * Hiérarchie : Domain → ProfileType → ConfigTemplate
 *
 * Règles :
 * - Un profil appartient à 1 domaine unique
 * - Les types sont filtrés par domaine
 * - Les champs de config sont dynamiques par type
 * - Le backend refuse toute création incohérente
 */

import type { LucideIcon } from 'lucide-react';
import {
  Globe, Code, Smartphone, Monitor, Phone, Radio, Server,
  Car, BarChart3, MapPin, FileText, Layers, Wifi, Zap,
  Shield, Play, Network, Cpu, Database, TestTube, Eye,
  Terminal, Settings2, Workflow
} from 'lucide-react';

// ─── Profile Domain ────────────────────────────────────────────────────────

export type ProfileDomain =
  | 'WEB'
  | 'API'
  | 'MOBILE'
  | 'DESKTOP'
  | 'TELECOM_IMS'
  | 'TELECOM_RAN'
  | 'TELECOM_EPC'
  | 'TELECOM_5GC'
  | 'DRIVE_TEST';

// ─── Profile Type ──────────────────────────────────────────────────────────

export type ProfileType =
  // WEB
  | 'UI_E2E'
  | 'UI_KEYWORD'
  | 'VISUAL_CHECK'
  // API
  | 'REST'
  | 'SOAP'
  | 'GRPC'
  // MOBILE
  | 'APPIUM'
  | 'ADB_TASKS'
  // DESKTOP
  | 'WINAPPDRIVER'
  | 'PLAYWRIGHT_ELECTRON'
  // TELECOM_IMS
  | 'SIP'
  | 'IMS_REG'
  | 'IMS_CALL'
  // TELECOM_EPC
  | 'ATTACH'
  | 'BEARER'
  | 'SESSION'
  // TELECOM_5GC
  | 'REGISTRATION'
  | 'PDU_SESSION'
  | 'SBI'
  // DRIVE_TEST
  | 'LOG_IMPORT'
  | 'KPI_ANALYSIS'
  | 'GEO_TRACE';

// ─── Domain Metadata ───────────────────────────────────────────────────────

export interface DomainMeta {
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  color: string;       // Tailwind color class prefix (e.g. 'blue')
  bgClass: string;     // Badge background
  textClass: string;   // Badge text
  borderClass: string; // Badge border
}

export const DOMAIN_META: Record<ProfileDomain, DomainMeta> = {
  WEB: {
    label: 'Web',
    shortLabel: 'WEB',
    description: 'Tests d\'interfaces web (E2E, keyword, visuel)',
    icon: Globe,
    color: 'blue',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/20',
  },
  API: {
    label: 'API',
    shortLabel: 'API',
    description: 'Tests d\'APIs REST, SOAP et gRPC',
    icon: Code,
    color: 'green',
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/20',
  },
  MOBILE: {
    label: 'Mobile',
    shortLabel: 'MOBILE',
    description: 'Tests d\'applications mobiles (Android-first)',
    icon: Smartphone,
    color: 'violet',
    bgClass: 'bg-violet-500/10',
    textClass: 'text-violet-400',
    borderClass: 'border-violet-500/20',
  },
  DESKTOP: {
    label: 'Desktop',
    shortLabel: 'DESKTOP',
    description: 'Tests d\'applications bureau (Windows, Electron)',
    icon: Monitor,
    color: 'slate',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/20',
  },
  TELECOM_IMS: {
    label: 'Télécom IMS',
    shortLabel: 'IMS',
    description: 'Tests IMS : SIP, enregistrement, appels',
    icon: Phone,
    color: 'purple',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/20',
  },
  TELECOM_RAN: {
    label: 'Télécom RAN',
    shortLabel: 'RAN',
    description: 'Tests réseau d\'accès radio',
    icon: Radio,
    color: 'orange',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/20',
  },
  TELECOM_EPC: {
    label: 'Télécom EPC',
    shortLabel: 'EPC',
    description: 'Tests cœur de réseau EPC (Attach, Bearer, Session)',
    icon: Server,
    color: 'red',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/20',
  },
  TELECOM_5GC: {
    label: 'Télécom 5G Core',
    shortLabel: '5GC',
    description: 'Tests 5G Core (Registration, PDU Session, SBI)',
    icon: Zap,
    color: 'indigo',
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/20',
  },
  DRIVE_TEST: {
    label: 'Drive Test',
    shortLabel: 'DT',
    description: 'Import de logs, analyse KPI, traces géo',
    icon: Car,
    color: 'amber',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/20',
  },
};

// ─── Profile Type Metadata ─────────────────────────────────────────────────

export interface ProfileTypeMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  domain: ProfileDomain;
}

export const PROFILE_TYPE_META: Record<ProfileType, ProfileTypeMeta> = {
  // WEB
  UI_E2E: { label: 'UI End-to-End', description: 'Tests E2E avec Playwright', icon: Play, domain: 'WEB' },
  UI_KEYWORD: { label: 'UI Keyword', description: 'Tests keyword-driven avec Robot Framework', icon: Terminal, domain: 'WEB' },
  VISUAL_CHECK: { label: 'Visual Check', description: 'Vérification visuelle (screenshots, diff)', icon: Eye, domain: 'WEB' },
  // API
  REST: { label: 'REST API', description: 'Tests REST avec k6 ou Newman', icon: Code, domain: 'API' },
  SOAP: { label: 'SOAP API', description: 'Tests SOAP/XML', icon: FileText, domain: 'API' },
  GRPC: { label: 'gRPC', description: 'Tests gRPC/Protobuf', icon: Zap, domain: 'API' },
  // MOBILE
  APPIUM: { label: 'Appium', description: 'Tests mobiles Android-first avec Appium', icon: Smartphone, domain: 'MOBILE' },
  ADB_TASKS: { label: 'ADB Tasks', description: 'Tâches ADB (install, push, shell)', icon: Terminal, domain: 'MOBILE' },
  // DESKTOP
  WINAPPDRIVER: { label: 'WinAppDriver', description: 'Tests Windows Desktop', icon: Monitor, domain: 'DESKTOP' },
  PLAYWRIGHT_ELECTRON: { label: 'Playwright Electron', description: 'Tests Electron avec Playwright', icon: Play, domain: 'DESKTOP' },
  // TELECOM_IMS
  SIP: { label: 'SIP', description: 'Session Initiation Protocol', icon: Phone, domain: 'TELECOM_IMS' },
  IMS_REG: { label: 'IMS Registration', description: 'Enregistrement IMS (REGISTER)', icon: Shield, domain: 'TELECOM_IMS' },
  IMS_CALL: { label: 'IMS Call', description: 'Appel IMS (INVITE/BYE)', icon: Phone, domain: 'TELECOM_IMS' },
  // TELECOM_EPC
  ATTACH: { label: 'Attach', description: 'Procédure Attach EPC', icon: Network, domain: 'TELECOM_EPC' },
  BEARER: { label: 'Bearer', description: 'Gestion Bearer EPC', icon: Layers, domain: 'TELECOM_EPC' },
  SESSION: { label: 'Session', description: 'Session EPC', icon: Workflow, domain: 'TELECOM_EPC' },
  // TELECOM_5GC
  REGISTRATION: { label: 'Registration', description: 'Enregistrement 5G', icon: Shield, domain: 'TELECOM_5GC' },
  PDU_SESSION: { label: 'PDU Session', description: 'Session PDU 5G', icon: Database, domain: 'TELECOM_5GC' },
  SBI: { label: 'SBI', description: 'Service-Based Interface 5G', icon: Cpu, domain: 'TELECOM_5GC' },
  // DRIVE_TEST
  LOG_IMPORT: { label: 'Log Import', description: 'Import de fichiers de logs drive test', icon: FileText, domain: 'DRIVE_TEST' },
  KPI_ANALYSIS: { label: 'KPI Analysis', description: 'Analyse KPI réseau', icon: BarChart3, domain: 'DRIVE_TEST' },
  GEO_TRACE: { label: 'Geo Trace', description: 'Traces géolocalisées', icon: MapPin, domain: 'DRIVE_TEST' },
};

// ─── Domain → Allowed Types Mapping ────────────────────────────────────────

export const ALLOWED_TYPES: Record<ProfileDomain, ProfileType[]> = {
  WEB: ['UI_E2E', 'UI_KEYWORD', 'VISUAL_CHECK'],
  API: ['REST', 'SOAP', 'GRPC'],
  MOBILE: ['APPIUM', 'ADB_TASKS'],
  DESKTOP: ['WINAPPDRIVER', 'PLAYWRIGHT_ELECTRON'],
  TELECOM_IMS: ['SIP', 'IMS_REG', 'IMS_CALL'],
  TELECOM_RAN: [],
  TELECOM_EPC: ['ATTACH', 'BEARER', 'SESSION'],
  TELECOM_5GC: ['REGISTRATION', 'PDU_SESSION', 'SBI'],
  DRIVE_TEST: ['LOG_IMPORT', 'KPI_ANALYSIS', 'GEO_TRACE'],
};

// ─── Project Domain → Profile Domains Mapping ──────────────────────────────
// Maps the project's domain field to the allowed ProfileDomains

export function getEnabledDomains(projectDomain: string): ProfileDomain[] {
  const map: Record<string, ProfileDomain[]> = {
    WEB: ['WEB', 'API'],
    API: ['API'],
    IMS: ['TELECOM_IMS'],
    RAN: ['TELECOM_RAN'],
    EPC: ['TELECOM_EPC'],
    '5GC': ['TELECOM_5GC'],
    MOBILE: ['MOBILE'],
    DESKTOP: ['DESKTOP'],
    DRIVE_TEST: ['DRIVE_TEST'],
  };
  return map[projectDomain] || ['WEB'];
}

// ─── Config Field Definitions ──────────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'tags';

export interface ConfigField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: { value: string; label: string }[];
  helpText?: string;
}

export const CONFIG_TEMPLATES: Record<ProfileType, ConfigField[]> = {
  // ─── WEB ───────────────────────────────────────────────────────────────
  UI_E2E: [
    { key: 'sut_url', label: 'URL du SUT', type: 'text', placeholder: 'https://app.example.com', required: true },
    { key: 'base_path', label: 'Base Path', type: 'text', placeholder: '/', defaultValue: '/' },
    { key: 'auth_mode', label: 'Mode d\'authentification', type: 'select', options: [
      { value: 'none', label: 'Aucun' },
      { value: 'basic', label: 'Basic Auth' },
      { value: 'bearer', label: 'Bearer Token' },
      { value: 'oauth2', label: 'OAuth2' },
      { value: 'cookie', label: 'Cookie Session' },
    ], defaultValue: 'none' },
    { key: 'default_viewport', label: 'Viewport par défaut', type: 'select', options: [
      { value: '1920x1080', label: '1920×1080 (Desktop)' },
      { value: '1366x768', label: '1366×768 (Laptop)' },
      { value: '375x812', label: '375×812 (iPhone X)' },
      { value: '360x640', label: '360×640 (Android)' },
    ], defaultValue: '1920x1080' },
    { key: 'browser', label: 'Navigateur', type: 'select', options: [
      { value: 'chromium', label: 'Chromium' },
      { value: 'firefox', label: 'Firefox' },
      { value: 'webkit', label: 'WebKit' },
    ], defaultValue: 'chromium' },
    { key: 'headless', label: 'Mode headless', type: 'checkbox', defaultValue: true },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '30000', defaultValue: 30000 },
  ],
  UI_KEYWORD: [
    { key: 'sut_url', label: 'URL du SUT', type: 'text', placeholder: 'https://app.example.com', required: true },
    { key: 'library', label: 'Librairie Robot', type: 'select', options: [
      { value: 'SeleniumLibrary', label: 'SeleniumLibrary' },
      { value: 'Browser', label: 'Browser (Playwright)' },
    ], defaultValue: 'Browser' },
    { key: 'browser', label: 'Navigateur', type: 'select', options: [
      { value: 'chromium', label: 'Chromium' },
      { value: 'firefox', label: 'Firefox' },
    ], defaultValue: 'chromium' },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '30000', defaultValue: 30000 },
  ],
  VISUAL_CHECK: [
    { key: 'sut_url', label: 'URL du SUT', type: 'text', placeholder: 'https://app.example.com', required: true },
    { key: 'baseline_dir', label: 'Répertoire baseline', type: 'text', placeholder: '/baselines', defaultValue: '/baselines' },
    { key: 'threshold', label: 'Seuil de diff (%)', type: 'number', placeholder: '5', defaultValue: 5 },
    { key: 'viewport', label: 'Viewport', type: 'text', placeholder: '1920x1080', defaultValue: '1920x1080' },
  ],

  // ─── API ───────────────────────────────────────────────────────────────
  REST: [
    { key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com/v1', required: true },
    { key: 'auth_mode', label: 'Authentification', type: 'select', options: [
      { value: 'none', label: 'Aucune' },
      { value: 'basic', label: 'Basic Auth' },
      { value: 'bearer', label: 'Bearer Token' },
      { value: 'api_key', label: 'API Key (header)' },
      { value: 'oauth2_cc', label: 'OAuth2 Client Credentials' },
    ], defaultValue: 'none' },
    { key: 'auth_header', label: 'Header d\'auth', type: 'text', placeholder: 'Authorization', helpText: 'Nom du header (si API Key)' },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '10000', defaultValue: 10000 },
    { key: 'verify_tls', label: 'Vérifier TLS', type: 'checkbox', defaultValue: true },
    { key: 'content_type', label: 'Content-Type', type: 'select', options: [
      { value: 'application/json', label: 'JSON' },
      { value: 'application/xml', label: 'XML' },
      { value: 'multipart/form-data', label: 'Multipart' },
    ], defaultValue: 'application/json' },
  ],
  SOAP: [
    { key: 'wsdl_url', label: 'URL WSDL', type: 'text', placeholder: 'https://api.example.com/service?wsdl', required: true },
    { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://api.example.com/service' },
    { key: 'soap_version', label: 'Version SOAP', type: 'select', options: [
      { value: '1.1', label: 'SOAP 1.1' },
      { value: '1.2', label: 'SOAP 1.2' },
    ], defaultValue: '1.1' },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '10000', defaultValue: 10000 },
  ],
  GRPC: [
    { key: 'host', label: 'Hôte gRPC', type: 'text', placeholder: 'api.example.com', required: true },
    { key: 'port', label: 'Port', type: 'number', placeholder: '443', defaultValue: 443 },
    { key: 'tls', label: 'TLS activé', type: 'checkbox', defaultValue: true },
    { key: 'proto_path', label: 'Chemin .proto', type: 'text', placeholder: '/protos/service.proto' },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '10000', defaultValue: 10000 },
  ],

  // ─── MOBILE ────────────────────────────────────────────────────────────
  APPIUM: [
    { key: 'platform', label: 'Plateforme', type: 'select', options: [
      { value: 'android', label: 'Android' },
      { value: 'ios', label: 'iOS' },
    ], defaultValue: 'android', required: true },
    { key: 'device_name', label: 'Nom du device', type: 'text', placeholder: 'Pixel 6', required: true },
    { key: 'app_package', label: 'Package / Bundle ID', type: 'text', placeholder: 'com.example.app', required: true },
    { key: 'appium_server', label: 'Serveur Appium', type: 'text', placeholder: 'http://localhost:4723', defaultValue: 'http://localhost:4723' },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '30000', defaultValue: 30000 },
  ],
  ADB_TASKS: [
    { key: 'device_serial', label: 'Série du device', type: 'text', placeholder: 'emulator-5554', required: true },
    { key: 'adb_host', label: 'Hôte ADB', type: 'text', placeholder: 'localhost', defaultValue: 'localhost' },
    { key: 'adb_port', label: 'Port ADB', type: 'number', placeholder: '5037', defaultValue: 5037 },
  ],

  // ─── DESKTOP ───────────────────────────────────────────────────────────
  WINAPPDRIVER: [
    { key: 'app_path', label: 'Chemin de l\'application', type: 'text', placeholder: 'C:\\Program Files\\App\\app.exe', required: true },
    { key: 'winappdriver_url', label: 'URL WinAppDriver', type: 'text', placeholder: 'http://127.0.0.1:4723', defaultValue: 'http://127.0.0.1:4723' },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '30000', defaultValue: 30000 },
  ],
  PLAYWRIGHT_ELECTRON: [
    { key: 'app_path', label: 'Chemin Electron', type: 'text', placeholder: '/usr/bin/electron-app', required: true },
    { key: 'headless', label: 'Mode headless', type: 'checkbox', defaultValue: false },
    { key: 'timeout_ms', label: 'Timeout (ms)', type: 'number', placeholder: '30000', defaultValue: 30000 },
  ],

  // ─── TELECOM_IMS ───────────────────────────────────────────────────────
  SIP: [
    { key: 'target_host', label: 'Hôte SIP (P-CSCF)', type: 'text', placeholder: '10.0.0.1', required: true },
    { key: 'port', label: 'Port', type: 'number', placeholder: '5060', defaultValue: 5060 },
    { key: 'transport', label: 'Transport', type: 'select', options: [
      { value: 'udp', label: 'UDP' },
      { value: 'tcp', label: 'TCP' },
      { value: 'tls', label: 'TLS' },
    ], defaultValue: 'udp' },
    { key: 'realm', label: 'Realm', type: 'text', placeholder: 'ims.orange.ci' },
    { key: 'impu', label: 'IMPU', type: 'text', placeholder: 'sip:user@ims.orange.ci' },
    { key: 'impi', label: 'IMPI', type: 'text', placeholder: 'user@ims.orange.ci' },
  ],
  IMS_REG: [
    { key: 'target_host', label: 'Hôte P-CSCF', type: 'text', placeholder: '10.0.0.1', required: true },
    { key: 'port', label: 'Port', type: 'number', placeholder: '5060', defaultValue: 5060 },
    { key: 'transport', label: 'Transport', type: 'select', options: [
      { value: 'udp', label: 'UDP' }, { value: 'tcp', label: 'TCP' }, { value: 'tls', label: 'TLS' },
    ], defaultValue: 'udp' },
    { key: 'realm', label: 'Realm', type: 'text', placeholder: 'ims.orange.ci' },
    { key: 'reg_expires', label: 'Expires (sec)', type: 'number', placeholder: '3600', defaultValue: 3600 },
  ],
  IMS_CALL: [
    { key: 'target_host', label: 'Hôte P-CSCF', type: 'text', placeholder: '10.0.0.1', required: true },
    { key: 'port', label: 'Port', type: 'number', placeholder: '5060', defaultValue: 5060 },
    { key: 'transport', label: 'Transport', type: 'select', options: [
      { value: 'udp', label: 'UDP' }, { value: 'tcp', label: 'TCP' }, { value: 'tls', label: 'TLS' },
    ], defaultValue: 'udp' },
    { key: 'caller_uri', label: 'URI appelant', type: 'text', placeholder: 'sip:a@ims.orange.ci' },
    { key: 'callee_uri', label: 'URI appelé', type: 'text', placeholder: 'sip:b@ims.orange.ci' },
    { key: 'codec', label: 'Codec', type: 'select', options: [
      { value: 'PCMU', label: 'G.711 µ-law' }, { value: 'PCMA', label: 'G.711 A-law' }, { value: 'AMR', label: 'AMR' },
    ], defaultValue: 'PCMU' },
  ],

  // ─── TELECOM_EPC ───────────────────────────────────────────────────────
  ATTACH: [
    { key: 'mme_host', label: 'Hôte MME', type: 'text', placeholder: '10.0.0.10', required: true },
    { key: 'mme_port', label: 'Port', type: 'number', placeholder: '36412', defaultValue: 36412 },
    { key: 'imsi', label: 'IMSI', type: 'text', placeholder: '208930000000001' },
    { key: 'apn', label: 'APN', type: 'text', placeholder: 'internet', defaultValue: 'internet' },
  ],
  BEARER: [
    { key: 'pgw_host', label: 'Hôte P-GW', type: 'text', placeholder: '10.0.0.20', required: true },
    { key: 'pgw_port', label: 'Port', type: 'number', placeholder: '2123', defaultValue: 2123 },
    { key: 'bearer_qci', label: 'QCI', type: 'number', placeholder: '9', defaultValue: 9 },
    { key: 'apn', label: 'APN', type: 'text', placeholder: 'internet', defaultValue: 'internet' },
  ],
  SESSION: [
    { key: 'sgw_host', label: 'Hôte S-GW', type: 'text', placeholder: '10.0.0.15', required: true },
    { key: 'sgw_port', label: 'Port', type: 'number', placeholder: '2123', defaultValue: 2123 },
    { key: 'session_type', label: 'Type de session', type: 'select', options: [
      { value: 'default', label: 'Default Bearer' }, { value: 'dedicated', label: 'Dedicated Bearer' },
    ], defaultValue: 'default' },
  ],

  // ─── TELECOM_5GC ───────────────────────────────────────────────────────
  REGISTRATION: [
    { key: 'amf_host', label: 'Hôte AMF', type: 'text', placeholder: '10.0.0.30', required: true },
    { key: 'amf_port', label: 'Port', type: 'number', placeholder: '38412', defaultValue: 38412 },
    { key: 'supi', label: 'SUPI', type: 'text', placeholder: 'imsi-208930000000001' },
    { key: 'plmn', label: 'PLMN', type: 'text', placeholder: '20893', defaultValue: '20893' },
  ],
  PDU_SESSION: [
    { key: 'smf_host', label: 'Hôte SMF', type: 'text', placeholder: '10.0.0.31', required: true },
    { key: 'smf_port', label: 'Port', type: 'number', placeholder: '29502', defaultValue: 29502 },
    { key: 'dnn', label: 'DNN', type: 'text', placeholder: 'internet', defaultValue: 'internet' },
    { key: 'sst', label: 'SST (S-NSSAI)', type: 'number', placeholder: '1', defaultValue: 1 },
    { key: 'sd', label: 'SD (S-NSSAI)', type: 'text', placeholder: '000001' },
  ],
  SBI: [
    { key: 'nrf_url', label: 'URL NRF', type: 'text', placeholder: 'https://nrf.5gc.local:29510', required: true },
    { key: 'service', label: 'Service NF', type: 'select', options: [
      { value: 'namf', label: 'AMF (Namf)' },
      { value: 'nsmf', label: 'SMF (Nsmf)' },
      { value: 'nudm', label: 'UDM (Nudm)' },
      { value: 'nausf', label: 'AUSF (Nausf)' },
      { value: 'npcf', label: 'PCF (Npcf)' },
    ], defaultValue: 'namf' },
    { key: 'api_version', label: 'Version API', type: 'text', placeholder: 'v1', defaultValue: 'v1' },
    { key: 'verify_tls', label: 'Vérifier TLS', type: 'checkbox', defaultValue: true },
  ],

  // ─── DRIVE_TEST ────────────────────────────────────────────────────────
  LOG_IMPORT: [
    { key: 'log_format', label: 'Format de log', type: 'select', options: [
      { value: 'tems', label: 'TEMS' },
      { value: 'nemo', label: 'Nemo Outdoor' },
      { value: 'actix', label: 'Actix Analyzer' },
      { value: 'csv', label: 'CSV générique' },
    ], required: true },
    { key: 'import_path', label: 'Chemin d\'import', type: 'text', placeholder: '/data/drive-test/' },
  ],
  KPI_ANALYSIS: [
    { key: 'kpi_set', label: 'Jeu de KPI', type: 'select', options: [
      { value: 'voice', label: 'Voix (CSSR, DCR, HOSR)' },
      { value: 'data', label: 'Data (Throughput, Latency)' },
      { value: 'coverage', label: 'Couverture (RSRP, RSRQ, SINR)' },
    ], required: true },
    { key: 'threshold_file', label: 'Fichier de seuils', type: 'text', placeholder: '/config/thresholds.yaml' },
  ],
  GEO_TRACE: [
    { key: 'map_provider', label: 'Fournisseur de carte', type: 'select', options: [
      { value: 'osm', label: 'OpenStreetMap' },
      { value: 'google', label: 'Google Maps' },
    ], defaultValue: 'osm' },
    { key: 'trace_format', label: 'Format de trace', type: 'select', options: [
      { value: 'kml', label: 'KML' },
      { value: 'gpx', label: 'GPX' },
      { value: 'geojson', label: 'GeoJSON' },
    ], defaultValue: 'kml' },
  ],
};

// ─── Validation Helpers ────────────────────────────────────────────────────

/**
 * Valide qu'un type de profil est autorisé pour un domaine donné.
 */
export function isTypeAllowedForDomain(domain: ProfileDomain, type: ProfileType): boolean {
  return ALLOWED_TYPES[domain]?.includes(type) ?? false;
}

/**
 * Valide qu'un domaine de profil est autorisé pour un projet donné.
 */
export function isDomainAllowedForProject(projectDomain: string, profileDomain: ProfileDomain): boolean {
  return getEnabledDomains(projectDomain).includes(profileDomain);
}

/**
 * Valide la configuration d'un profil selon son type.
 * Retourne un tableau d'erreurs (vide si valide).
 */
export function validateConfig(type: ProfileType, config: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const fields = CONFIG_TEMPLATES[type] || [];
  for (const field of fields) {
    if (field.required) {
      const val = config[field.key];
      if (val === undefined || val === null || val === '') {
        errors.push(`Le champ "${field.label}" est requis.`);
      }
    }
  }
  return errors;
}

/**
 * Génère une configuration par défaut pour un type de profil.
 */
export function getDefaultConfig(type: ProfileType): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const fields = CONFIG_TEMPLATES[type] || [];
  for (const field of fields) {
    if (field.defaultValue !== undefined) {
      config[field.key] = field.defaultValue;
    }
  }
  return config;
}

/**
 * Migre un ancien profil (protocol-based) vers le nouveau modèle domain-first.
 */
export function migrateOldProfile(protocol: string): { domain: ProfileDomain; type: ProfileType } {
  const map: Record<string, { domain: ProfileDomain; type: ProfileType }> = {
    SIP: { domain: 'TELECOM_IMS', type: 'SIP' },
    IMS: { domain: 'TELECOM_IMS', type: 'IMS_REG' },
    DIAMETER: { domain: 'TELECOM_EPC', type: 'ATTACH' },
    HTTP2: { domain: 'API', type: 'REST' },
    WEB: { domain: 'WEB', type: 'UI_E2E' },
    CUSTOM: { domain: 'API', type: 'REST' },
  };
  return map[protocol] || { domain: 'WEB', type: 'UI_E2E' };
}
