/**
 * AdminAuditPage — /admin/audit
 * Journal d'audit durci : filtres enrichis (action, entity, date range, acteur),
 * export CSV/JSON, statistiques, affichage amélioré.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  ScrollText, Search, Clock, User, Download, FileJson, FileSpreadsheet,
  ChevronDown, ChevronUp, BarChart3, Filter, X,
} from 'lucide-react';
import { adminAudit } from '../admin/adminStore';
import type { AuditEntry, AuditAction, AuditEntityType } from '../admin/types';
import { toast } from 'sonner';

// ─── Labels & Colors ──────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  USER_CREATED: 'Utilisateur créé',
  USER_UPDATED: 'Utilisateur modifié',
  USER_DISABLED: 'Utilisateur désactivé',
  USER_ENABLED: 'Utilisateur réactivé',
  USER_PASSWORD_RESET: 'MDP réinitialisé',
  MEMBERSHIP_ADDED: 'Membre ajouté',
  MEMBERSHIP_UPDATED: 'Rôle modifié',
  MEMBERSHIP_REMOVED: 'Membre retiré',
  INVITE_SENT: 'Invitation envoyée',
  INVITE_RESENT: 'Invitation renvoyée',
  INVITE_REVOKED: 'Invitation révoquée',
  INVITE_ACCEPTED: 'Invitation acceptée',
  ROLE_CREATED: 'Rôle créé',
  ROLE_UPDATED: 'Rôle modifié',
  ROLE_DELETED: 'Rôle supprimé',
  PROJECT_ACCESS_DENIED: 'Accès refusé',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  USER_CREATED: 'bg-green-500/10 text-green-400 border-green-500/20',
  USER_UPDATED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  USER_DISABLED: 'bg-red-500/10 text-red-400 border-red-500/20',
  USER_ENABLED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  USER_PASSWORD_RESET: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  MEMBERSHIP_ADDED: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  MEMBERSHIP_UPDATED: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  MEMBERSHIP_REMOVED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  INVITE_SENT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  INVITE_RESENT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  INVITE_REVOKED: 'bg-red-500/10 text-red-400 border-red-500/20',
  INVITE_ACCEPTED: 'bg-green-500/10 text-green-400 border-green-500/20',
  ROLE_CREATED: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  ROLE_UPDATED: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  ROLE_DELETED: 'bg-red-500/10 text-red-400 border-red-500/20',
  PROJECT_ACCESS_DENIED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  user: 'Utilisateur',
  membership: 'Membership',
  invite: 'Invitation',
  role: 'Rôle',
  access: 'Accès projet',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];
const ALL_ENTITIES = Object.keys(ENTITY_LABELS) as AuditEntityType[];

// ─── Export helpers ───────────────────────────────────────────────────

function exportJSON(entries: AuditEntry[]) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${entries.length} entrées exportées en JSON`);
}

function exportCSV(entries: AuditEntry[]) {
  const headers = ['timestamp', 'action', 'entity_type', 'entity_id', 'target_label', 'actor_name', 'actor_email', 'trace_id', 'metadata'];
  const rows = entries.map(e => [
    e.timestamp,
    e.action,
    e.entity_type,
    e.entity_id,
    `"${(e.target_label || '').replace(/"/g, '""')}"`,
    `"${(e.actor_name || '').replace(/"/g, '""')}"`,
    e.actor_email,
    e.trace_id,
    `"${JSON.stringify(e.metadata).replace(/"/g, '""')}"`,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${entries.length} entrées exportées en CSV`);
}

// ─── Main component ──────────────────────────────────────────────────

export default function AdminAuditPage() {
  const [filterEntity, setFilterEntity] = useState<AuditEntityType | ''>('');
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
  const [filterActor, setFilterActor] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [limit, setLimit] = useState(50);
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load all entries then filter client-side
  const allEntries = useMemo(() => {
    return adminAudit.list({ limit: 1000 });
  }, []);

  const entries = useMemo(() => {
    let result = allEntries;
    if (filterEntity) result = result.filter(e => e.entity_type === filterEntity);
    if (filterAction) result = result.filter(e => e.action === filterAction);
    if (filterActor) {
      const q = filterActor.toLowerCase();
      result = result.filter(e =>
        e.actor_name.toLowerCase().includes(q) || e.actor_email.toLowerCase().includes(q)
      );
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo + 'T23:59:59').getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() <= to);
    }
    return result.slice(0, limit);
  }, [allEntries, filterEntity, filterAction, filterActor, filterDateFrom, filterDateTo, limit]);

  // Stats
  const stats = useMemo(() => {
    const byAction: Record<string, number> = {};
    const byEntity: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    for (const e of allEntries) {
      byAction[e.action] = (byAction[e.action] || 0) + 1;
      byEntity[e.entity_type] = (byEntity[e.entity_type] || 0) + 1;
      byActor[e.actor_name] = (byActor[e.actor_name] || 0) + 1;
    }
    const topActors = Object.entries(byActor).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total: allEntries.length, byAction, byEntity, topActors };
  }, [allEntries]);

  const hasActiveFilters = filterEntity || filterAction || filterActor || filterDateFrom || filterDateTo;

  const clearFilters = useCallback(() => {
    setFilterEntity('');
    setFilterAction('');
    setFilterActor('');
    setFilterDateFrom('');
    setFilterDateTo('');
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Journal d'audit</h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} entrée(s) enregistrée(s) — {entries.length} affichée(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-md border transition-colors ${showStats ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
            title="Statistiques"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => exportJSON(entries)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Exporter JSON"
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON
          </button>
          <button
            onClick={() => exportCSV(entries)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Exporter CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Stats panel */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-heading font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground mt-1">Total entrées</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-heading font-bold text-foreground">{Object.keys(stats.byAction).length}</div>
            <div className="text-xs text-muted-foreground mt-1">Types d'actions</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-heading font-bold text-foreground">{Object.keys(stats.byEntity).length}</div>
            <div className="text-xs text-muted-foreground mt-1">Types d'entités</div>
          </div>
          <div className="p-4 bg-card border border-border rounded-lg">
            <div className="text-2xl font-heading font-bold text-foreground">{stats.topActors.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Acteurs distincts</div>
          </div>
          {/* Top actors */}
          {stats.topActors.length > 0 && (
            <div className="col-span-2 md:col-span-4 p-4 bg-card border border-border rounded-lg">
              <h4 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">Top acteurs</h4>
              <div className="flex flex-wrap gap-3">
                {stats.topActors.map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 rounded-md">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm text-foreground">{name}</span>
                    <span className="text-xs font-mono text-primary">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Action distribution */}
          <div className="col-span-2 md:col-span-4 p-4 bg-card border border-border rounded-lg">
            <h4 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">Distribution par action</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byAction)
                .sort((a, b) => b[1] - a[1])
                .map(([action, count]) => (
                  <button
                    key={action}
                    onClick={() => setFilterAction(action as AuditAction)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border cursor-pointer transition-colors ${ACTION_COLORS[action as AuditAction]}`}
                  >
                    {ACTION_LABELS[action as AuditAction]} <span className="font-mono opacity-70">({count})</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrer par acteur (nom ou email)..."
              value={filterActor}
              onChange={e => setFilterActor(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md transition-colors ${showFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtres avancés
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="w-3 h-3" />
              Réinitialiser
            </button>
          )}
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={25}>25 entrées</option>
            <option value={50}>50 entrées</option>
            <option value={100}>100 entrées</option>
            <option value={200}>200 entrées</option>
            <option value={500}>500 entrées</option>
          </select>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap p-3 bg-card border border-border rounded-lg">
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Type d'entité</label>
              <select
                value={filterEntity}
                onChange={e => setFilterEntity(e.target.value as AuditEntityType | '')}
                className="px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Tous</option>
                {ALL_ENTITIES.map(e => (
                  <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Action</label>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value as AuditAction | '')}
                className="px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Toutes</option>
                {ALL_ACTIONS.map(a => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Date début</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-1">Date fin</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {entries.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <ScrollText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune entrée d'audit{hasActiveFilters ? ' pour ces filtres' : ''}.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveFilters ? 'Essayez de modifier les filtres.' : 'Les actions d\'administration seront enregistrées ici.'}
            </p>
          </div>
        ) : (
          entries.map(entry => (
            <AuditRow key={entry.id} entry={entry} />
          ))
        )}
      </div>

      {entries.length >= limit && (
        <div className="text-center">
          <button
            onClick={() => setLimit(l => l + 50)}
            className="text-sm text-primary hover:underline"
          >
            Charger plus...
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Audit Row ──────────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ts = new Date(entry.timestamp);

  return (
    <div className="bg-card border border-border rounded-lg hover:bg-secondary/10 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-4"
      >
        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono shrink-0 w-36">
          <Clock className="w-3 h-3" />
          {ts.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} {ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        {/* Entity badge */}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary/30 text-muted-foreground border border-border shrink-0">
          {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
        </span>

        {/* Action badge */}
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${ACTION_COLORS[entry.action]}`}>
          {ACTION_LABELS[entry.action]}
        </span>

        {/* Description */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm text-foreground truncate">{entry.target_label}</span>
        </div>

        {/* Actor */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <User className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{entry.actor_name}</span>
        </div>

        {/* Expand icon */}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Acteur :</span>{' '}
              <span className="text-foreground font-mono">{entry.actor_email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Trace ID :</span>{' '}
              <span className="text-foreground font-mono">{entry.trace_id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Entity type :</span>{' '}
              <span className="text-foreground font-mono">{entry.entity_type}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Entity ID :</span>{' '}
              <span className="text-foreground font-mono">{entry.entity_id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Action :</span>{' '}
              <span className="text-foreground font-mono">{entry.action}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Horodatage :</span>{' '}
              <span className="text-foreground font-mono">{entry.timestamp}</span>
            </div>
          </div>
          {Object.keys(entry.metadata).length > 0 && (
            <div className="mt-3">
              <span className="text-xs text-muted-foreground">Metadata :</span>
              <pre className="mt-1 p-2 bg-background rounded text-xs text-foreground font-mono overflow-x-auto max-h-40">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
