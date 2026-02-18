/**
 * ADMIN-RBAC-HARDEN-1 — usePermission hook
 *
 * Wraps hasPermission / hasProjectAccess / getEffectivePermissions
 * for easy use in React components.
 *
 * Usage:
 *   const { can, canAll, canAny, hasAccess } = usePermission();
 *   if (can(PermissionKey.SCRIPTS_CREATE)) { ... }
 *   if (canAny([PermissionKey.EXECUTIONS_RUN, PermissionKey.EXECUTIONS_RERUN])) { ... }
 *   if (hasAccess(projectId)) { ... }
 */
import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  hasPermission,
  hasProjectAccess,
  getEffectivePermissions,
  PermissionKey,
} from '../admin/permissions';

export function usePermission(projectId?: string) {
  const { user } = useAuth();

  /** Check a single permission */
  const can = useCallback(
    (key: PermissionKey) => hasPermission(user, key, projectId ? { projectId } : undefined),
    [user, projectId]
  );

  /** Check that ALL permissions are granted */
  const canAll = useCallback(
    (keys: PermissionKey[]) => keys.every(k => hasPermission(user, k, projectId ? { projectId } : undefined)),
    [user, projectId]
  );

  /** Check that ANY permission is granted */
  const canAny = useCallback(
    (keys: PermissionKey[]) => keys.some(k => hasPermission(user, k, projectId ? { projectId } : undefined)),
    [user, projectId]
  );

  /** Check project access (membership or ADMIN) */
  const hasAccess = useCallback(
    (pid: string) => hasProjectAccess(user, pid),
    [user]
  );

  /** Get all effective permissions */
  const effectivePermissions = useMemo(
    () => getEffectivePermissions(user, projectId),
    [user, projectId]
  );

  /** Is global admin */
  const isAdmin = user?.role === 'ADMIN';

  return {
    can,
    canAll,
    canAny,
    hasAccess,
    effectivePermissions,
    isAdmin,
    PermissionKey,
  };
}
