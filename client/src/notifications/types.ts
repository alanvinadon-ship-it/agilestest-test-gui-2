/**
 * ADMIN-NOTIFICATIONS-1 — Types et modèles pour le système de notifications
 *
 * Couvre :
 * - NotificationSettings (SMS Orange + Email SMTP)
 * - NotificationTemplate (templates réutilisables)
 * - NotificationRule (event → notification)
 * - NotificationDeliveryLog (journal d'envoi)
 * - NotificationsDispatcher (moteur de rendu + envoi)
 */

// ─── Enums ──────────────────────────────────────────────────────────────

export type SmsProvider = 'NONE' | 'ORANGE';
export type EmailProvider = 'NONE' | 'SMTP';
export type SmsAuthMode = 'OAUTH2_CLIENT_CREDENTIALS' | 'API_KEY';
export type SmtpSecureMode = 'NONE' | 'STARTTLS' | 'TLS';
export type NotificationChannel = 'SMS' | 'EMAIL';
export type TemplateStatus = 'ACTIVE' | 'DISABLED';

export type NotificationEventType =
  | 'USER_INVITED'
  | 'INVITE_ACCEPTED'
  | 'EXECUTION_PASSED'
  | 'EXECUTION_FAILED'
  | 'INCIDENT_CREATED'
  | 'REPAIR_PROPOSED'
  | 'DRIVE_KPI_THRESHOLD_BREACH';

export type RecipientType =
  | 'ACTOR'
  | 'TARGET_USER'
  | 'PROJECT_MEMBERS'
  | 'PROJECT_ADMINS'
  | 'GLOBAL_ADMINS'
  | 'CUSTOM';

export type DeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED' | 'THROTTLED';

// ─── SMS Settings ───────────────────────────────────────────────────────

export interface SmsSettings {
  provider: SmsProvider;
  enabled: boolean;
  from_sender_id: string | null;
  base_url: string;
  auth_mode: SmsAuthMode;
  client_id: string | null;       // secret — masked in GET
  client_secret: string | null;   // secret — masked in GET
  api_key: string | null;         // secret — masked in GET
  token_url: string | null;
  scope: string | null;
  timeout_ms: number;
}

export interface SmsSettingsMasked extends Omit<SmsSettings, 'client_id' | 'client_secret' | 'api_key'> {
  client_id: string | null;       // '********' if set
  client_secret: string | null;   // '********' if set
  api_key: string | null;         // '********' if set
  _has_client_id: boolean;
  _has_client_secret: boolean;
  _has_api_key: boolean;
}

// ─── Email Settings ─────────────────────────────────────────────────────

export interface EmailSettings {
  provider: EmailProvider;
  enabled: boolean;
  host: string;
  port: number;
  secure: SmtpSecureMode;
  username: string | null;        // secret
  password: string | null;        // secret
  from_email: string;
  from_name: string | null;
  reply_to: string | null;
  timeout_ms: number;
}

export interface EmailSettingsMasked extends Omit<EmailSettings, 'username' | 'password'> {
  username: string | null;        // '********' if set
  password: string | null;        // '********' if set
  _has_username: boolean;
  _has_password: boolean;
}

// ─── Unified NotificationSettings ───────────────────────────────────────

export interface NotificationSettings {
  sms: SmsSettings;
  email: EmailSettings;
  updated_at: string;
  updated_by: string;
}

export interface NotificationSettingsMasked {
  sms: SmsSettingsMasked;
  email: EmailSettingsMasked;
  updated_at: string;
  updated_by: string;
}

// ─── Test Send ──────────────────────────────────────────────────────────

export interface TestSmsRequest {
  to_msisdn: string;
  message: string;
}

export interface TestEmailRequest {
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
}

export interface TestSendResult {
  status: 'OK' | 'ERROR';
  provider_response?: string;
  error_message?: string;
  trace_id: string;
  duration_ms: number;
}

// ─── Notification Template ──────────────────────────────────────────────

export interface TemplateVariable {
  name: string;        // e.g. 'actor.name'
  description: string;
  example: string;
}

export interface NotificationTemplate {
  template_id: string;           // slug, e.g. 'invite_user_email'
  channel: NotificationChannel;
  name: string;
  description: string;
  subject: string | null;        // EMAIL only
  body_text: string;
  body_html: string | null;      // EMAIL only, optional
  variables_schema: TemplateVariable[];
  is_system: boolean;
  status: TemplateStatus;
  updated_at: string;
  updated_by: string;
}

// ─── Notification Rule ──────────────────────────────────────────────────

export interface ThrottlePolicy {
  max_per_hour: number;
  dedup_window_min: number;
}

export interface NotificationRule {
  rule_id: string;               // slug, e.g. 'on_execution_failed'
  event_type: NotificationEventType;
  enabled: boolean;
  channels_enabled: NotificationChannel[];
  template_sms_id: string | null;
  template_email_id: string | null;
  recipients: RecipientType[];
  custom_recipients_emails: string[];
  custom_recipients_msisdn: string[];
  throttle_policy: ThrottlePolicy;
  updated_at: string;
  updated_by: string;
}

// ─── Delivery Log ───────────────────────────────────────────────────────

export interface NotificationDeliveryLog {
  delivery_id: string;
  ts: string;
  channel: NotificationChannel;
  provider: 'ORANGE' | 'SMTP' | 'STUB';
  event_type: NotificationEventType;
  rule_id: string;
  template_id: string;
  recipient: string;             // email or msisdn
  status: DeliveryStatus;
  error_message: string | null;
  trace_id: string;
  metadata: Record<string, string>;  // project_id, execution_id, etc.
}

// ─── Dispatcher context ─────────────────────────────────────────────────

export interface DispatchContext {
  app: { name: string; base_url: string };
  actor?: { name: string; email: string };
  project?: { name: string; id: string };
  execution?: { id: string; scenario_id: string; status: string; trace_id: string };
  incident?: { id: string; summary: string; severity: string };
  drive?: { campaign: string; kpi_name: string; value: string; threshold: string };
  invite?: { link: string; expires_at: string };
  [key: string]: unknown;
}

// ─── Event type labels ──────────────────────────────────────────────────

export const EVENT_TYPE_LABELS: Record<NotificationEventType, string> = {
  USER_INVITED: 'Invitation utilisateur',
  INVITE_ACCEPTED: 'Invitation acceptée',
  EXECUTION_PASSED: 'Exécution réussie',
  EXECUTION_FAILED: 'Exécution échouée',
  INCIDENT_CREATED: 'Incident créé',
  REPAIR_PROPOSED: 'Repair proposé',
  DRIVE_KPI_THRESHOLD_BREACH: 'Seuil KPI Drive dépassé',
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  SMS: 'SMS',
  EMAIL: 'E-mail',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  SENT: 'Envoyé',
  FAILED: 'Échoué',
  SKIPPED: 'Ignoré',
  THROTTLED: 'Limité',
};

export const RECIPIENT_LABELS: Record<RecipientType, string> = {
  ACTOR: 'Acteur (initiateur)',
  TARGET_USER: 'Utilisateur cible',
  PROJECT_MEMBERS: 'Membres du projet',
  PROJECT_ADMINS: 'Admins du projet',
  GLOBAL_ADMINS: 'Admins globaux',
  CUSTOM: 'Liste personnalisée',
};

// ─── Core variables (whitelist) ─────────────────────────────────────────

export const CORE_VARIABLES: TemplateVariable[] = [
  { name: 'app.name', description: 'Nom de l\'application', example: 'AgilesTest' },
  { name: 'app.base_url', description: 'URL de base', example: 'https://agilestest.orange.ci' },
  { name: 'actor.name', description: 'Nom de l\'acteur', example: 'Jean Dupont' },
  { name: 'actor.email', description: 'Email de l\'acteur', example: 'jean@orange.ci' },
  { name: 'project.name', description: 'Nom du projet', example: 'Orange-WEB' },
  { name: 'project.id', description: 'ID du projet', example: 'proj_abc123' },
  { name: 'execution.id', description: 'ID de l\'exécution', example: 'exec_xyz789' },
  { name: 'execution.scenario_id', description: 'ID du scénario', example: 'sc_login_01' },
  { name: 'execution.status', description: 'Statut de l\'exécution', example: 'FAILED' },
  { name: 'execution.trace_id', description: 'Trace ID', example: 'tr_abc123def456' },
  { name: 'incident.id', description: 'ID de l\'incident', example: 'inc_001' },
  { name: 'incident.summary', description: 'Résumé de l\'incident', example: 'Login timeout after 30s' },
  { name: 'incident.severity', description: 'Sévérité', example: 'P1' },
  { name: 'drive.campaign', description: 'Nom de la campagne Drive', example: 'Abidjan-Nord Q1' },
  { name: 'drive.kpi_name', description: 'Nom du KPI', example: 'RSRP' },
  { name: 'drive.value', description: 'Valeur observée', example: '-115 dBm' },
  { name: 'drive.threshold', description: 'Seuil configuré', example: '-110 dBm' },
  { name: 'invite.link', description: 'Lien d\'invitation', example: 'https://agilestest.orange.ci/invite/abc' },
  { name: 'invite.expires_at', description: 'Date d\'expiration', example: '2026-03-01T23:59:59Z' },
];

// ─── Default settings ───────────────────────────────────────────────────

export const DEFAULT_SMS_SETTINGS: SmsSettings = {
  provider: 'NONE',
  enabled: false,
  from_sender_id: null,
  base_url: 'https://api.orange.com/smsmessaging/v1',
  auth_mode: 'OAUTH2_CLIENT_CREDENTIALS',
  client_id: null,
  client_secret: null,
  api_key: null,
  token_url: 'https://api.orange.com/oauth/v1/token',
  scope: null,
  timeout_ms: 10000,
};

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  provider: 'NONE',
  enabled: false,
  host: '',
  port: 587,
  secure: 'STARTTLS',
  username: null,
  password: null,
  from_email: '',
  from_name: 'AgilesTest',
  reply_to: null,
  timeout_ms: 15000,
};
