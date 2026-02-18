/**
 * AdminAuditPage — /admin/audit
 * Journal d'audit : actions utilisateurs/memberships avec filtres
 */
import { useState, useMemo } from 'react';
import { ScrollText, Search, Filter, Clock, User, Shield, ArrowRight } from 'lucide-react';
import { adminAudit } from '../admin/adminStore';
import type { AuditEntry, AuditAction, AuditEntityType } from '../admin/types';

const ACTION_LABELS: Record<AuditAction, string> = {
  USER_CREATED: 'Utilisateur créé',
  USER_UPDATED: 'Utilisateur modifié',
  USER_DISABLED: 'Utilisateur désactivé',
  USER_ENABLED: 'Utilisateur réactivé',
  USER_PASSWORD_RESET: 'Mot de passe réinitialisé',
  MEMBERSHIP_ADDED: 'Membre ajouté',
  MEMBERSHIP_UPDATED: 'Rôle modifié',
  MEMBERSHIP_REMOVED: 'Membre retiré',
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
};

export default function AdminAuditPage() {
  const [filterEntity, setFilterEntity] = useState<AuditEntityType | ''>('');
  const [filterActor, setFilterActor] = useState('');
  const [limit, setLimit] = useState(50);

  const entries = useMemo(() => {
    return adminAudit.list({
      entity: filterEntity || undefined,
      actor: filterActor || undefined,
      limit,
    });
  }, [filterEntity, filterActor, limit]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Journal d'audit</h1>
          <p className="text-sm text-muted-foreground">Historique des actions d'administration</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filtrer par acteur..."
            value={filterActor}
            onChange={e => setFilterActor(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value as AuditEntityType | '')}
          className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Tous les types</option>
          <option value="user">Utilisateurs</option>
          <option value="membership">Memberships</option>
        </select>
        <select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value={25}>25 entrées</option>
          <option value={50}>50 entrées</option>
          <option value={100}>100 entrées</option>
          <option value={200}>200 entrées</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {entries.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <ScrollText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucune entrée d'audit.</p>
            <p className="text-xs text-muted-foreground mt-1">Les actions d'administration seront enregistrées ici.</p>
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
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
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
          </div>
          {Object.keys(entry.metadata).length > 0 && (
            <div className="mt-3">
              <span className="text-xs text-muted-foreground">Metadata :</span>
              <pre className="mt-1 p-2 bg-background rounded text-xs text-foreground font-mono overflow-x-auto">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
