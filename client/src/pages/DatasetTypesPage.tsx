import { useState, useMemo, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import type { DatasetTypeField, TestType } from '../types';
import {
  Plus, Database, Search, Filter, Edit2, Trash2, X, AlertCircle,
  ChevronDown, ChevronRight, Check,
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────

const DOMAINS = ['WEB', 'API', 'IMS', 'EPC', '5GC', 'RAN', 'IOT', 'MOBILE', 'DESKTOP'] as const;
const TEST_TYPES: TestType[] = ['VABF', 'VSR', 'VABE'];
const FIELD_TYPES = ['string', 'number', 'boolean', 'email', 'url', 'date', 'phone', 'ip', 'enum'] as const;

const DOMAIN_COLORS: Record<string, string> = {
  WEB: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  API: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  IMS: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  EPC: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  '5GC': 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  RAN: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  IOT: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  MOBILE: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  DESKTOP: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const TEST_TYPE_COLORS: Record<string, string> = {
  VABF: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  VSR: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  VABE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

// ─── Badge Components ──────────────────────────────────────────────────────

function DomainBadge({ domain }: { domain: string }) {
  const cls = DOMAIN_COLORS[domain] || 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-bold border ${cls}`}>{domain}</span>;
}

function TestTypeBadge({ testType }: { testType?: string | null }) {
  if (!testType) return <span className="text-[10px] text-muted-foreground">—</span>;
  const cls = TEST_TYPE_COLORS[testType] || 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-bold border ${cls}`}>{testType}</span>;
}

function FieldTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    string: 'text-blue-400', number: 'text-amber-400', boolean: 'text-emerald-400',
    email: 'text-cyan-400', url: 'text-purple-400', date: 'text-rose-400',
    phone: 'text-orange-400', ip: 'text-teal-400', enum: 'text-fuchsia-400',
  };
  return <span className={`font-mono text-[10px] ${colors[type] || 'text-muted-foreground'}`}>{type}</span>;
}

// ─── Schema Preview ────────────────────────────────────────────────────────

function SchemaPreview({ fields, placeholders }: { fields: DatasetTypeField[]; placeholders: Record<string, string> }) {
  if (fields.length === 0) return <p className="text-xs text-muted-foreground italic">Aucun champ défini.</p>;
  return (
    <div className="border border-border/50 rounded overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/30">
            <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Champ</th>
            <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Type</th>
            <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Req.</th>
            <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Description</th>
            <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Exemple</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} className="border-t border-border/30">
              <td className="px-2 py-1 font-mono text-foreground">{f.name}</td>
              <td className="px-2 py-1"><FieldTypeBadge type={f.type} /></td>
              <td className="px-2 py-1 text-center">{f.required ? <Check className="w-3 h-3 text-emerald-400 mx-auto" /> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-2 py-1 text-muted-foreground">{f.description}</td>
              <td className="px-2 py-1 font-mono text-orange-400/70">{placeholders[f.name] || f.example || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helper: map DB row (camelCase from tRPC) to frontend display shape ────

interface DisplayDatasetType {
  id: string;           // uid from DB
  dataset_type_id: string;
  domain: string;
  test_type?: string | null;
  name: string;
  description: string;
  schema_fields: DatasetTypeField[];
  example_placeholders: Record<string, string>;
  tags: string[];
}

function mapRow(row: any): DisplayDatasetType {
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

// ─── Create/Edit Modal ─────────────────────────────────────────────────────

function DatasetTypeModal({
  open, onClose, onSave, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    datasetTypeId: string;
    name: string;
    domain: string;
    testType?: string;
    description?: string;
    schemaFields?: DatasetTypeField[];
    examplePlaceholders?: Record<string, string>;
    tags?: string[];
  }) => void;
  initial?: DisplayDatasetType;
}) {
  const isEdit = !!initial;
  const [slug, setSlug] = useState(initial?.dataset_type_id || '');
  const [name, setName] = useState(initial?.name || '');
  const [domain, setDomain] = useState(initial?.domain || 'WEB');
  const [testType, setTestType] = useState<string>(initial?.test_type || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [tags, setTags] = useState(initial?.tags?.join(', ') || '');
  const [fields, setFields] = useState<DatasetTypeField[]>(initial?.schema_fields || []);
  const [error, setError] = useState('');

  function addField() {
    setFields([...fields, { name: '', type: 'string', required: false, description: '', example: '' }]);
  }

  function updateField(idx: number, key: keyof DatasetTypeField, value: unknown) {
    const updated = [...fields];
    (updated[idx] as any)[key] = value;
    setFields(updated);
  }

  function removeField(idx: number) {
    setFields(fields.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!slug || !name || !domain) {
      setError('Le slug, le nom et le domaine sont obligatoires.');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(slug)) {
      setError('Le slug doit être en snake_case (lettres minuscules, chiffres, underscores).');
      return;
    }
    const placeholders: Record<string, string> = {};
    fields.forEach(f => { if (f.example) placeholders[f.name] = f.example; });
    onSave({
      datasetTypeId: slug,
      name,
      domain,
      testType: testType || undefined,
      description,
      schemaFields: fields.filter(f => f.name),
      examplePlaceholders: placeholders,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-heading font-bold text-foreground">
              {isEdit ? 'Modifier le gabarit' : 'Nouveau gabarit de dataset'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Slug + Nom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Slug (dataset_type_id) *</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                disabled={isEdit}
                placeholder="ex: user_admin"
                className="w-full px-3 py-2 rounded bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 font-mono disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Nom *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ex: Utilisateurs Administrateurs"
                className="w-full px-3 py-2 rounded bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              />
            </div>
          </div>

          {/* Domain + Test Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Domaine *</label>
              <select
                value={domain}
                onChange={e => setDomain(e.target.value)}
                className="w-full px-3 py-2 rounded bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              >
                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Type de test (optionnel)</label>
              <select
                value={testType}
                onChange={e => setTestType(e.target.value)}
                className="w-full px-3 py-2 rounded bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              >
                <option value="">— Tous types —</option>
                {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Description du gabarit de dataset..."
              className="w-full px-3 py-2 rounded bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tags (séparés par virgule)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="auth, admin, ims"
              className="w-full px-3 py-2 rounded bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            />
          </div>

          {/* Schema Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground">Champs du schéma</label>
              <button onClick={addField} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter un champ
              </button>
            </div>
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun champ. Cliquez sur "Ajouter un champ".</p>
            ) : (
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_50px_1fr_auto] gap-2 items-center bg-muted/20 rounded p-2">
                    <input
                      type="text" value={f.name} onChange={e => updateField(i, 'name', e.target.value)}
                      placeholder="nom_champ"
                      className="px-2 py-1 rounded bg-muted/50 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                    />
                    <select value={f.type} onChange={e => updateField(i, 'type', e.target.value)}
                      className="px-2 py-1 rounded bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                      {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      <input type="checkbox" checked={f.required} onChange={e => updateField(i, 'required', e.target.checked)} />
                      Req
                    </label>
                    <input
                      type="text" value={f.description} onChange={e => updateField(i, 'description', e.target.value)}
                      placeholder="description"
                      className="px-2 py-1 rounded bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                    />
                    <button onClick={() => removeField(i)} className="p-1 rounded hover:bg-red-500/10 text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">
            Annuler
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors">
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function DatasetTypesPage() {
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [filterTestType, setFilterTestType] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<DisplayDatasetType | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Query: fetch dataset types with cursor pagination ──
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const pageSize = 50;
  const currentCursor = cursorStack[cursorStack.length - 1];

  const { data, isLoading, isFetching } = trpc.datasetTypes.list.useQuery(
    { cursor: currentCursor, pageSize },
  );

  // Accumulate results across pages
  const [accumulated, setAccumulated] = useState<any[]>([]);
  useEffect(() => {
    if (data?.data) {
      if (cursorStack.length === 1) {
        setAccumulated(data.data);
      } else {
        setAccumulated(prev => {
          const ids = new Set(prev.map((r: any) => r.uid));
          const newItems = data.data.filter((r: any) => !ids.has(r.uid));
          return [...prev, ...newItems];
        });
      }
    }
  }, [data?.data, cursorStack.length]);

  const hasMore = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor;

  // Map DB rows to display shape
  const allItems = useMemo(() => {
    return accumulated.map(mapRow);
  }, [accumulated]);

  // Apply client-side filters (domain, testType, search)
  const items = useMemo(() => {
    let filtered = allItems;
    if (filterDomain) {
      filtered = filtered.filter(dt => dt.domain === filterDomain);
    }
    if (filterTestType) {
      filtered = filtered.filter(dt => !dt.test_type || dt.test_type === filterTestType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(dt =>
        dt.name.toLowerCase().includes(q) ||
        dt.dataset_type_id.toLowerCase().includes(q) ||
        dt.description.toLowerCase().includes(q) ||
        dt.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [allItems, filterDomain, filterTestType, searchQuery]);

  const uniqueDomains = useMemo(() => {
    return Array.from(new Set(allItems.map(dt => dt.domain))).sort();
  }, [allItems]);

  // ── Mutations ──
  const createMutation = trpc.datasetTypes.create.useMutation({
    onSuccess: () => {
      utils.datasetTypes.list.invalidate();
      setShowCreate(false);
    },
  });

  const updateMutation = trpc.datasetTypes.update.useMutation({
    onSuccess: () => {
      utils.datasetTypes.list.invalidate();
      setEditing(null);
    },
  });

  const deleteMutation = trpc.datasetTypes.delete.useMutation({
    onSuccess: () => utils.datasetTypes.list.invalidate(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">Gabarits de Datasets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schémas standardisés que les scénarios IA référencent via <code className="text-orange-400 font-mono text-xs">required_dataset_types</code>.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nouveau gabarit
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, slug ou tag..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterDomain}
            onChange={e => setFilterDomain(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
          >
            <option value="">Tous domaines</option>
            {uniqueDomains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <select
          value={filterTestType}
          onChange={e => setFilterTestType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
        >
          <option value="">Tous types</option>
          {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{items.length} gabarit{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun gabarit trouvé.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(dt => {
            const isExpanded = expandedId === dt.id;
            return (
              <div key={dt.id} className="border border-border/50 rounded-lg bg-card/50 overflow-hidden">
                {/* Row header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : dt.id)}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <code className="text-xs font-mono text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded shrink-0">{dt.dataset_type_id}</code>
                  <span className="text-sm font-semibold text-foreground">{dt.name}</span>
                  <DomainBadge domain={dt.domain} />
                  <TestTypeBadge testType={dt.test_type} />
                  <span className="text-xs text-muted-foreground ml-auto">{dt.schema_fields.length} champ{dt.schema_fields.length !== 1 ? 's' : ''}</span>
                  {dt.tags.length > 0 && (
                    <div className="flex items-center gap-1 ml-2">
                      {dt.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">{tag}</span>
                      ))}
                      {dt.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{dt.tags.length - 3}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditing(dt)} className="p-1 rounded hover:bg-muted" title="Éditer">
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Supprimer "${dt.name}" ?`)) deleteMutation.mutate({ datasetTypeId: dt.dataset_type_id }); }}
                      className="p-1 rounded hover:bg-red-500/10"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-3">
                    {dt.description && (
                      <p className="text-xs text-muted-foreground">{dt.description}</p>
                    )}
                    <SchemaPreview fields={dt.schema_fields} placeholders={dt.example_placeholders} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charger plus */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {items.length} gabarit(s) affiché(s){allItems.length !== items.length ? ` / ${allItems.length} total` : ''}
        </p>
        {hasMore && (
          <button
            onClick={() => { if (nextCursor) setCursorStack(prev => [...prev, nextCursor]); }}
            disabled={isFetching}
            className="rounded-md border border-border px-4 py-1.5 text-xs text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
          >
            {isFetching ? 'Chargement…' : 'Charger plus'}
          </button>
        )}
      </div>

      {/* Create Modal */}
      <DatasetTypeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={d => createMutation.mutate(d)}
      />

      {/* Edit Modal */}
      {editing && (
        <DatasetTypeModal
          open={true}
          onClose={() => setEditing(null)}
          onSave={d => updateMutation.mutate(d)}
          initial={editing}
        />
      )}
    </div>
  );
}
