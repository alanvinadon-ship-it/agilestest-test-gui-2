import { useState } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryApi } from '../api/repositoryApi';
import type { TestProfile, TestScenario } from '../types';
import {
  Plus, FileText, Loader2, Trash2, X, AlertCircle, Search,
  ChevronDown, GripVertical
} from 'lucide-react';

function CreateScenarioModal({ isOpen, onClose, profiles }: {
  isOpen: boolean; onClose: () => void; profiles: TestProfile[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [profileId, setProfileId] = useState(profiles[0]?.id || '');
  const [steps, setSteps] = useState([
    { action: '', description: '', expected_result: '' },
  ]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: Partial<TestScenario>) => repositoryApi.createScenario(profileId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setName(''); setDescription(''); setSteps([{ action: '', description: '', expected_result: '' }]);
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr?.response?.data?.error?.message || 'Erreur lors de la création.');
    },
  });

  const addStep = () => setSteps([...steps, { action: '', description: '', expected_result: '' }]);
  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, value: string) => {
    const newSteps = [...steps];
    (newSteps[i] as Record<string, string>)[field] = value;
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Nom *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ex: SIP Registration Flow"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Profil associé *</label>
              <select value={profileId} onChange={(e) => setProfileId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
                {profiles.length === 0 && <option value="">Aucun profil disponible</option>}
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.protocol})</option>)}
              </select>
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
                        placeholder="Action (ex: REGISTER)"
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <input type="text" value={step.description} onChange={(e) => updateStep(i, 'description', e.target.value)}
                      placeholder="Description de l'étape"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    <input type="text" value={step.expected_result} onChange={(e) => updateStep(i, 'expected_result', e.target.value)}
                      placeholder="Résultat attendu (ex: 200 OK)"
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

export default function ScenariosPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: profilesData, isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles', currentProject?.id],
    queryFn: () => repositoryApi.listProfiles(currentProject!.id),
    enabled: !!currentProject,
  });

  const profiles = (profilesData?.data || []) as TestProfile[];

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
            Définissez les scénarios de test pour <strong className="text-foreground">{currentProject.name}</strong>.
            Chaque scénario est associé à un profil et contient une séquence d'étapes.
          </p>
        </div>
        {canWrite && profiles.length > 0 && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau scénario
          </button>
        )}
      </div>

      {loadingProfiles ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucun profil disponible</h3>
          <p className="text-sm text-muted-foreground">Créez d'abord un profil de test avant de définir des scénarios.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => {
            const isExpanded = expandedProfile === profile.id;
            return (
              <div key={profile.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary">{profile.protocol}</span>
                    <span className="text-sm font-medium text-foreground">{profile.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{profile.target_host}:{profile.target_port}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4">
                    {loadingScenarios ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    ) : scenarios.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun scénario pour ce profil.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {scenarios.map((scenario) => (
                          <div key={scenario.id} className="flex items-center justify-between bg-secondary/20 rounded-md px-4 py-3">
                            <div>
                              <h4 className="text-sm font-medium text-foreground">{scenario.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {scenario.steps?.length || 0} étape(s) — Créé le {new Date(scenario.created_at).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                            {canWrite && (
                              <button onClick={() => deleteMutation.mutate(scenario.id)}
                                className="text-muted-foreground hover:text-destructive p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
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

      <CreateScenarioModal isOpen={showCreate} onClose={() => setShowCreate(false)} profiles={profiles} />
    </div>
  );
}
