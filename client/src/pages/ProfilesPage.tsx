import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import { trpc } from '@/lib/trpc';
import type { TestProfile, TestType } from '../types';
import {
  Plus, Settings2, Loader2, Trash2, X, AlertCircle, Search,
  ChevronRight, ChevronLeft, Check, Info,
  ClipboardCheck, Shield, Gauge, Edit2
} from 'lucide-react';
import {
  type ProfileDomain, type ProfileType, type ConfigField,
  DOMAIN_META, PROFILE_TYPE_META, ALLOWED_TYPES, CONFIG_TEMPLATES,
  getEnabledDomains, getDefaultConfig, validateConfig, migrateOldProfile,
} from '../config/profileDomains';

// ─── Test Type Metadata ─────────────────────────────────────────────────────

const TEST_TYPE_META: Record<TestType, {
  label: string;
  fullLabel: string;
  description: string;
  icon: typeof ClipboardCheck;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  VABF: {
    label: 'VABF',
    fullLabel: 'Validation Fonctionnelle',
    description: 'Vérification d\'Aptitude au Bon Fonctionnement — tests fonctionnels, cas nominaux, cas limites, non-régression.',
    icon: ClipboardCheck,
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/20',
  },
  VSR: {
    label: 'VSR',
    fullLabel: 'Validation Service / Résilience',
    description: 'Vérification de Service Régulier — tests de résilience, haute disponibilité, failover, recovery, monitoring.',
    icon: Shield,
    bgClass: 'bg-sky-500/10',
    textClass: 'text-sky-400',
    borderClass: 'border-sky-500/20',
  },
  VABE: {
    label: 'VABE',
    fullLabel: 'Performance / Charge / Sécurité',
    description: 'Vérification d\'Aptitude à la Bonne Exploitabilité — tests de charge, performance, stress, sécurité.',
    icon: Gauge,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/20',
  },
};

const ALL_TEST_TYPES: TestType[] = ['VABF', 'VSR', 'VABE'];

// ─── Dynamic Config Form ───────────────────────────────────────────────────

function ConfigFieldInput({ field, value, onChange }: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
  const baseInput = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30";

  switch (field.type) {
    case 'text':
      return (
        <input type="text" value={(value as string) || ''} onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder} className={baseInput} />
      );
    case 'number':
      return (
        <input type="number" value={(value as number) ?? ''} onChange={(e) => onChange(field.key, e.target.value ? Number(e.target.value) : '')}
          placeholder={field.placeholder} className={baseInput} />
      );
    case 'select':
      return (
        <select value={(value as string) || ''} onChange={(e) => onChange(field.key, e.target.value)}
          className={baseInput}>
          <option value="">— Sélectionner —</option>
          {field.options?.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(field.key, e.target.checked)}
            className="w-4 h-4 rounded border-input text-primary focus:ring-ring/30" />
          <span className="text-sm text-foreground">Activé</span>
        </label>
      );
    case 'textarea':
      return (
        <textarea value={(value as string) || ''} onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder} rows={3}
          className={`${baseInput} resize-none`} />
      );
    default:
      return (
        <input type="text" value={(value as string) || ''} onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder} className={baseInput} />
      );
  }
}

// ─── Test Type Badge ──────────────────────────────────────────────────────

function TestTypeBadge({ testType }: { testType?: TestType | string }) {
  if (!testType) return null;
  const meta = TEST_TYPE_META[testType as TestType];
  if (!meta) return <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{testType}</span>;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ─── Domain Badge ─────────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain?: string }) {
  if (!domain) return null;
  const meta = DOMAIN_META[domain as ProfileDomain];
  if (!meta) return <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{domain}</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
      <meta.icon className="w-3 h-3" />
      {meta.shortLabel}
    </span>
  );
}

function TypeBadge({ profileType }: { profileType?: string }) {
  if (!profileType) return null;
  const meta = PROFILE_TYPE_META[profileType as ProfileType];
  if (!meta) return <span className="text-xs text-muted-foreground font-mono">{profileType}</span>;
  return (
    <span className="text-xs text-muted-foreground font-mono">{meta.label}</span>
  );
}

// ─── Create Profile Modal (4-step wizard) ──────────────────────────────────

function CreateProfileModal({ isOpen, onClose, projectId, projectDomain }: {
  isOpen: boolean; onClose: () => void; projectId: string; projectDomain: string;
}) {
  const utils = trpc.useUtils();
  const enabledDomains = useMemo(() => getEnabledDomains(projectDomain), [projectDomain]);
  const isSingleDomain = enabledDomains.length === 1;

  // Wizard state — steps: 1=Domain, 2=TestType, 3=ProfileType, 4=Config
  const [step, setStep] = useState(isSingleDomain ? 2 : 1);
  const [selectedDomain, setSelectedDomain] = useState<ProfileDomain | null>(
    isSingleDomain ? enabledDomains[0] : null
  );
  const [selectedTestType, setSelectedTestType] = useState<TestType | null>(null);
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const availableTypes = selectedDomain ? ALLOWED_TYPES[selectedDomain] : [];
  const configFields = selectedType ? CONFIG_TEMPLATES[selectedType] : [];

  // Compute total steps and display step
  const firstStep = isSingleDomain ? 2 : 1;
  const totalSteps = isSingleDomain ? 3 : 4;
  const displayStep = step - firstStep + 1;

  const mutation = trpc.profiles.create.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      resetAndClose();
    },
    onError: (err) => {
      setError(err.message || 'Erreur lors de la création.');
    },
  });

  const resetAndClose = () => {
    setStep(isSingleDomain ? 2 : 1);
    setSelectedDomain(isSingleDomain ? enabledDomains[0] : null);
    setSelectedTestType(null);
    setSelectedType(null);
    setName('');
    setDescription('');
    setConfig({});
    setError(null);
    onClose();
  };

  const handleDomainSelect = (domain: ProfileDomain) => {
    setSelectedDomain(domain);
    setSelectedTestType(null);
    setSelectedType(null);
    setConfig({});
    setStep(2);
  };

  const handleTestTypeSelect = (tt: TestType) => {
    setSelectedTestType(tt);
    setSelectedType(null);
    setConfig({});
    setStep(3);
  };

  const handleTypeSelect = (type: ProfileType) => {
    setSelectedType(type);
    setConfig(getDefaultConfig(type));
    setStep(4);
  };

  const handleConfigChange = (key: string, val: unknown) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom du profil est requis.');
      return;
    }
    if (!selectedDomain || !selectedType || !selectedTestType) {
      setError('Domaine, type de test et type de profil requis.');
      return;
    }

    const validationErrors = validateConfig(selectedType, config);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    const targetHost = (config.sut_url || config.base_url || config.target_host || config.host || config.mme_host || config.pgw_host || config.sgw_host || config.amf_host || config.smf_host || config.nrf_url || config.appium_server || config.winappdriver_url || config.wsdl_url || '') as string;
    const targetPort = (config.port || config.target_port || config.mme_port || config.pgw_port || config.sgw_port || config.amf_port || config.smf_port || config.adb_port || 0) as number;

    mutation.mutate({
      projectId,
      name: name.trim(),
      description: description.trim(),
      testType: selectedTestType!,
      domain: selectedDomain!,
      profileType: selectedType!,
      protocol: 'CUSTOM',
      targetHost: targetHost,
      targetPort: targetPort || 0,
      parameters: {},
      config,
    });
  };

  const goBack = () => {
    setError(null);
    if (step === 4) {
      setSelectedType(null);
      setStep(3);
    } else if (step === 3) {
      setSelectedTestType(null);
      setStep(2);
    } else if (step === 2 && !isSingleDomain) {
      setSelectedDomain(null);
      setStep(1);
    }
  };

  if (!isOpen) return null;

  const domainMeta = selectedDomain ? DOMAIN_META[selectedDomain] : null;
  const testTypeMeta = selectedTestType ? TEST_TYPE_META[selectedTestType] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {domainMeta && (
              <div className={`w-8 h-8 rounded-md ${domainMeta.bgClass} flex items-center justify-center`}>
                <domainMeta.icon className={`w-4 h-4 ${domainMeta.textClass}`} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">
                Nouveau profil
                {domainMeta ? ` — ${domainMeta.shortLabel}` : ''}
                {testTypeMeta ? ` · ${testTypeMeta.label}` : ''}
              </h2>
              <p className="text-xs text-muted-foreground">
                Étape {displayStep} sur {totalSteps}
              </p>
            </div>
          </div>
          <button type="button" onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4 shrink-0">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                i < displayStep ? 'bg-primary' : 'bg-border'
              }`} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Step 1: Domain Selection */}
          {step === 1 && !isSingleDomain && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-heading font-semibold text-foreground mb-1">Choisir le domaine</h3>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez le domaine de test pour ce profil. Les domaines disponibles dépendent du projet.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {enabledDomains.map((d) => {
                  const meta = DOMAIN_META[d];
                  const DIcon = meta.icon;
                  return (
                    <button key={d} type="button" onClick={() => handleDomainSelect(d)}
                      className="flex items-start gap-3 rounded-lg border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 border-border">
                      <div className={`w-10 h-10 rounded-md ${meta.bgClass} flex items-center justify-center shrink-0`}>
                        <DIcon className={`w-5 h-5 ${meta.textClass}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{meta.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Test Type Selection (VABF / VSR / VABE) */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-heading font-semibold text-foreground mb-1">Type de test *</h3>
                <p className="text-sm text-muted-foreground">
                  {domainMeta && (
                    <>Domaine : <span className={`font-medium ${domainMeta.textClass}`}>{domainMeta.label}</span>. </>
                  )}
                  Sélectionnez l'objectif de validation pour ce profil.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {ALL_TEST_TYPES.map((tt) => {
                  const meta = TEST_TYPE_META[tt];
                  const TIcon = meta.icon;
                  return (
                    <button key={tt} type="button" onClick={() => handleTestTypeSelect(tt)}
                      className="flex items-center gap-4 rounded-lg border border-border p-5 text-left transition-all hover:border-primary/50 hover:bg-primary/5 group">
                      <div className={`w-12 h-12 rounded-md ${meta.bgClass} flex items-center justify-center shrink-0`}>
                        <TIcon className={`w-6 h-6 ${meta.textClass}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{meta.label}</p>
                          <span className="text-xs text-muted-foreground">— {meta.fullLabel}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Profile Type Selection */}
          {step === 3 && selectedDomain && selectedTestType && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-heading font-semibold text-foreground mb-1">Choisir le type de profil</h3>
                <p className="text-sm text-muted-foreground">
                  <span className={`font-medium ${domainMeta?.textClass}`}>{domainMeta?.label}</span>
                  <span className="mx-1">·</span>
                  <span className={`font-medium ${testTypeMeta?.textClass}`}>{testTypeMeta?.label}</span>
                  <span className="mx-1">—</span>
                  Sélectionnez le type de test à configurer.
                </p>
              </div>
              {availableTypes.length === 0 ? (
                <div className="text-center py-8">
                  <Info className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun type disponible pour ce domaine.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableTypes.map((t) => {
                    const meta = PROFILE_TYPE_META[t];
                    const TIcon = meta.icon;
                    return (
                      <button key={t} type="button" onClick={() => handleTypeSelect(t)}
                        className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 group">
                        <div className={`w-10 h-10 rounded-md ${domainMeta?.bgClass} flex items-center justify-center shrink-0`}>
                          <TIcon className={`w-5 h-5 ${domainMeta?.textClass}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Configuration Form */}
          {step === 4 && selectedDomain && selectedType && selectedTestType && (
            <form onSubmit={handleSubmit} id="profile-form" className="space-y-5">
              <div>
                <h3 className="text-base font-heading font-semibold text-foreground mb-1">
                  Configuration — {PROFILE_TYPE_META[selectedType].label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  <TestTypeBadge testType={selectedTestType} />
                  <span className="mx-1.5">·</span>
                  Renseignez les paramètres de connexion et de configuration.
                </p>
              </div>

              {/* Name & Description */}
              <div className="space-y-3 pb-4 border-b border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Nom du profil *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={`Ex: ${PROFILE_TYPE_META[selectedType].label} — ${selectedTestType} Production`}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                    placeholder="Description optionnelle du profil..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>

              {/* Dynamic Config Fields */}
              <div className="space-y-3">
                <h4 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" />
                  Paramètres {PROFILE_TYPE_META[selectedType].label}
                </h4>
                {configFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </label>
                    <ConfigFieldInput field={field} value={config[field.key]} onChange={handleConfigChange} />
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <div>
            {(step > firstStep) && (
              <button type="button" onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={resetAndClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            {step === 4 && (
              <button type="submit" form="profile-form" disabled={mutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Créer le profil
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ProfilesPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const { can } = usePermission();
  const canCreateProfile = can(PermissionKey.PROFILES_CREATE);
  const canUpdateProfile = can(PermissionKey.PROFILES_UPDATE);
  const canDeleteProfile = can(PermissionKey.PROFILES_DELETE);
  const [showCreate, setShowCreate] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TestProfile | null>(null);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');
  const [testTypeFilter, setTestTypeFilter] = useState<string>('ALL');
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [allItems, setAllItems] = useState<any[]>([]);
  const utils = trpc.useUtils();

  const enabledDomains = useMemo(
    () => currentProject ? getEnabledDomains(currentProject.domain) : [],
    [currentProject?.domain]
  );

  const PAGE_SIZE = 30;

  const { data, isLoading, isFetching } = trpc.profiles.list.useQuery(
    { projectId: String(currentProject?.id || ''), page: 1, pageSize: PAGE_SIZE, cursor },
    { enabled: !!currentProject },
  );

  // Accumulate items as cursor changes
  useEffect(() => {
    if (data?.data) {
      if (cursor === undefined) {
        // First page: replace
        setAllItems(data.data);
      } else {
        // Subsequent pages: append, deduplicate by id
        setAllItems(prev => {
          const existingIds = new Set(prev.map((p: any) => p.id));
          const newItems = data.data.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [data, cursor]);

  // Reset when project changes
  useEffect(() => {
    setCursor(undefined);
    setAllItems([]);
  }, [currentProject?.id]);

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  const deleteMutation = trpc.profiles.delete.useMutation({
    onSuccess: () => {
      setCursor(undefined);
      setAllItems([]);
      utils.profiles.list.invalidate();
    },
  });

  // Map DB camelCase to frontend snake_case and apply filters
  const profiles = useMemo(() => {
    const raw = allItems;
    return raw.map((p: any): TestProfile => {
      const mapped: TestProfile = {
        id: String(p.id),
        project_id: p.projectId || '',
        name: p.name || '',
        description: p.description || '',
        test_type: (p.testType || 'VABF') as TestType,
        domain: p.domain || '',
        profile_type: p.profileType || '',
        protocol: p.protocol || '',
        target_host: p.targetHost || '',
        target_port: p.targetPort || 0,
        parameters: p.parameters || {},
        config: p.config || {},
        created_at: p.createdAt ? new Date(p.createdAt).toISOString() : '',
        updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
      };
      if (!mapped.domain && mapped.protocol) {
        const migrated = migrateOldProfile(mapped.protocol);
        return { ...mapped, domain: migrated.domain, profile_type: migrated.type, test_type: mapped.test_type || 'VABF' as TestType };
      }
      if (!mapped.test_type) {
        return { ...mapped, test_type: 'VABF' as TestType };
      }
      return mapped;
    });
  }, [allItems]);

  const filtered = useMemo(() => {
    let result = profiles;
    if (domainFilter !== 'ALL') {
      result = result.filter(p => p.domain === domainFilter);
    }
    if (testTypeFilter !== 'ALL') {
      result = result.filter(p => p.test_type === testTypeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.domain?.toLowerCase().includes(q) ||
        p.profile_type?.toLowerCase().includes(q) ||
        p.test_type?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [profiles, domainFilter, testTypeFilter, search]);

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Settings2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour gérer ses profils de test.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Profils de test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Profils pour <strong className="text-foreground">{currentProject.name}</strong>
            <span className="mx-1.5">·</span>
            Domaine{enabledDomains.length > 1 ? 's' : ''} :{' '}
            {enabledDomains.map(d => (
              <span key={d} className={`font-medium ${DOMAIN_META[d].textClass}`}>
                {DOMAIN_META[d].shortLabel}
              </span>
            )).reduce((acc: React.ReactNode[], el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-muted-foreground">, </span>, el], [])}
          </p>
        </div>
        {canCreateProfile && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau profil
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un profil..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>

        {/* Test Type Filter */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
          <button onClick={() => setTestTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              testTypeFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}>
            Tous
          </button>
          {ALL_TEST_TYPES.map(tt => {
            const meta = TEST_TYPE_META[tt];
            return (
              <button key={tt} onClick={() => setTestTypeFilter(tt)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  testTypeFilter === tt ? `${meta.bgClass} ${meta.textClass}` : 'text-muted-foreground hover:text-foreground'
                }`}>
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Domain Filter */}
        {enabledDomains.length > 1 && (
          <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
            <button onClick={() => setDomainFilter('ALL')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                domainFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              Tous
            </button>
            {enabledDomains.map(d => {
              const meta = DOMAIN_META[d];
              return (
                <button key={d} onClick={() => setDomainFilter(d)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    domainFilter === d ? `${meta.bgClass} ${meta.textClass}` : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {meta.shortLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Settings2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucun profil</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {testTypeFilter !== 'ALL'
              ? `Aucun profil ${TEST_TYPE_META[testTypeFilter as TestType]?.label || testTypeFilter}.`
              : domainFilter !== 'ALL'
              ? `Aucun profil pour le domaine ${DOMAIN_META[domainFilter as ProfileDomain]?.label || domainFilter}.`
              : 'Créez un profil pour définir les paramètres de test.'}
          </p>
          {canCreateProfile && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Nouveau profil
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((profile) => {
            const domainMeta = profile.domain ? DOMAIN_META[profile.domain as ProfileDomain] : null;
            const typeMeta = profile.profile_type ? PROFILE_TYPE_META[profile.profile_type as ProfileType] : null;
            const Icon = typeMeta?.icon || domainMeta?.icon || Settings2;

            return (
              <div key={profile.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-5 py-4 group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-md ${domainMeta?.bgClass || 'bg-muted'} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${domainMeta?.textClass || 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground truncate">{profile.name}</h3>
                      <TestTypeBadge testType={profile.test_type} />
                      <DomainBadge domain={profile.domain} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <TypeBadge profileType={profile.profile_type} />
                      {profile.target_host && (
                        <span className="text-xs text-muted-foreground font-mono">
                          · {profile.target_host}{profile.target_port ? `:${profile.target_port}` : ''}
                        </span>
                      )}
                    </div>
                    {profile.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-lg">{profile.description}</p>
                    )}
                  </div>
                </div>
                {(canUpdateProfile || canDeleteProfile) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canUpdateProfile && (
                      <button onClick={() => setEditingProfile(profile)}
                        className="text-muted-foreground hover:text-primary transition-colors p-1.5" title="Éditer">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDeleteProfile && (
                      <button onClick={() => deleteMutation.mutate({ profileId: Number(profile.id) })}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1.5" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charger plus */}
      {data?.hasMore && !isLoading && filtered.length > 0 && (
        <div className="flex justify-center py-4">
          <button
            onClick={handleLoadMore}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {isFetching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
            ) : (
              <>Charger plus ({data?.pagination?.total ? `${allItems.length} / ${data.pagination.total}` : '...'})</>
            )}
          </button>
        </div>
      )}

      <CreateProfileModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={currentProject.id}
        projectDomain={currentProject.domain}
      />
      {editingProfile && (
        <EditProfileModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          projectDomain={currentProject?.domain}
        />
      )}
    </div>
  );
}

function EditProfileModal({ profile, onClose, projectDomain }: {
  profile: TestProfile;
  onClose: () => void;
  projectDomain?: string;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description || '');
  const [config, setConfig] = useState<Record<string, unknown>>(profile.config || {});
  const [error, setError] = useState<string | null>(null);
  const [testTypeError, setTestTypeError] = useState(false);

  const { data: scenariosData } = trpc.scenarios.list.useQuery(
    { projectId: profile.project_id || '', page: 1, pageSize: 100 },
    { enabled: !!profile.id },
  );

  const hasScenarios = (scenariosData?.data || []).length > 0;
  const configFields = profile.profile_type ? CONFIG_TEMPLATES[profile.profile_type as ProfileType] : [];

  const mutation = trpc.profiles.update.useMutation({
    onSuccess: () => {
      utils.profiles.list.invalidate();
      onClose();
    },
    onError: (err) => {
      const msg = err.message || 'Erreur lors de la modification.';
      if (msg.includes('409')) {
        setTestTypeError(true);
      }
      setError(msg);
    },
  });

  const handleConfigChange = (key: string, val: unknown) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTestTypeError(false);

    if (!name.trim()) {
      setError('Le nom du profil est requis.');
      return;
    }

    const validationErrors = validateConfig(profile.profile_type as ProfileType, config);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    mutation.mutate({
      profileId: Number(profile.id),
      name: name.trim(),
      description: description.trim(),
      config,
    });
  };

  const domainMeta = profile.domain ? DOMAIN_META[profile.domain as ProfileDomain] : null;
  const testTypeMeta = profile.test_type ? TEST_TYPE_META[profile.test_type] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {domainMeta && (
              <div className={`w-8 h-8 rounded-md ${domainMeta.bgClass} flex items-center justify-center`}>
                <domainMeta.icon className={`w-4 h-4 ${domainMeta.textClass}`} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">Éditer le profil</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {domainMeta && <span className={`font-medium ${domainMeta.textClass}`}>{domainMeta.label}</span>}
                {testTypeMeta && <span className="ml-2">· <span className={`font-medium ${testTypeMeta.textClass}`}>{testTypeMeta.label}</span></span>}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-destructive">{error}</p>
                {testTypeError && hasScenarios && (
                  <p className="text-xs text-destructive/80 mt-1">Le type de test ne peut pas être modifié car des scénarios sont attachés à ce profil.</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nom du profil *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: E2E — Orange Web Production"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle du profil..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none" />
            </div>

            {configFields.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Configuration</h3>
                <div className="space-y-4">
                  {configFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        {field.label}
                        {field.required && <span className="text-destructive"> *</span>}
                      </label>
                      <ConfigFieldInput
                        field={field}
                        value={config[field.key]}
                        onChange={handleConfigChange}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors">
            Annuler
          </button>
          <button type="button" onClick={handleSubmit} disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
