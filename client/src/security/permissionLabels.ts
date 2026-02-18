/**
 * FE-RBAC-COVERAGE-1 — Permission label helpers
 *
 * Maps PermissionKey to human-readable labels using PERMISSION_GROUPS.
 */

import { PermissionKey, PERMISSION_GROUPS } from '../admin/permissions';

// Build a flat map of PermissionKey -> label
const labelMap = new Map<string, string>();
const groupMap = new Map<string, string>();

for (const group of PERMISSION_GROUPS) {
  for (const perm of group.permissions) {
    labelMap.set(perm.key, `${group.label} — ${perm.label}`);
    groupMap.set(perm.key, group.label);
  }
}

/**
 * Get a human-readable label for a PermissionKey.
 * Returns "Group — Action" format, e.g. "Scénarios — Créer"
 */
export function getPermissionLabel(key: PermissionKey): string {
  return labelMap.get(key) || key;
}

/**
 * Get the group label for a PermissionKey.
 * Returns e.g. "Scénarios", "Datasets", "Administration"
 */
export function getPermissionGroupLabel(key: PermissionKey): string {
  return groupMap.get(key) || key.split('.')[0];
}
