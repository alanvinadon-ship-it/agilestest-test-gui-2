/**
 * RequireProjectAccess — Guard qui vérifie que l'utilisateur a un membership
 * sur le projet actif, ou est global ADMIN.
 *
 * Règle :
 * - Autoriser si user est global ADMIN
 * - Sinon autoriser uniquement si membership existe sur projectId
 * - En cas de refus : message "Accès refusé" + lien vers ProjectsPage
 */
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProject } from '../state/projectStore';
import { hasProjectAccess } from '../admin/permissions';
import { Link } from 'wouter';
import { ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export function RequireProjectAccess({ children }: Props) {
  const { user } = useAuth();
  const { currentProject } = useProject();

  // If no project selected, let RequireProject handle it
  if (!currentProject) {
    return <>{children}</>;
  }

  // Check access
  if (!hasProjectAccess(user, currentProject.id)) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-foreground">403 — Accès refusé</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Vous n'avez aucun rôle sur le projet <strong>{currentProject.name}</strong>.
          Contactez un administrateur pour obtenir un accès.
        </p>
        <Link href="/projects">
          <span className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer">
            Retour aux projets
          </span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
