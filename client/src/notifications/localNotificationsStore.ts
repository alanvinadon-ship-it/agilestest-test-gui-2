/**
 * ADMIN-NOTIFICATIONS-1 — Local store pour le système de notifications
 *
 * Simule le backend :
 * - CRUD settings (masquage secrets)
 * - CRUD templates + preview
 * - CRUD rules
 * - Delivery logs + dispatcher
 * - Test send (stub)
 * - Audit intégré
 */

import type {
  NotificationSettings,
  NotificationSettingsMasked,
  SmsSettingsMasked,
  EmailSettingsMasked,
  NotificationTemplate,
  NotificationRule,
  NotificationDeliveryLog,
  DispatchContext,
  TestSmsRequest,
  TestEmailRequest,
  TestSendResult,
  NotificationEventType,
  NotificationChannel,
  TemplateVariable,
} from './types';
import {
  DEFAULT_SMS_SETTINGS,
  DEFAULT_EMAIL_SETTINGS,
  CORE_VARIABLES,
} from './types';

// ─── Helpers ────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'agilestest_notif_';
const uid = () => `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();
const traceId = () => `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

import { memoryStore } from '../api/memoryStore';

function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = memoryStore.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function setItem<T>(key: string, value: T): void {
  memoryStore.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}

const MASK = '********';

// ─── Settings ───────────────────────────────────────────────────────────

function getSettings(): NotificationSettings {
  return getItem<NotificationSettings>('settings', {
    sms: { ...DEFAULT_SMS_SETTINGS },
    email: { ...DEFAULT_EMAIL_SETTINGS },
    updated_at: now(),
    updated_by: 'system',
  });
}

function maskSettings(s: NotificationSettings): NotificationSettingsMasked {
  const smsMasked: SmsSettingsMasked = {
    ...s.sms,
    client_id: s.sms.client_id ? MASK : null,
    client_secret: s.sms.client_secret ? MASK : null,
    api_key: s.sms.api_key ? MASK : null,
    _has_client_id: !!s.sms.client_id,
    _has_client_secret: !!s.sms.client_secret,
    _has_api_key: !!s.sms.api_key,
  };
  const emailMasked: EmailSettingsMasked = {
    ...s.email,
    username: s.email.username ? MASK : null,
    password: s.email.password ? MASK : null,
    _has_username: !!s.email.username,
    _has_password: !!s.email.password,
  };
  return { sms: smsMasked, email: emailMasked, updated_at: s.updated_at, updated_by: s.updated_by };
}

export const localNotifSettings = {
  get(): NotificationSettingsMasked {
    return maskSettings(getSettings());
  },

  /** Retourne les settings email bruts (non masqués) pour l'envoi SMTP via backend */
  getRawEmailSettings(): NotificationSettings['email'] {
    return getSettings().email;
  },

  update(patch: { sms?: Partial<NotificationSettings['sms']>; email?: Partial<NotificationSettings['email']> }, actor: string): NotificationSettingsMasked {
    const current = getSettings();
    if (patch.sms) {
      // Don't overwrite secrets if masked value sent
      const smsPatch = { ...patch.sms };
      if (smsPatch.client_id === MASK) delete smsPatch.client_id;
      if (smsPatch.client_secret === MASK) delete smsPatch.client_secret;
      if (smsPatch.api_key === MASK) delete smsPatch.api_key;
      current.sms = { ...current.sms, ...smsPatch };
    }
    if (patch.email) {
      const emailPatch = { ...patch.email };
      if (emailPatch.username === MASK) delete emailPatch.username;
      if (emailPatch.password === MASK) delete emailPatch.password;
      current.email = { ...current.email, ...emailPatch };
    }
    current.updated_at = now();
    current.updated_by = actor;
    setItem('settings', current);
    addAudit('notifications_settings_updated', actor, { channels_modified: [patch.sms ? 'SMS' : null, patch.email ? 'EMAIL' : null].filter(Boolean) });
    return maskSettings(current);
  },

  disable(channel: 'sms' | 'email', actor: string): NotificationSettingsMasked {
    const current = getSettings();
    if (channel === 'sms') current.sms.enabled = false;
    else current.email.enabled = false;
    current.updated_at = now();
    current.updated_by = actor;
    setItem('settings', current);
    addAudit('notifications_channel_disabled', actor, { channel });
    return maskSettings(current);
  },

  testSms(req: TestSmsRequest, actor: string): TestSendResult {
    const settings = getSettings();
    const trace = traceId();
    addAudit('notifications_sms_test_sent', actor, { to: req.to_msisdn, trace_id: trace });

    if (!settings.sms.enabled || settings.sms.provider === 'NONE') {
      // Stub mode
      const log: NotificationDeliveryLog = {
        delivery_id: uid(), ts: now(), channel: 'SMS', provider: 'STUB',
        event_type: 'USER_INVITED', rule_id: '_test', template_id: '_test',
        recipient: req.to_msisdn, status: 'SENT', error_message: null,
        trace_id: trace, metadata: { mode: 'stub_test' },
      };
      addDeliveryLog(log);
      return { status: 'OK', provider_response: 'STUB: SMS simulé envoyé', trace_id: trace, duration_ms: 120 };
    }

    // Simulate real provider
    const success = Math.random() > 0.15;
    const log: NotificationDeliveryLog = {
      delivery_id: uid(), ts: now(), channel: 'SMS', provider: 'ORANGE',
      event_type: 'USER_INVITED', rule_id: '_test', template_id: '_test',
      recipient: req.to_msisdn, status: success ? 'SENT' : 'FAILED',
      error_message: success ? null : 'Provider timeout (simulated)',
      trace_id: trace, metadata: { mode: 'test' },
    };
    addDeliveryLog(log);
    return success
      ? { status: 'OK', provider_response: 'Orange API: 201 Created', trace_id: trace, duration_ms: 340 + Math.floor(Math.random() * 200) }
      : { status: 'ERROR', error_message: 'Provider timeout (simulated)', trace_id: trace, duration_ms: 10000 };
  },

  testEmail(req: TestEmailRequest, actor: string): TestSendResult {
    const settings = getSettings();
    const trace = traceId();
    addAudit('notifications_email_test_sent', actor, { to: req.to_email, trace_id: trace });

    if (!settings.email.enabled || settings.email.provider === 'NONE') {
      const log: NotificationDeliveryLog = {
        delivery_id: uid(), ts: now(), channel: 'EMAIL', provider: 'STUB',
        event_type: 'USER_INVITED', rule_id: '_test', template_id: '_test',
        recipient: req.to_email, status: 'SENT', error_message: null,
        trace_id: trace, metadata: { mode: 'stub_test' },
      };
      addDeliveryLog(log);
      return { status: 'OK', provider_response: 'STUB: Email simulé envoyé', trace_id: trace, duration_ms: 85 };
    }

    const success = Math.random() > 0.1;
    const log: NotificationDeliveryLog = {
      delivery_id: uid(), ts: now(), channel: 'EMAIL', provider: 'SMTP',
      event_type: 'USER_INVITED', rule_id: '_test', template_id: '_test',
      recipient: req.to_email, status: success ? 'SENT' : 'FAILED',
      error_message: success ? null : 'SMTP connection refused (simulated)',
      trace_id: trace, metadata: { mode: 'test' },
    };
    addDeliveryLog(log);
    return success
      ? { status: 'OK', provider_response: 'SMTP: 250 OK', trace_id: trace, duration_ms: 450 + Math.floor(Math.random() * 300) }
      : { status: 'ERROR', error_message: 'SMTP connection refused (simulated)', trace_id: trace, duration_ms: 15000 };
  },
};

// ─── Templates ──────────────────────────────────────────────────────────

function getTemplates(): NotificationTemplate[] {
  return getItem<NotificationTemplate[]>('templates', SYSTEM_TEMPLATES);
}

export const localNotifTemplates = {
  list(channel?: NotificationChannel): NotificationTemplate[] {
    const all = getTemplates();
    if (channel) return all.filter(t => t.channel === channel);
    return all;
  },

  get(id: string): NotificationTemplate | undefined {
    return getTemplates().find(t => t.template_id === id);
  },

  create(tpl: Omit<NotificationTemplate, 'updated_at' | 'updated_by'>, actor: string): NotificationTemplate {
    const all = getTemplates();
    if (all.find(t => t.template_id === tpl.template_id)) throw new Error(`Template ${tpl.template_id} existe déjà (409)`);
    const full: NotificationTemplate = { ...tpl, updated_at: now(), updated_by: actor };
    all.push(full);
    setItem('templates', all);
    addAudit('notifications_template_created', actor, { template_id: tpl.template_id });
    return full;
  },

  update(id: string, patch: Partial<NotificationTemplate>, actor: string): NotificationTemplate {
    const all = getTemplates();
    const idx = all.findIndex(t => t.template_id === id);
    if (idx === -1) throw new Error('Template non trouvé (404)');
    all[idx] = { ...all[idx], ...patch, template_id: id, updated_at: now(), updated_by: actor };
    setItem('templates', all);
    addAudit('notifications_template_updated', actor, { template_id: id });
    return all[idx];
  },

  delete(id: string, actor: string): void {
    const all = getTemplates();
    const tpl = all.find(t => t.template_id === id);
    if (!tpl) throw new Error('Template non trouvé (404)');
    if (tpl.is_system) throw new Error('Impossible de supprimer un template système (403)');
    setItem('templates', all.filter(t => t.template_id !== id));
    addAudit('notifications_template_deleted', actor, { template_id: id });
  },

  preview(id: string, context: DispatchContext): { subject: string | null; body_text: string; body_html: string | null } {
    const tpl = localNotifTemplates.get(id);
    if (!tpl) throw new Error('Template non trouvé (404)');
    return {
      subject: tpl.subject ? renderTemplate(tpl.subject, context, tpl.variables_schema) : null,
      body_text: renderTemplate(tpl.body_text, context, tpl.variables_schema),
      body_html: tpl.body_html ? renderTemplate(tpl.body_html, context, tpl.variables_schema) : null,
    };
  },
};

// ─── Rules ──────────────────────────────────────────────────────────────

function getRules(): NotificationRule[] {
  return getItem<NotificationRule[]>('rules', DEFAULT_RULES);
}

export const localNotifRules = {
  list(): NotificationRule[] {
    return getRules();
  },

  get(id: string): NotificationRule | undefined {
    return getRules().find(r => r.rule_id === id);
  },

  update(id: string, patch: Partial<NotificationRule>, actor: string): NotificationRule {
    const all = getRules();
    const idx = all.findIndex(r => r.rule_id === id);
    if (idx === -1) throw new Error('Rule non trouvée (404)');
    all[idx] = { ...all[idx], ...patch, rule_id: id, updated_at: now(), updated_by: actor };
    setItem('rules', all);
    addAudit('notifications_rule_updated', actor, { rule_id: id });
    return all[idx];
  },

  testRule(id: string, context: DispatchContext, actor: string): NotificationDeliveryLog[] {
    const rule = localNotifRules.get(id);
    if (!rule) throw new Error('Rule non trouvée (404)');
    addAudit('notifications_rule_test', actor, { rule_id: id });
    return dispatchForRule(rule, context, true);
  },
};

// ─── Delivery Logs ──────────────────────────────────────────────────────

function getDeliveryLogs(): NotificationDeliveryLog[] {
  return getItem<NotificationDeliveryLog[]>('delivery_logs', []);
}

function addDeliveryLog(log: NotificationDeliveryLog): void {
  const all = getDeliveryLogs();
  all.push(log);
  // Keep max 500 logs
  if (all.length > 500) all.splice(0, all.length - 500);
  setItem('delivery_logs', all);
}

export const localNotifDeliveryLogs = {
  list(filters?: {
    channel?: NotificationChannel;
    event_type?: NotificationEventType;
    status?: string;
    recipient?: string;
    from_date?: string;
    to_date?: string;
  }): NotificationDeliveryLog[] {
    let logs = getDeliveryLogs();
    if (filters?.channel) logs = logs.filter(l => l.channel === filters.channel);
    if (filters?.event_type) logs = logs.filter(l => l.event_type === filters.event_type);
    if (filters?.status) logs = logs.filter(l => l.status === filters.status);
    if (filters?.recipient) logs = logs.filter(l => l.recipient.includes(filters.recipient!));
    if (filters?.from_date) logs = logs.filter(l => l.ts >= filters.from_date!);
    if (filters?.to_date) logs = logs.filter(l => l.ts <= filters.to_date!);
    return logs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  },

  get(id: string): NotificationDeliveryLog | undefined {
    return getDeliveryLogs().find(l => l.delivery_id === id);
  },

  exportCsv(): string {
    const logs = getDeliveryLogs();
    const header = 'delivery_id,ts,channel,provider,event_type,rule_id,template_id,recipient,status,error_message,trace_id';
    const rows = logs.map(l =>
      `${l.delivery_id},${l.ts},${l.channel},${l.provider},${l.event_type},${l.rule_id},${l.template_id},${l.recipient},${l.status},${l.error_message || ''},${l.trace_id}`
    );
    return [header, ...rows].join('\n');
  },
};

// ─── Dispatcher ─────────────────────────────────────────────────────────

function dispatchForRule(rule: NotificationRule, context: DispatchContext, isTest: boolean): NotificationDeliveryLog[] {
  const logs: NotificationDeliveryLog[] = [];
  const settings = getSettings();

  for (const channel of rule.channels_enabled) {
    const templateId = channel === 'SMS' ? rule.template_sms_id : rule.template_email_id;
    if (!templateId) continue;

    const tpl = localNotifTemplates.get(templateId);
    if (!tpl || tpl.status === 'DISABLED') continue;

    // Resolve recipients (simplified for demo)
    const recipients: string[] = [];
    for (const rt of rule.recipients) {
      switch (rt) {
        case 'ACTOR':
          if (channel === 'EMAIL' && context.actor?.email) recipients.push(context.actor.email);
          break;
        case 'TARGET_USER':
          if (channel === 'EMAIL' && context.actor?.email) recipients.push(context.actor.email);
          break;
        case 'GLOBAL_ADMINS':
          if (channel === 'EMAIL') recipients.push('admin@agilestest.io');
          if (channel === 'SMS') recipients.push('+2250700000000');
          break;
        case 'CUSTOM':
          if (channel === 'EMAIL') recipients.push(...rule.custom_recipients_emails);
          if (channel === 'SMS') recipients.push(...rule.custom_recipients_msisdn);
          break;
        default:
          if (channel === 'EMAIL') recipients.push('team@agilestest.io');
          break;
      }
    }

    // Throttle check (simplified)
    const recentLogs = getDeliveryLogs().filter(l =>
      l.rule_id === rule.rule_id &&
      l.status === 'SENT' &&
      new Date(l.ts).getTime() > Date.now() - 3600000
    );
    if (recentLogs.length >= rule.throttle_policy.max_per_hour && !isTest) {
      const log: NotificationDeliveryLog = {
        delivery_id: uid(), ts: now(), channel, provider: 'STUB',
        event_type: rule.event_type, rule_id: rule.rule_id,
        template_id: templateId, recipient: recipients[0] || 'unknown',
        status: 'THROTTLED', error_message: `Limite ${rule.throttle_policy.max_per_hour}/h atteinte`,
        trace_id: traceId(), metadata: { ...context.project ? { project_id: context.project.id } : {} },
      };
      addDeliveryLog(log);
      logs.push(log);
      continue;
    }

    // Send to each recipient
    for (const recipient of [...new Set(recipients)]) {
      const provider = channel === 'SMS'
        ? (settings.sms.enabled && settings.sms.provider !== 'NONE' ? 'ORANGE' : 'STUB')
        : (settings.email.enabled && settings.email.provider !== 'NONE' ? 'SMTP' : 'STUB');

      const success = Math.random() > 0.08;
      const log: NotificationDeliveryLog = {
        delivery_id: uid(), ts: now(), channel,
        provider: provider as 'ORANGE' | 'SMTP' | 'STUB',
        event_type: rule.event_type, rule_id: rule.rule_id,
        template_id: templateId, recipient,
        status: success ? 'SENT' : 'FAILED',
        error_message: success ? null : 'Delivery failed (simulated)',
        trace_id: traceId(),
        metadata: {
          ...(context.project ? { project_id: context.project.id } : {}),
          ...(context.execution ? { execution_id: context.execution.id } : {}),
          ...(context.incident ? { incident_id: context.incident.id } : {}),
          is_test: isTest ? 'true' : 'false',
        },
      };
      addDeliveryLog(log);
      logs.push(log);
    }
  }

  return logs;
}

export const localNotifDispatcher = {
  dispatch(eventType: NotificationEventType, context: DispatchContext): NotificationDeliveryLog[] {
    const rules = getRules().filter(r => r.event_type === eventType && r.enabled);
    const allLogs: NotificationDeliveryLog[] = [];
    for (const rule of rules) {
      const logs = dispatchForRule(rule, context, false);
      allLogs.push(...logs);
    }
    if (allLogs.length > 0) {
      addAudit('notifications_dispatched', 'system', {
        event_type: eventType,
        deliveries: allLogs.length,
        sent: allLogs.filter(l => l.status === 'SENT').length,
        failed: allLogs.filter(l => l.status === 'FAILED').length,
      });
    }
    return allLogs;
  },
};

// ─── Template rendering ─────────────────────────────────────────────────

function renderTemplate(template: string, context: DispatchContext, schema: TemplateVariable[]): string {
  const allowedVars = new Set(schema.map(v => v.name));
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, varName: string) => {
    if (!allowedVars.has(varName)) return match; // Keep unknown vars as-is
    const parts = varName.split('.');
    let value: unknown = context;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return match;
      }
    }
    return String(value ?? match);
  });
}

// ─── Audit helper ───────────────────────────────────────────────────────

function addAudit(action: string, actor: string, details: Record<string, unknown>): void {
  try {
    const raw = memoryStore.getItem('agilestest_audit_log');
    const items = raw ? JSON.parse(raw) : [];
    items.push({
      id: uid(),
      timestamp: now(),
      action,
      actor_id: actor,
      actor_name: actor,
      entity_type: 'notifications',
      entity_id: 'global',
      project_id: null,
      details,
      trace_id: traceId(),
    });
    memoryStore.setItem('agilestest_audit_log', JSON.stringify(items));
  } catch { /* ignore */ }
}

// ─── System Templates (starter pack) ────────────────────────────────────

const INVITE_VARS: TemplateVariable[] = CORE_VARIABLES.filter(v =>
  ['app.name', 'app.base_url', 'actor.name', 'actor.email', 'invite.link', 'invite.expires_at'].includes(v.name)
);
const EXEC_VARS: TemplateVariable[] = CORE_VARIABLES.filter(v =>
  ['app.name', 'project.name', 'execution.id', 'execution.scenario_id', 'execution.status', 'execution.trace_id', 'actor.name'].includes(v.name)
);
const INCIDENT_VARS: TemplateVariable[] = CORE_VARIABLES.filter(v =>
  ['app.name', 'project.name', 'incident.id', 'incident.summary', 'incident.severity', 'actor.name'].includes(v.name)
);
const DRIVE_VARS: TemplateVariable[] = CORE_VARIABLES.filter(v =>
  ['app.name', 'project.name', 'drive.campaign', 'drive.kpi_name', 'drive.value', 'drive.threshold'].includes(v.name)
);

const SYSTEM_TEMPLATES: NotificationTemplate[] = [
  {
    template_id: 'invite_user_email',
    channel: 'EMAIL',
    name: 'Invitation utilisateur (Email)',
    description: 'Email envoyé lors de l\'invitation d\'un nouvel utilisateur',
    subject: '[{{app.name}}] Vous êtes invité(e) à rejoindre la plateforme',
    body_text: 'Bonjour,\n\n{{actor.name}} vous invite à rejoindre {{app.name}}.\n\nCliquez sur le lien suivant pour accepter l\'invitation :\n{{invite.link}}\n\nCe lien expire le {{invite.expires_at}}.\n\nCordialement,\nL\'équipe {{app.name}}',
    body_html: null,
    variables_schema: INVITE_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    template_id: 'invite_user_sms',
    channel: 'SMS',
    name: 'Invitation utilisateur (SMS)',
    description: 'SMS court envoyé lors de l\'invitation',
    subject: null,
    body_text: '{{app.name}}: {{actor.name}} vous invite. Lien: {{invite.link}}',
    body_html: null,
    variables_schema: INVITE_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    template_id: 'execution_failed_email',
    channel: 'EMAIL',
    name: 'Exécution échouée (Email)',
    description: 'Email envoyé quand une exécution échoue',
    subject: '[{{app.name}}] Exécution échouée — {{execution.id}}',
    body_text: 'L\'exécution {{execution.id}} du scénario {{execution.scenario_id}} a échoué dans le projet {{project.name}}.\n\nStatut: {{execution.status}}\nTrace ID: {{execution.trace_id}}\n\nConnectez-vous pour consulter le rapport d\'incident.',
    body_html: null,
    variables_schema: EXEC_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    template_id: 'execution_failed_sms',
    channel: 'SMS',
    name: 'Exécution échouée (SMS)',
    description: 'SMS envoyé quand une exécution échoue',
    subject: null,
    body_text: '{{app.name}}: Exec {{execution.id}} FAILED ({{project.name}}). Trace: {{execution.trace_id}}',
    body_html: null,
    variables_schema: EXEC_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    template_id: 'execution_passed_email',
    channel: 'EMAIL',
    name: 'Exécution réussie (Email)',
    description: 'Email envoyé quand une exécution réussit',
    subject: '[{{app.name}}] Exécution réussie — {{execution.id}}',
    body_text: 'L\'exécution {{execution.id}} du scénario {{execution.scenario_id}} a réussi dans le projet {{project.name}}.\n\nStatut: {{execution.status}}\nTrace ID: {{execution.trace_id}}',
    body_html: null,
    variables_schema: EXEC_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    template_id: 'incident_created_email',
    channel: 'EMAIL',
    name: 'Incident créé (Email)',
    description: 'Email envoyé lors de la création d\'un incident',
    subject: '[{{app.name}}] Nouvel incident {{incident.severity}} — {{incident.id}}',
    body_text: 'Un nouvel incident a été créé dans le projet {{project.name}}.\n\nID: {{incident.id}}\nSévérité: {{incident.severity}}\nRésumé: {{incident.summary}}\n\nConnectez-vous pour consulter les détails.',
    body_html: null,
    variables_schema: INCIDENT_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    template_id: 'drive_kpi_breach_email',
    channel: 'EMAIL',
    name: 'Seuil KPI Drive dépassé (Email)',
    description: 'Email envoyé lors d\'un dépassement de seuil KPI Drive',
    subject: '[{{app.name}}] Alerte KPI Drive — {{drive.kpi_name}}',
    body_text: 'Alerte KPI dans la campagne {{drive.campaign}} du projet {{project.name}}.\n\nKPI: {{drive.kpi_name}}\nValeur observée: {{drive.value}}\nSeuil: {{drive.threshold}}\n\nConsultez le reporting Drive pour plus de détails.',
    body_html: null,
    variables_schema: DRIVE_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    template_id: 'drive_kpi_breach_sms',
    channel: 'SMS',
    name: 'Seuil KPI Drive dépassé (SMS)',
    description: 'SMS envoyé lors d\'un dépassement de seuil KPI Drive',
    subject: null,
    body_text: '{{app.name}}: Alerte {{drive.kpi_name}} = {{drive.value}} (seuil {{drive.threshold}}) — {{drive.campaign}}',
    body_html: null,
    variables_schema: DRIVE_VARS,
    is_system: true,
    status: 'ACTIVE',
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
];

// ─── Default Rules ──────────────────────────────────────────────────────

const DEFAULT_RULES: NotificationRule[] = [
  {
    rule_id: 'on_user_invited',
    event_type: 'USER_INVITED',
    enabled: true,
    channels_enabled: ['EMAIL'],
    template_sms_id: 'invite_user_sms',
    template_email_id: 'invite_user_email',
    recipients: ['TARGET_USER'],
    custom_recipients_emails: [],
    custom_recipients_msisdn: [],
    throttle_policy: { max_per_hour: 50, dedup_window_min: 5 },
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    rule_id: 'on_execution_failed',
    event_type: 'EXECUTION_FAILED',
    enabled: true,
    channels_enabled: ['EMAIL'],
    template_sms_id: 'execution_failed_sms',
    template_email_id: 'execution_failed_email',
    recipients: ['ACTOR', 'PROJECT_ADMINS'],
    custom_recipients_emails: [],
    custom_recipients_msisdn: [],
    throttle_policy: { max_per_hour: 30, dedup_window_min: 10 },
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    rule_id: 'on_execution_passed',
    event_type: 'EXECUTION_PASSED',
    enabled: false,
    channels_enabled: ['EMAIL'],
    template_sms_id: null,
    template_email_id: 'execution_passed_email',
    recipients: ['ACTOR'],
    custom_recipients_emails: [],
    custom_recipients_msisdn: [],
    throttle_policy: { max_per_hour: 100, dedup_window_min: 1 },
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    rule_id: 'on_incident_created',
    event_type: 'INCIDENT_CREATED',
    enabled: true,
    channels_enabled: ['EMAIL'],
    template_sms_id: null,
    template_email_id: 'incident_created_email',
    recipients: ['PROJECT_ADMINS', 'GLOBAL_ADMINS'],
    custom_recipients_emails: [],
    custom_recipients_msisdn: [],
    throttle_policy: { max_per_hour: 20, dedup_window_min: 15 },
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    rule_id: 'on_repair_proposed',
    event_type: 'REPAIR_PROPOSED',
    enabled: false,
    channels_enabled: ['EMAIL'],
    template_sms_id: null,
    template_email_id: null,
    recipients: ['ACTOR'],
    custom_recipients_emails: [],
    custom_recipients_msisdn: [],
    throttle_policy: { max_per_hour: 20, dedup_window_min: 10 },
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    rule_id: 'on_drive_kpi_breach',
    event_type: 'DRIVE_KPI_THRESHOLD_BREACH',
    enabled: true,
    channels_enabled: ['EMAIL', 'SMS'],
    template_sms_id: 'drive_kpi_breach_sms',
    template_email_id: 'drive_kpi_breach_email',
    recipients: ['PROJECT_ADMINS'],
    custom_recipients_emails: [],
    custom_recipients_msisdn: [],
    throttle_policy: { max_per_hour: 10, dedup_window_min: 30 },
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
  {
    rule_id: 'on_invite_accepted',
    event_type: 'INVITE_ACCEPTED',
    enabled: false,
    channels_enabled: ['EMAIL'],
    template_sms_id: null,
    template_email_id: null,
    recipients: ['GLOBAL_ADMINS'],
    custom_recipients_emails: [],
    custom_recipients_msisdn: [],
    throttle_policy: { max_per_hour: 50, dedup_window_min: 1 },
    updated_at: '2025-01-01T00:00:00Z',
    updated_by: 'system',
  },
];
