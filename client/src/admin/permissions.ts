/**
 * ADMIN-RBAC-HARDEN-1 — Catalogue officiel des permissions
 *
 * Source unique pour tous les contrôles d'accès (UI + API).
 * Précédence hasPermission :
 *   1. Global ADMIN → true (override total)
 *   2. Si projectId fourni → permissions du rôle projet
 *   3. Sinon → permissions du rôle global
 */
import { memoryStore } from '../api/memoryStore';

// ─── PermissionKey Enum ────────────────────────────────────────────────

export enum PermissionKey {
  // Projects
  PROJECTS_READ = 'projects.read',
  PROJECTS_CREATE = 'projects.create',
  PROJECTS_UPDATE = 'projects.update',
  PROJECTS_DELETE = 'projects.delete',

  // Profiles
  PROFILES_READ = 'profiles.read',
  PROFILES_CREATE = 'profiles.create',
  PROFILES_UPDATE = 'profiles.update',
  PROFILES_DELETE = 'profiles.delete',

  // Scenarios
  SCENARIOS_READ = 'scenarios.read',
  SCENARIOS_CREATE = 'scenarios.create',
  SCENARIOS_UPDATE = 'scenarios.update',
  SCENARIOS_DELETE = 'scenarios.delete',
  SCENARIOS_ACTIVATE = 'scenarios.activate',

  // Datasets
  DATASETS_READ = 'datasets.read',
  DATASETS_CREATE = 'datasets.create',
  DATASETS_UPDATE = 'datasets.update',
  DATASETS_DELETE = 'datasets.delete',
  DATASETS_ACTIVATE = 'datasets.activate',
  DATASETS_SECRETS_READ = 'datasets.secrets.read',
  DATASETS_EXPORT = 'datasets.export',

  // Bundles
  BUNDLES_READ = 'bundles.read',
  BUNDLES_CREATE = 'bundles.create',
  BUNDLES_UPDATE = 'bundles.update',
  BUNDLES_DELETE = 'bundles.delete',
  BUNDLES_ACTIVATE = 'bundles.activate',
  BUNDLES_RESOLVE = 'bundles.resolve',

  // Scripts IA
  SCRIPTS_READ = 'scripts.read',
  SCRIPTS_CREATE = 'scripts.create',
  SCRIPTS_ACTIVATE = 'scripts.activate',
  SCRIPTS_DELETE = 'scripts.delete',
  SCRIPTS_DOWNLOAD = 'scripts.download',

  // Executions
  EXECUTIONS_READ = 'executions.read',
  EXECUTIONS_RUN = 'executions.run',
  EXECUTIONS_RERUN = 'executions.rerun',
  EXECUTIONS_CANCEL = 'executions.cancel',
  EXECUTIONS_DELETE = 'executions.delete',

  // Repair
  REPAIR_READ = 'repair.read',
  REPAIR_LAUNCH = 'repair.launch',
  REPAIR_ACTIVATE = 'repair.activate',

  // Runners / Jobs
  RUNNERS_READ = 'runners.read',
  RUNNERS_REGISTER = 'runners.register',
  RUNNERS_DISABLE = 'runners.disable',

  // Drive Test
  DRIVE_CAMPAIGNS_READ = 'drive.campaigns.read',
  DRIVE_CAMPAIGNS_CREATE = 'drive.campaigns.create',
  DRIVE_CAMPAIGNS_UPDATE = 'drive.campaigns.update',
  DRIVE_CAMPAIGNS_DELETE = 'drive.campaigns.delete',
  DRIVE_REPORTING_READ = 'drive.reporting.read',

  // Admin
  ADMIN_USERS_READ = 'admin.users.read',
  ADMIN_USERS_MANAGE = 'admin.users.manage',
  ADMIN_ROLES_READ = 'admin.roles.read',
  ADMIN_ROLES_MANAGE = 'admin.roles.manage',
  ADMIN_INVITES_MANAGE = 'admin.invites.manage',
  ADMIN_AUDIT_READ = 'admin.audit.read',
  ADMIN_AUDIT_EXPORT = 'admin.audit.export',
  ADMIN_MEMBERSHIPS_MANAGE = 'admin.memberships.manage',
  // Notifications Settings
  SETTINGS_NOTIFICATIONS_READ = 'settings.notifications.read',
  SETTINGS_NOTIFICATIONS_UPDATE = 'settings.notifications.update',
  SETTINGS_NOTIFICATIONS_TEST = 'settings.notifications.test',
  SETTINGS_NOTIFICATIONS_DISABLE = 'settings.notifications.disable',
  // Notifications Templates & Rules
  NOTIFICATIONS_TEMPLATES_READ = 'notifications.templates.read',
  NOTIFICATIONS_TEMPLATES_UPDATE = 'notifications.templates.update',
  NOTIFICATIONS_RULES_READ = 'notifications.rules.read',
  NOTIFICATIONS_RULES_UPDATE = 'notifications.rules.update',
  NOTIFICATIONS_DELIVERY_READ = 'notifications.delivery.read',
}

// ─── Permission Groups (for UI multi-select) ───────────────────────────

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: { key: PermissionKey; label: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'projects',
    label: 'Projets',
    permissions: [
      { key: PermissionKey.PROJECTS_READ, label: 'Lire' },
      { key: PermissionKey.PROJECTS_CREATE, label: 'Créer' },
      { key: PermissionKey.PROJECTS_UPDATE, label: 'Modifier' },
      { key: PermissionKey.PROJECTS_DELETE, label: 'Supprimer' },
    ],
  },
  {
    id: 'profiles',
    label: 'Profils de test',
    permissions: [
      { key: PermissionKey.PROFILES_READ, label: 'Lire' },
      { key: PermissionKey.PROFILES_CREATE, label: 'Créer' },
      { key: PermissionKey.PROFILES_UPDATE, label: 'Modifier' },
      { key: PermissionKey.PROFILES_DELETE, label: 'Supprimer' },
    ],
  },
  {
    id: 'scenarios',
    label: 'Scénarios',
    permissions: [
      { key: PermissionKey.SCENARIOS_READ, label: 'Lire' },
      { key: PermissionKey.SCENARIOS_CREATE, label: 'Créer' },
      { key: PermissionKey.SCENARIOS_UPDATE, label: 'Modifier' },
      { key: PermissionKey.SCENARIOS_DELETE, label: 'Supprimer' },
      { key: PermissionKey.SCENARIOS_ACTIVATE, label: 'Activer/Finaliser' },
    ],
  },
  {
    id: 'datasets',
    label: 'Datasets',
    permissions: [
      { key: PermissionKey.DATASETS_READ, label: 'Lire' },
      { key: PermissionKey.DATASETS_CREATE, label: 'Créer' },
      { key: PermissionKey.DATASETS_UPDATE, label: 'Modifier' },
      { key: PermissionKey.DATASETS_DELETE, label: 'Supprimer' },
      { key: PermissionKey.DATASETS_ACTIVATE, label: 'Activer' },
      { key: PermissionKey.DATASETS_SECRETS_READ, label: 'Voir secrets' },
      { key: PermissionKey.DATASETS_EXPORT, label: 'Exporter' },
    ],
  },
  {
    id: 'bundles',
    label: 'Bundles',
    permissions: [
      { key: PermissionKey.BUNDLES_READ, label: 'Lire' },
      { key: PermissionKey.BUNDLES_CREATE, label: 'Créer' },
      { key: PermissionKey.BUNDLES_UPDATE, label: 'Modifier' },
      { key: PermissionKey.BUNDLES_DELETE, label: 'Supprimer' },
      { key: PermissionKey.BUNDLES_ACTIVATE, label: 'Activer' },
      { key: PermissionKey.BUNDLES_RESOLVE, label: 'Résoudre' },
    ],
  },
  {
    id: 'scripts',
    label: 'Scripts IA',
    permissions: [
      { key: PermissionKey.SCRIPTS_READ, label: 'Lire' },
      { key: PermissionKey.SCRIPTS_CREATE, label: 'Générer' },
      { key: PermissionKey.SCRIPTS_ACTIVATE, label: 'Activer' },
      { key: PermissionKey.SCRIPTS_DELETE, label: 'Supprimer' },
      { key: PermissionKey.SCRIPTS_DOWNLOAD, label: 'Télécharger' },
    ],
  },
  {
    id: 'executions',
    label: 'Exécutions',
    permissions: [
      { key: PermissionKey.EXECUTIONS_READ, label: 'Lire' },
      { key: PermissionKey.EXECUTIONS_RUN, label: 'Lancer' },
      { key: PermissionKey.EXECUTIONS_RERUN, label: 'Relancer' },
      { key: PermissionKey.EXECUTIONS_CANCEL, label: 'Annuler' },
      { key: PermissionKey.EXECUTIONS_DELETE, label: 'Supprimer' },
    ],
  },
  {
    id: 'repair',
    label: 'Repair IA',
    permissions: [
      { key: PermissionKey.REPAIR_READ, label: 'Lire' },
      { key: PermissionKey.REPAIR_LAUNCH, label: 'Lancer repair' },
      { key: PermissionKey.REPAIR_ACTIVATE, label: 'Activer version' },
    ],
  },
  {
    id: 'runners',
    label: 'Runners / Jobs',
    permissions: [
      { key: PermissionKey.RUNNERS_READ, label: 'Lire' },
      { key: PermissionKey.RUNNERS_REGISTER, label: 'Enregistrer' },
      { key: PermissionKey.RUNNERS_DISABLE, label: 'Désactiver' },
    ],
  },
  {
    id: 'drive',
    label: 'Drive Test',
    permissions: [
      { key: PermissionKey.DRIVE_CAMPAIGNS_READ, label: 'Lire campagnes' },
      { key: PermissionKey.DRIVE_CAMPAIGNS_CREATE, label: 'Créer campagnes' },
      { key: PermissionKey.DRIVE_CAMPAIGNS_UPDATE, label: 'Modifier campagnes' },
      { key: PermissionKey.DRIVE_CAMPAIGNS_DELETE, label: 'Supprimer campagnes' },
      { key: PermissionKey.DRIVE_REPORTING_READ, label: 'Voir reporting' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    permissions: [
      { key: PermissionKey.ADMIN_USERS_READ, label: 'Voir utilisateurs' },
      { key: PermissionKey.ADMIN_USERS_MANAGE, label: 'Gérer utilisateurs' },
      { key: PermissionKey.ADMIN_ROLES_READ, label: 'Voir rôles' },
      { key: PermissionKey.ADMIN_ROLES_MANAGE, label: 'Gérer rôles' },
      { key: PermissionKey.ADMIN_INVITES_MANAGE, label: 'Gérer invitations' },
      { key: PermissionKey.ADMIN_AUDIT_READ, label: 'Voir audit' },
      { key: PermissionKey.ADMIN_AUDIT_EXPORT, label: 'Exporter audit' },
      { key: PermissionKey.ADMIN_MEMBERSHIPS_MANAGE, label: 'Gérer memberships' },
    ],
  },
  {
    id: 'notifications',
    label: 'Paramètres — Notifications',
    permissions: [
      { key: PermissionKey.SETTINGS_NOTIFICATIONS_READ, label: 'Lire config' },
      { key: PermissionKey.SETTINGS_NOTIFICATIONS_UPDATE, label: 'Modifier config' },
      { key: PermissionKey.SETTINGS_NOTIFICATIONS_TEST, label: 'Tester envoi' },
      { key: PermissionKey.SETTINGS_NOTIFICATIONS_DISABLE, label: 'Désactiver canal' },
      { key: PermissionKey.NOTIFICATIONS_TEMPLATES_READ, label: 'Lire templates' },
      { key: PermissionKey.NOTIFICATIONS_TEMPLATES_UPDATE, label: 'Modifier templates' },
      { key: PermissionKey.NOTIFICATIONS_RULES_READ, label: 'Lire règles' },
      { key: PermissionKey.NOTIFICATIONS_RULES_UPDATE, label: 'Modifier règles' },
      { key: PermissionKey.NOTIFICATIONS_DELIVERY_READ, label: 'Voir delivery logs' },
    ],
  },
];

// ─── All permission keys (flat list) ───────────────────────────────────

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PermissionKey);

// ─── System Roles (default permissions) ────────────────────────────────

export interface RoleDefinition {
  role_id: string;
  name: string;
  description: string;
  scope: 'GLOBAL' | 'PROJECT';
  is_system: boolean;
  permissions: PermissionKey[];
  created_at: string;
  updated_at: string;
}

const ALL_PERMS = ALL_PERMISSION_KEYS;

const READ_PERMS: PermissionKey[] = ALL_PERMISSION_KEYS.filter(k => k.endsWith('.read'));

const MANAGER_PERMS: PermissionKey[] = ALL_PERMISSION_KEYS.filter(
  k => !k.startsWith('admin.') && !k.includes('.delete')
);

const PROJECT_VIEWER_PERMS: PermissionKey[] = [
  PermissionKey.PROJECTS_READ,
  PermissionKey.PROFILES_READ,
  PermissionKey.SCENARIOS_READ,
  PermissionKey.DATASETS_READ,
  PermissionKey.BUNDLES_READ,
  PermissionKey.SCRIPTS_READ,
  PermissionKey.EXECUTIONS_READ,
  PermissionKey.REPAIR_READ,
  PermissionKey.RUNNERS_READ,
  PermissionKey.DRIVE_CAMPAIGNS_READ,
  PermissionKey.DRIVE_REPORTING_READ,
];

const PROJECT_EDITOR_PERMS: PermissionKey[] = [
  ...PROJECT_VIEWER_PERMS,
  PermissionKey.PROFILES_CREATE,
  PermissionKey.PROFILES_UPDATE,
  PermissionKey.SCENARIOS_CREATE,
  PermissionKey.SCENARIOS_UPDATE,
  PermissionKey.SCENARIOS_ACTIVATE,
  PermissionKey.DATASETS_CREATE,
  PermissionKey.DATASETS_UPDATE,
  PermissionKey.DATASETS_ACTIVATE,
  PermissionKey.DATASETS_EXPORT,
  PermissionKey.BUNDLES_CREATE,
  PermissionKey.BUNDLES_UPDATE,
  PermissionKey.BUNDLES_ACTIVATE,
  PermissionKey.BUNDLES_RESOLVE,
  PermissionKey.SCRIPTS_CREATE,
  PermissionKey.SCRIPTS_ACTIVATE,
  PermissionKey.SCRIPTS_DOWNLOAD,
  PermissionKey.EXECUTIONS_RUN,
  PermissionKey.EXECUTIONS_RERUN,
  PermissionKey.REPAIR_LAUNCH,
  PermissionKey.REPAIR_ACTIVATE,
  PermissionKey.DRIVE_CAMPAIGNS_CREATE,
  PermissionKey.DRIVE_CAMPAIGNS_UPDATE,
];

const PROJECT_ADMIN_PERMS: PermissionKey[] = [
  ...PROJECT_EDITOR_PERMS,
  PermissionKey.PROJECTS_UPDATE,
  PermissionKey.PROJECTS_DELETE,
  PermissionKey.PROFILES_DELETE,
  PermissionKey.SCENARIOS_DELETE,
  PermissionKey.DATASETS_DELETE,
  PermissionKey.DATASETS_SECRETS_READ,
  PermissionKey.BUNDLES_DELETE,
  PermissionKey.SCRIPTS_DELETE,
  PermissionKey.EXECUTIONS_CANCEL,
  PermissionKey.EXECUTIONS_DELETE,
  PermissionKey.RUNNERS_REGISTER,
  PermissionKey.RUNNERS_DISABLE,
  PermissionKey.DRIVE_CAMPAIGNS_DELETE,
  PermissionKey.ADMIN_MEMBERSHIPS_MANAGE,
];

export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    role_id: 'ADMIN',
    name: 'Administrateur',
    description: 'Accès total à toutes les fonctionnalités (override global)',
    scope: 'GLOBAL',
    is_system: true,
    permissions: ALL_PERMS,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    role_id: 'MANAGER',
    name: 'Manager',
    description: 'Gestion des projets, profils, scénarios, datasets, scripts et exécutions',
    scope: 'GLOBAL',
    is_system: true,
    permissions: MANAGER_PERMS,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    role_id: 'VIEWER',
    name: 'Lecteur',
    description: 'Lecture seule sur toutes les ressources',
    scope: 'GLOBAL',
    is_system: true,
    permissions: READ_PERMS,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    role_id: 'PROJECT_ADMIN',
    name: 'Admin Projet',
    description: 'Accès complet au projet incluant suppression et gestion des membres',
    scope: 'PROJECT',
    is_system: true,
    permissions: PROJECT_ADMIN_PERMS,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    role_id: 'PROJECT_EDITOR',
    name: 'Éditeur Projet',
    description: 'Création et modification des ressources du projet, exécution des tests',
    scope: 'PROJECT',
    is_system: true,
    permissions: PROJECT_EDITOR_PERMS,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    role_id: 'PROJECT_VIEWER',
    name: 'Lecteur Projet',
    description: 'Lecture seule sur les ressources du projet',
    scope: 'PROJECT',
    is_system: true,
    permissions: PROJECT_VIEWER_PERMS,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

// ─── hasPermission helper ──────────────────────────────────────────────

/**
 * Vérifie si un utilisateur possède une permission donnée.
 *
 * Précédence :
 * 1. Global ADMIN → true (override total)
 * 2. Si projectId fourni → cherche le membership du user sur ce projet,
 *    puis vérifie les permissions du rôle projet
 * 3. Sinon → permissions du rôle global
 */
export function hasPermission(
  user: { id: string; role: string } | null | undefined,
  permissionKey: PermissionKey,
  options?: { projectId?: string }
): boolean {
  if (!user) return false;

  // 1. Global ADMIN override
  if (user.role === 'ADMIN') return true;

  // 2. If projectId provided, check project membership
  if (options?.projectId) {
    const memberships = getMembershipsFromStore(user.id);
    const membership = memberships.find(m => m.project_id === options.projectId);
    if (!membership) return false; // No membership = no access

    const projectRole = getRoleDefinition(membership.project_role);
    if (!projectRole) return false;
    return projectRole.permissions.includes(permissionKey);
  }

  // 3. Check global role permissions
  const globalRole = getRoleDefinition(user.role);
  if (!globalRole) return false;
  return globalRole.permissions.includes(permissionKey);
}

/**
 * Vérifie si un utilisateur a accès à un projet (membership ou ADMIN).
 */
export function hasProjectAccess(
  user: { id: string; role: string } | null | undefined,
  projectId: string
): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const memberships = getMembershipsFromStore(user.id);
  return memberships.some(m => m.project_id === projectId);
}

/**
 * Retourne toutes les permissions effectives d'un utilisateur sur un projet.
 */
export function getEffectivePermissions(
  user: { id: string; role: string } | null | undefined,
  projectId?: string
): PermissionKey[] {
  if (!user) return [];
  if (user.role === 'ADMIN') return ALL_PERMISSION_KEYS;

  if (projectId) {
    const memberships = getMembershipsFromStore(user.id);
    const membership = memberships.find(m => m.project_id === projectId);
    if (!membership) return [];
    const role = getRoleDefinition(membership.project_role);
    return role ? role.permissions : [];
  }

  const globalRole = getRoleDefinition(user.role);
  return globalRole ? globalRole.permissions : [];
}

// ─── Internal helpers ──────────────────────────────────────────────────

function getMembershipsFromStore(userId: string): Array<{ project_id: string; project_role: string }> {
  try {
    const raw = memoryStore.getItem('agilestest_memberships');
    if (!raw) return [];
    const all = JSON.parse(raw) as Array<{ user_id: string; project_id: string; project_role: string }>;
    return all.filter(m => m.user_id === userId);
  } catch {
    return [];
  }
}

function getRoleDefinition(roleId: string): RoleDefinition | undefined {
  // First check system roles
  const systemRole = SYSTEM_ROLES.find(r => r.role_id === roleId);
  if (systemRole) return systemRole;

  // Then check custom roles from memoryStore
  try {
    const raw = memoryStore.getItem('agilestest_custom_roles');
    if (!raw) return undefined;
    const customRoles = JSON.parse(raw) as RoleDefinition[];
    return customRoles.find(r => r.role_id === roleId);
  } catch {
    return undefined;
  }
}

// ─── Exported for RBAC Matrix ──────────────────────────────────────────

export function getAllRoles(scope?: 'GLOBAL' | 'PROJECT'): RoleDefinition[] {
  const customRoles = getCustomRoles();
  const all = [...SYSTEM_ROLES, ...customRoles];
  if (scope) return all.filter(r => r.scope === scope);
  return all;
}

export function getCustomRoles(): RoleDefinition[] {
  try {
    const raw = memoryStore.getItem('agilestest_custom_roles');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomRole(role: RoleDefinition): RoleDefinition {
  const roles = getCustomRoles();
  const idx = roles.findIndex(r => r.role_id === role.role_id);
  if (idx >= 0) {
    roles[idx] = { ...role, updated_at: new Date().toISOString() };
  } else {
    roles.push({ ...role, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  memoryStore.setItem('agilestest_custom_roles', JSON.stringify(roles));
  return idx >= 0 ? roles[idx] : roles[roles.length - 1];
}

export function deleteCustomRole(roleId: string): void {
  // Check if role is in use
  try {
    const memberships = memoryStore.getItem('agilestest_memberships');
    if (memberships) {
      const all = JSON.parse(memberships) as Array<{ project_role: string }>;
      if (all.some(m => m.project_role === roleId)) {
        throw new Error('Impossible de supprimer un rôle utilisé par des memberships (409).');
      }
    }
    const users = memoryStore.getItem('agilestest_admin_users');
    if (users) {
      const all = JSON.parse(users) as Array<{ role: string }>;
      if (all.some(u => u.role === roleId)) {
        throw new Error('Impossible de supprimer un rôle attribué à des utilisateurs (409).');
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('409')) throw e;
  }

  const roles = getCustomRoles();
  const idx = roles.findIndex(r => r.role_id === roleId);
  if (idx === -1) throw new Error('Rôle non trouvé');
  if (roles[idx].is_system) throw new Error('Impossible de supprimer un rôle système.');
  roles.splice(idx, 1);
  memoryStore.setItem('agilestest_custom_roles', JSON.stringify(roles));
}
