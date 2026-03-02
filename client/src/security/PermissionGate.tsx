/**
 * FE-RBAC-COVERAGE-1 — PermissionGate component
 *
 * Wraps children and conditionally hides or disables them based on permissions.
 *
 * Usage:
 *   <PermissionGate perm={PermissionKey.SCENARIOS_CREATE}>
 *     <Button>Créer</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate perm={PermissionKey.SCENARIOS_CREATE} mode="disable" tooltip>
 *     <Button>Créer</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate perms={[PermissionKey.SCENARIOS_CREATE, PermissionKey.SCENARIOS_UPDATE]} any>
 *     <Button>Modifier</Button>
 *   </PermissionGate>
 */

import type { ReactNode } from 'react';
import { usePermission } from '../hooks/usePermission';
import { PermissionKey } from '../admin/permissions';
import { getPermissionLabel } from './permissionLabels';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { memoryStore } from '../api/memoryStore';

// Feature flag: show disabled + tooltip instead of hiding
const EXPLAIN_MODE = typeof window !== 'undefined'
  ? memoryStore.getItem('RBAC_EXPLAIN_MODE') === 'true'
  : false;

interface PermissionGateProps {
  /** Single permission to check */
  perm?: PermissionKey;
  /** Multiple permissions to check */
  perms?: PermissionKey[];
  /** If true, require ANY of perms. If false (default), require ALL */
  any?: boolean;
  /** 'hide' (default) removes from DOM, 'disable' wraps in disabled state */
  mode?: 'hide' | 'disable';
  /** Show tooltip with missing permission label when disabled */
  tooltip?: boolean;
  /** Project ID for project-scoped permissions */
  projectId?: string;
  /** Fallback content when permission denied (optional) */
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  perm,
  perms,
  any: anyMode = false,
  mode: propMode,
  tooltip: propTooltip,
  projectId,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAll, canAny } = usePermission(projectId);

  // Determine which permissions to check
  const keysToCheck = perms || (perm ? [perm] : []);

  // Check permissions
  let allowed: boolean;
  if (keysToCheck.length === 0) {
    allowed = true;
  } else if (anyMode) {
    allowed = canAny(keysToCheck);
  } else {
    allowed = canAll(keysToCheck);
  }

  if (allowed) {
    return <>{children}</>;
  }

  // Determine effective mode: prop > EXPLAIN_MODE > 'hide'
  const mode = propMode || (EXPLAIN_MODE ? 'disable' : 'hide');
  const showTooltip = propTooltip ?? (mode === 'disable');

  if (mode === 'hide') {
    return <>{fallback}</>;
  }

  // mode === 'disable'
  const missingLabels = keysToCheck
    .filter(k => !can(k))
    .map(k => getPermissionLabel(k));

  const tooltipText = `Permission manquante : ${missingLabels.join(', ')}`;

  const disabledContent = (
    <div className="inline-block opacity-50 pointer-events-none select-none" aria-disabled="true">
      {children}
    </div>
  );

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-block cursor-not-allowed">
              {disabledContent}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return disabledContent;
}
