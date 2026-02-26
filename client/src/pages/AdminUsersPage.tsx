/**
 * AdminUsersPage — /admin/users
 * CRUD utilisateurs via tRPC backend (DB), filtres, disable/enable, reset password, view memberships
 */
import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { localNotifSettings } from '../notifications';
import {
  Users, Plus, Search, Edit2, UserX, UserCheck,
  KeyRound, Eye, Shield, X, ChevronLeft, ChevronRight,
  Mail, MailX, MailCheck, RefreshCw, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import {
  GLOBAL_ROLE_LABELS, GLOBAL_ROLE_COLORS, PROJECT_ROLE_LABELS, PROJECT_ROLE_COLORS,
  createUserSchema, updateUserSchema,
} from '../admin/types';
import type { UserStatus, CreateUserInput, UpdateUserInput } from '../admin/types';
import type { UserRole } from '../types';

// ─── DB role mapping ────────────────────────────────────────────────────
// DB stores lowercase (admin, manager, viewer, user)
// Frontend uses uppercase (ADMIN, MANAGER, VIEWER)
function dbRoleToFrontend(dbRole: string): UserRole {
  const r = dbRole?.toUpperCase();
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'MANAGER') return 'MANAGER';
  if (r === 'VIEWER') return 'VIEWER';
  if (r === 'USER') return 'VIEWER'; // legacy "user" role maps to VIEWER
  return 'VIEWER';
}

// Map DB user row to AdminUser-like shape for the UI
function mapDbUser(row: any) {
  return {
    id: row.id,
    full_name: row.fullName || row.name || row.email || '—',
    email: row.email || '',
    role: dbRoleToFrontend(row.role),
    status: (row.status || 'ACTIVE') as UserStatus,
    last_login_at: row.lastSignedIn || null,
    memberships_count: 0, // TODO: join count
    created_at: row.createdAt,
  };
}

// ─── Component ──────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const actorId = currentUser?.id || '';
  const actorName = currentUser?.full_name || '';

  // State
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | ''>('');
  const [filterStatus, setFilterStatus] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [viewMembershipsUser, setViewMembershipsUser] = useState<any | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<any | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showInvitesList, setShowInvitesList] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // tRPC queries
  const utils = trpc.useUtils();
  const usersQuery = trpc.admin.listUsers.useQuery({
    search: search || undefined,
    role: filterRole || undefined,
    status: filterStatus || undefined,
    page,
    pageSize,
  }, { placeholderData: (prev) => prev });

  const users = useMemo(() => {
    const items = usersQuery.data?.items || [];
    return items.map(mapDbUser);
  }, [usersQuery.data]);

  const total = usersQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Mutations
  const disableMutation = trpc.admin.disableUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success('Utilisateur désactivé'); },
    onError: (e) => toast.error(e.message),
  });
  const enableMutation = trpc.admin.enableUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success('Utilisateur réactivé'); },
    onError: (e) => toast.error(e.message),
  });
  const resetPasswordMutation = trpc.admin.resetUserPassword.useMutation({
    onSuccess: () => { toast.success('Mot de passe réinitialisé'); setResetPasswordUser(null); setNewPassword(''); },
    onError: (e) => toast.error(e.message),
  });

  const handleDisable = useCallback((u: any) => {
    disableMutation.mutate({ id: u.id });
    setConfirmDisable(null);
  }, [disableMutation]);

  const handleEnable = useCallback((u: any) => {
    enableMutation.mutate({ id: u.id });
  }, [enableMutation]);

  const handleResetPassword = useCallback(() => {
    if (!resetPasswordUser || !newPassword || newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    resetPasswordMutation.mutate({ id: resetPasswordUser.id, newPassword });
  }, [resetPasswordUser, newPassword, resetPasswordMutation]);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInvitesList(true)}
            className="flex items-center gap-2 px-3 py-2 bg-secondary text-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Invitations
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            Inviter
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer utilisateur
          </button>
        </div>
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
          <option value="INVITED">Invité</option>
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
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Chargement...
                  </td>
                </tr>
              ) : users.length === 0 ? (
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
                            {u.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
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
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                        u.status === 'ACTIVE' ? 'text-green-400' : u.status === 'INVITED' ? 'text-indigo-400' : 'text-red-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          u.status === 'ACTIVE' ? 'bg-green-400' : u.status === 'INVITED' ? 'bg-indigo-400' : 'bg-red-400'
                        }`} />
                        {u.status === 'ACTIVE' ? 'Actif' : u.status === 'INVITED' ? 'Invité' : 'Désactivé'}
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
                          onClick={() => { setResetPasswordUser(u); setNewPassword(''); }}
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {total} utilisateur{total > 1 ? 's' : ''} — Page {page}/{totalPages}
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
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); utils.admin.listUsers.invalidate(); }}
        />
      )}

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={() => { setEditUser(null); utils.admin.listUsers.invalidate(); }}
        />
      )}

      {/* View Memberships Drawer */}
      {viewMembershipsUser && (
        <MembershipsDrawer
          user={viewMembershipsUser}
          onClose={() => setViewMembershipsUser(null)}
        />
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSent={() => { setShowInvite(false); utils.admin.listUsers.invalidate(); }}
        />
      )}

      {/* Invites List Drawer */}
      {showInvitesList && (
        <InvitesListDrawer
          onClose={() => setShowInvitesList(false)}
          onRefresh={() => utils.admin.listUsers.invalidate()}
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

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-heading font-semibold text-foreground">Réinitialiser le mot de passe</h3>
              <button onClick={() => setResetPasswordUser(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Nouveau mot de passe pour <strong className="text-foreground">{resetPasswordUser.full_name}</strong> ({resetPasswordUser.email})
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nouveau mot de passe *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Min. 6 caractères"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
              <button onClick={() => setResetPasswordUser(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
              <button
                onClick={handleResetPassword}
                disabled={resetPasswordMutation.isPending}
                className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {resetPasswordMutation.isPending ? 'En cours...' : 'Réinitialiser'}
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
  onClose,
  onCreated,
}: {
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

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success(`Utilisateur ${form.full_name} créé`);
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    const result = createUserSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(e => { errs[String(e.path[0])] = e.message; });
      setErrors(errs);
      return;
    }
    createMutation.mutate({
      fullName: form.full_name,
      email: form.email,
      role: form.role,
      password: form.password || undefined,
    });
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
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit User Modal ────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: any;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState<UpdateUserInput>({
    full_name: user.full_name,
    email: user.email,
    role: user.role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      toast.success(`Utilisateur ${form.full_name || user.full_name} mis à jour`);
      onUpdated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    const result = updateUserSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(e => { errs[String(e.path[0])] = e.message; });
      setErrors(errs);
      return;
    }
    updateMutation.mutate({
      id: user.id,
      fullName: form.full_name || undefined,
      email: form.email || undefined,
      role: form.role || undefined,
    });
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
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Memberships Drawer ─────────────────────────────────────────────────

function MembershipsDrawer({ user, onClose }: { user: any; onClose: () => void }) {
  const membershipsQuery = trpc.admin.listUserMemberships.useQuery({ userId: String(user.id) });
  const memberships = membershipsQuery.data?.items || [];

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
          {membershipsQuery.isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          ) : memberships.length === 0 ? (
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
              {memberships.map((m: any) => (
                <div key={m.uid || m.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.projectName || m.project_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">Depuis {new Date(m.createdAt || m.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                    PROJECT_ROLE_COLORS[m.projectRole as keyof typeof PROJECT_ROLE_COLORS] || 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {PROJECT_ROLE_LABELS[m.projectRole as keyof typeof PROJECT_ROLE_LABELS] || m.projectRole || '—'}
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

// ─── Invite Modal ──────────────────────────────────────────────────────

function InviteModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { user: currentUser } = useAuth();
  const actorId = currentUser?.id || '';
  const actorName = currentUser?.full_name || '';

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('VIEWER');
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const createInviteMutation = trpc.admin.createInvite.useMutation();
  const sendInviteEmailMutation = trpc.notifications.sendInviteEmail.useMutation();

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrateur',
    MANAGER: 'Manager',
    VIEWER: 'Lecteur',
  };

  const handleSend = useCallback(async () => {
    if (!email.trim()) { toast.error('Email requis'); return; }
    setSending(true);
    setEmailStatus('idle');
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invite = await createInviteMutation.mutateAsync({
        email: email.trim(),
        role,
        invitedBy: actorId || undefined,
        invitedByName: actorName || undefined,
        expiresAt,
      });

      if (!invite) {
        toast.error("Erreur lors de la création de l'invitation");
        return;
      }

      // Try sending email via SMTP if configured
      const rawEmail = localNotifSettings.getRawEmailSettings();
      const isSmtpLive = rawEmail.enabled && rawEmail.provider === 'SMTP' && rawEmail.host && rawEmail.username && rawEmail.password;

      if (isSmtpLive) {
        setEmailStatus('sending');
        try {
          const baseUrl = window.location.origin;
          const inviteLink = `${baseUrl}/invite/accept?token=${invite.token}`;

          const result = await sendInviteEmailMutation.mutateAsync({
            smtp: {
              host: rawEmail.host,
              port: rawEmail.port,
              secure: rawEmail.secure,
              username: rawEmail.username!,
              password: rawEmail.password!,
              from_email: rawEmail.from_email || 'noreply@agilestest.io',
              from_name: rawEmail.from_name || 'AgilesTest',
              reply_to: rawEmail.reply_to || undefined,
              timeout_ms: rawEmail.timeout_ms,
            },
            invitee_email: email,
            inviter_name: actorName || 'Administrateur',
            role: ROLE_LABELS[role] || role,
            invite_link: inviteLink,
            expires_at: invite.expiresAt?.toISOString?.() || expiresAt.toISOString(),
            app_name: 'AgilesTest',
          });

          if (result.success) {
            setEmailStatus('sent');
            toast.success(`Invitation envoyée à ${email} — email délivré via SMTP`);
          } else {
            setEmailStatus('failed');
            toast.warning(`Invitation créée mais l'email n'a pas pu être envoyé : ${result.error}`);
          }
        } catch (smtpErr: any) {
          setEmailStatus('failed');
          toast.warning(`Invitation créée mais erreur SMTP : ${smtpErr.message}`);
        }
      } else {
        toast.success(`Invitation créée pour ${email} (email non envoyé — activez le mode Live dans Admin > Notifications > Email)`);
      }

      onSent();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  }, [email, role, actorId, actorName, onSent, createInviteMutation, sendInviteEmailMutation]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" />
            Inviter un utilisateur
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="utilisateur@exemple.com"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle global</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            >
              <option value="VIEWER">Lecteur</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          {(() => {
            const rawEmail = localNotifSettings.getRawEmailSettings();
            const isLive = rawEmail.enabled && rawEmail.provider === 'SMTP' && rawEmail.host && rawEmail.username && rawEmail.password;
            return (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
                isLive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                <Mail className="w-3.5 h-3.5" />
                {isLive
                  ? `L'invitation sera envoyée par email via ${rawEmail.host}`
                  : 'Email non configuré — l\'invitation sera créée sans envoi d\'email (configurer dans Admin > Notifications > Email)'
                }
              </div>
            );
          })()}
          {emailStatus === 'sending' && (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Envoi de l'email en cours...
            </div>
          )}
          {emailStatus === 'sent' && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <MailCheck className="w-3.5 h-3.5" /> Email d'invitation envoyé avec succès
            </div>
          )}
          {emailStatus === 'failed' && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <MailX className="w-3.5 h-3.5" /> L'email n'a pas pu être envoyé (invitation créée quand même)
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Envoi en cours...' : 'Envoyer l\'invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invites List Drawer ───────────────────────────────────────────────

const INVITE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  EXPIRED: 'Expirée',
  REVOKED: 'Révoquée',
};

const INVITE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  ACCEPTED: 'bg-green-500/10 text-green-400 border-green-500/20',
  EXPIRED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  REVOKED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function InvitesListDrawer({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const { user: currentUser } = useAuth();
  const actorName = currentUser?.full_name || 'Administrateur';

  const utils = trpc.useUtils();
  const invitesQuery = trpc.admin.listInvites.useQuery({ pageSize: 100 });
  const invites = invitesQuery.data?.items || [];

  const revokeMutation = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => { utils.admin.listInvites.invalidate(); onRefresh(); toast.success('Invitation révoquée'); },
    onError: (e) => toast.error(e.message),
  });

  const sendInviteEmailMutation = trpc.notifications.sendInviteEmail.useMutation();

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrateur',
    MANAGER: 'Manager',
    VIEWER: 'Lecteur',
    admin: 'Administrateur',
    manager: 'Manager',
    viewer: 'Lecteur',
  };

  const handleResend = useCallback(async (inv: any) => {
    try {
      // Try sending email via SMTP if configured
      const rawEmail = localNotifSettings.getRawEmailSettings();
      const isSmtpLive = rawEmail.enabled && rawEmail.provider === 'SMTP' && rawEmail.host && rawEmail.username && rawEmail.password;

      if (isSmtpLive) {
        try {
          const baseUrl = window.location.origin;
          const inviteLink = `${baseUrl}/invite/accept?token=${inv.token}`;

          const result = await sendInviteEmailMutation.mutateAsync({
            smtp: {
              host: rawEmail.host,
              port: rawEmail.port,
              secure: rawEmail.secure,
              username: rawEmail.username!,
              password: rawEmail.password!,
              from_email: rawEmail.from_email || 'noreply@agilestest.io',
              from_name: rawEmail.from_name || 'AgilesTest',
              reply_to: rawEmail.reply_to || undefined,
              timeout_ms: rawEmail.timeout_ms,
            },
            invitee_email: inv.email,
            inviter_name: actorName,
            role: ROLE_LABELS[inv.role] || inv.role,
            invite_link: inviteLink,
            expires_at: inv.expiresAt ? new Date(inv.expiresAt).toISOString() : '',
            app_name: 'AgilesTest',
          });

          if (result.success) {
            toast.success(`Invitation renvoyée à ${inv.email} — email délivré via SMTP`);
          } else {
            toast.warning(`Erreur SMTP : ${result.error}`);
          }
        } catch (smtpErr: any) {
          toast.warning(`Erreur SMTP : ${smtpErr.message}`);
        }
      } else {
        toast.info(`Email non configuré — copiez le lien d'invitation manuellement`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [actorName, sendInviteEmailMutation]);

  const handleRevoke = useCallback((inv: any) => {
    revokeMutation.mutate({ uid: inv.uid });
  }, [revokeMutation]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border-l border-border h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              Invitations
            </h3>
            <p className="text-xs text-muted-foreground">{invites.length} invitation(s) au total</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          {invitesQuery.isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune invitation envoyée.</p>
            </div>
          ) : (
            invites.map((inv: any) => (
              <div key={inv.uid || inv.id} className="p-4 bg-secondary/30 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invité par {inv.invitedByName || '—'} le {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${INVITE_STATUS_COLORS[inv.status] || ''}`}>
                    {INVITE_STATUS_LABELS[inv.status] || inv.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Rôle : <strong className="text-foreground">{ROLE_LABELS[inv.role] || inv.role}</strong></span>
                  <span className="text-border">|</span>
                  <span>Expire : {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('fr-FR') : '—'}</span>
                </div>
                {(inv.status === 'PENDING' || inv.status === 'EXPIRED') && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleResend(inv)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-600/10 text-indigo-400 rounded hover:bg-indigo-600/20 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Renvoyer
                    </button>
                    {inv.status === 'PENDING' && (
                      <button
                        onClick={() => handleRevoke(inv)}
                        disabled={revokeMutation.isPending}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600/10 text-red-400 rounded hover:bg-red-600/20 transition-colors"
                      >
                        <MailX className="w-3 h-3" />
                        Révoquer
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
