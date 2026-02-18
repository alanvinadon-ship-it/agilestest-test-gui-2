import { useState, useMemo } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApi';
import type { TestProfile, TestScenario, TestType } from '../types';
import {
  Plus, FileText, Loader2, Trash2, X, AlertCircle, Search,
  ChevronDown, GripVertical, ClipboardCheck, Shield, Gauge, Filter, Edit2, Sparkles
} from 'lucide-react';
import SuggestScenariosModal from '../components/SuggestScenariosModal';
import {
  type ProfileDomain, DOMAIN_META, PROFILE_TYPE_META, type ProfileType,
} from '../config/profileDomains';

// ─── Test Type Metadata (shared) ────────────────────────────────────────────

const TEST_TYPE_META: Record<TestType, {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  icon: typeof ClipboardCheck;
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
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ─── Runner suggestion based on test_type + domain ──────────────────────────

function getRunnerSuggestion(testType: TestType, domain?: string): string {
  const map: Record<string, Record<string, string>> = {
    VABF: {
      WEB: 'Playwright / Robot Framework',
      API: 'Newman / k6',
      MOBILE: 'Appium',
      DESKTOP: 'WinAppDriver / Playwright',
      TELECOM_IMS: 'SIPp / pjsua',
      TELECOM_EPC: 'S1AP Tester',
      TELECOM_5GC: 'UERANSIM / Open5GS',
      DRIVE_TEST: 'Log Parser',
    },
    VABE: {
      WEB: 'k6 / JMeter / Gatling',
      API: 'k6 / JMeter / Newman',
      MOBILE: 'Appium + Monkey',
      DESKTOP: 'Load Generator',
      TELECOM_IMS: 'SIPp (charge)',
      TELECOM_EPC: 'S1AP Load',
      TELECOM_5GC: 'UERANSIM (charge)',
      DRIVE_TEST: 'Batch Analyzer',
    },
    VSR: {
      WEB: 'Playwright + Chaos',
      API: 'k6 + Fault Injection',
      MOBILE: 'Appium + Network Sim',
      DESKTOP: 'Resilience Runner',
      TELECOM_IMS: 'SIPp + Sondes',
      TELECOM_EPC: 'S1AP + Sondes',
      TELECOM_5GC: 'UERANSIM + Sondes',
      DRIVE_TEST: 'Field Analyzer',
    },
  };
  return map[testType]?.[domain || 'WEB'] || 'Runner par défaut';
}

// ─── Create Scenario Modal ──────────────────────────────────────────────────

function CreateScenarioModal({ isOpen, onClose, profiles, testTypeFilter }: {
  isOpen: boolean; onClose: () => void; profiles: TestProfile[]; testTypeFilter: string;
}) {
  const { currentProject } = useProject();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profileId, setProfileId] = useState('');
  const [steps, setSteps] = useState([
    { id: 'step-1', order: 0, action: '', description: '', expected_result: '', parameters: {} },
  ]);
  const [error, setError] = useState<string | null>(null);

  // Filter profiles by test_type if a filter is active
  const availableProfiles = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    if (testTypeFilter && testTypeFilter !== 'ALL') {
      return profiles.filter(p => p.test_type === testTypeFilter);
    }
    return profiles;
  }, [profiles, testTypeFilter]);

  const selectedProfile = availableProfiles.find(p => p.id === profileId);

  const mutation = useMutation({
    mutationFn: (data: Partial<TestScenario>) => repositoryApi.createScenario(profileId, data, currentProject?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setName(''); setDescription(''); setProfileId('');
      setSteps([{ id: 'step-1', order: 0, action: '', description: '', expected_result: '', parameters: {} }]);
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || (err as Error)?.message || 'Erreur lors de la création.');
    },
  });

  const addStep = () => setSteps([...steps, { id: `step-${steps.length + 1}`, order: steps.length, action: '', description: '', expected_result: '', parameters: {} }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, value: string) => {
    const newSteps = [...steps];
    if (!newSteps[i].id) newSteps[i].id = `step-${i + 1}`;
    if (newSteps[i].order === undefined) newSteps[i].order = i;
    if (!newSteps[i].parameters) newSteps[i].parameters = {};
    (newSteps[i] as Record<string, unknown>)[field] = value;
    setSteps(newSteps);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !profileId) {
      setError('Le nom et le profil sont requis.');
      return;
    }
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      steps: steps.map((s, i) => ({
        id: `step-${i + 1}`,
        order: i + 1,
        action: s.action,
        description: s.description,
        expected_result: s.expected_result,
        parameters: {},
      })),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-heading font-semibold text-foreground">Nouveau scénario</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Profile selection with test_type info */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Profil associé *</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">— Sélectionner un profil —</option>
              {availableProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  [{p.test_type || 'VABF'}] {p.name} ({p.domain || p.protocol})
                </option>
              ))}
            </select>
          </div>

          {/* Inherited test_type (read-only) */}
          {selectedProfile && (
            <div className="flex items-center gap-3 bg-secondary/30 rounded-md px-4 py-3">
              <span className="text-xs text-muted-foreground">Type de test hérité :</span>
              <TestTypeBadge testType={selectedProfile.test_type} />
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Runner suggéré : <strong className="text-foreground">{getRunnerSuggestion(selectedProfile.test_type || 'VABF' as TestType, selectedProfile.domain)}</strong>
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nom du scénario *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Login + Navigation catalogue"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Étapes du scénario</label>
              <button type="button" onClick={addStep}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80">
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
                        placeholder="Action (ex: NAVIGATE, CLICK, ASSERT)"
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <input type="text" value={step.description} onChange={(e) => updateStep(i, 'description', e.target.value)}
                      placeholder="Description de l'étape"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <input type="text" value={step.expected_result} onChange={(e) => updateStep(i, 'expected_result', e.target.value)}
                      placeholder="Résultat attendu (ex: Page affichée, 200 OK)"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                  </div>
                  {steps.length > 1 && (
                    <button type="button" onClick={() => removeStep(i)}
                      className="text-muted-foreground hover:text-destructive p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editingScenario, setEditingScenario] = useState<TestScenario | null>(null);
  const [suggestProfile, setSuggestProfile] = useState<TestProfile | null>(null);
  const [search, setSearch] = useState('');
  const [testTypeFilter, setTestTypeFilter] = useState<string>('ALL');
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: profilesData, isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles', currentProject?.id],
    queryFn: () => repositoryApi.listProfiles(currentProject!.id),
    enabled: !!currentProject,
  });

  const allProfiles = (profilesData?.data || []) as TestProfile[];

  // Migrate profiles without test_type
  const profiles = useMemo(() => {
    return allProfiles.map(p => {
      if (!p.test_type) return { ...p, test_type: 'VABF' as TestType };
      return p;
    });
  }, [allProfiles]);

  // Filter profiles by test_type
  const filteredProfiles = useMemo(() => {
    let result = profiles;
    if (testTypeFilter !== 'ALL') {
      result = result.filter(p => p.test_type === testTypeFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.test_type?.toLowerCase().includes(q) ||
        p.domain?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [profiles, testTypeFilter, search]);

  const { data: scenariosData, isLoading: loadingScenarios } = useQuery({
    queryKey: ['scenarios', expandedProfile],
    queryFn: () => repositoryApi.listScenarios(expandedProfile!),
    enabled: !!expandedProfile,
  });

  const scenarios = (scenariosData?.data || []) as TestScenario[];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => repositoryApi.deleteScenario(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
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
            Scénarios de test pour <strong className="text-foreground">{currentProject.name}</strong>.
            Chaque scénario hérite le <strong className="text-foreground">test_type</strong> de son profil.
          </p>
        </div>
        {canWrite && profiles.length > 0 && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau scénario
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un profil ou scénario..."
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
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
      </div>

      {loadingProfiles ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">
            {profiles.length === 0 ? 'Aucun profil disponible' : `Aucun profil ${testTypeFilter !== 'ALL' ? TEST_TYPE_META[testTypeFilter as TestType]?.label : ''}`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {profiles.length === 0
              ? 'Créez d\'abord un profil de test avant de définir des scénarios.'
              : 'Aucun profil ne correspond au filtre sélectionné.'}
          </p>
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
                <button
                  type="button"
                  onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TestTypeBadge testType={profile.test_type} />
                    {domainMeta && (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${domainMeta.bgClass} ${domainMeta.textClass}`}>
                        {domainMeta.shortLabel}
                      </span>
                    )}
                    <span className="text-sm font-medium text-foreground">{profile.name}</span>
                    {typeMeta && (
                      <span className="text-xs text-muted-foreground">({typeMeta.label})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground hidden sm:inline">Runner : {runner}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4">
                    {/* Suggest button for this profile */}
                    {canWrite && (
                      <div className="flex items-center justify-end mb-3 gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSuggestProfile(profile); }}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-400 hover:from-amber-500/20 hover:to-orange-500/20 transition-all font-medium"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Suggérer des scénarios (IA)
                        </button>
                      </div>
                    )}

                    {loadingScenarios ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    ) : scenarios.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground mb-3">
                          Aucun scénario pour ce profil.
                        </p>
                        <button
                          onClick={() => setSuggestProfile(profile)}
                          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-400 hover:from-amber-500/20 hover:to-orange-500/20 transition-all font-medium"
                        >
                          <Sparkles className="w-4 h-4" />
                          Suggérer des scénarios avec l'IA
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {scenarios.map((scenario) => (
                          <div key={scenario.id} className="flex items-center justify-between bg-secondary/20 rounded-md px-4 py-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-medium text-foreground">{scenario.name}</h4>
                                <TestTypeBadge testType={profile.test_type} />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {scenario.steps?.length || 0} étape(s) — Créé le {new Date(scenario.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            {canWrite && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => setEditingScenario(scenario)}
                                  className="text-muted-foreground hover:text-primary p-1" title="Éditer">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteMutation.mutate(scenario.id)}
                                  className="text-muted-foreground hover:text-destructive p-1" title="Supprimer">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateScenarioModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        profiles={profiles}
        testTypeFilter={testTypeFilter}
      />
      {editingScenario && (
        <EditScenarioModal
          scenario={editingScenario}
          profile={profiles.find(p => p.id === editingScenario.profile_id)}
          onClose={() => setEditingScenario(null)}
        />
      )}

      {/* Suggest Scenarios Modal */}
      {suggestProfile && (
        <SuggestScenariosModal
          profile={suggestProfile}
          projectId={currentProject.id}
          projectName={currentProject.name}
          open={!!suggestProfile}
          onClose={() => setSuggestProfile(null)}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ['scenarios'] });
          }}
        />
      )}
    </div>
  );
}

function EditScenarioModal({ scenario, profile, onClose }: {
  scenario: TestScenario;
  profile?: TestProfile;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(scenario.name);
  const [description, setDescription] = useState(scenario.description || '');
  const [steps, setSteps] = useState(scenario.steps || [{ id: 'step-1', order: 0, action: '', description: '', expected_result: '', parameters: {} }]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: Partial<TestScenario>) => repositoryApi.updateScenario(scenario.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || (err as Error)?.message || 'Erreur lors de la modification.');
    },
  });

  const handleStepChange = (index: number, field: string, value: string) => {
    const newSteps = [...steps];
    if (!newSteps[index].id) newSteps[index].id = `step-${Date.now()}-${index}`;
    if (newSteps[index].order === undefined) newSteps[index].order = index;
    if (!newSteps[index].parameters) newSteps[index].parameters = {};
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleAddStep = () => {
    setSteps([...steps, { id: `step-${Date.now()}`, order: steps.length, action: '', description: '', expected_result: '', parameters: {} }]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom du scénario est requis.');
      return;
    }

    if (steps.length === 0) {
      setError('Au moins une étape est requise.');
      return;
    }

    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      steps,
    });
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
              <h2 className="text-lg font-heading font-semibold text-foreground">Éditer le scénario</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile?.name}
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
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nom du scénario *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Connexion et navigation"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle du scénario..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Étapes du scénario</h3>
                <button type="button" onClick={handleAddStep}
                  className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  + Ajouter une étape
                </button>
              </div>
              <div className="space-y-4">
                {steps.map((step, idx) => (
                  <div key={idx} className="border border-border rounded-md p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Étape {idx + 1}</span>
                      {steps.length > 1 && (
                        <button type="button" onClick={() => handleRemoveStep(idx)}
                          className="text-xs text-destructive hover:text-destructive/80">
                          Supprimer
                        </button>
                      )}
                    </div>
                    <input type="text" value={step.action} onChange={(e) => handleStepChange(idx, 'action', e.target.value)}
                      placeholder="Action (ex: Cliquer sur le bouton Connexion)"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <input type="text" value={step.description} onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                      placeholder="Description (optionnel)"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <input type="text" value={step.expected_result} onChange={(e) => handleStepChange(idx, 'expected_result', e.target.value)}
                      placeholder="Résultat attendu (ex: Redirection vers le dashboard)"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                  </div>
                ))}
              </div>
            </div>
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
