/**
 * AdminUsersPage — /admin/users
 * CRUD utilisateurs, filtres, disable/enable, reset password, view memberships
 */
import { useState, useMemo, useCallback } from 'react';
import {
  Users, Plus, Search, Filter, Edit2, UserX, UserCheck,
  KeyRound, Eye, MoreHorizontal, Shield, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { adminUsers, adminMemberships } from '../admin/adminStore';
import {
  GLOBAL_ROLE_LABELS, GLOBAL_ROLE_COLORS, PROJECT_ROLE_LABELS, PROJECT_ROLE_COLORS,
  createUserSchema, updateUserSchema,
} from '../admin/types';
import type { AdminUser, UserStatus, CreateUserInput, UpdateUserInput, ProjectMembership } from '../admin/types';
import type { UserRole } from '../types';

// ─── Component ──────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const actor = currentUser
    ? { id: currentUser.id, name: currentUser.full_name, email: currentUser.email }
    : { id: '', name: '', email: '' };

  // State
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | ''>('');
  const [filterStatus, setFilterStatus] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [viewMembershipsUser, setViewMembershipsUser] = useState<AdminUser | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<AdminUser | null>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Data
  const result = useMemo(() => {
    void refreshKey;
    return adminUsers.list({
      search: search || undefined,
      status: filterStatus || undefined,
      role: filterRole || undefined,
      page,
      limit: 15,
    });
  }, [search, filterRole, filterStatus, page, refreshKey]);

  const { data: users, pagination } = result;

  // Handlers
  const handleDisable = useCallback((u: AdminUser) => {
    try {
      adminUsers.disable(u.id, actor);
      toast.success(`${u.full_name} désactivé`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
    setConfirmDisable(null);
  }, [actor, refresh]);

  const handleEnable = useCallback((u: AdminUser) => {
    try {
      adminUsers.enable(u.id, actor);
      toast.success(`${u.full_name} réactivé`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [actor, refresh]);

  const handleResetPassword = useCallback((u: AdminUser) => {
    try {
      const res = adminUsers.resetPassword(u.id, actor);
      toast.success(res.message);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [actor]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Utilisateurs</h1>
            <p className="text-sm text-muted-foreground">Gestion des comptes et rôles globaux</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Créer utilisateur
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value as UserRole | ''); setPage(1); }}
          className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Tous les rôles</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value as UserStatus | ''); setPage(1); }}
          className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="DISABLED">Désactivé</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Rôle</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Projets</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Dernière activité</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {u.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-foreground">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${GLOBAL_ROLE_COLORS[u.role]}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {GLOBAL_ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-400' : 'bg-red-400'}`} />
                        {u.status === 'ACTIVE' ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{u.memberships_count}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditUser(u)}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setViewMembershipsUser(u)}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          title="Voir les projets"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="p-1.5 text-muted-foreground hover:text-amber-400 transition-colors"
                          title="Réinitialiser mot de passe"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {u.status === 'ACTIVE' ? (
                          <button
                            onClick={() => setConfirmDisable(u)}
                            className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Désactiver"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnable(u)}
                            className="p-1.5 text-muted-foreground hover:text-green-400 transition-colors"
                            title="Réactiver"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {pagination.total} utilisateur{pagination.total > 1 ? 's' : ''} — Page {pagination.page}/{pagination.total_pages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                disabled={page === pagination.total_pages}
                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateUserModal
          actor={actor}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          actor={actor}
          onClose={() => setEditUser(null)}
          onUpdated={() => { setEditUser(null); refresh(); }}
        />
      )}

      {/* View Memberships Drawer */}
      {viewMembershipsUser && (
        <MembershipsDrawer
          user={viewMembershipsUser}
          onClose={() => setViewMembershipsUser(null)}
        />
      )}

      {/* Confirm Disable */}
      {confirmDisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Désactiver l'utilisateur</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Êtes-vous sûr de vouloir désactiver <strong className="text-foreground">{confirmDisable.full_name}</strong> ?
              L'utilisateur ne pourra plus se connecter.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDisable(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDisable(confirmDisable)}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-sm font-medium hover:bg-red-500/20 transition-colors"
              >
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create User Modal ──────────────────────────────────────────────────

function CreateUserModal({
  actor,
  onClose,
  onCreated,
}: {
  actor: { id: string; name: string; email: string };
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateUserInput>({
    full_name: '',
    email: '',
    role: 'VIEWER',
    password: '',
    send_invite: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const result = createUserSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(e => { errs[String(e.path[0])] = e.message; });
      setErrors(errs);
      return;
    }
    try {
      adminUsers.create(result.data, actor);
      toast.success(`Utilisateur ${form.full_name} créé`);
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-heading font-semibold text-foreground">Créer un utilisateur</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nom complet *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Jean Dupont"
            />
            {errors.full_name && <p className="text-xs text-red-400 mt-1">{errors.full_name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="jean.dupont@example.com"
            />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle global *</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="VIEWER">Lecteur (Viewer)</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Mot de passe (optionnel)</label>
            <input
              type="password"
              value={form.password || ''}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Min. 6 caractères"
            />
            {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.send_invite}
              onChange={e => setForm(f => ({ ...f, send_invite: e.target.checked }))}
              className="rounded border-border"
            />
            Envoyer un email d'invitation (simulé)
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Modal ────────────────────────────────────────────────────

function EditUserModal({
  user,
  actor,
  onClose,
  onUpdated,
}: {
  user: AdminUser;
  actor: { id: string; name: string; email: string };
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState<UpdateUserInput>({
    full_name: user.full_name,
    email: user.email,
    role: user.role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = () => {
    const result = updateUserSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(e => { errs[String(e.path[0])] = e.message; });
      setErrors(errs);
      return;
    }
    try {
      adminUsers.update(user.id, result.data, actor);
      toast.success(`Utilisateur ${form.full_name || user.full_name} mis à jour`);
      onUpdated();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-heading font-semibold text-foreground">Modifier l'utilisateur</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nom complet</label>
            <input
              type="text"
              value={form.full_name || ''}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.full_name && <p className="text-xs text-red-400 mt-1">{errors.full_name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={form.email || ''}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle global</label>
            <select
              value={form.role || user.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="VIEWER">Lecteur (Viewer)</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Memberships Drawer ─────────────────────────────────────────────────

function MembershipsDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const memberships = useMemo(() => adminMemberships.listByUser(user.id), [user.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground">Projets de {user.full_name}</h3>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          {memberships.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Aucun accès projet assigné.</p>
              {user.role !== 'ADMIN' && (
                <p className="text-xs text-amber-400 mt-2">
                  Cet utilisateur n'a accès à aucun projet. Ajoutez-le via "Accès Projets".
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {memberships.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.project_name}</p>
                    <p className="text-xs text-muted-foreground">Depuis {new Date(m.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${PROJECT_ROLE_COLORS[m.project_role]}`}>
                    {PROJECT_ROLE_LABELS[m.project_role]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
