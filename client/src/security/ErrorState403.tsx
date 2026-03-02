/**
 * FE-RBAC-COVERAGE-1 — ErrorState403 component
 *
 * Standard 403 error state displayed when a user lacks access.
 * Shows trace_id, action buttons (back to projects, change project, contact admin).
 *
 * Usage:
 *   <ErrorState403 />
 *   <ErrorState403 traceId="exec_abc123" message="Vous n'avez pas accès à ce projet." />
 */

import { ShieldAlert, ArrowLeft, FolderOpen, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

interface ErrorState403Props {
  /** Custom error message */
  message?: string;
  /** Trace ID for debugging (e.g., execution_id, request_id) */
  traceId?: string;
  /** Show "Contact admin" text */
  showContactAdmin?: boolean;
  /** Custom back action */
  onBack?: () => void;
}

export function ErrorState403({
  message = "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource.",
  traceId,
  showContactAdmin = true,
  onBack,
}: ErrorState403Props) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 px-4">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
        <ShieldAlert className="w-10 h-10 text-red-500" />
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Accès refusé</h2>
        <p className="text-muted-foreground max-w-md">{message}</p>
      </div>

      {/* Trace ID */}
      {traceId && (
        <div className="bg-muted/50 border border-border rounded-md px-4 py-2 text-sm">
          <span className="text-muted-foreground">trace_id : </span>
          <code className="text-foreground font-mono text-xs">{traceId}</code>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          variant="outline"
          onClick={onBack || (() => navigate('/'))}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Revenir aux projets
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/projects')}
          className="gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          Changer de projet
        </Button>
      </div>

      {/* Contact admin */}
      {showContactAdmin && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <Mail className="w-4 h-4" />
          <span>
            Si vous pensez que c'est une erreur, contactez votre administrateur
            pour vérifier vos permissions et votre membership projet.
          </span>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-muted-foreground/60 max-w-lg text-center mt-4">
        <p>
          L'accès aux ressources d'un projet nécessite une <strong>membership active</strong> avec
          un rôle disposant des permissions appropriées. Consultez la page{' '}
          <button
            onClick={() => navigate('/docs/admin')}
            className="underline hover:text-foreground transition-colors"
          >
            Documentation Admin
          </button>{' '}
          pour plus d'informations sur le modèle RBAC.
        </p>
      </div>
    </div>
  );
}
