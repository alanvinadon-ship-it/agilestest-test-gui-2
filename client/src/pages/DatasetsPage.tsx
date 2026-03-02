import { useState, useMemo } from 'react';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import { trpc } from '@/lib/trpc';
import type { DatasetTypeField, TestType } from '../types';
import {
  Plus, Database, Loader2, Trash2, X, Search, Filter, Copy,
  Eye, EyeOff, Lock, CheckCircle2, Archive, FileText, ChevronDown,
  AlertTriangle, Save, Shield,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────

type TargetEnv = 'DEV' | 'PREPROD' | 'PILOT_ORANGE' | 'PROD';
type DatasetInstanceStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED';

interface DisplayDatasetInstance {
  dataset_id: string;       // uid from DB
  project_id: string;
  dataset_type_id: string;
  env: TargetEnv;
  version: number;
  status: DatasetInstanceStatus;
  values_json: Record<string, unknown>;
  notes: string;
  created_at: string;
}

interface DisplayDatasetType {
  id: string;
  dataset_type_id: string;
  domain: string;
  test_type?: string | null;
  name: string;
  description: string;
  schema_fields: DatasetTypeField[];
  example_placeholders: Record<string, string>;
  tags: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────

const ALL_ENVS: TargetEnv[] = ['DEV', 'PREPROD', 'PILOT_ORANGE', 'PROD'];
const ALL_STATUSES: DatasetInstanceStatus[] = ['DRAFT', 'ACTIVE', 'DEPRECATED'];

const ENV_META: Record<TargetEnv, { label: string; bgClass: string; textClass: string; borderClass: string }> = {
  DEV:          { label: 'DEV',          bgClass: 'bg-sky-500/10',    textClass: 'text-sky-400',    borderClass: 'border-sky-500/20' },
  PREPROD:      { label: 'PREPROD',      bgClass: 'bg-violet-500/10', textClass: 'text-violet-400', borderClass: 'border-violet-500/20' },
  PILOT_ORANGE: { label: 'PILOT ORANGE', bgClass: 'bg-orange-500/10', textClass: 'text-orange-400', borderClass: 'border-orange-500/20' },
  PROD:         { label: 'PROD',         bgClass: 'bg-red-500/10',    textClass: 'text-red-400',    borderClass: 'border-red-500/20' },
};

const STATUS_META: Record<DatasetInstanceStatus, { label: string; bgClass: string; textClass: string; borderClass: string; icon: typeof FileText }> = {
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

function StatusBadge({ status }: { status: DatasetInstanceStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${meta.bgClass} ${meta.textClass} border ${meta.borderClass}`}>
      <Icon className="w-2.5 h-2.5" />{meta.label}
    </span>
  );
}

// ─── Helpers: map DB rows ────────────────────────────────────────────────

function mapInstance(row: any): DisplayDatasetInstance {
  return {
    dataset_id: row.uid ?? row.dataset_id ?? '',
    project_id: row.projectId ?? row.project_id ?? '',
    dataset_type_id: row.datasetTypeId ?? row.dataset_type_id ?? '',
    env: (row.env ?? 'DEV') as TargetEnv,
    version: row.version ?? 1,
    status: (row.status ?? 'DRAFT') as DatasetInstanceStatus,
    values_json: (row.valuesJson ?? row.values_json ?? {}) as Record<string, unknown>,
    notes: row.notes ?? '',
    created_at: row.createdAt ?? row.created_at ?? new Date().toISOString(),
  };
}

function mapDatasetType(row: any): DisplayDatasetType {
  return {
    id: row.uid ?? row.id?.toString() ?? '',
    dataset_type_id: row.datasetTypeId ?? row.dataset_type_id ?? '',
    domain: row.domain ?? 'WEB',
    test_type: row.testType ?? row.test_type ?? null,
    name: row.name ?? '',
    description: row.description ?? '',
    schema_fields: (row.schemaFields ?? row.schema_fields ?? []) as DatasetTypeField[],
    example_placeholders: (row.examplePlaceholders ?? row.example_placeholders ?? {}) as Record<string, string>,
    tags: (row.tags ?? []) as string[],
  };
}

// ─── Create Dataset Modal ─────────────────────────────────────────────────

function CreateDatasetModal({ isOpen, onClose, projectId }: {
  isOpen: boolean; onClose: () => void; projectId: string;
}) {
  const utils = trpc.useUtils();
  const [env, setEnv] = useState<TargetEnv>('PREPROD');
  const [datasetTypeId, setDatasetTypeId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch dataset types from DB via tRPC
  const { data: dtData } = trpc.datasetTypes.list.useQuery();
  const datasetTypes = useMemo(() => (dtData?.data || []).map(mapDatasetType), [dtData]);

  const mutation = trpc.datasetInstances.create.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      toast.success('Dataset instance créé');
      setDatasetTypeId(''); setNotes('');
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-lg font-heading font-semibold text-foreground">Créer un dataset</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Env */}
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

          {/* Dataset Type */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Gabarit (Dataset Type) *</label>
            <select value={datasetTypeId} onChange={e => setDatasetTypeId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="">— Sélectionner un gabarit —</option>
              {datasetTypes.map(dt => (
                <option key={dt.dataset_type_id} value={dt.dataset_type_id}>
                  {dt.name} ({dt.dataset_type_id}) — {dt.domain}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              placeholder="Notes sur ce jeu de données..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors">
            Annuler
          </button>
          <button onClick={() => mutation.mutate({ projectId, datasetTypeId, env, notes: notes || undefined })} disabled={!datasetTypeId || mutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Dataset Modal (JSON editor) ───────────────────────────────────

function EditDatasetModal({ instance, onClose }: {
  instance: DisplayDatasetInstance; onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [valuesJson, setValuesJson] = useState<Record<string, unknown>>({ ...instance.values_json });
  const [notes, setNotes] = useState(instance.notes || '');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Fetch dataset type for schema display
  const { data: dtData } = trpc.datasetTypes.list.useQuery();
  const dt = useMemo(() => {
    const all = (dtData?.data || []).map(mapDatasetType);
    return all.find(d => d.dataset_type_id === instance.dataset_type_id) ?? null;
  }, [dtData, instance.dataset_type_id]);

  const saveMutation = trpc.datasetInstances.update.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      toast.success('Dataset sauvegardé');
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const activateMutation = trpc.datasetInstances.update.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      toast.success('Dataset activé');
      onClose();
    },
  });

  const deprecateMutation = trpc.datasetInstances.update.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      toast.success('Dataset déprécié');
      onClose();
    },
  });

  const handleFieldChange = (fieldName: string, value: string) => {
    setValuesJson(prev => ({ ...prev, [fieldName]: value }));
    setJsonError(null);
  };

  const handleRawJsonChange = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      setValuesJson(parsed);
      setJsonError(null);
    } catch {
      setJsonError('JSON invalide');
    }
  };

  const [rawMode, setRawMode] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Server-side validation
  const { data: validation, refetch: refetchValidation, isFetching: isValidating } = trpc.datasetInstances.validate.useQuery(
    { datasetId: instance.dataset_id },
    { enabled: showValidation, staleTime: 0 },
  );

  const handleValidate = () => {
    setShowValidation(true);
    if (showValidation) refetchValidation();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">
                {dt?.name || instance.dataset_type_id}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <EnvBadge env={instance.env} />
                <StatusBadge status={instance.status} />
                <span className="text-[10px] font-mono text-muted-foreground">v{instance.version}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {dt ? `${dt.schema_fields.length} champs définis dans le gabarit` : 'Gabarit non trouvé'}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setRawMode(!rawMode)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  rawMode ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'border-border text-muted-foreground hover:text-foreground'
                }`}>
                {rawMode ? 'Formulaire' : 'JSON brut'}
              </button>
            </div>
          </div>

          {rawMode ? (
            /* Raw JSON editor */
            <div>
              <textarea
                value={JSON.stringify(valuesJson, null, 2)}
                onChange={e => handleRawJsonChange(e.target.value)}
                rows={16}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
              {jsonError && <p className="text-xs text-destructive mt-1">{jsonError}</p>}
            </div>
          ) : (
            /* Field-by-field editor with schema info */
            <div className="space-y-3">
              {dt?.schema_fields.map(field => {
                const currentValue = String(valuesJson[field.name] ?? '');

                return (
                  <div key={field.name} className="grid grid-cols-[1fr_2fr] gap-3 items-start">
                    <div className="pt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-mono text-foreground">{field.name}</span>
                        {field.required && <span className="text-destructive text-xs">*</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{field.description}</p>
                      <p className="text-[10px] text-muted-foreground/60 font-mono">
                        type: {field.type}{field.example ? ` — ex: ${field.example}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {field.type === 'enum' && field.enum_values ? (
                        <select
                          value={currentValue}
                          onChange={e => handleFieldChange(field.name, e.target.value)}
                          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                        >
                          <option value="">—</option>
                          {field.enum_values.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'boolean' ? 'checkbox' : 'text'}
                          value={currentValue}
                          onChange={e => handleFieldChange(field.name, e.target.value)}
                          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                          placeholder={field.example || ''}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Champs hors schéma */}
              {Object.keys(valuesJson).filter(k => !dt?.schema_fields.some(f => f.name === k)).map(key => (
                <div key={key} className="grid grid-cols-[1fr_2fr] gap-3 items-start">
                  <div className="pt-2">
                    <span className="text-sm font-mono text-muted-foreground">{key}</span>
                    <p className="text-[10px] text-amber-400/60">Champ hors gabarit</p>
                  </div>
                  <input
                    type="text"
                    value={String(valuesJson[key] ?? '')}
                    onChange={e => handleFieldChange(key, e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Validation Panel */}
          {showValidation && validation && (
            <div className={`rounded-lg border p-4 space-y-3 ${
              validation.valid
                ? 'border-green-500/20 bg-green-500/5'
                : 'border-red-500/20 bg-red-500/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {validation.valid
                    ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                    : <AlertTriangle className="w-4 h-4 text-red-400" />
                  }
                  <span className={`text-sm font-semibold ${validation.valid ? 'text-green-400' : 'text-red-400'}`}>
                    {validation.valid ? 'Validation r\u00e9ussie' : `${validation.errors.length} erreur(s)`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>Champs: {validation.summary.filled}/{validation.summary.total}</span>
                  <span>Requis: {validation.summary.requiredFilled}/{validation.summary.required}</span>
                </div>
              </div>
              {validation.errors.length > 0 && (
                <div className="space-y-1">
                  {validation.errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-red-400 font-semibold">\u2716</span>
                      <span className="font-mono text-foreground/80">{e.field}</span>
                      <span className="text-muted-foreground">{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
              {validation.warnings.length > 0 && (
                <div className="space-y-1">
                  {validation.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-amber-400 font-semibold">\u26A0</span>
                      <span className="font-mono text-foreground/80">{w.field}</span>
                      <span className="text-muted-foreground">{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              placeholder="Notes..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={handleValidate} disabled={isValidating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
              {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              Valider
            </button>
            {instance.status === 'DRAFT' && (
              <button onClick={() => activateMutation.mutate({ datasetId: instance.dataset_id, status: 'ACTIVE', valuesJson, notes })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-xs font-medium text-white hover:bg-green-500 transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" /> Activer
              </button>
            )}
            {instance.status === 'ACTIVE' && (
              <button onClick={() => deprecateMutation.mutate({ datasetId: instance.dataset_id, status: 'DEPRECATED' })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600/80 text-xs font-medium text-white hover:bg-red-500 transition-colors">
                <Archive className="w-3.5 h-3.5" /> Déprécier
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors">
              Annuler
            </button>
            <button onClick={() => saveMutation.mutate({ datasetId: instance.dataset_id, valuesJson, notes })} disabled={saveMutation.isPending || !!jsonError}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const { currentProject } = useProject();
  const { canWrite } = useAuth();
  const { can } = usePermission();
  const canCreateDataset = can(PermissionKey.DATASETS_CREATE);
  const canDeleteDataset = can(PermissionKey.DATASETS_DELETE);
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [editingInstance, setEditingInstance] = useState<DisplayDatasetInstance | null>(null);
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // ── Query: dataset instances from DB via tRPC ──
  const { data, isLoading } = trpc.datasetInstances.list.useQuery(
    {
      projectId: String(currentProject?.id || ''),
      env: envFilter !== 'ALL' ? envFilter as any : undefined,
      status: statusFilter !== 'ALL' ? statusFilter as any : undefined,
      datasetTypeId: typeFilter !== 'ALL' ? typeFilter : undefined,
    },
    { enabled: !!currentProject },
  );

  const instances = useMemo(() => (data?.data || []).map(mapInstance), [data]);

  // ── Query: dataset types for display ──
  const { data: dtData } = trpc.datasetTypes.list.useQuery();
  const datasetTypes = useMemo(() => (dtData?.data || []).map(mapDatasetType), [dtData]);
  const dtMap = useMemo(() => new Map(datasetTypes.map(dt => [dt.dataset_type_id, dt])), [datasetTypes]);

  const filtered = useMemo(() => {
    if (!search) return instances;
    const q = search.toLowerCase();
    return instances.filter(d =>
      d.dataset_type_id.toLowerCase().includes(q) ||
      (dtMap.get(d.dataset_type_id)?.name || '').toLowerCase().includes(q) ||
      d.notes?.toLowerCase().includes(q)
    );
  }, [instances, search, dtMap]);

  // ── Mutations ──
  const deleteMutation = trpc.datasetInstances.delete.useMutation({
    onSuccess: () => {
      utils.datasetInstances.list.invalidate();
      toast.success('Dataset supprimé');
    },
    onError: (err) => toast.error(err.message),
  });

  // Unique dataset_type_ids in current instances
  const usedTypeIds = useMemo(() => Array.from(new Set(instances.map(d => d.dataset_type_id))), [instances]);

  if (!currentProject) {
    return (
      <div className="max-w-5xl mx-auto text-center py-16">
        <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Aucun projet sélectionné</h2>
        <p className="text-sm text-muted-foreground">Sélectionnez un projet pour gérer ses jeux de données.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Jeux de données (Instances)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Instances de datasets par environnement pour <strong className="text-foreground">{currentProject.name}</strong>.
            Workflow : <span className="font-mono text-xs">DRAFT → ACTIVE → DEPRECATED</span>
          </p>
        </div>
        {canCreateDataset && (
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Créer depuis gabarit
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

        {/* Env filter */}
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

        {/* Status filter */}
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

        {/* Type filter */}
        {usedTypeIds.length > 1 && (
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30">
            <option value="ALL">Tous types</option>
            {usedTypeIds.map(tid => (
              <option key={tid} value={tid}>{dtMap.get(tid)?.name || tid}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <Database className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">Aucun dataset instance</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Créez un dataset depuis un gabarit pour commencer.
          </p>
          {canCreateDataset && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Créer depuis gabarit
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Env</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Version</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Champs</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inst => {
                const dt = dtMap.get(inst.dataset_type_id);
                const fieldCount = Object.keys(inst.values_json).length;
                return (
                  <tr key={inst.dataset_id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors cursor-pointer"
                    onClick={() => setEditingInstance(inst)}>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-foreground">{dt?.name || inst.dataset_type_id}</span>
                        <p className="text-[10px] font-mono text-muted-foreground">{inst.dataset_type_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><EnvBadge env={inst.env} /></td>
                    <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-muted-foreground">v{inst.version}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-muted-foreground">{fieldCount} champs</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-muted-foreground">{new Date(inst.created_at).toLocaleDateString('fr-FR')}</span></td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingInstance(inst)}
                          className="text-muted-foreground hover:text-primary p-1.5 rounded hover:bg-primary/10 transition-colors" title="Éditer">
                          <FileText className="w-4 h-4" />
                        </button>
                        {canDeleteDataset && inst.status !== 'ACTIVE' && (
                          <button onClick={() => deleteMutation.mutate({ datasetId: inst.dataset_id })}
                            className="text-muted-foreground hover:text-destructive p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats bar */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{filtered.length} dataset(s)</span>
          <span>•</span>
          {ALL_ENVS.map(e => {
            const count = filtered.filter(d => d.env === e).length;
            if (count === 0) return null;
            return <span key={e}>{ENV_META[e].label}: {count}</span>;
          })}
          <span>•</span>
          <span>ACTIVE: {filtered.filter(d => d.status === 'ACTIVE').length}</span>
          <span>DRAFT: {filtered.filter(d => d.status === 'DRAFT').length}</span>
        </div>
      )}

      {/* Modals */}
      <CreateDatasetModal isOpen={showCreate} onClose={() => setShowCreate(false)} projectId={currentProject.id} />
      {editingInstance && <EditDatasetModal instance={editingInstance} onClose={() => setEditingInstance(null)} />}
    </div>
  );
}
