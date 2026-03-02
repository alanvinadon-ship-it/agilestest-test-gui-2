import { useState, useCallback } from 'react';
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjectQueries';
import { useProject } from '../state/projectStore';
import { useAuth } from '../auth/AuthContext';
import { usePermission, PermissionKey } from '../security';
import type { Project, ProjectDomain, CreateProjectRequest } from '../types';
import {
  Plus, Trash2, Loader2, FolderOpen, Search,
  AlertCircle, X, Check
} from 'lucide-react';

// ─── Domain Badge ────────────────────────────────────────────────────────────

const domainStyles: Record<string, string> = {
  WEB: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  API: 'bg-green-500/10 text-green-400 border-green-500/20',
  IMS: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  RAN: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  EPC: 'bg-red-500/10 text-red-400 border-red-500/20',
  '5GC': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

function DomainBadge({ domain }: { domain: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${domainStyles[domain] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
      {domain}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'Actif', cls: 'status-led-success' },
    ARCHIVED: { label: 'Archivé', cls: 'status-led-idle' },
    DRAFT: { label: 'Brouillon', cls: 'status-led-warning' },
  };
  const entry = map[status] || { label: status, cls: 'status-led-idle' };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`status-led ${entry.cls}`} />
      {entry.label}
    </span>
  );
}

// ─── DOMAINS ─────────────────────────────────────────────────────────────────

const DOMAINS: { value: ProjectDomain; label: string }[] = [
  { value: 'WEB', label: 'Web' },
  { value: 'API', label: 'API' },
  { value: 'IMS', label: 'IMS (Telecom)' },
  { value: 'RAN', label: 'RAN (Radio)' },
  { value: 'EPC', label: 'EPC (Core)' },
  { value: '5GC', label: '5G Core' },
];

// ─── Create Project Modal ────────────────────────────────────────────────────

function CreateProjectModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState<ProjectDomain>('WEB');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const createMutation = useCreateProject();

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Le nom du projet est requis.';
    else if (name.trim().length < 3) errs.name = 'Le nom doit contenir au moins 3 caractères.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    const payload: CreateProjectRequest = {
      name: name.trim(),
      domain,
      ...(description.trim() ? { description: description.trim() } : {}),
    };

    try {
      const result = await createMutation.mutateAsync(payload);
      setName(''); setDescription(''); setDomain('WEB'); setErrors({});
      // Build a Project object from the result and input
      const project: Project = {
        id: String(result.uid),
        name: name.trim(),
        description: description.trim(),
        domain,
        status: 'ACTIVE',
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onCreated(project);
      onClose();
    } catch (err: unknown) {
      setApiError((err as Error)?.message || 'Erreur lors de la création.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-heading font-semibold text-foreground">Nouveau projet</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {apiError && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{apiError}</p>
            </div>
          )}

          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-foreground mb-1">
              Nom du projet <span className="text-destructive">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Orange CIV - IMS Validation"
              className={`w-full rounded-md border px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 ${errors.name ? 'border-destructive' : 'border-input'}`}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="project-domain" className="block text-sm font-medium text-foreground mb-1">
              Domaine <span className="text-destructive">*</span>
            </label>
            <select
              id="project-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value as ProjectDomain)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="project-desc" className="block text-sm font-medium text-foreground mb-1">
              Description <span className="text-xs text-muted-foreground">(optionnel)</span>
            </label>
            <textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Décrivez brièvement l'objectif de ce projet..."
              className="w-full rounded-md border border-input px-3 py-2 text-sm text-foreground bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{description.length}/500</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
              ) : (
                <><Plus className="w-4 h-4" /> Créer le projet</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation ─────────────────────────────────────────────────────

function DeleteConfirmModal({ project, onClose, onConfirm, isPending }: {
  project: Project | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Supprimer le projet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Êtes-vous sûr de vouloir supprimer <strong className="text-foreground">{project.name}</strong> ? Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Projects Page ───────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { canWrite } = useAuth();
  const { can } = usePermission();
  const canCreate = can(PermissionKey.PROJECTS_CREATE);
  const canDelete = can(PermissionKey.PROJECTS_DELETE);
  const { selectProject, currentProject } = useProject();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useProjects({ limit: 50 });
  const deleteMutation = useDeleteProject();

  const projects = data?.data || [];
  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.domain.toLowerCase().includes(search.toLowerCase()))
    : projects;

  const handleCreated = useCallback((project: Project) => {
    selectProject(project);
  }, [selectProject]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ projectId: deleteTarget.id });
      setDeleteTarget(null);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Projets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos projets de test. Sélectionnez un projet pour accéder aux profils, scénarios et exécutions.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau projet
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un projet..."
          className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement des projets...</span>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Impossible de charger les projets.</p>
          <button onClick={() => refetch()} className="text-sm text-primary hover:underline mt-2">Réessayer</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-lg">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-base font-heading font-semibold text-foreground mb-1">
            {search ? 'Aucun résultat' : 'Aucun projet'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {search ? 'Essayez avec d\'autres termes.' : 'Créez votre premier projet pour commencer.'}
          </p>
          {!search && canCreate && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Nouveau projet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => {
            const isSelected = currentProject?.id === project.id;
            return (
              <div
                key={project.id}
                className={`flex items-center justify-between bg-card border rounded-lg px-5 py-4 transition-colors ${
                  isSelected ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{project.name}</h3>
                      <DomainBadge domain={project.domain} />
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-md">{project.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground font-mono mt-1">
                      Créé le {new Date(project.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => selectProject(project)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-primary'
                        : 'border border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    {isSelected ? <><Check className="w-3 h-3" /> Sélectionné</> : 'Sélectionner'}
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(project)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateProjectModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      <DeleteConfirmModal project={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} isPending={deleteMutation.isPending} />
    </div>
  );
}
