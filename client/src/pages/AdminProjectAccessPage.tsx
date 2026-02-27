/**
 * AdminProjectAccessPage — /admin/project-access
 * Gestion des membres par projet, ajout/retrait, rôles projet
 */
import { useState, useMemo, useCallback } from 'react';
import {
  FolderKanban, Plus, Search, UserPlus, Edit2, Trash2, X,
  Shield, AlertTriangle, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { useProject } from '../state/projectStore';
import { trpc } from '@/lib/trpc';
// Project type inferred from tRPC response
import { adminMemberships, adminUsers } from '../admin/adminStore';
import {
  PROJECT_ROLE_LABELS, PROJECT_ROLE_COLORS,
  GLOBAL_ROLE_LABELS, GLOBAL_ROLE_COLORS,
  addMemberSchema,
} from '../admin/types';
import type { ProjectMembership, ProjectRole, AdminUser } from '../admin/types';

export default function AdminProjectAccessPage() {
  const { user: currentUser } = useAuth();
  const { currentProject } = useProject();
  const { data: projectsData } = trpc.projects.list.useQuery({ page: 1, pageSize: 200 });
  const allProjects = useMemo(() => projectsData?.data || [], [projectsData]);
  const actor = currentUser
    ? { id: currentUser.id, name: currentUser.full_name, email: currentUser.email }
    : { id: '', name: '', email: '' };

  const [selectedProjectId, setSelectedProjectId] = useState(currentProject?.id || '');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editMembership, setEditMembership] = useState<ProjectMembership | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ProjectMembership | null>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const selectedProject = useMemo(() => allProjects.find((p) => String(p.uid) === selectedProjectId || String(p.id) === selectedProjectId), [allProjects, selectedProjectId]);

  const members = useMemo(() => {
    void refreshKey;
    if (!selectedProjectId) return [];
    return adminMemberships.listByProject(selectedProjectId);
  }, [selectedProjectId, refreshKey]);

  const handleRemove = useCallback((m: ProjectMembership) => {
    try {
      adminMemberships.remove(m.id, actor);
      toast.success(`${m.user_name} retiré du projet`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
    setConfirmRemove(null);
  }, [actor, refresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Accès Projets</h1>
            <p className="text-sm text-muted-foreground">Gérer les membres et rôles par projet</p>
          </div>
        </div>
        {selectedProjectId && (
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter membre
          </button>
        )}
      </div>

      {/* Project selector */}
      <div className="bg-card border border-border rounded-lg p-4">
        <label className="block text-xs font-medium text-muted-foreground mb-2">Sélectionner un projet</label>
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="w-full max-w-md px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">— Choisir un projet —</option>
          {allProjects.map((p) => (
            <option key={p.uid} value={p.uid}>{p.name} ({p.domain})</option>
          ))}
        </select>
      </div>

      {/* Members table */}
      {selectedProjectId ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {members.length} membre{members.length !== 1 ? 's' : ''} — {selectedProject?.name}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Utilisateur</th>
                  <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Rôle global</th>
                  <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Rôle projet</th>
                  <th className="text-left px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Ajouté le</th>
                  <th className="text-right px-4 py-3 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Aucun membre assigné à ce projet.
                    </td>
                  </tr>
                ) : (
                  members.map(m => {
                    const userInfo = adminUsers.getById(m.user_id);
                    const globalRole = userInfo?.role || 'VIEWER';
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {m.user_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-foreground">{m.user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{m.user_email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${GLOBAL_ROLE_COLORS[globalRole]}`}>
                            {GLOBAL_ROLE_LABELS[globalRole]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${PROJECT_ROLE_COLORS[m.project_role]}`}>
                            <Shield className="w-3 h-3 mr-1" />
                            {PROJECT_ROLE_LABELS[m.project_role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(m.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditMembership(m)}
                              className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                              title="Modifier le rôle"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmRemove(m)}
                              className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                              title="Retirer du projet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <FolderKanban className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Sélectionnez un projet pour gérer ses membres.</p>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && selectedProjectId && selectedProject && (
        <AddMemberModal
          projectId={selectedProjectId}
          projectName={selectedProject.name}
          existingMemberIds={members.map(m => m.user_id)}
          actor={actor}
          onClose={() => setShowAddMember(false)}
          onAdded={() => { setShowAddMember(false); refresh(); }}
        />
      )}

      {/* Edit Role Modal */}
      {editMembership && (
        <EditRoleModal
          membership={editMembership}
          actor={actor}
          onClose={() => setEditMembership(null)}
          onUpdated={() => { setEditMembership(null); refresh(); }}
        />
      )}

      {/* Confirm Remove */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-heading font-semibold text-foreground">Retirer du projet</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Retirer <strong className="text-foreground">{confirmRemove.user_name}</strong> du projet <strong className="text-foreground">{confirmRemove.project_name}</strong> ?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmRemove(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
              <button
                onClick={() => handleRemove(confirmRemove)}
                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-sm font-medium hover:bg-red-500/20 transition-colors"
              >
                Retirer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Member Modal ───────────────────────────────────────────────────

function AddMemberModal({
  projectId,
  projectName,
  existingMemberIds,
  actor,
  onClose,
  onAdded,
}: {
  projectId: string;
  projectName: string;
  existingMemberIds: string[];
  actor: { id: string; name: string; email: string };
  onClose: () => void;
  onAdded: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [projectRole, setProjectRole] = useState<ProjectRole>('PROJECT_VIEWER');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Search users (typeahead)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const result = adminUsers.list({ search: searchQuery, status: 'ACTIVE', limit: 10 });
    return result.data.filter(u => !existingMemberIds.includes(u.id));
  }, [searchQuery, existingMemberIds]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return adminUsers.getById(selectedUserId);
  }, [selectedUserId]);

  const handleSubmit = () => {
    const result = addMemberSchema.safeParse({ user_id: selectedUserId, project_role: projectRole });
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach(e => { errs[String(e.path[0])] = e.message; });
      setErrors(errs);
      return;
    }
    try {
      adminMemberships.add(projectId, projectName, result.data, actor);
      toast.success(`${selectedUser?.full_name || 'Utilisateur'} ajouté au projet`);
      onAdded();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-heading font-semibold text-foreground">Ajouter un membre</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">Projet : <strong className="text-foreground">{projectName}</strong></p>

          {/* User search */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rechercher un utilisateur *</label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-md border border-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {selectedUser.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedUser.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedUserId(''); setSearchQuery(''); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Tapez un nom ou email..."
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { setSelectedUserId(u.id); setSearchQuery(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-secondary/30 transition-colors flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-primary">
                            {u.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-foreground">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.user_id && <p className="text-xs text-red-400 mt-1">{errors.user_id}</p>}
          </div>

          {/* Project role */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle projet *</label>
            <select
              value={projectRole}
              onChange={e => setProjectRole(e.target.value as ProjectRole)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="PROJECT_VIEWER">Lecteur Projet</option>
              <option value="PROJECT_EDITOR">Éditeur</option>
              <option value="PROJECT_ADMIN">Admin Projet</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Annuler</button>
          <button
            onClick={handleSubmit}
            disabled={!selectedUserId}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Role Modal ────────────────────────────────────────────────────

function EditRoleModal({
  membership,
  actor,
  onClose,
  onUpdated,
}: {
  membership: ProjectMembership;
  actor: { id: string; name: string; email: string };
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [projectRole, setProjectRole] = useState<ProjectRole>(membership.project_role);

  const handleSubmit = () => {
    try {
      adminMemberships.updateRole(membership.id, projectRole, actor);
      toast.success(`Rôle de ${membership.user_name} mis à jour`);
      onUpdated();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-heading font-semibold text-foreground">Modifier le rôle</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Utilisateur : <strong className="text-foreground">{membership.user_name}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Projet : <strong className="text-foreground">{membership.project_name}</strong>
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle projet</label>
            <select
              value={projectRole}
              onChange={e => setProjectRole(e.target.value as ProjectRole)}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="PROJECT_VIEWER">Lecteur Projet</option>
              <option value="PROJECT_EDITOR">Éditeur</option>
              <option value="PROJECT_ADMIN">Admin Projet</option>
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
