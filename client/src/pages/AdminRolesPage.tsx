/**
 * AdminRolesPage — CRUD rôles GLOBAL/PROJECT avec permissions multi-select groupées.
 *
 * Features :
 * - Tabs GLOBAL / PROJECT
 * - Table : role_id, name, scope, is_system, nb_users/memberships, updated_at
 * - Create/Edit modal avec permissions groupées via PERMISSION_GROUPS
 * - Preview "Matrice des capacités"
 * - Rôles système : pas de delete ; edit permissions limité si is_system
 * - Empêcher delete si rôle utilisé (409)
 */
import { useState, useMemo, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import {
  ShieldCheck, Plus, Pencil, Trash2, Lock, Check, X, ChevronDown, ChevronRight,
  Crown, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { memoryStore } from '../api/memoryStore';
import {
  PermissionKey,
  PERMISSION_GROUPS,
  SYSTEM_ROLES,
  getAllRoles,
  saveCustomRole,
  deleteCustomRole,
  type RoleDefinition,
} from '../admin/permissions';

type ScopeTab = 'GLOBAL' | 'PROJECT';

export default function AdminRolesPage() {
  const [activeTab, setActiveTab] = useState<ScopeTab>('GLOBAL');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const roles = useMemo(() => getAllRoles(activeTab), [activeTab, refreshKey]);

  // Count users/memberships for each role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    try {
      const usersRaw = memoryStore.getItem('agilestest_admin_users');
      const membershipsRaw = memoryStore.getItem('agilestest_memberships');
      const users = usersRaw ? JSON.parse(usersRaw) as Array<{ role: string }> : [];
      const memberships = membershipsRaw ? JSON.parse(membershipsRaw) as Array<{ project_role: string }> : [];

      for (const r of roles) {
        if (r.scope === 'GLOBAL') {
          counts[r.role_id] = users.filter(u => u.role === r.role_id).length;
        } else {
          counts[r.role_id] = memberships.filter(m => m.project_role === r.role_id).length;
        }
      }
    } catch { /* ignore */ }
    return counts;
  }, [roles]);

  const handleDelete = useCallback((roleId: string) => {
    try {
      deleteCustomRole(roleId);
      toast.success('Rôle supprimé');
      setRefreshKey(k => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Gestion des Rôles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Créez et modifiez les rôles avec leurs permissions. Les rôles système sont protégés.
          </p>
        </div>
        <button
          onClick={() => { setIsCreating(true); setEditingRole(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau rôle
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit">
        {(['GLOBAL', 'PROJECT'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'GLOBAL' ? 'Rôles Globaux' : 'Rôles Projet'}
          </button>
        ))}
      </div>

      {/* Roles Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/30 border-b border-border">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Système</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Permissions</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                {activeTab === 'GLOBAL' ? 'Utilisateurs' : 'Memberships'}
              </th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role, roleIdx) => (
              <Fragment key={`role-tbody-${role.role_id}-${roleIdx}`}>
                <tr key={role.role_id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{role.role_id}</td>
                  <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                    {role.is_system && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    {role.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{role.description}</td>
                  <td className="px-4 py-3 text-center">
                    {role.is_system ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Lock className="w-2.5 h-2.5" /> système
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        custom
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setShowPreview(showPreview === role.role_id ? null : role.role_id)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {role.permissions.length}
                      {showPreview === role.role_id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs">{roleCounts[role.role_id] || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditingRole(role); setIsCreating(false); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!role.is_system && (
                        <button
                          onClick={() => handleDelete(role.role_id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Permission preview row */}
                {showPreview === role.role_id && (
                  <tr key={`${role.role_id}-preview`} className="bg-secondary/10">
                    <td colSpan={7} className="px-4 py-3">
                      <PermissionPreview permissions={role.permissions} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  Aucun rôle {activeTab === 'GLOBAL' ? 'global' : 'projet'} trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {(isCreating || editingRole) && (
        <RoleEditorModal
          role={editingRole}
          defaultScope={activeTab}
          onClose={() => { setIsCreating(false); setEditingRole(null); }}
          onSave={() => { setIsCreating(false); setEditingRole(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

// ─── Permission Preview ────────────────────────────────────────────────

function PermissionPreview({ permissions }: { permissions: PermissionKey[] }) {
  const permSet = new Set(permissions);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {PERMISSION_GROUPS.map((group, groupIdx) => {
        const granted = group.permissions.filter(p => permSet.has(p.key));
        if (granted.length === 0) return null;
        return (
          <div key={`perm-group-${group.id}-${groupIdx}`} className="space-y-1">
            <p className="text-[10px] font-mono font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.permissions.map((p, pIdx) => (
                <span
                  key={`perm-${p.key}-${pIdx}`}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-mono',
                    permSet.has(p.key)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-secondary/50 text-muted-foreground/40 line-through'
                  )}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Role Editor Modal ─────────────────────────────────────────────────

interface RoleEditorModalProps {
  role: RoleDefinition | null;
  defaultScope: ScopeTab;
  onClose: () => void;
  onSave: () => void;
}

function RoleEditorModal({ role, defaultScope, onClose, onSave }: RoleEditorModalProps) {
  const isEdit = !!role;
  const isSystem = role?.is_system ?? false;

  const [roleId, setRoleId] = useState(role?.role_id ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [scope, setScope] = useState<'GLOBAL' | 'PROJECT'>(role?.scope ?? defaultScope);
  const [selectedPerms, setSelectedPerms] = useState<Set<PermissionKey>>(
    new Set(role?.permissions ?? [])
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const togglePerm = useCallback((key: PermissionKey) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const selectAllInGroup = useCallback((group: typeof PERMISSION_GROUPS[0]) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      const allSelected = group.permissions.every(p => next.has(p.key));
      if (allSelected) {
        group.permissions.forEach(p => next.delete(p.key));
      } else {
        group.permissions.forEach(p => next.add(p.key));
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!roleId.trim()) { toast.error('L\'ID du rôle est requis'); return; }
    if (!name.trim()) { toast.error('Le nom est requis'); return; }
    if (!/^[A-Z][A-Z0-9_]*$/.test(roleId) && !isEdit) {
      toast.error('L\'ID doit être en MAJUSCULES_SNAKE_CASE'); return;
    }

    // Check uniqueness for new roles
    if (!isEdit) {
      const existing = getAllRoles();
      if (existing.some(r => r.role_id === roleId)) {
        toast.error('Un rôle avec cet ID existe déjà'); return;
      }
    }

    try {
      saveCustomRole({
        role_id: roleId,
        name,
        description,
        scope,
        is_system: isSystem,
        permissions: Array.from(selectedPerms),
        created_at: role?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success(isEdit ? 'Rôle modifié' : 'Rôle créé');
      onSave();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  }, [roleId, name, description, scope, selectedPerms, isEdit, isSystem, role, onSave]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            {isSystem && <Lock className="w-4 h-4 text-amber-400" />}
            {isEdit ? `Modifier : ${role!.name}` : 'Nouveau rôle'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                ID du rôle {isEdit && <span className="text-amber-400">(immutable)</span>}
              </label>
              <input
                value={roleId}
                onChange={e => setRoleId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                disabled={isEdit}
                placeholder="CUSTOM_ROLE_NAME"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground disabled:opacity-50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Scope</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value as 'GLOBAL' | 'PROJECT')}
                disabled={isEdit}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground disabled:opacity-50"
              >
                <option value="GLOBAL">Global</option>
                <option value="PROJECT">Projet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nom</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nom du rôle"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Description du rôle..."
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none"
            />
          </div>

          {/* Permissions multi-select grouped */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                Permissions ({selectedPerms.size} sélectionnées)
              </label>
              {isSystem && (
                <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Rôle système — modifications limitées
                </span>
              )}
            </div>

            <div className="space-y-2 border border-border rounded-lg p-3 max-h-80 overflow-y-auto">
              {PERMISSION_GROUPS.map(group => {
                const isExpanded = expandedGroups.has(group.id);
                const selectedCount = group.permissions.filter(p => selectedPerms.has(p.key)).length;
                const allSelected = selectedCount === group.permissions.length;

                return (
                  <div key={group.id} className="border border-border/50 rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span className="text-xs font-medium text-foreground">{group.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {selectedCount}/{group.permissions.length}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); selectAllInGroup(group); }}
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-mono transition-colors',
                            allSelected
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {allSelected ? 'Tout retirer' : 'Tout sélect.'}
                        </button>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 py-2 grid grid-cols-2 gap-1.5">
                        {group.permissions.map(p => (
                          <label
                            key={p.key}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <div
                              onClick={() => togglePerm(p.key)}
                              className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                                selectedPerms.has(p.key)
                                  ? 'bg-primary border-primary'
                                  : 'border-border bg-background group-hover:border-primary/50'
                              )}
                            >
                              {selectedPerms.has(p.key) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                            </div>
                            <span className="text-xs text-foreground">{p.label}</span>
                            <span className="text-[9px] font-mono text-muted-foreground/50 ml-auto">{p.key}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Check className="w-4 h-4" />
            {isEdit ? 'Enregistrer' : 'Créer le rôle'}
          </button>
        </div>
      </div>
    </div>
  );
}
