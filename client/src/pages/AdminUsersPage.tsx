/**
 * AdminUsersPage — /admin/users
 * CRUD utilisateurs + invitations — branché sur tRPC/Postgres
 */
import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Users, Plus, Search, Edit2, UserX,
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
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [editUser, setEditUser] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showInvitesList, setShowInvitesList] = useState(false);

  // ── tRPC queries ──────────────────────────────────────────────────────
  const [stableSearch] = useState(() => '');
  const searchInput = useMemo(() => search, [search]);

  const usersQuery = trpc.admin.listUsers.useQuery({
    page,
    pageSize,
    search: searchInput || undefined,
    role: filterRole === 'admin' || filterRole === 'user' ? filterRole as 'admin' | 'user' : undefined,
  });

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
      toast.success('Utilisateur mis à jour');
      setEditUser(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Map DB users to display format
  const usersData = useMemo(() => {
    if (!usersQuery.data) return { users: [], pagination: { page: 1, pageSize: 15, total: 0, totalPages: 1 } };
    return {
      users: usersQuery.data.data.map((u: any) => ({
        id: u.id,
        name: u.name || 'Sans nom',
        email: u.email || '',
        role: DB_ROLE_TO_FRONTEND[u.role] || 'VIEWER',
        isOwner: u.isOwner || false,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
        openId: u.openId,
      })),
      pagination: usersQuery.data.pagination,
    };
  }, [usersQuery.data]);

  const { users: usersList, pagination } = usersData;

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
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Dernière connexion</th>
                <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Inscrit le</th>
                <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Chargement...
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : (
                usersList.map((u: any) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {u.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
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
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
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
                        {!u.isOwner && (
                          <button
                            onClick={() => setConfirmDelete(u)}
                            className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
