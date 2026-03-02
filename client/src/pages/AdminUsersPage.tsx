/**
 * AdminUsersPage — /admin/users
 * CRUD utilisateurs + invitations — branché sur tRPC/Postgres
 */
import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Users, Plus, Search, Edit2, UserX, UserPlus,
  KeyRound, Eye, Shield, X, ChevronLeft, ChevronRight,
  Mail, MailX, MailCheck, RefreshCw, Send, Trash2, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { localNotifSettings } from '../notifications';
import type { UserRole } from '../types';

// ─── Role mapping (DB uses lowercase, frontend uses uppercase) ─────────
const DB_ROLE_TO_FRONTEND: Record<string, UserRole> = {
  admin: 'ADMIN',
  user: 'VIEWER',
};
const FRONTEND_ROLE_TO_DB: Record<string, string> = {
  ADMIN: 'admin',
  MANAGER: 'user', // no manager in DB enum, fallback to user
  VIEWER: 'user',
};

const GLOBAL_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  VIEWER: 'Lecteur',
};
const GLOBAL_ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
  MANAGER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  VIEWER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  invited: 'Invité',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  inactive: 'text-muted-foreground',
  invited: 'text-indigo-400',
};

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

// ─── Component ──────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  // State
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [editUser, setEditUser] = useState<any | null>(null);
  const [viewUser, setViewUser] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showInvitesList, setShowInvitesList] = useState(false);

  // ── tRPC queries ──────────────────────────────────────────────────────
  const searchInput = useMemo(() => search, [search]);

  const usersQuery = trpc.admin.listUsers.useQuery({
    page,
    pageSize,
    search: searchInput || undefined,
    role: filterRole === 'admin' || filterRole === 'user' ? filterRole as 'admin' | 'user' : undefined,
  });

  // Fetch pending invites to merge into user list as "invited" status
  const invitesListQuery = trpc.admin.listInvites.useQuery({ page: 1, pageSize: 100 });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast.success('Utilisateur supprimé');
      setConfirmDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateUserMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast.success('Utilisateur mis \u00e0 jour');
      setEditUser(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Resend invite mutation
  const sendInviteEmailMutation = (trpc.notifications as any).sendInviteEmail?.useMutation?.() ?? { mutateAsync: async () => ({ success: false, error: 'Not available' }), isPending: false };

  const resendInviteMutation = trpc.admin.resendInvite.useMutation({
    onSuccess: async (data) => {
      utils.admin.listInvites.invalidate();

      // Attempt to send email via SMTP if Live mode is active
      const rawEmail = localNotifSettings.getRawEmailSettings();
      const isSmtpLive = rawEmail.enabled && rawEmail.provider === 'SMTP' && rawEmail.host && rawEmail.username && rawEmail.password;

      if (isSmtpLive) {
        try {
          const baseUrl = window.location.origin;
          const inviteLink = `${baseUrl}/invite/accept?token=${data.token}`;
          const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrateur', MANAGER: 'Manager', VIEWER: 'Lecteur' };

          const result = await sendInviteEmailMutation.mutateAsync({
            smtp: {
              host: rawEmail.host!,
              port: rawEmail.port,
              secure: rawEmail.secure,
              username: rawEmail.username!,
              password: rawEmail.password!,
              from_email: rawEmail.from_email || 'noreply@agilestest.io',
              from_name: rawEmail.from_name || 'AgilesTest',
              reply_to: rawEmail.reply_to || undefined,
              timeout_ms: rawEmail.timeout_ms,
            },
            invitee_email: data.email,
            inviter_name: 'Administrateur',
            role: ROLE_LABELS[data.role] || data.role,
            invite_link: inviteLink,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            app_name: 'AgilesTest',
          });

          if (result.success) {
            toast.success(`Invitation renvoy\u00e9e \u00e0 ${data.email} \u2014 email d\u00e9livr\u00e9 via SMTP`);
          } else {
            toast.warning(`Invitation renvoy\u00e9e mais l'email n'a pas pu \u00eatre envoy\u00e9 : ${result.error}`);
          }
        } catch (smtpErr: any) {
          toast.warning(`Invitation renvoy\u00e9e mais erreur SMTP : ${smtpErr.message}`);
        }
      } else {
        toast.success(`Invitation renvoy\u00e9e pour ${data.email} (email non envoy\u00e9 \u2014 activez le mode Live dans Admin > Notifications > Email)`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Map DB users to display format, merging pending invites as "invited" entries
  const usersData = useMemo(() => {
    if (!usersQuery.data) return { users: [], pagination: { page: 1, pageSize: 15, total: 0, totalPages: 1 } };

    const dbUsers = usersQuery.data.data.map((u: any) => {
      // Determine status: user is active if they have logged in at least once
      const status = u.lastSignedIn ? 'active' : 'inactive';
      return {
        id: u.id,
        name: u.name || 'Sans nom',
        email: u.email || '',
        role: DB_ROLE_TO_FRONTEND[u.role] || 'VIEWER',
        isOwner: u.isOwner || false,
        status,
        projectsCount: u.projectsCount ?? 0,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
        openId: u.openId,
        avatarUrl: u.avatarUrl ?? null,
        isInvite: false,
      };
    });

    // Merge pending invites that don't have a corresponding user yet
    const pendingInvites = (invitesListQuery.data?.data ?? [])
      .filter((inv: any) => inv.status === 'PENDING')
      .filter((inv: any) => !dbUsers.some((u: any) => u.email === inv.email));

    const inviteEntries = pendingInvites.map((inv: any) => ({
      id: `invite-${inv.id}`,
      name: inv.email.split('@')[0],
      email: inv.email,
      role: inv.role || 'VIEWER',
      isOwner: false,
      status: 'invited' as const,
      projectsCount: 0,
      createdAt: inv.createdAt,
      lastSignedIn: null,
      openId: null,
      avatarUrl: null,
      isInvite: true,
      inviteId: inv.id,
    }));

    return {
      users: [...dbUsers, ...inviteEntries],
      pagination: usersQuery.data.pagination,
    };
  }, [usersQuery.data, invitesListQuery.data]);

  // Apply status filter client-side (since backend doesn't have status column)
  const filteredUsers = useMemo(() => {
    if (!filterStatus) return usersData.users;
    return usersData.users.filter((u: any) => u.status === filterStatus);
  }, [usersData.users, filterStatus]);

  const { pagination } = usersData;

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
            onClick={() => setShowCreateUser(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
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
          onChange={e => { setFilterRole(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Tous les rôles</option>
          <option value="admin">Administrateur</option>
          <option value="user">Utilisateur</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
          <option value="invited">Invité</option>
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
                <th className="text-center px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Projets</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Dernière activité</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Chargement...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u: any) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="w-8 h-8 rounded-md object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-foreground">{u.name}</span>
                          {u.isOwner && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Propriétaire
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${GLOBAL_ROLE_COLORS[u.role] || GLOBAL_ROLE_COLORS.VIEWER}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        {GLOBAL_ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_COLORS[u.status] || STATUS_COLORS.inactive}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-400' : u.status === 'invited' ? 'bg-indigo-400' : 'bg-muted-foreground'}`} />
                        {STATUS_LABELS[u.status] || u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                      {u.projectsCount}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.lastSignedIn
                        ? new Date(u.lastSignedIn).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : new Date(u.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {u.isInvite ? (
                          <button
                            onClick={() => resendInviteMutation.mutate({ inviteId: u.inviteId })}
                            disabled={resendInviteMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-400 bg-indigo-500/10 rounded border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-pointer disabled:opacity-50"
                            title="Renvoyer l'invitation"
                          >
                            {resendInviteMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Renvoyer
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditUser(u)}
                              className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setViewUser(u)}
                              className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                              title="Voir le profil"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setResetPasswordUser(u)}
                              className="p-1.5 text-muted-foreground hover:text-amber-400 transition-colors"
                              title="Réinitialiser le mot de passe"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            {!u.isOwner && (
                              <button
                                onClick={() => setConfirmDelete(u)}
                                className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
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
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {pagination.total} utilisateur{pagination.total > 1 ? 's' : ''} — Page {pagination.page}/{pagination.totalPages}
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
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSubmit={(data) => {
            updateUserMutation.mutate({
              userId: editUser.id,
              name: data.name,
              email: data.email,
              role: data.role ? FRONTEND_ROLE_TO_DB[data.role] as 'admin' | 'user' : undefined,
            });
          }}
          isLoading={updateUserMutation.isPending}
        />
      )}

      {/* View User Modal */}
      {viewUser && (
        <ViewUserModal user={viewUser} onClose={() => setViewUser(null)} />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal user={resetPasswordUser} onClose={() => setResetPasswordUser(null)} />
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Supprimer l'utilisateur</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Êtes-vous sûr de vouloir supprimer <strong className="text-foreground">{confirmDelete.name}</strong> ?
              Cette action est irréversible. Toutes les données associées (appartenances projets, invitations, journaux d'audit) seront supprimées.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteUserMutation.mutate({ userId: confirmDelete.id })}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Supprimer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <CreateUserModal
          onClose={() => setShowCreateUser(false)}
          onCreated={() => {
            setShowCreateUser(false);
            utils.admin.listUsers.invalidate();
          }}
        />
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSent={() => { setShowInvite(false); }}
        />
      )}

      {/* Invites List Drawer */}
      {showInvitesList && (
        <InvitesListDrawer
          onClose={() => setShowInvitesList(false)}
        />
      )}
    </div>
  );
}

// ─── View User Modal ──────────────────────────────────────────────────

function ViewUserModal({ user, onClose }: { user: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Profil utilisateur
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-14 h-14 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-primary">
                  {user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h4 className="text-lg font-semibold text-foreground">{user.name}</h4>
              <p className="text-sm text-muted-foreground font-mono">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Rôle</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${GLOBAL_ROLE_COLORS[user.role] || GLOBAL_ROLE_COLORS.VIEWER}`}>
                <Shield className="w-3 h-3 mr-1" />
                {GLOBAL_ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Statut</p>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${STATUS_COLORS[user.status] || STATUS_COLORS.inactive}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-400' : user.status === 'invited' ? 'bg-indigo-400' : 'bg-muted-foreground'}`} />
                {STATUS_LABELS[user.status] || user.status}
              </span>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Projets</p>
              <p className="text-sm font-medium text-foreground">{user.projectsCount}</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Dernière connexion</p>
              <p className="text-sm font-medium text-foreground">
                {user.lastSignedIn
                  ? new Date(user.lastSignedIn).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Jamais'}
              </p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 col-span-2">
              <p className="text-xs text-muted-foreground mb-1">Inscrit le</p>
              <p className="text-sm font-medium text-foreground">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>
          {user.isOwner && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="w-3.5 h-3.5" />
              Cet utilisateur est le propriétaire de l'application.
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: any; onClose: () => void }) {
  const handleReset = () => {
    // TODO: Implement actual password reset via tRPC when endpoint is available
    toast.info(`Fonctionnalité à venir — la réinitialisation du mot de passe pour ${user.name} sera disponible prochainement.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground">Réinitialiser le mot de passe</h3>
            <p className="text-xs text-muted-foreground">{user.name} — {user.email}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Un email de réinitialisation sera envoyé à <strong className="text-foreground">{user.email}</strong>.
          L'utilisateur devra définir un nouveau mot de passe via le lien reçu.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-sm font-medium hover:bg-amber-500/20 transition-colors"
          >
            Envoyer le lien
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('VIEWER');

  const createUserMutation = trpc.admin.createInvite.useMutation({
    onSuccess: () => {
      toast.success(`Utilisateur ${name} créé avec succès`);
      onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Le nom est requis'); return; }
    if (!email.trim()) { toast.error('L\'email est requis'); return; }
    createUserMutation.mutate({ email, role: role as 'ADMIN' | 'MANAGER' | 'VIEWER' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Créer un utilisateur
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nom complet</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jean.dupont@exemple.com"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle global</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="VIEWER">Lecteur</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Mail className="w-3.5 h-3.5" />
            Une invitation sera envoyée à l'adresse email indiquée.
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button
            onClick={handleCreate}
            disabled={createUserMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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
  onClose,
  onSubmit,
  isLoading,
}: {
  user: { id: number; name: string; email: string; role: string; isOwner: boolean };
  onClose: () => void;
  onSubmit: (data: { name?: string; email?: string; role?: string }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);

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
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle global</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={user.isOwner}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              <option value="VIEWER">Lecteur</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Administrateur</option>
            </select>
            {user.isOwner && (
              <p className="text-xs text-amber-400 mt-1">Le rôle du propriétaire ne peut pas être modifié.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button
            onClick={() => onSubmit({ name, email, role })}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invite Modal ──────────────────────────────────────────────────────

function InviteModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('VIEWER');
  const sendInviteEmailMutation = (trpc.notifications as any).sendInviteEmail?.useMutation?.() ?? { mutateAsync: async () => ({ success: false, error: 'Not available' }), isPending: false };

  const createInviteMutation = trpc.admin.createInvite.useMutation({
    onSuccess: async (data) => {
      utils.admin.listInvites.invalidate();

      // Tenter l'envoi d'email réel via SMTP si le mode Live est actif
      const rawEmail = localNotifSettings.getRawEmailSettings();
      const isSmtpLive = rawEmail.enabled && rawEmail.provider === 'SMTP' && rawEmail.host && rawEmail.username && rawEmail.password;

      if (isSmtpLive) {
        try {
          const baseUrl = window.location.origin;
          const inviteLink = `${baseUrl}/invite/accept?token=${data.token}`;
          const ROLE_LABELS: Record<string, string> = { ADMIN: 'Administrateur', MANAGER: 'Manager', VIEWER: 'Lecteur' };

          const result = await sendInviteEmailMutation.mutateAsync({
            smtp: {
              host: rawEmail.host!,
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
            inviter_name: 'Administrateur',
            role: ROLE_LABELS[role] || role,
            invite_link: inviteLink,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            app_name: 'AgilesTest',
          });

          if (result.success) {
            toast.success(`Invitation envoyée à ${email} — email délivré via SMTP`);
          } else {
            toast.warning(`Invitation créée mais l'email n'a pas pu être envoyé : ${result.error}`);
          }
        } catch (smtpErr: any) {
          toast.warning(`Invitation créée mais erreur SMTP : ${smtpErr.message}`);
        }
      } else {
        toast.success(`Invitation créée pour ${email} (email non envoyé — activez le mode Live dans Admin > Notifications > Email)`);
      }

      onSent();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSend = useCallback(() => {
    if (!email.trim()) { toast.error('Email requis'); return; }
    createInviteMutation.mutate({ email, role: role as 'ADMIN' | 'MANAGER' | 'VIEWER' });
  }, [email, role, createInviteMutation]);

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
              onChange={e => setRole(e.target.value)}
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
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Annuler
          </button>
          <button
            onClick={handleSend}
            disabled={createInviteMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {createInviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {createInviteMutation.isPending ? 'Envoi en cours...' : 'Envoyer l\'invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invites List Drawer ───────────────────────────────────────────────

function InvitesListDrawer({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();

  const invitesQuery = trpc.admin.listInvites.useQuery({ page: 1, pageSize: 50 });

  const revokeInviteMutation = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => {
      utils.admin.listInvites.invalidate();
      toast.success('Invitation révoquée');
    },
    onError: (err) => toast.error(err.message),
  });

  const invites = invitesQuery.data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border-l border-border h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              Invitations
            </h3>
            <p className="text-xs text-muted-foreground">{invites.length} invitation(s)</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          {invitesQuery.isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune invitation envoyée.</p>
            </div>
          ) : (
            invites.map((inv: any) => (
              <div key={inv.id} className="p-4 bg-secondary/30 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invité le {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${INVITE_STATUS_COLORS[inv.status] || ''}`}>
                    {INVITE_STATUS_LABELS[inv.status] || inv.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Rôle : <strong className="text-foreground">{GLOBAL_ROLE_LABELS[inv.role] || inv.role}</strong></span>
                  <span className="text-border">|</span>
                  <span>Expire : {new Date(inv.expiresAt).toLocaleDateString('fr-FR')}</span>
                </div>
                {inv.status === 'PENDING' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => revokeInviteMutation.mutate({ inviteId: inv.id })}
                      disabled={revokeInviteMutation.isPending}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600/10 text-red-400 rounded hover:bg-red-600/20 transition-colors"
                    >
                      <MailX className="w-3 h-3" />
                      Révoquer
                    </button>
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
