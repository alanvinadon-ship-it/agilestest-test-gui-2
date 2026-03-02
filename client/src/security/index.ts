/**
 * FE-RBAC-COVERAGE-1 — Security module
 *
 * Centralise tous les composants et helpers liés au contrôle d'accès.
 */

export { PermissionGate } from './PermissionGate';
export { ErrorState403 } from './ErrorState403';
export { getPermissionLabel, getPermissionGroupLabel } from './permissionLabels';
export { usePermission } from '../hooks/usePermission';
export { PermissionKey } from '../admin/permissions';
