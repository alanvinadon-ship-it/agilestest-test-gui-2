import { useState, useMemo } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  localBundles, localBundleItems, localDatasetInstances,
  localDatasetTypes, localValidation, localScenarios,
} from '../api/localStore';
import { repositoryApi } from '../api/repositoryApi';
import type {
  DatasetBundle, DatasetInstance, DatasetType, TargetEnv, BundleStatus,
  TestScenario, BundleValidationResult,
} from '../types';
import {
  Plus, Package, Loader2, Trash2, X, Search, Filter, Copy,
  CheckCircle2, Archive, FileText, ChevronDown, ChevronUp,
  AlertTriangle, Save, Database, Link2, Unlink, Shield,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────

const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];
const ALL_STATUSES: BundleStatus[] = ['DRAFT', 'ACTIVE', 'DEPRECATED'];

const ENV_META: Record<TargetEnv, { label: string; bgClass: string; textClass: string; borderClass: string }> = {
  DEV:          { label: 'DEV',          bgClass: 'bg-sky-500/10',    textClass: 'text-sky-400',    borderClass: 'border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      bgClass: 'bg-violet-500/10', textClass: 'text-violet-400', borderClass: 'border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', bgClass: 'bg-orange-500/10', textClass: 'text-orange-400', borderClass: 'border-orange-500/20' },
  PROD:         { label: 'PROD',         bgClass: 'bg-red-500/10',    textClass: 'text-red-400',    borderClass: 'border-red-500/20' },
};

const STATUS_META: Record<BundleStatus, { label: string; bgClass: string; textClass: string; borderClass: string; icon: typeof FileText }> = {
  DRAFT:      { label: 'Brouillon', bgClass: 'bg-slate-500/10', textClass: 'text-slate-400', borderClass: 'border-slate-500/20', icon: FileText },
  ACTIVE:     { label: 'Actif',     bgClass: 'bg-green-500/10', textClass: 'text-green-400', borderClass: 'border-green-500/20', icon: CheckCircle2 },
  DEPRECATED: { label: 'Déprécié',  bgClass: 'bg-red-500/10',   textClass: 'text-red-400',   borderClass: 'border-red-500/20',   icon: Archive },
};

function EnvBadge({ env }: { env: TargetEnv }) {
  const meta = ENV_META[env];
  return (
    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded font-semibold ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
      {meta.label}
    </span>
  );
}

function BundleStatusBadge({ status }: { status: BundleStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
      <Icon className="w-2.5 h-2.5" />{meta.label}
    </span>
  );
}

// ─── Create Bundle Modal ──────────────────────────────────────────────────

function CreateBundleModal({ isOpen, onClose, projectId, projectDomain }: {
  isOpen: boolean; onClose: () => void; projectId: string; projectDomain: string;
}) {
  const queryClient = useQueryClient();
  const [env, setEnv] = useState<TargetEnv>('PREPROD');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');

  const suggestedName = useMemo(() => {
    const domain = projectDomain || 'GEN';
    return `BUNDLE_${domain}_${env}_V1`;
  }, [env, projectDomain]);

  const mutation = useMutation({
    mutationFn: async () => localBundles.create(projectId, {
      name: name || suggestedName,
      env,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset_bundles'] });
      toast.success('Bundle créé');
      setName(''); setTags('');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-foreground">Créer un bundle</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Environnement *</label>
            <div className="flex gap-2">
              {ALL_ENVS.map(e => (
                <button key={e} onClick={() => setEnv(e)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold border transition-colors ${
                    env === e
                      ? `${ENV_META[e].bgClass} ${ENV_META[e].textClass} ${ENV_META[e].borderClass}`
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                  }`}>{ENV_META[e].label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom du bundle</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={suggestedName}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
            <p className="text-[10px] text-muted-foreground mt-1">Suggestion : {suggestedName}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tags (séparés par virgule)</label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)}
              placeholder="vabf, login, preprod"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors">
            Annuler
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Validate Bundle Modal ────────────────────────────────────────────────

function ValidateBundleModal({ bundle, onClose, projectId }: {
  bundle: DatasetBundle; onClose: () => void; projectId: string;
}) {
  const [scenarioId, setScenarioId] = useState('');
  const [result, setResult] = useState<BundleValidationResult | null>(null);

  const { data: scenariosData } = useQuery({
    queryKey: ['all_scenarios_project', projectId],
    queryFn: () => repositoryApi.listScenariosByProject(projectId),
    enabled: !!projectId,
  });
  const scenarios = (scenariosData?.data || []) as TestScenario[];

  const handleValidate = () => {
    if (!scenarioId) return;
    try {
      const res = localValidation.validateBundleForScenario(bundle.bundle_id, scenarioId);
      setResult(res);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-cyan-500/10 flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">Valider avec un scénario</h2>
              <p className="text-xs text-muted-foreground">{bundle.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scénario à valider</label>
            <select value={scenarioId} onChange={e => setScenarioId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">— Sélectionner un scénario —</option>
              {scenarios.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.scenario_code ? `(${s.scenario_code})` : ''} [{s.status}]
                </option>
              ))}
            </select>
          </div>

          <button onClick={handleValidate} disabled={!scenarioId}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 text-sm font-medium text-white hover:bg-cyan-500 transition-colors disabled:opacity-50">
            <ClipboardCheck className="w-4 h-4" /> Valider
          </button>

          {result && (
            <div className="space-y-3">
              <div className={`rounded-md p-4 border ${result.ok ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.ok ? (
                    <><CheckCircle2 className="w-5 h-5 text-green-400" /><span className="text-sm font-semibold text-green-400">Compatible</span></>
                  ) : (
                    <><AlertTriangle className="w-5 h-5 text-red-400" /><span className="text-sm font-semibold text-red-400">Incompatible</span></>
                  )}
                </div>

                {result.missing_types.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-red-400 mb-1">Types manquants :</p>
                    <div className="flex flex-wrap gap-1">
                      {result.missing_types.map(t => (
                        <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {result.conflicts.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-400 mb-1">Conflits (doublons de type) :</p>
                    {result.conflicts.map(c => (
                      <p key={c.dataset_type_id} className="text-[10px] text-amber-400/80">
                        {c.dataset_type_id} : {c.dataset_ids.length} datasets
                      </p>
                    ))}
                  </div>
                )}

                {Object.keys(result.schema_errors_by_type).length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-400 mb-1">Erreurs de schéma :</p>
                    {Object.entries(result.schema_errors_by_type).map(([type, errors]) => (
                      <div key={type} className="mb-1">
                        <p className="text-[10px] font-mono text-amber-400">{type} :</p>
                        {errors.map((e, i) => <p key={i} className="text-[10px] text-amber-400/70 ml-2">• {e}</p>)}
                      </div>
                    ))}
                  </div>
                )}

                {result.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-amber-400 mb-1">Avertissements :</p>
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-[10px] text-amber-400/70">⚠ {w}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bundle Detail (expanded row) ─────────────────────────────────────────

function BundleDetail({ bundle, projectId }: { bundle: DatasetBundle; projectId: string }) {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const [addingDataset, setAddingDataset] = useState(false);

  // Get bundle items
  const bundleItems = useMemo(() => localBundleItems.list(bundle.bundle_id), [bundle.bundle_id]);
  const allInstances = useQuery({
    queryKey: ['dataset_instances', projectId],
    queryFn: () => localDatasetInstances.list(projectId),
  });
  const allDatasets = (allInstances.data?.data || []) as DatasetInstance[];

  const { data: dtData } = useQuery({
    queryKey: ['dataset_types_all'],
    queryFn: () => localDatasetTypes.list(),
  });
  const dtMap = useMemo(() => {
    const types = (dtData?.data || []) as DatasetType[];
    return new Map(types.map(dt => [dt.dataset_type_id, dt]));
  }, [dtData]);

  // Datasets in this bundle
  const bundleDatasets = useMemo(() => {
    const ids = new Set(bundleItems.map(bi => bi.dataset_id));
    return allDatasets.filter(d => ids.has(d.dataset_id));
  }, [bundleItems, allDatasets]);

  // Available datasets (same env, not already in bundle)
  const availableDatasets = useMemo(() => {
    const existingIds = new Set(bundleItems.map(bi => bi.dataset_id));
    const existingTypes = new Set(bundleDatasets.map(d => d.dataset_type_id));
    return allDatasets.filter(d =>
      d.env === bundle.env &&
      !existingIds.has(d.dataset_id) &&
      !existingTypes.has(d.dataset_type_id) // Prevent type duplicates
    );
  }, [allDatasets, bundleItems, bundleDatasets, bundle.env]);

  const addMutation = useMutation({
    mutationFn: async (datasetId: string) => localBundleItems.add(bundle.bundle_id, datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset_bundles'] });
      queryClient.invalidateQueries({ queryKey: ['dataset_instances'] });
      toast.success('Dataset ajouté au bundle');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (datasetId: string) => localBundleItems.remove(bundle.bundle_id, datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset_bundles'] });
      toast.success('Dataset retiré du bundle');
    },
  });

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Bundle datasets */}
      {bundleDatasets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucun dataset dans ce bundle.</p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {bundleDatasets.length} dataset(s) inclus :
          </p>
          {bundleDatasets.map(d => {
            const dt = dtMap.get(d.dataset_type_id);
            return (
              <div key={d.dataset_id} className="flex items-center justify-between bg-secondary/20 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-primary/60" />
                  <span className="text-sm text-foreground">{dt?.name || d.dataset_type_id}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{d.dataset_type_id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    d.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' :
                    d.status === 'DRAFT' ? 'bg-slate-500/10 text-slate-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{d.status}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">v{d.version}</span>
                </div>
                {canWrite && (
                  <button onClick={() => removeMutation.mutate(d.dataset_id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors" title="Retirer">
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add dataset */}
      {canWrite && (
        <div>
          {addingDataset ? (
            <div className="bg-secondary/10 rounded-md p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Ajouter un dataset ({bundle.env}) — {availableDatasets.length} disponible(s)
              </p>
              {availableDatasets.length === 0 ? (
                <p className="text-xs text-amber-400">
                  Aucun dataset disponible pour cet environnement (ou tous les types sont déjà couverts).
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {availableDatasets.map(d => {
                    const dt = dtMap.get(d.dataset_type_id);
                    return (
                      <button key={d.dataset_id} onClick={() => addMutation.mutate(d.dataset_id)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-primary/10 transition-colors text-left">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-primary/60" />
                          <span className="text-sm text-foreground">{dt?.name || d.dataset_type_id}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">v{d.version}</span>
                        </div>
                        <Plus className="w-3.5 h-3.5 text-primary" />
                      </button>
                    );
                  })}
                </div>
              )}
              <button onClick={() => setAddingDataset(false)}
                className="text-xs text-muted-foreground hover:text-foreground">Fermer</button>
            </div>
          ) : (
            <button onClick={() => setAddingDataset(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Ajouter un dataset
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function BundlesPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [validatingBundle, setValidatingBundle] = useState<DatasetBundle | null>(null);
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedBundle, setExpandedBundle] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dataset_bundles', currentProject?.id, envFilter, statusFilter],
    queryFn: () => localBundles.list(currentProject!.id, {
      env: envFilter !== 'ALL' ? envFilter as TargetEnv : undefined,
      status: statusFilter !== 'ALL' ? statusFilter as BundleStatus : undefined,
    }),
    enabled: !!currentProject,
  });

  const bundles = (data?.data || []) as DatasetBundle[];

  const filtered = useMemo(() => {
    if (!search) return bundles;
    const q = search.toLowerCase();
    return bundles.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [bundles, search]);

  const activateMutation = useMutation({
    mutationFn: async (id: string) => localBundles.update(id, { status: 'ACTIVE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset_bundles'] });
      toast.success('Bundle activé');
    },
  });

  const deprecateMutation = useMutation({
    mutationFn: async (id: string) => localBundles.update(id, { status: 'DEPRECATED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset_bundles'] });
      toast.success('Bundle déprécié');
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (id: string) => localBundles.clone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset_bundles'] });
      toast.success('Bundle cloné');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => localBundles.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset_bundles'] });
      toast.success('Bundle supprimé');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour gérer ses bundles.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Bundles de données</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regroupez les datasets par environnement pour <strong className="text-foreground">{currentProject.name}</strong>.
            Un bundle = 1 dataset max par type.
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nouveau bundle
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>

        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
          <button onClick={() => setEnvFilter('ALL')}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${envFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Tous env
          </button>
          {ALL_ENVS.map(e => {
            const meta = ENV_META[e];
            return (
              <button key={e} onClick={() => setEnvFilter(e)}
                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                  envFilter === e ? `${meta.bgClass} ${meta.textClass}` : 'text-muted-foreground hover:text-foreground'
                }`}>{meta.label}</button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 bg-card border border-border rounded-md p-1">
          <button onClick={() => setStatusFilter('ALL')}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${statusFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            Tous
          </button>
          {ALL_STATUSES.map(s => {
            const meta = STATUS_META[s];
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  statusFilter === s ? `${meta.bgClass} ${meta.textClass}` : 'text-muted-foreground hover:text-foreground'
                }`}>{meta.label}</button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucun bundle</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Créez un bundle pour regrouper vos datasets par environnement.
          </p>
          {canWrite && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Nouveau bundle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(bundle => {
            const isExpanded = expandedBundle === bundle.bundle_id;
            const itemCount = localBundleItems.list(bundle.bundle_id).length;

            return (
              <div key={bundle.bundle_id} className="bg-card border border-border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setExpandedBundle(isExpanded ? null : bundle.bundle_id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-primary/60" />
                    <span className="text-sm font-medium text-foreground font-mono">{bundle.name}</span>
                    <EnvBadge env={bundle.env} />
                    <BundleStatusBadge status={bundle.status} />
                    <span className="text-[10px] font-mono text-muted-foreground">v{bundle.version}</span>
                    <span className="text-[10px] text-muted-foreground">{itemCount} dataset(s)</span>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {canWrite && bundle.status === 'DRAFT' && (
                      <button onClick={() => activateMutation.mutate(bundle.bundle_id)}
                        className="text-green-400 hover:text-green-300 p-1.5 rounded hover:bg-green-500/10 transition-colors" title="Activer">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {canWrite && bundle.status === 'ACTIVE' && (
                      <button onClick={() => deprecateMutation.mutate(bundle.bundle_id)}
                        className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 transition-colors" title="Déprécier">
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => setValidatingBundle(bundle)}
                      className="text-cyan-400 hover:text-cyan-300 p-1.5 rounded hover:bg-cyan-500/10 transition-colors" title="Valider avec scénario">
                      <ClipboardCheck className="w-4 h-4" />
                    </button>
                    <button onClick={() => cloneMutation.mutate(bundle.bundle_id)}
                      className="text-muted-foreground hover:text-cyan-400 p-1.5 rounded hover:bg-cyan-500/10 transition-colors" title="Cloner">
                      <Copy className="w-4 h-4" />
                    </button>
                    {canWrite && bundle.status === 'DRAFT' && (
                      <button onClick={() => deleteMutation.mutate(bundle.bundle_id)}
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <BundleDetail bundle={bundle} projectId={currentProject!.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{filtered.length} bundle(s)</span>
          <span>•</span>
          {ALL_ENVS.map(e => {
            const count = filtered.filter(b => b.env === e).length;
            if (count === 0) return null;
            return <span key={e}>{ENV_META[e].label}: {count}</span>;
          })}
        </div>
      )}

      {/* Modals */}
      <CreateBundleModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={currentProject.id}
        projectDomain={currentProject.domain}
      />
      {validatingBundle && (
        <ValidateBundleModal
          bundle={validatingBundle}
          onClose={() => setValidatingBundle(null)}
          projectId={currentProject.id}
        />
      )}
    </div>
  );
}
