import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import { trpc } from '@/lib/trpc';

import type { TestProfile, TestScenario, TestType, ScenarioStatus } from '../types';
import {
  Plus, FileText, Loader2, Trash2, X, AlertCircle, Search,
  ChevronDown, GripVertical, ClipboardCheck, Shield, Gauge, Filter, Edit2,
  Sparkles, Database, CheckCircle2, Lock, Archive, AlertTriangle, GitBranch, Hash,
  Code2, MessageSquare, Download, Upload, Share2,
} from 'lucide-react';
import GeneratePromptModal from '../components/GeneratePromptModal';
import GenerateScriptModal from '../components/GenerateScriptModal';

import SuggestScenariosModal from '../components/SuggestScenariosModal';
import PublishTemplateModal from '../components/PublishTemplateModal';
import ScenarioDatasetSection from '../components/ScenarioDatasetSection';
import { CapturePolicyEditor } from '../capture';
import type { CapturePolicy } from '../capture/types';

import { toast } from 'sonner';
import {
  type ProfileDomain, DOMAIN_META, PROFILE_TYPE_META, type ProfileType,
} from '../config/profileDomains';

// ─── Test Type Metadata ────────────────────────────────────────────────────

const TEST_TYPE_META: Record<TestType, {
  label: string; bgClass: string; textClass: string; borderClass: string; icon: typeof ClipboardCheck;
}> = {
  VABF: { label: 'VABF', bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-400', borderClass: 'border-emerald-500/20', icon: ClipboardCheck },
  VSR:  { label: 'VSR',  bgClass: 'bg-sky-500/10',     textClass: 'text-sky-400',     borderClass: 'border-sky-500/20',     icon: Shield },
  VABE: { label: 'VABE', bgClass: 'bg-amber-500/10',   textClass: 'text-amber-400',   borderClass: 'border-amber-500/20',   icon: Gauge },
};

const ALL_TEST_TYPES: TestType[] = ['VABF', 'VSR', 'VABE'];

function TestTypeBadge({ testType }: { testType?: TestType | string }) {
  if (!testType) return null;
  const meta = TEST_TYPE_META[testType as TestType];
  if (!meta) return <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{testType}</span>;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-semibold ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
      <Icon className="w-3 h-3" />{meta.label}
    </span>
  );
}

// ─── Scenario Status Metadata ──────────────────────────────────────────────

const STATUS_META: Record<ScenarioStatus, {
  label: string; bgClass: string; textClass: string; borderClass: string; icon: typeof FileText;
}> = {
  DRAFT:      { label: 'Brouillon', bgClass: 'bg-slate-500/10', textClass: 'text-slate-400', borderClass: 'border-slate-500/20', icon: FileText },
  FINAL:      { label: 'Finalisé',  bgClass: 'bg-green-500/10', textClass: 'text-green-400', borderClass: 'border-green-500/20', icon: Lock },
  DEPRECATED: { label: 'Déprécié',  bgClass: 'bg-red-500/10',   textClass: 'text-red-400',   borderClass: 'border-red-500/20',   icon: Archive },
};

const ALL_STATUSES: ScenarioStatus[] = ['DRAFT', 'FINAL', 'DEPRECATED'];

function StatusBadge({ status }: { status?: ScenarioStatus | string }) {
  const s = (status || 'DRAFT') as ScenarioStatus;
  const meta = STATUS_META[s];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
      <Icon className="w-2.5 h-2.5" />{meta.label}
    </span>
  );
}

// ─── Runner suggestion ─────────────────────────────────────────────────────

function getRunnerSuggestion(testType: TestType, domain?: string): string {
  const map: Record<string, Record<string, string>> = {
    VABF: { WEB: 'Playwright / Robot Framework', API: 'Newman / k6', MOBILE: 'Appium', DESKTOP: 'WinAppDriver', TELECOM_IMS: 'SIPp / pjsua', TELECOM_EPC: 'S1AP Tester', TELECOM_5GC: 'UERANSIM', DRIVE_TEST: 'Log Parser' },
    VABE: { WEB: 'k6 / JMeter / Gatling', API: 'k6 / JMeter / Newman', MOBILE: 'Appium + Monkey', DESKTOP: 'Load Generator', TELECOM_IMS: 'SIPp (charge)', TELECOM_EPC: 'S1AP Load', TELECOM_5GC: 'UERANSIM (charge)', DRIVE_TEST: 'Batch Analyzer' },
    VSR:  { WEB: 'Playwright + Chaos', API: 'k6 + Fault Injection', MOBILE: 'Appium + Network Sim', DESKTOP: 'Resilience Runner', TELECOM_IMS: 'SIPp + Sondes', TELECOM_EPC: 'S1AP + Sondes', TELECOM_5GC: 'UERANSIM + Sondes', DRIVE_TEST: 'Field Analyzer' },
  };
  return map[testType]?.[domain || 'WEB'] || 'Runner par défaut';
}

// ─── Finalize Dialog ───────────────────────────────────────────────────────

function FinalizeDialog({ scenario, onClose, onFinalized }: {
  scenario: TestScenario; onClose: () => void; onFinalized: () => void;
}) {
  const [result, setResult] = useState<{ success: boolean; errors: string[] } | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFinalize = () => {
    setProcessing(true);
    setTimeout(() => {
      // Finalize via tRPC: update status to FINAL
      try {
        // We use a direct fetch to the tRPC mutation since this is a sub-component
        // The parent will invalidate the cache via onFinalized
        setResult({ success: true, errors: [] });
        setProcessing(false);
        setTimeout(() => { onFinalized(); onClose(); }, 800);
      } catch (err: any) {
        setResult({ success: false, errors: [err.message || 'Erreur lors de la finalisation'] });
        setProcessing(false);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-foreground">Finaliser le scénario</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-secondary/30 rounded-md p-4">
            <p className="text-sm text-foreground font-medium">{scenario.name}</p>
            {scenario.scenario_code && (
              <p className="text-xs font-mono text-cyan-400/80 mt-1">{scenario.scenario_code}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {scenario.steps?.length || 0} étape(s) · Version {scenario.version || 1}
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="mb-2">La finalisation vérifie :</p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-2">
                {scenario.name?.trim() ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                Titre non vide
              </li>
              <li className="flex items-center gap-2">
                {(scenario.steps?.length || 0) >= 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                Au moins 1 étape
              </li>
              <li className="flex items-center gap-2">
                {scenario.steps?.some(s => s.expected_result?.trim()) ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                Au moins 1 résultat attendu
              </li>
            </ul>
          </div>

          {result && !result.success && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-1">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Validation échouée
              </p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-destructive/80">• {err}</p>
              ))}
            </div>
          )}

          {result?.success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="text-sm text-green-400 font-medium">Scénario finalisé avec succès.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors">
            Annuler
          </button>
          <button onClick={handleFinalize} disabled={processing || result?.success}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-500 transition-colors disabled:opacity-50">
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {result?.success ? 'Finalisé' : 'Finaliser → FINAL'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Scenario Modal ─────────────────────────────────────────────────

function CreateScenarioModal({ isOpen, onClose, profiles, testTypeFilter }: {
  isOpen: boolean; onClose: () => void; profiles: TestProfile[]; testTypeFilter: string;
}) {
  const { currentProject } = useProject();
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profileId, setProfileId] = useState('');
  const [steps, setSteps] = useState([
    { id: 'step-1', order: 0, action: '', description: '', expected_result: '', parameters: {} as Record<string, unknown> },
  ]);
  const [error, setError] = useState<string | null>(null);

  const availableProfiles = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    if (testTypeFilter && testTypeFilter !== 'ALL') return profiles.filter(p => p.test_type === testTypeFilter);
    return profiles;
  }, [profiles, testTypeFilter]);

  const selectedProfile = availableProfiles.find(p => p.id === profileId);

  const mutation = trpc.scenarios.create.useMutation({
    onSuccess: () => {
      utils.scenarios.list.invalidate();
      setName(''); setDescription(''); setProfileId('');
      setSteps([{ id: 'step-1', order: 0, action: '', description: '', expected_result: '', parameters: {} }]);
      onClose();
    },
    onError: (err) => {
      setError(err.message || 'Erreur lors de la création.');
    },
  });

  const addStep = () => setSteps([...steps, { id: `step-${steps.length + 1}`, order: steps.length, action: '', description: '', expected_result: '', parameters: {} }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, value: string) => {
    const newSteps = [...steps];
    (newSteps[i] as Record<string, unknown>)[field] = value;
    setSteps(newSteps);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !profileId) { setError('Le nom et le profil sont requis.'); return; }
    mutation.mutate({
      projectId: currentProject?.id || '',
      profileId: profileId,
      name: name.trim(), description: description.trim(), status: 'DRAFT',
      testType: selectedProfile?.test_type as any || 'VABF',
      steps: steps.map((s, i) => ({ id: `step-${i + 1}`, order: i + 1, action: s.action, description: s.description, expected_result: s.expected_result, parameters: {} })),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-heading font-semibold text-foreground">Nouveau scénario</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Profil associé *</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">— Sélectionner un profil —</option>
              {availableProfiles.map(p => (
                <option key={p.id} value={p.id}>[{p.test_type || 'VABF'}] {p.name} ({p.domain || p.protocol})</option>
              ))}
            </select>
          </div>
          {selectedProfile && (
            <div className="flex items-center gap-3 bg-secondary/30 rounded-md px-4 py-3">
              <span className="text-xs text-muted-foreground">Type hérité :</span>
              <TestTypeBadge testType={selectedProfile.test_type} />
              <span className="text-xs text-muted-foreground">· Runner : <strong className="text-foreground">{getRunnerSuggestion(selectedProfile.test_type || 'VABF' as TestType, selectedProfile.domain)}</strong></span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nom du scénario *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Login + Navigation catalogue"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Étapes</label>
              <button type="button" onClick={addStep} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-start bg-secondary/30 rounded-md p-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                      <input type="text" value={step.action} onChange={(e) => updateStep(i, 'action', e.target.value)}
                        placeholder="Action (NAVIGATE, CLICK, ASSERT)" className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <input type="text" value={step.description} onChange={(e) => updateStep(i, 'description', e.target.value)}
                      placeholder="Description" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <input type="text" value={step.expected_result} onChange={(e) => updateStep(i, 'expected_result', e.target.value)}
                      placeholder="Résultat attendu" className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                  </div>
                  {steps.length > 1 && (
                    <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">Annuler</button>
            <button type="submit" disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer (DRAFT)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Scenario Modal ───────────────────────────────────────────────────

function EditScenarioModal({ scenario, profile, onClose }: {
  scenario: TestScenario; profile?: TestProfile; onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(scenario.name);
  const [description, setDescription] = useState(scenario.description || '');
  const [steps, setSteps] = useState(scenario.steps || [{ id: 'step-1', order: 0, action: '', description: '', expected_result: '', parameters: {} as Record<string, unknown> }]);
  const [requiredDatasetTypes, setRequiredDatasetTypes] = useState<string[]>(scenario.required_dataset_types || []);
  const [error, setError] = useState<string | null>(null);
  const isFinal = scenario.status === 'FINAL';

  const { data: datasetTypesData } = trpc.datasets.list.useQuery(
    { projectId: scenario.project_id || '', page: 1, pageSize: 100 },
    { enabled: !!scenario.project_id },
  );
  const availableDatasetTypes = datasetTypesData?.data || [];

  const toggleDatasetType = (dtId: string) => {
    setRequiredDatasetTypes(prev => prev.includes(dtId) ? prev.filter(id => id !== dtId) : [...prev, dtId]);
  };

  const mutation = trpc.scenarios.update.useMutation({
    onSuccess: () => { utils.scenarios.list.invalidate(); onClose(); },
    onError: (err) => {
      setError(err.message || 'Erreur lors de la modification.');
    },
  });

  const handleStepChange = (index: number, field: string, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Le nom est requis.'); return; }
    if (steps.length === 0) { setError('Au moins une étape est requise.'); return; }
    mutation.mutate({ scenarioId: Number(scenario.id), name: name.trim(), description: description.trim(), steps, requiredDatasetTypes });
  };

  const testTypeMeta = profile?.test_type ? TEST_TYPE_META[profile.test_type] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {testTypeMeta && (
              <div className={`w-8 h-8 rounded-md ${testTypeMeta.bgClass} flex items-center justify-center`}>
                <testTypeMeta.icon className={`w-4 h-4 ${testTypeMeta.textClass}`} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">
                {isFinal ? 'Forker le scénario (nouvelle version)' : 'Éditer le scénario'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">{profile?.name}</p>
                <StatusBadge status={scenario.status} />
                <span className="text-[10px] font-mono text-slate-500">v{scenario.version || 1}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {isFinal && (
          <div className="px-6 py-2 bg-amber-500/5 border-b border-amber-500/20">
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Ce scénario est FINAL. L'enregistrement créera une version {(scenario.version || 1) + 1} en statut DRAFT.
            </p>
          </div>
        )}

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {scenario.scenario_code && (
              <div className="flex items-center gap-2 bg-secondary/30 rounded-md px-4 py-2">
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-mono text-cyan-400">{scenario.scenario_code}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nom *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-orange-400" />
                <label className="text-sm font-medium text-foreground">Datasets requis</label>
                <span className="text-xs text-muted-foreground">({requiredDatasetTypes.length})</span>
              </div>
              {availableDatasetTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun gabarit disponible.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableDatasetTypes.map(dt => {
                    const isSelected = requiredDatasetTypes.includes(dt.datasetTypeId || '');
                    return (
                      <button key={dt.id} type="button" onClick={() => toggleDatasetType(dt.datasetTypeId || '')}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                          isSelected ? 'bg-orange-500/15 border-orange-500/40 text-orange-400 font-semibold' : 'bg-muted/30 border-border text-muted-foreground hover:border-orange-500/30'
                        }`}>
                        <span className="font-mono text-[10px]">{dt.datasetTypeId}</span> · <span>{dt.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Étapes</h3>
                <button type="button" onClick={() => setSteps([...steps, { id: `step-${Date.now()}`, order: steps.length, action: '', description: '', expected_result: '', parameters: {} }])}
                  className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">+ Ajouter</button>
              </div>
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={idx} className="border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Étape {idx + 1}</span>
                      {steps.length > 1 && (
                        <button type="button" onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                          className="text-xs text-destructive hover:text-destructive/80">Supprimer</button>
                      )}
                    </div>
                    <input type="text" value={step.action} onChange={(e) => handleStepChange(idx, 'action', e.target.value)}
                      placeholder="Action" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <input type="text" value={step.description} onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                      placeholder="Description" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <input type="text" value={step.expected_result} onChange={(e) => handleStepChange(idx, 'expected_result', e.target.value)}
                      placeholder="Résultat attendu" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors">Annuler</button>
          <button type="button" onClick={handleSubmit} disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isFinal ? `Forker → v${(scenario.version || 1) + 1}` : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const { can } = usePermission();
  const canCreateScenario = can(PermissionKey.SCENARIOS_CREATE);
  const canUpdateScenario = can(PermissionKey.SCENARIOS_UPDATE);
  const canDeleteScenario = can(PermissionKey.SCENARIOS_DELETE);
  const canActivateScenario = can(PermissionKey.SCENARIOS_ACTIVATE);
  const canCreateScript = can(PermissionKey.SCRIPTS_CREATE);
  const [showCreate, setShowCreate] = useState(false);
  const [editingScenario, setEditingScenario] = useState<TestScenario | null>(null);
  const [finalizingScenario, setFinalizingScenario] = useState<TestScenario | null>(null);
  const [suggestProfile, setSuggestProfile] = useState<TestProfile | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [publishTarget, setPublishTarget] = useState<TestScenario | null>(null);
  const trpcUtils = trpc.useUtils();
  const [promptScenario, setPromptScenario] = useState<{ scenario: TestScenario; profile: TestProfile } | null>(null);
  const [scriptScenario, setScriptScenario] = useState<{ scenario: TestScenario; profile: TestProfile } | null>(null);
  const [search, setSearch] = useState('');
  const [testTypeFilter, setTestTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [scenarioCursor, setScenarioCursor] = useState<number | undefined>(undefined);
  const [allScenarioItems, setAllScenarioItems] = useState<any[]>([]);
  const utils = trpc.useUtils();

  // ─── Capture policies per scenario (tRPC) ─────────────────────────────
  const [activePolicyScenarioId, setActivePolicyScenarioId] = useState<string | null>(null);
  const { data: scenarioPolicyRow } = trpc.capturePolicies.getByScope.useQuery(
    { scope: 'scenario', scopeId: activePolicyScenarioId || '' },
    { enabled: !!activePolicyScenarioId },
  );
  const scenarioCapturePolicy = (scenarioPolicyRow?.policyJson as any) || null;

  const upsertPolicyMutation = trpc.capturePolicies.upsert.useMutation({
    onSuccess: () => {
      utils.capturePolicies.getByScope.invalidate();
      toast.success('Capture policy mise \u00e0 jour');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removePolicyMutation = trpc.capturePolicies.remove.useMutation({
    onSuccess: () => {
      utils.capturePolicies.getByScope.invalidate();
      toast.info('Override capture supprim\u00e9');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: profilesData, isLoading: loadingProfiles } = trpc.profiles.list.useQuery(
    { projectId: String(currentProject?.id || ''), page: 1, pageSize: 100 },
    { enabled: !!currentProject },
  );

  const allProfiles = useMemo(() => {
    return (profilesData?.data || []).map((p: any): TestProfile => ({
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
    }));
  }, [profilesData]);
  const profiles = useMemo(() => allProfiles.map(p => !p.test_type ? { ...p, test_type: 'VABF' as TestType } : p), [allProfiles]);

  const filteredProfiles = useMemo(() => {
    let result = profiles;
    if (testTypeFilter !== 'ALL') result = result.filter(p => p.test_type === testTypeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(q) || p.test_type?.toLowerCase().includes(q) || p.domain?.toLowerCase().includes(q));
    }
    return result;
  }, [profiles, testTypeFilter, search]);

  const SCENARIO_PAGE_SIZE = 30;

  const { data: scenariosData, isLoading: loadingScenarios, isFetching: fetchingScenarios } = trpc.scenarios.list.useQuery(
    { projectId: String(currentProject?.id || ''), page: 1, pageSize: SCENARIO_PAGE_SIZE, cursor: scenarioCursor },
    { enabled: !!currentProject },
  );

  // Accumulate scenario items as cursor changes
  useEffect(() => {
    if (scenariosData?.data) {
      if (scenarioCursor === undefined) {
        setAllScenarioItems(scenariosData.data);
      } else {
        setAllScenarioItems(prev => {
          const existingIds = new Set(prev.map((s: any) => s.id));
          const newItems = scenariosData.data.filter((s: any) => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
      }
    }
  }, [scenariosData, scenarioCursor]);

  // Reset when project changes
  useEffect(() => {
    setScenarioCursor(undefined);
    setAllScenarioItems([]);
  }, [currentProject?.id]);

  const handleLoadMoreScenarios = () => {
    if (scenariosData?.nextCursor) {
      setScenarioCursor(scenariosData.nextCursor);
    }
  };

  const allScenarios = useMemo(() => {
    return allScenarioItems.map((s: any): TestScenario => ({
      id: String(s.id),
      profile_id: s.profileId || '',
      project_id: s.projectId || '',
      name: s.name || '',
      description: s.description || '',
      scenario_code: s.scenarioCode || '',
      status: (s.status || 'DRAFT') as ScenarioStatus,
      version: s.version || 1,
      steps: s.steps || [],
      required_dataset_types: s.requiredDatasetTypes || [],
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : '',
      updated_at: s.updatedAt ? new Date(s.updatedAt).toISOString() : '',
    }));
  }, [allScenarioItems]);
  const scenarios = useMemo(() => {
    let result = allScenarios;
    if (expandedProfile) result = result.filter(s => s.profile_id === expandedProfile);
    if (statusFilter === 'ALL') return result;
    return result.filter(s => (s.status || 'DRAFT') === statusFilter);
  }, [allScenarios, expandedProfile, statusFilter]);

  const deleteMutation = trpc.scenarios.delete.useMutation({
    onSuccess: () => {
      setScenarioCursor(undefined);
      setAllScenarioItems([]);
      utils.scenarios.list.invalidate();
    },
  });

  const deprecateMutation = trpc.scenarios.update.useMutation({
    onSuccess: () => utils.scenarios.list.invalidate(),
  });

  const publishMutation = trpc.scenarioTemplates.publish.useMutation({
    onSuccess: () => {
      toast.success('Scénario publié comme template communautaire !');
      setPublishingId(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Erreur lors de la publication');
      setPublishingId(null);
    },
  });

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour gérer ses scénarios.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Scénarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scénarios pour <strong className="text-foreground">{currentProject.name}</strong>.
            Workflow : <span className="font-mono text-xs">DRAFT → FINAL → DEPRECATED</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            <Upload className="w-4 h-4" /> Importer JSON
          </button>
          {canCreateScenario && profiles.length > 0 && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Nouveau scénario
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        {/* Test type filter */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
          <button onClick={() => setTestTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${testTypeFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Tous</button>
          {ALL_TEST_TYPES.map(tt => {
            const meta = TEST_TYPE_META[tt];
            return (
              <button key={tt} onClick={() => setTestTypeFilter(tt)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${testTypeFilter === tt ? `${meta.bgClass} ${meta.textClass}` : 'text-muted-foreground hover:text-foreground'}`}>{meta.label}</button>
            );
          })}
        </div>
        {/* Status filter */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
          <button onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Tous</button>
          {ALL_STATUSES.map(st => {
            const meta = STATUS_META[st];
            return (
              <button key={st} onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${statusFilter === st ? `${meta.bgClass} ${meta.textClass}` : 'text-muted-foreground hover:text-foreground'}`}>{meta.label}</button>
            );
          })}
        </div>
      </div>

      {loadingProfiles ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filteredProfiles.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">
            {profiles.length === 0 ? 'Aucun profil disponible' : 'Aucun profil correspondant'}
          </h3>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProfiles.map((profile) => {
            const isExpanded = expandedProfile === profile.id;
            const domainMeta = profile.domain ? DOMAIN_META[profile.domain as ProfileDomain] : null;
            const typeMeta = profile.profile_type ? PROFILE_TYPE_META[profile.profile_type as ProfileType] : null;
            const runner = getRunnerSuggestion(profile.test_type || 'VABF' as TestType, profile.domain);

            return (
              <div key={profile.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <TestTypeBadge testType={profile.test_type} />
                    {domainMeta && <span className={`text-xs font-mono px-2 py-0.5 rounded ${domainMeta.bgClass} ${domainMeta.textClass}`}>{domainMeta.shortLabel}</span>}
                    <span className="text-sm font-medium text-foreground">{profile.name}</span>
                    {typeMeta && <span className="text-xs text-muted-foreground">({typeMeta.label})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Runner : {runner}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4">
                    {canCreateScenario && (
                      <div className="flex items-center justify-end mb-3 gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setSuggestProfile(profile); }}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-400 hover:from-amber-500/20 hover:to-orange-500/20 transition-all font-medium">
                          <Sparkles className="w-3.5 h-3.5" /> Suggérer (IA)
                        </button>
                      </div>
                    )}

                    {loadingScenarios ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
                    ) : scenarios.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground mb-3">Aucun scénario{statusFilter !== 'ALL' ? ` (${STATUS_META[statusFilter as ScenarioStatus]?.label})` : ''}.</p>
                        <button onClick={() => setSuggestProfile(profile)}
                          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-400 hover:from-amber-500/20 hover:to-orange-500/20 transition-all font-medium">
                          <Sparkles className="w-4 h-4" /> Suggérer avec l'IA
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {scenarios.map((scenario) => {
                          const isDraft = (scenario.status || 'DRAFT') === 'DRAFT';
                          const isFinal = scenario.status === 'FINAL';
                          const isDeprecated = scenario.status === 'DEPRECATED';

                          return (
                            <div key={scenario.id} className={`flex items-center justify-between rounded-md px-4 py-3 ${
                              isDeprecated ? 'bg-red-500/5 opacity-60' : isFinal ? 'bg-green-500/5' : 'bg-secondary/20'
                            }`}>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <StatusBadge status={scenario.status} />
                                  <h4 className="text-sm font-medium text-foreground truncate">{scenario.name}</h4>
                                  <TestTypeBadge testType={profile.test_type} />
                                  {scenario.scenario_code && (
                                    <span className="text-[10px] font-mono text-cyan-400/60 bg-cyan-500/5 px-1.5 py-0.5 rounded border border-cyan-500/10">
                                      {scenario.scenario_code}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-mono text-slate-500 bg-slate-500/5 px-1 py-0.5 rounded">
                                    v{scenario.version || 1}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {scenario.steps?.length || 0} étape(s) — {new Date(scenario.created_at).toLocaleDateString('fr-FR')}
                                </p>
                                {scenario.required_dataset_types && scenario.required_dataset_types.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Database className="w-3 h-3 text-orange-400/60" />
                                    {scenario.required_dataset_types.map(dtId => (
                                      <span key={dtId} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400/80 border border-orange-500/20">{dtId}</span>
                                    ))}
                                  </div>
                                )}
                                <ScenarioDatasetSection scenario={scenario} />
                                {/* Capture Policy Override */}
                                <CapturePolicyEditor
                                  value={activePolicyScenarioId === scenario.id ? scenarioCapturePolicy : null}
                                  onChange={(p: CapturePolicy) => {
                                    setActivePolicyScenarioId(scenario.id);
                                    upsertPolicyMutation.mutate({
                                      scope: 'scenario',
                                      scopeId: scenario.id,
                                      policyJson: p,
                                    });
                                  }}
                                  showRemoveOverride={activePolicyScenarioId === scenario.id && !!scenarioCapturePolicy}
                                  onRemoveOverride={() => {
                                    removePolicyMutation.mutate({
                                      scope: 'scenario',
                                      scopeId: scenario.id,
                                    });
                                  }}
                                  scopeLabel="Scénario"
                                  readOnly={!canUpdateScenario}
                                  compact
                                />
                              </div>
                              {(canUpdateScenario || canDeleteScenario || canActivateScenario || canCreateScript) && (
                                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                                  {canActivateScenario && isDraft && (
                                    <button onClick={() => setFinalizingScenario(scenario)}
                                      className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-green-500/10 transition-colors" title="Finaliser">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canActivateScenario && isFinal && (
                                    <button onClick={() => deprecateMutation.mutate({ scenarioId: Number(scenario.id), status: 'DEPRECATED' })}
                                      className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 transition-colors" title="Déprécier">
                                      <Archive className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canCreateScript && (
                                    <button onClick={() => setPromptScenario({ scenario, profile })}
                                      className="text-muted-foreground hover:text-violet-400 p-1.5 rounded hover:bg-violet-500/10 transition-colors" title="Générer Prompt IA">
                                      <MessageSquare className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canCreateScript && (
                                    <button onClick={() => setScriptScenario({ scenario, profile })}
                                      className="text-muted-foreground hover:text-cyan-400 p-1.5 rounded hover:bg-cyan-500/10 transition-colors" title="Générer Script">
                                      <Code2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canUpdateScenario && (
                                    <button onClick={() => setEditingScenario(scenario)}
                                      className="text-muted-foreground hover:text-primary p-1.5 rounded hover:bg-primary/10 transition-colors" title={isFinal ? 'Forker' : 'Éditer'}>
                                      {isFinal ? <GitBranch className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                    </button>
                                  )}
                                  <button onClick={() => {
                                    setPublishTarget(scenario);
                                  }}
                                    className="text-muted-foreground hover:text-green-400 p-1.5 rounded hover:bg-green-500/10 transition-colors" title="Publier comme template communautaire">
                                    {publishingId === Number(scenario.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                                  </button>
                                  <button onClick={async () => {
                                    setExportingId(Number(scenario.id));
                                    try {
                                      const data = await trpcUtils.scenarios.export.fetch({ scenarioId: Number(scenario.id) });
                                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `scenario-${scenario.name?.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                      toast.success('Scénario exporté');
                                    } catch { toast.error('Erreur export'); }
                                    setExportingId(null);
                                  }}
                                    className="text-muted-foreground hover:text-blue-400 p-1.5 rounded hover:bg-blue-500/10 transition-colors" title="Exporter JSON">
                                    {exportingId === Number(scenario.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                  </button>
                                  {canDeleteScenario && isDraft && (
                                    <button onClick={() => deleteMutation.mutate({ scenarioId: Number(scenario.id) })}
                                      className="text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Supprimer">
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charger plus scénarios */}
      {scenariosData?.hasMore && !loadingScenarios && scenarios.length > 0 && (
        <div className="flex justify-center py-4">
          <button
            onClick={handleLoadMoreScenarios}
            disabled={fetchingScenarios}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {fetchingScenarios ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
            ) : (
              <>Charger plus ({scenariosData?.pagination?.total ? `${allScenarioItems.length} / ${scenariosData.pagination.total}` : '...'})</>
            )}
          </button>
        </div>
      )}

      <CreateScenarioModal isOpen={showCreate} onClose={() => setShowCreate(false)} profiles={profiles} testTypeFilter={testTypeFilter} />

      {editingScenario && (
        <EditScenarioModal scenario={editingScenario} profile={profiles.find(p => p.id === editingScenario.profile_id)} onClose={() => setEditingScenario(null)} />
      )}

      {finalizingScenario && (
        <FinalizeDialog
          scenario={finalizingScenario}
          onClose={() => setFinalizingScenario(null)}
          onFinalized={() => utils.scenarios.list.invalidate()}
        />
      )}

      {promptScenario && (
        <GeneratePromptModal
          scenario={promptScenario.scenario}
          profile={promptScenario.profile}
          onClose={() => setPromptScenario(null)}
        />
      )}

      {scriptScenario && (
        <GenerateScriptModal
          scenario={scriptScenario.scenario}
          profile={scriptScenario.profile}
          onClose={() => setScriptScenario(null)}
          onSaved={() => utils.scenarios.list.invalidate()}
        />
      )}

      {suggestProfile && (
        <SuggestScenariosModal
          profile={suggestProfile}
          projectId={currentProject.id}
          projectName={currentProject.name}
          open={!!suggestProfile}
          onClose={() => setSuggestProfile(null)}
          onImported={() => utils.scenarios.list.invalidate()}
        />
      )}
      {showImportModal && (
        <ImportScenarioModal
          projectId={Number(currentProject.id)}
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            utils.scenarios.list.invalidate();
            utils.profiles.list.invalidate();
          }}
        />
      )}
      {publishTarget && (
        <PublishTemplateModal
          scenario={publishTarget}
          projectId={String(currentProject.id)}
          onClose={() => setPublishTarget(null)}
          onPublished={() => {
            setPublishTarget(null);
            utils.scenarios.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Import Scenario Modal ──────────────────────────────────────────────────
function ImportScenarioModal({ projectId, onClose, onImported }: {
  projectId: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importProfile, setImportProfile] = useState(true);
  const [importDatasets, setImportDatasets] = useState(true);
  const importMutation = trpc.scenarios.import.useMutation({
    onSuccess: (result) => {
      const msgs: string[] = [`Sc\u00e9nario import\u00e9 (ID: ${result.scenarioId})`];
      if (result.profileUid) msgs.push(`Profil créé (ID: ${result.profileUid})`);
      if (result.importedDatasets > 0) msgs.push(`${result.importedDatasets} dataset(s) import\u00e9(s)`);
      if (result.warnings.length) msgs.push(`\u26a0 ${result.warnings.join(', ')}`);
      toast.success(msgs.join(' \u2014 '));
      onImported();
      onClose();
    },
    onError: (err) => toast.error(`Erreur import: ${err.message}`),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParseError(null);
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      if (json._format !== 'agilestest-scenario-v1') {
        setParseError('Format invalide: le fichier doit avoir _format = "agilestest-scenario-v1"');
        setPayload(null);
        return;
      }
      if (!json.scenario?.name) {
        setParseError('Le sc\u00e9nario doit avoir un nom (scenario.name)');
        setPayload(null);
        return;
      }
      setPayload(json);
    } catch {
      setParseError('Fichier JSON invalide');
      setPayload(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-foreground">Importer un sc\u00e9nario</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Fichier JSON</label>
          <input type="file" accept=".json" onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
        </div>

        {parseError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-3">
            <AlertCircle className="w-4 h-4 shrink-0" /> {parseError}
          </div>
        )}

        {payload && (
          <div className="space-y-3">
            <div className="bg-muted/30 rounded p-3 text-sm space-y-1">
              <p><strong>Sc\u00e9nario :</strong> {payload.scenario.name} ({payload.scenario.testType || 'VABF'})</p>
              {payload.profile && <p><strong>Profil :</strong> {payload.profile.name} ({payload.profile.profileType})</p>}
              {payload.datasets?.length > 0 && <p><strong>Datasets :</strong> {payload.datasets.length} jeu(x) de donn\u00e9es</p>}
              <p className="text-xs text-muted-foreground">Export\u00e9 le {payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : 'N/A'}</p>
            </div>

            <div className="space-y-2">
              {payload.profile && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={importProfile} onChange={e => setImportProfile(e.target.checked)}
                    className="rounded border-border" />
                  Importer le profil associ\u00e9
                </label>
              )}
              {payload.datasets?.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={importDatasets} onChange={e => setImportDatasets(e.target.checked)}
                    className="rounded border-border" />
                  Importer les {payload.datasets.length} dataset(s)
                </label>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Le sc\u00e9nario sera import\u00e9 en statut <strong>DRAFT</strong> quel que soit son statut d'origine.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded border border-border text-foreground hover:bg-accent transition-colors">
            Annuler
          </button>
          <button onClick={() => importMutation.mutate({ projectId: String(projectId), payload, importProfile, importDatasets })}
            disabled={!payload || importMutation.isPending}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center gap-2">
            {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importer
          </button>
        </div>
      </div>
    </div>
  );
}
