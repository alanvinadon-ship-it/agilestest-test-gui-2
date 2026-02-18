/**
 * AdminNotificationsPage — /admin/notifications
 *
 * 5 onglets :
 * 1. SMS (Orange) — config provider + test send
 * 2. E-mail (SMTP) — config provider + test send
 * 3. Templates — CRUD templates + preview
 * 4. Rules — event → notification toggles + recipients + throttle
 * 5. Delivery Logs — journal d'envoi + filtres + drill-down
 */
import { useState, useMemo, useCallback, Fragment } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Bell, Smartphone, Mail, FileText, GitBranch, ScrollText,
  Save, Send, Power, PowerOff, Eye, EyeOff, Edit2, Trash2,
  Plus, Search, Filter, X, ChevronDown, ChevronRight, Copy,
  Check, AlertTriangle, Info, ExternalLink, Download, RefreshCw,
  Zap, Clock, Users, Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { hasPermission, PermissionKey } from '../admin/permissions';
import {
  localNotifSettings,
  localNotifTemplates,
  localNotifRules,
  localNotifDeliveryLogs,
} from '../notifications';
import type {
  SmsSettingsMasked,
  EmailSettingsMasked,
  SmsAuthMode,
  SmtpSecureMode,
  NotificationTemplate,
  NotificationRule,
  NotificationDeliveryLog,
  NotificationChannel,
  NotificationEventType,
  DeliveryStatus,
  DispatchContext,
  TestSendResult,
} from '../notifications';
import {
  EVENT_TYPE_LABELS,
  CHANNEL_LABELS,
  DELIVERY_STATUS_LABELS,
  RECIPIENT_LABELS,
  CORE_VARIABLES,
} from '../notifications';

// ─── Tab definitions ────────────────────────────────────────────────────

type TabId = 'sms' | 'email' | 'templates' | 'rules' | 'delivery';

const TABS: { id: TabId; label: string; icon: typeof Bell }[] = [
  { id: 'sms', label: 'SMS (Orange)', icon: Smartphone },
  { id: 'email', label: 'E-mail (SMTP)', icon: Mail },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'rules', label: 'Règles', icon: GitBranch },
  { id: 'delivery', label: 'Delivery Logs', icon: ScrollText },
];

// ─── Helpers ────────────────────────────────────────────────────────────

const MASK = '********';

function SecretField({ label, value, hasValue, canEdit, onChange }: {
  label: string; value: string | null; hasValue: boolean;
  canEdit: boolean; onChange: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');
  const [visible, setVisible] = useState(false);

  if (!canEdit) {
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <div className="px-3 py-2 bg-secondary/30 border border-border rounded-md text-sm text-muted-foreground">
          {hasValue ? MASK : '(non défini)'}
        </div>
      </div>
    );
  }

  if (!editing && hasValue) {
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 bg-secondary/30 border border-border rounded-md text-sm text-muted-foreground">{MASK}</div>
          <button onClick={() => { setEditing(true); setLocalVal(''); setVisible(true); }}
            className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 border border-border rounded-md text-foreground transition-colors"
            title="Modifier">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const currentVal = editing ? localVal : (value || '');

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input type={visible ? 'text' : 'password'} value={currentVal}
            onChange={e => { if (editing) setLocalVal(e.target.value); else onChange(e.target.value); }}
            onBlur={() => { if (editing) { onChange(localVal || null); setEditing(false); } }}
            placeholder={`Entrer ${label.toLowerCase()}`}
            className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <button type="button" onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            title={visible ? 'Masquer' : 'Afficher'}>
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {editing && (
          <button onClick={() => { setEditing(false); setVisible(false); }}
            className="px-3 py-2 text-xs bg-secondary hover:bg-secondary/80 border border-border rounded-md text-muted-foreground"
            title="Annuler">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ enabled, label }: { enabled: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
      {label || (enabled ? 'Activé' : 'Désactivé')}
    </span>
  );
}

function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const colors: Record<DeliveryStatus, string> = {
    SENT: 'bg-emerald-500/10 text-emerald-400',
    FAILED: 'bg-red-500/10 text-red-400',
    SKIPPED: 'bg-zinc-500/10 text-zinc-400',
    THROTTLED: 'bg-amber-500/10 text-amber-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {DELIVERY_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  const canRead = hasPermission(user, PermissionKey.SETTINGS_NOTIFICATIONS_READ);
  const canUpdate = hasPermission(user, PermissionKey.SETTINGS_NOTIFICATIONS_UPDATE);
  const canTest = hasPermission(user, PermissionKey.SETTINGS_NOTIFICATIONS_TEST);
  const canDisable = hasPermission(user, PermissionKey.SETTINGS_NOTIFICATIONS_DISABLE);
  const canReadTemplates = hasPermission(user, PermissionKey.NOTIFICATIONS_TEMPLATES_READ);
  const canUpdateTemplates = hasPermission(user, PermissionKey.NOTIFICATIONS_TEMPLATES_UPDATE);
  const canReadRules = hasPermission(user, PermissionKey.NOTIFICATIONS_RULES_READ);
  const canUpdateRules = hasPermission(user, PermissionKey.NOTIFICATIONS_RULES_UPDATE);
  const canReadDelivery = hasPermission(user, PermissionKey.NOTIFICATIONS_DELIVERY_READ);

  const [activeTab, setActiveTab] = useState<TabId>('sms');
  const [refreshKey, setRefreshKey] = useState(0);
  const actor = user?.email || 'unknown';

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-heading font-semibold text-foreground">Accès refusé</p>
          <p className="text-sm text-muted-foreground mt-1">Permission <code>settings.notifications.read</code> requise.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">Configuration SMS Orange, E-mail SMTP, templates et règles d'envoi</p>
          </div>
        </div>
        <a href="/admin/audit" className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
          <ScrollText className="w-3.5 h-3.5" /> Journal d'audit
        </a>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'sms' && <SmsTab canUpdate={canUpdate} canTest={canTest} canDisable={canDisable} actor={actor} refresh={refresh} rk={refreshKey} />}
      {activeTab === 'email' && <EmailTab canUpdate={canUpdate} canTest={canTest} canDisable={canDisable} actor={actor} refresh={refresh} rk={refreshKey} />}
      {activeTab === 'templates' && <TemplatesTab canRead={canReadTemplates} canUpdate={canUpdateTemplates} actor={actor} refresh={refresh} rk={refreshKey} />}
      {activeTab === 'rules' && <RulesTab canRead={canReadRules} canUpdate={canUpdateRules} canTest={canTest} actor={actor} refresh={refresh} rk={refreshKey} />}
      {activeTab === 'delivery' && <DeliveryTab canRead={canReadDelivery} rk={refreshKey} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 1 — SMS Orange
// ═══════════════════════════════════════════════════════════════════════

function SmsTab({ canUpdate, canTest, canDisable, actor, refresh, rk }: {
  canUpdate: boolean; canTest: boolean; canDisable: boolean; actor: string; refresh: () => void; rk: number;
}) {
  const settings = useMemo(() => localNotifSettings.get(), [rk]);
  const sms = settings.sms;

  const [enabled, setEnabled] = useState(sms.enabled);
  const [baseUrl, setBaseUrl] = useState(sms.base_url);
  const [senderId, setSenderId] = useState(sms.from_sender_id || '');
  const [authMode, setAuthMode] = useState<SmsAuthMode>(sms.auth_mode);
  const [tokenUrl, setTokenUrl] = useState(sms.token_url || '');
  const [scope, setScope] = useState(sms.scope || '');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [timeoutMs, setTimeoutMs] = useState(sms.timeout_ms);

  // Test SMS
  const [testMsisdn, setTestMsisdn] = useState('');
  const [testMessage, setTestMessage] = useState('Test SMS depuis AgilesTest');
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    const patch: Record<string, unknown> = {
      enabled, provider: enabled ? 'ORANGE' as const : 'NONE' as const,
      base_url: baseUrl, from_sender_id: senderId || null,
      auth_mode: authMode, token_url: tokenUrl || null, scope: scope || null,
      timeout_ms: timeoutMs,
    };
    if (clientId !== null) patch.client_id = clientId;
    if (clientSecret !== null) patch.client_secret = clientSecret;
    if (apiKey !== null) patch.api_key = apiKey;
    localNotifSettings.update({ sms: patch as any }, actor);
    toast.success('Configuration SMS sauvegardée');
    refresh();
  };

  const handleDisable = () => {
    localNotifSettings.disable('sms', actor);
    setEnabled(false);
    toast.success('Canal SMS désactivé');
    refresh();
  };

  const handleTest = () => {
    if (!testMsisdn) { toast.error('Numéro MSISDN requis'); return; }
    setTesting(true);
    setTimeout(() => {
      const result = localNotifSettings.testSms({ to_msisdn: testMsisdn, message: testMessage }, actor);
      setTestResult(result);
      setTesting(false);
      if (result.status === 'OK') toast.success('SMS test envoyé');
      else toast.error(`Échec: ${result.error_message}`);
    }, 800);
  };

  const isStub = !sms.enabled || sms.provider === 'NONE';

  const toggleStubMode = () => {
    if (!canUpdate) return;
    const newProvider = isStub ? 'ORANGE' as const : 'NONE' as const;
    localNotifSettings.update({ sms: { provider: newProvider, enabled: newProvider !== 'NONE' } as any }, actor);
    if (newProvider !== 'NONE') { setEnabled(true); toast.success('Mode Live activé — les SMS seront envoyés via Orange API'); }
    else { toast.success('Mode Stub activé — les SMS sont simulés localement'); }
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg px-5 py-3">
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Provider SMS : Orange</p>
            <p className="text-xs text-muted-foreground">Dernière modification : {new Date(settings.updated_at).toLocaleString('fr-FR')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleStubMode} disabled={!canUpdate}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              isStub
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}>
            {isStub ? 'Mode Stub' : 'Mode Live'}
          </button>
          <StatusBadge enabled={sms.enabled} />
        </div>
      </div>

      {/* Config form */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-heading font-semibold text-foreground">Configuration SMS Orange</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">Activé</span>
            <button onClick={() => canUpdate && setEnabled(!enabled)} disabled={!canUpdate}
              className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-secondary'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Base URL</label>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} disabled={!canUpdate}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sender ID</label>
            <input value={senderId} onChange={e => setSenderId(e.target.value)} disabled={!canUpdate}
              placeholder="ex: AgilesTest"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Mode d'authentification</label>
          <div className="flex gap-3">
            {(['OAUTH2_CLIENT_CREDENTIALS', 'API_KEY'] as SmsAuthMode[]).map(mode => (
              <button key={mode} onClick={() => canUpdate && setAuthMode(mode)} disabled={!canUpdate}
                className={`px-4 py-2 rounded-md text-xs font-medium border transition-colors ${
                  authMode === mode ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary/30 border-border text-muted-foreground hover:text-foreground'
                } disabled:opacity-50`}>
                {mode === 'OAUTH2_CLIENT_CREDENTIALS' ? 'OAuth2 Client Credentials' : 'API Key'}
              </button>
            ))}
          </div>
        </div>

        {authMode === 'OAUTH2_CLIENT_CREDENTIALS' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Token URL</label>
              <input value={tokenUrl} onChange={e => setTokenUrl(e.target.value)} disabled={!canUpdate}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Scope</label>
              <input value={scope} onChange={e => setScope(e.target.value)} disabled={!canUpdate}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
            </div>
            <SecretField label="Client ID" value={clientId} hasValue={sms._has_client_id} canEdit={canUpdate} onChange={setClientId} />
            <SecretField label="Client Secret" value={clientSecret} hasValue={sms._has_client_secret} canEdit={canUpdate} onChange={setClientSecret} />
          </div>
        )}

        {authMode === 'API_KEY' && (
          <div className="grid grid-cols-2 gap-4">
            <SecretField label="API Key" value={apiKey} hasValue={sms._has_api_key} canEdit={canUpdate} onChange={setApiKey} />
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Timeout (ms)</label>
              <input type="number" value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))} disabled={!canUpdate}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Timeout (ms)</label>
            <input type="number" value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))} disabled={!canUpdate}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          {canUpdate && (
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save className="w-4 h-4" /> Sauvegarder
            </button>
          )}
          {canDisable && enabled && (
            <button onClick={handleDisable}
              className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-md text-sm font-medium hover:bg-destructive/20 transition-colors">
              <PowerOff className="w-4 h-4" /> Désactiver
            </button>
          )}
        </div>
      </div>

      {/* Test SMS */}
      {canTest && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Test SMS
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Numéro MSISDN</label>
              <input value={testMsisdn} onChange={e => setTestMsisdn(e.target.value)}
                placeholder="+2250700000000"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Message <span className="text-muted-foreground/60">({testMessage.length}/160)</span>
                {testMessage.length > 160 && <span className="text-amber-400 ml-1">Multi-SMS</span>}
              </label>
              <input value={testMessage} onChange={e => setTestMessage(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <button onClick={handleTest} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {testing ? 'Envoi en cours...' : 'Envoyer test'}
          </button>
          {testResult && (
            <div className={`p-4 rounded-md border ${testResult.status === 'OK' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.status === 'OK' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                <span className={`text-sm font-medium ${testResult.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.status === 'OK' ? 'Envoyé avec succès' : 'Échec de l\'envoi'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {testResult.provider_response && <p>Réponse provider : {testResult.provider_response}</p>}
                {testResult.error_message && <p className="text-red-400">Erreur : {testResult.error_message}</p>}
                <p>Trace ID : <code className="text-primary">{testResult.trace_id}</code></p>
                <p>Durée : {testResult.duration_ms} ms</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2 — Email SMTP
// ═══════════════════════════════════════════════════════════════════════

function EmailTab({ canUpdate, canTest, canDisable, actor, refresh, rk }: {
  canUpdate: boolean; canTest: boolean; canDisable: boolean; actor: string; refresh: () => void; rk: number;
}) {
  const settings = useMemo(() => localNotifSettings.get(), [rk]);
  const email = settings.email;

  const [enabled, setEnabled] = useState(email.enabled);
  const [host, setHost] = useState(email.host);
  const [port, setPort] = useState(email.port);
  const [secure, setSecure] = useState<SmtpSecureMode>(email.secure);
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState(email.from_email);
  const [fromName, setFromName] = useState(email.from_name || '');
  const [replyTo, setReplyTo] = useState(email.reply_to || '');
  const [timeoutMs, setTimeoutMs] = useState(email.timeout_ms);

  // Test Email
  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('Test email depuis AgilesTest');
  const [testBody, setTestBody] = useState('Ceci est un email de test envoyé depuis la console AgilesTest.');
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleSave = () => {
    const patch: Record<string, unknown> = {
      enabled, provider: enabled ? 'SMTP' as const : 'NONE' as const,
      host, port, secure, from_email: fromEmail,
      from_name: fromName || null, reply_to: replyTo || null, timeout_ms: timeoutMs,
    };
    if (username !== null) patch.username = username;
    if (password !== null) patch.password = password;
    localNotifSettings.update({ email: patch as any }, actor);
    toast.success('Configuration Email sauvegardée');
    refresh();
  };

  const handleDisable = () => {
    localNotifSettings.disable('email', actor);
    setEnabled(false);
    toast.success('Canal Email désactivé');
    refresh();
  };

  const testEmailMutation = trpc.notifications.testEmail.useMutation();

  const handleTest = async () => {
    if (!testTo) { toast.error('Adresse email requise'); return; }

    const isStubMode = !enabled || !host;
    if (isStubMode) {
      // Mode Stub : simulation locale
      setTesting(true);
      setTimeout(() => {
        const result = localNotifSettings.testEmail({ to_email: testTo, subject: testSubject, body_text: testBody }, actor);
        setTestResult(result);
        setTesting(false);
        if (result.status === 'OK') toast.success('Email test envoyé (mode stub)');
        else toast.error(`Échec: ${result.error_message}`);
      }, 800);
      return;
    }

    // Mode Live : envoi réel via backend SMTP
    setTesting(true);
    setTestResult(null);
    try {
      // Lire les settings bruts (non masqués) depuis localStorage
      const raw = localNotifSettings.getRawEmailSettings();
      // Utiliser les valeurs du formulaire (qui peuvent être modifiées) ou les valeurs stockées
      const smtpConfig = {
        host: host,
        port: port,
        secure: secure,
        username: username ?? raw.username ?? '',
        password: password ?? raw.password ?? '',
        from_email: fromEmail || raw.from_email || 'noreply@agilestest.io',
        from_name: fromName || raw.from_name || 'AgilesTest',
        reply_to: replyTo || raw.reply_to || undefined,
        timeout_ms: timeoutMs,
      };

      if (!smtpConfig.username || !smtpConfig.password) {
        toast.error('Username et Password SMTP requis pour le mode Live');
        setTesting(false);
        return;
      }

      const result = await testEmailMutation.mutateAsync({
        smtp: smtpConfig,
        to_email: testTo,
      });

      const traceId = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

      if (result.success) {
        const testSendResult: TestSendResult = {
          status: 'OK',
          provider_response: `SMTP: ${result.response || '250 OK'} (Message-ID: ${result.message_id || 'N/A'})`,
          trace_id: traceId,
          duration_ms: result.duration_ms,
        };
        setTestResult(testSendResult);
        toast.success('Email test envoyé avec succès via SMTP');
      } else {
        const testSendResult: TestSendResult = {
          status: 'ERROR',
          error_message: result.error || 'Erreur SMTP inconnue',
          trace_id: traceId,
          duration_ms: result.duration_ms,
        };
        setTestResult(testSendResult);
        toast.error(`Échec SMTP: ${result.error}`);
      }
    } catch (err: any) {
      const traceId = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      setTestResult({
        status: 'ERROR',
        error_message: err.message || 'Erreur de communication avec le serveur',
        trace_id: traceId,
        duration_ms: 0,
      });
      toast.error(`Erreur: ${err.message || 'Impossible de contacter le serveur'}`);
    } finally {
      setTesting(false);
    }
  };

  const isStub = !email.enabled || email.provider === 'NONE';

  const toggleStubMode = () => {
    if (!canUpdate) return;
    const newProvider = isStub ? 'SMTP' as const : 'NONE' as const;
    localNotifSettings.update({ email: { provider: newProvider, enabled: newProvider !== 'NONE' } as any }, actor);
    if (newProvider !== 'NONE') { setEnabled(true); toast.success('Mode Live activé — les emails seront envoyés via SMTP'); }
    else { toast.success('Mode Stub activé — les emails sont simulés localement'); }
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg px-5 py-3">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Provider Email : SMTP</p>
            <p className="text-xs text-muted-foreground">Dernière modification : {new Date(settings.updated_at).toLocaleString('fr-FR')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleStubMode} disabled={!canUpdate}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              isStub
                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}>
            {isStub ? 'Mode Stub' : 'Mode Live'}
          </button>
          <StatusBadge enabled={email.enabled} />
        </div>
      </div>

      {/* Config form */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-heading font-semibold text-foreground">Configuration SMTP</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">Activé</span>
            <button onClick={() => canUpdate && setEnabled(!enabled)} disabled={!canUpdate}
              className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-secondary'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Host</label>
            <input value={host} onChange={e => setHost(e.target.value)} disabled={!canUpdate}
              placeholder="smtp.orange.ci"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Port</label>
            <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} disabled={!canUpdate}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sécurité</label>
            <select value={secure} onChange={e => setSecure(e.target.value as SmtpSecureMode)} disabled={!canUpdate}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50">
              <option value="NONE">Aucune</option>
              <option value="STARTTLS">STARTTLS</option>
              <option value="TLS">TLS</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Username</label>
            <input type="text" value={username ?? (email._has_username ? email.username ?? '' : '')}
              onChange={e => setUsername(e.target.value)}
              disabled={!canUpdate}
              placeholder="Entrer username"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
          <SecretField label="Password" value={password} hasValue={email._has_password} canEdit={canUpdate} onChange={setPassword} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From Email</label>
            <input value={fromEmail} onChange={e => setFromEmail(e.target.value)} disabled={!canUpdate}
              placeholder="noreply@agilestest.io"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From Name</label>
            <input value={fromName} onChange={e => setFromName(e.target.value)} disabled={!canUpdate}
              placeholder="AgilesTest"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reply-To</label>
            <input value={replyTo} onChange={e => setReplyTo(e.target.value)} disabled={!canUpdate}
              placeholder="support@agilestest.io"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Timeout (ms)</label>
            <input type="number" value={timeoutMs} onChange={e => setTimeoutMs(Number(e.target.value))} disabled={!canUpdate}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          {canUpdate && (
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save className="w-4 h-4" /> Sauvegarder
            </button>
          )}
          {canDisable && enabled && (
            <button onClick={handleDisable}
              className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-md text-sm font-medium hover:bg-destructive/20 transition-colors">
              <PowerOff className="w-4 h-4" /> Désactiver
            </button>
          )}
        </div>
      </div>

      {/* Test Email */}
      {canTest && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Test Email
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Destinataire</label>
              <input value={testTo} onChange={e => setTestTo(e.target.value)}
                placeholder="test@orange.ci"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sujet</label>
              <input value={testSubject} onChange={e => setTestSubject(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Corps du message</label>
            <textarea value={testBody} onChange={e => setTestBody(e.target.value)} rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <button onClick={handleTest} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {testing ? 'Envoi en cours...' : 'Envoyer test'}
          </button>
          {testResult && (
            <div className={`p-4 rounded-md border ${testResult.status === 'OK' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.status === 'OK' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                <span className={`text-sm font-medium ${testResult.status === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.status === 'OK' ? 'Envoyé avec succès' : 'Échec de l\'envoi'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {testResult.provider_response && <p>Réponse provider : {testResult.provider_response}</p>}
                {testResult.error_message && <p className="text-red-400">Erreur : {testResult.error_message}</p>}
                <p>Trace ID : <code className="text-primary">{testResult.trace_id}</code></p>
                <p>Durée : {testResult.duration_ms} ms</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 3 — Templates
// ═══════════════════════════════════════════════════════════════════════

function TemplatesTab({ canRead, canUpdate, actor, refresh, rk }: {
  canRead: boolean; canUpdate: boolean; actor: string; refresh: () => void; rk: number;
}) {
  const [filterChannel, setFilterChannel] = useState<NotificationChannel | ''>('');
  const [search, setSearch] = useState('');
  const [editTpl, setEditTpl] = useState<NotificationTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [previewTpl, setPreviewTpl] = useState<NotificationTemplate | null>(null);
  const [previewResult, setPreviewResult] = useState<{ subject: string | null; body_text: string; body_html: string | null } | null>(null);

  const templates = useMemo(() => {
    let list = localNotifTemplates.list(filterChannel || undefined);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.template_id.toLowerCase().includes(q));
    }
    return list;
  }, [rk, filterChannel, search]);

  const handlePreview = (tpl: NotificationTemplate) => {
    const sampleContext: DispatchContext = {
      app: { name: 'AgilesTest', base_url: 'https://agilestest.orange.ci' },
      actor: { name: 'Jean Dupont', email: 'jean@orange.ci' },
      project: { name: 'Orange-WEB', id: 'proj_001' },
      execution: { id: 'exec_789', scenario_id: 'sc_login_01', status: 'FAILED', trace_id: 'tr_abc123' },
      incident: { id: 'inc_042', summary: 'Login timeout after 30s', severity: 'P1' },
      drive: { campaign: 'Abidjan-Nord Q1', kpi_name: 'RSRP', value: '-115 dBm', threshold: '-110 dBm' },
      invite: { link: 'https://agilestest.orange.ci/invite/abc123', expires_at: '2026-03-01T23:59:59Z' },
    };
    try {
      const result = localNotifTemplates.preview(tpl.template_id, sampleContext);
      setPreviewTpl(tpl);
      setPreviewResult(result);
    } catch (e) {
      toast.error('Erreur de preview');
    }
  };

  const handleDelete = (tpl: NotificationTemplate) => {
    try {
      localNotifTemplates.delete(tpl.template_id, actor);
      toast.success('Template supprimé');
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleStatus = (tpl: NotificationTemplate) => {
    localNotifTemplates.update(tpl.template_id, { status: tpl.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }, actor);
    toast.success(`Template ${tpl.status === 'ACTIVE' ? 'désactivé' : 'activé'}`);
    refresh();
  };

  if (!canRead) {
    return <div className="text-center py-12 text-muted-foreground">Permission <code>notifications.templates.read</code> requise.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              className="pl-9 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-64" />
          </div>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value as any)}
            className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Tous les canaux</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
        {canUpdate && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau template
          </button>
        )}
      </div>

      {/* Templates table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Template</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Canal</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Statut</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Variables</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Modifié</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(tpl => (
              <tr key={tpl.template_id} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tpl.template_id}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    tpl.channel === 'SMS' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {tpl.channel === 'SMS' ? <Smartphone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    {tpl.channel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge enabled={tpl.status === 'ACTIVE'} />
                    {tpl.is_system && <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-500/10 text-zinc-400">Système</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">{tpl.variables_schema.length} var.</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">{new Date(tpl.updated_at).toLocaleDateString('fr-FR')}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handlePreview(tpl)} title="Preview"
                      className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {canUpdate && (
                      <>
                        <button onClick={() => handleToggleStatus(tpl)} title={tpl.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          {tpl.status === 'ACTIVE' ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setEditTpl(tpl)} title="Modifier"
                          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!tpl.is_system && (
                          <button onClick={() => handleDelete(tpl)} title="Supprimer"
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun template trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview modal */}
      {previewTpl && previewResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setPreviewTpl(null); setPreviewResult(null); }}>
          <div className="bg-card border border-border rounded-lg w-[600px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-heading font-semibold text-foreground">Preview : {previewTpl.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{previewTpl.template_id}</p>
              </div>
              <button onClick={() => { setPreviewTpl(null); setPreviewResult(null); }} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {previewResult.subject && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Sujet</p>
                  <p className="text-sm text-foreground bg-secondary/30 px-3 py-2 rounded">{previewResult.subject}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Corps (texte)</p>
                <pre className="text-sm text-foreground bg-secondary/30 px-3 py-2 rounded whitespace-pre-wrap font-mono text-xs">{previewResult.body_text}</pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Variables utilisées</p>
                <div className="flex flex-wrap gap-1">
                  {previewTpl.variables_schema.map(v => (
                    <span key={v.name} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">{`{{${v.name}}}`}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTpl && (
        <TemplateEditorModal template={editTpl} actor={actor} onClose={() => { setEditTpl(null); refresh(); }} />
      )}

      {/* Create modal */}
      {showCreate && (
        <TemplateEditorModal template={null} actor={actor} onClose={() => { setShowCreate(false); refresh(); }} />
      )}
    </div>
  );
}

function TemplateEditorModal({ template, actor, onClose }: {
  template: NotificationTemplate | null; actor: string; onClose: () => void;
}) {
  const isNew = !template;
  const [id, setId] = useState(template?.template_id || '');
  const [name, setName] = useState(template?.name || '');
  const [channel, setChannel] = useState<NotificationChannel>(template?.channel || 'EMAIL');
  const [description, setDescription] = useState(template?.description || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [bodyText, setBodyText] = useState(template?.body_text || '');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '');

  const handleSave = () => {
    try {
      if (isNew) {
        if (!id || !name) { toast.error('ID et nom requis'); return; }
        localNotifTemplates.create({
          template_id: id, channel, name, description, subject: channel === 'EMAIL' ? subject : null,
          body_text: bodyText, body_html: channel === 'EMAIL' && bodyHtml ? bodyHtml : null,
          variables_schema: CORE_VARIABLES, is_system: false, status: 'ACTIVE',
        }, actor);
        toast.success('Template créé');
      } else {
        localNotifTemplates.update(template!.template_id, {
          name, description, subject: channel === 'EMAIL' ? subject : null,
          body_text: bodyText, body_html: channel === 'EMAIL' && bodyHtml ? bodyHtml : null,
        }, actor);
        toast.success('Template mis à jour');
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-[700px] max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-heading font-semibold text-foreground">{isNew ? 'Nouveau template' : `Modifier : ${template!.name}`}</p>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {isNew && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">ID (slug)</label>
                <input value={id} onChange={e => setId(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                  placeholder="mon_template_email"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nom</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            {isNew && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Canal</label>
                <select value={channel} onChange={e => setChannel(e.target.value as NotificationChannel)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          {channel === 'EMAIL' && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sujet</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Corps (texte)</label>
            <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={6}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          {/* Variables sidebar */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Variables disponibles (cliquer pour insérer)</p>
            <div className="flex flex-wrap gap-1">
              {CORE_VARIABLES.map(v => (
                <button key={v.name} onClick={() => setBodyText(prev => prev + `{{${v.name}}}`)}
                  title={`${v.description} — ex: ${v.example}`}
                  className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors">
                  {`{{${v.name}}}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            <Save className="w-4 h-4" /> {isNew ? 'Créer' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 4 — Rules
// ═══════════════════════════════════════════════════════════════════════

function RulesTab({ canRead, canUpdate, canTest, actor, refresh, rk }: {
  canRead: boolean; canUpdate: boolean; canTest: boolean; actor: string; refresh: () => void; rk: number;
}) {
  const rules = useMemo(() => localNotifRules.list(), [rk]);
  const templates = useMemo(() => localNotifTemplates.list(), [rk]);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [testingRule, setTestingRule] = useState<string | null>(null);

  const smsTemplates = templates.filter(t => t.channel === 'SMS');
  const emailTemplates = templates.filter(t => t.channel === 'EMAIL');

  const handleToggle = (rule: NotificationRule) => {
    localNotifRules.update(rule.rule_id, { enabled: !rule.enabled }, actor);
    toast.success(`Règle ${rule.enabled ? 'désactivée' : 'activée'}`);
    refresh();
  };

  const handleChannelToggle = (rule: NotificationRule, ch: NotificationChannel) => {
    const channels = rule.channels_enabled.includes(ch)
      ? rule.channels_enabled.filter(c => c !== ch)
      : [...rule.channels_enabled, ch];
    localNotifRules.update(rule.rule_id, { channels_enabled: channels }, actor);
    refresh();
  };

  const handleTemplateChange = (rule: NotificationRule, channel: 'sms' | 'email', templateId: string) => {
    const patch = channel === 'sms' ? { template_sms_id: templateId || null } : { template_email_id: templateId || null };
    localNotifRules.update(rule.rule_id, patch, actor);
    refresh();
  };

  const handleRecipientToggle = (rule: NotificationRule, rt: string) => {
    const recipients = rule.recipients.includes(rt as any)
      ? rule.recipients.filter(r => r !== rt)
      : [...rule.recipients, rt as any];
    localNotifRules.update(rule.rule_id, { recipients }, actor);
    refresh();
  };

  const handleThrottleChange = (rule: NotificationRule, field: 'max_per_hour' | 'dedup_window_min', value: number) => {
    localNotifRules.update(rule.rule_id, {
      throttle_policy: { ...rule.throttle_policy, [field]: value },
    }, actor);
    refresh();
  };

  const handleTestRule = (rule: NotificationRule) => {
    setTestingRule(rule.rule_id);
    setTimeout(() => {
      const context: DispatchContext = {
        app: { name: 'AgilesTest', base_url: 'https://agilestest.orange.ci' },
        actor: { name: 'Test User', email: 'test@orange.ci' },
        project: { name: 'Orange-WEB', id: 'proj_001' },
        execution: { id: 'exec_test', scenario_id: 'sc_test', status: 'FAILED', trace_id: 'tr_test' },
        incident: { id: 'inc_test', summary: 'Test incident', severity: 'P1' },
        drive: { campaign: 'Test Campaign', kpi_name: 'RSRP', value: '-115 dBm', threshold: '-110 dBm' },
        invite: { link: 'https://agilestest.orange.ci/invite/test', expires_at: '2026-03-01T23:59:59Z' },
      };
      const logs = localNotifRules.testRule(rule.rule_id, context, actor);
      setTestingRule(null);
      toast.success(`Test exécuté : ${logs.length} notification(s) envoyée(s)`);
      refresh();
    }, 600);
  };

  if (!canRead) {
    return <div className="text-center py-12 text-muted-foreground">Permission <code>notifications.rules.read</code> requise.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">Configurez les règles d'envoi par événement. Chaque règle lie un événement à un ou plusieurs canaux et templates.</p>
      </div>

      {rules.map(rule => {
        const isExpanded = expandedRule === rule.rule_id;
        return (
          <div key={rule.rule_id} className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Rule header */}
            <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-secondary/20"
              onClick={() => setExpandedRule(isExpanded ? null : rule.rule_id)}>
              <div className="flex items-center gap-3">
                <button onClick={e => { e.stopPropagation(); if (canUpdate) handleToggle(rule); }}
                  disabled={!canUpdate}
                  className={`relative w-9 h-5 rounded-full transition-colors ${rule.enabled ? 'bg-primary' : 'bg-secondary'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground">{EVENT_TYPE_LABELS[rule.event_type]}</p>
                  <p className="text-xs text-muted-foreground font-mono">{rule.rule_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {rule.channels_enabled.map(ch => (
                    <span key={ch} className={`px-2 py-0.5 rounded text-xs font-medium ${
                      ch === 'SMS' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>{ch}</span>
                  ))}
                </div>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Rule details */}
            {isExpanded && (
              <div className="px-5 py-4 border-t border-border space-y-4">
                {/* Channels */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Canaux activés</p>
                  <div className="flex gap-2">
                    {(['SMS', 'EMAIL'] as NotificationChannel[]).map(ch => (
                      <button key={ch} onClick={() => canUpdate && handleChannelToggle(rule, ch)} disabled={!canUpdate}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          rule.channels_enabled.includes(ch)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-secondary/30 border-border text-muted-foreground'
                        } disabled:opacity-50`}>
                        {ch === 'SMS' ? <Smartphone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Template SMS</label>
                    <select value={rule.template_sms_id || ''} onChange={e => canUpdate && handleTemplateChange(rule, 'sms', e.target.value)}
                      disabled={!canUpdate}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50">
                      <option value="">— Aucun —</option>
                      {smsTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Template Email</label>
                    <select value={rule.template_email_id || ''} onChange={e => canUpdate && handleTemplateChange(rule, 'email', e.target.value)}
                      disabled={!canUpdate}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50">
                      <option value="">— Aucun —</option>
                      {emailTemplates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Destinataires</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(RECIPIENT_LABELS).map(([key, label]) => (
                      <button key={key} onClick={() => canUpdate && handleRecipientToggle(rule, key)} disabled={!canUpdate}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          rule.recipients.includes(key as any)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-secondary/30 border-border text-muted-foreground'
                        } disabled:opacity-50`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Throttle */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Max par heure</label>
                    <input type="number" value={rule.throttle_policy.max_per_hour}
                      onChange={e => canUpdate && handleThrottleChange(rule, 'max_per_hour', Number(e.target.value))}
                      disabled={!canUpdate} min={1} max={1000}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Fenêtre dédup (min)</label>
                    <input type="number" value={rule.throttle_policy.dedup_window_min}
                      onChange={e => canUpdate && handleThrottleChange(rule, 'dedup_window_min', Number(e.target.value))}
                      disabled={!canUpdate} min={0} max={1440}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
                  </div>
                </div>

                {/* Test button */}
                {canTest && (
                  <button onClick={() => handleTestRule(rule)} disabled={testingRule === rule.rule_id}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-sm font-medium text-foreground transition-colors disabled:opacity-50">
                    {testingRule === rule.rule_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-primary" />}
                    Tester cette règle
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 5 — Delivery Logs
// ═══════════════════════════════════════════════════════════════════════

function DeliveryTab({ canRead, rk }: { canRead: boolean; rk: number }) {
  const [filterChannel, setFilterChannel] = useState<NotificationChannel | ''>('');
  const [filterStatus, setFilterStatus] = useState<DeliveryStatus | ''>('');
  const [filterEvent, setFilterEvent] = useState<NotificationEventType | ''>('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<NotificationDeliveryLog | null>(null);

  const logs = useMemo(() => {
    let list = localNotifDeliveryLogs.list({
      channel: filterChannel || undefined,
      status: filterStatus || undefined,
      event_type: filterEvent || undefined,
      recipient: search || undefined,
    });
    return list;
  }, [rk, filterChannel, filterStatus, filterEvent, search]);

  const handleExportCsv = () => {
    const csv = localNotifDeliveryLogs.exportCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'delivery_logs.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  if (!canRead) {
    return <div className="text-center py-12 text-muted-foreground">Permission <code>notifications.delivery.read</code> requise.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrer par destinataire..."
              className="pl-9 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-56" />
          </div>
          <select value={filterChannel} onChange={e => setFilterChannel(e.target.value as any)}
            className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Canal</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Statut</option>
            <option value="SENT">Envoyé</option>
            <option value="FAILED">Échoué</option>
            <option value="SKIPPED">Ignoré</option>
            <option value="THROTTLED">Limité</option>
          </select>
          <select value={filterEvent} onChange={e => setFilterEvent(e.target.value as any)}
            className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="">Événement</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button onClick={handleExportCsv}
          className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 border border-border rounded-md text-sm text-foreground transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: logs.length, color: 'text-foreground' },
          { label: 'Envoyés', value: logs.filter(l => l.status === 'SENT').length, color: 'text-emerald-400' },
          { label: 'Échoués', value: logs.filter(l => l.status === 'FAILED').length, color: 'text-red-400' },
          { label: 'Limités', value: logs.filter(l => l.status === 'THROTTLED').length, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg px-4 py-3 text-center">
            <p className={`text-xl font-heading font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Logs table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Canal</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Événement</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Destinataire</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Statut</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Trace</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 50).map(log => (
              <tr key={log.delivery_id} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(log.ts).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    log.channel === 'SMS' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {log.channel === 'SMS' ? <Smartphone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    {log.provider}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-foreground">{EVENT_TYPE_LABELS[log.event_type]}</td>
                <td className="px-4 py-2.5 text-xs text-foreground font-mono">{log.recipient}</td>
                <td className="px-4 py-2.5"><DeliveryStatusBadge status={log.status} /></td>
                <td className="px-4 py-2.5 text-xs text-primary font-mono">{log.trace_id.slice(0, 16)}...</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setSelectedLog(log)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun log de livraison.</td></tr>
            )}
          </tbody>
        </table>
        {logs.length > 50 && (
          <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground text-center">
            Affichage des 50 derniers logs sur {logs.length} total.
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedLog(null)}>
          <div className="bg-card border border-border rounded-lg w-[500px] max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="text-sm font-heading font-semibold text-foreground">Détail livraison</p>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ['ID', selectedLog.delivery_id],
                ['Date', new Date(selectedLog.ts).toLocaleString('fr-FR')],
                ['Canal', `${selectedLog.channel} (${selectedLog.provider})`],
                ['Événement', EVENT_TYPE_LABELS[selectedLog.event_type]],
                ['Règle', selectedLog.rule_id],
                ['Template', selectedLog.template_id],
                ['Destinataire', selectedLog.recipient],
                ['Statut', selectedLog.status],
                ['Trace ID', selectedLog.trace_id],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs text-foreground font-mono">{value}</span>
                </div>
              ))}
              {selectedLog.error_message && (
                <div className="p-3 rounded bg-red-500/5 border border-red-500/20">
                  <p className="text-xs text-red-400">{selectedLog.error_message}</p>
                </div>
              )}
              {Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Metadata</p>
                  <div className="bg-secondary/30 rounded p-3">
                    {Object.entries(selectedLog.metadata).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="text-foreground font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
