/**
 * ADMIN-USERS-ROLES-1 — Types et schémas Zod pour l'administration
 */
import { z } from 'zod';
import type { UserRole, User } from '../types';

// ─── Enums ──────────────────────────────────────────────────────────────

export type ProjectRole = 'PROJECT_ADMIN' | 'PROJECT_EDITOR' | 'PROJECT_VIEWER';
export type UserStatus = 'ACTIVE' | 'DISABLED' | 'INVITED';
export type AuditAction =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_PASSWORD_RESET'
  | 'MEMBERSHIP_ADDED'
  | 'MEMBERSHIP_UPDATED'
  | 'MEMBERSHIP_REMOVED'
  | 'INVITE_SENT'
  | 'INVITE_RESENT'
  | 'INVITE_REVOKED'
  | 'INVITE_ACCEPTED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'PROJECT_ACCESS_DENIED';

export type AuditEntityType = 'user' | 'membership' | 'invite' | 'role' | 'access';

// ─── Admin User (extended) ──────────────────────────────────────────────

export interface AdminUser extends User {
  status: UserStatus;
  last_login_at: string | null;
  memberships_count: number;
}

// ─── Project Membership ─────────────────────────────────────────────────

export interface ProjectMembership {
  id: string;
  project_id: string;
  project_name: string;
  user_id: string;
  user_email: string;
  user_name: string;
  project_role: ProjectRole;
  added_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Audit Entry ────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  target_label: string;
  metadata: Record<string, unknown>;
  trace_id: string;
}

// ─── RBAC Matrix (informative) ──────────────────────────────────────────

export type Permission = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'RUN' | 'ACTIVATE' | 'REPAIR';

export interface RbacModulePermissions {
  module: string;
  viewer: Permission[];
  manager: Permission[];
  admin: Permission[];
  project_viewer: Permission[];
  project_editor: Permission[];
  project_admin: Permission[];
}

export const RBAC_MATRIX: RbacModulePermissions[] = [
  {
    module: 'Projets',
    viewer: ['READ'],
    manager: ['READ', 'CREATE', 'UPDATE'],
    admin: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'UPDATE'],
    project_admin: ['READ', 'UPDATE', 'DELETE'],
  },
  {
    module: 'Profils de test',
    viewer: ['READ'],
    manager: ['READ', 'CREATE', 'UPDATE'],
    admin: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'CREATE', 'UPDATE'],
    project_admin: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
  },
  {
    module: 'Scénarios',
    viewer: ['READ'],
    manager: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    admin: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    project_admin: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE'],
  },
  {
    module: 'Datasets',
    viewer: ['READ'],
    manager: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    admin: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    project_admin: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE'],
  },
  {
    module: 'Bundles',
    viewer: ['READ'],
    manager: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    admin: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    project_admin: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE'],
  },
  {
    module: 'Scripts IA',
    viewer: ['READ'],
    manager: ['READ', 'CREATE', 'ACTIVATE'],
    admin: ['READ', 'CREATE', 'DELETE', 'ACTIVATE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'CREATE', 'ACTIVATE'],
    project_admin: ['READ', 'CREATE', 'DELETE', 'ACTIVATE'],
  },
  {
    module: 'Exécutions',
    viewer: ['READ'],
    manager: ['READ', 'RUN'],
    admin: ['READ', 'RUN', 'DELETE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'RUN'],
    project_admin: ['READ', 'RUN', 'DELETE'],
  },
  {
    module: 'Repair',
    viewer: ['READ'],
    manager: ['READ', 'REPAIR'],
    admin: ['READ', 'REPAIR', 'ACTIVATE'],
    project_viewer: ['READ'],
    project_editor: ['READ', 'REPAIR'],
    project_admin: ['READ', 'REPAIR', 'ACTIVATE'],
  },
  {
    module: 'Administration',
    viewer: [],
    manager: [],
    admin: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    project_viewer: [],
    project_editor: [],
    project_admin: ['READ'],
  },
];

// ─── Role labels ────────────────────────────────────────────────────────

export const GLOBAL_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  VIEWER: 'Lecteur',
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  PROJECT_ADMIN: 'Admin Projet',
  PROJECT_EDITOR: 'Éditeur',
  PROJECT_VIEWER: 'Lecteur Projet',
};

export const GLOBAL_ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
  MANAGER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  VIEWER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export const PROJECT_ROLE_COLORS: Record<ProjectRole, string> = {
  PROJECT_ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
  PROJECT_EDITOR: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PROJECT_VIEWER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

// ─── Zod Schemas ────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  full_name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Adresse email invalide'),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'] as const),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères').optional(),
  send_invite: z.boolean().default(false),
});

export const updateUserSchema = z.object({
  full_name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').optional(),
  email: z.string().email('Adresse email invalide').optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'] as const).optional(),
});

export const addMemberSchema = z.object({
  user_id: z.string().min(1, 'Utilisateur requis'),
  project_role: z.enum(['PROJECT_ADMIN', 'PROJECT_EDITOR', 'PROJECT_VIEWER'] as const),
});

export const updateMemberSchema = z.object({
  project_role: z.enum(['PROJECT_ADMIN', 'PROJECT_EDITOR', 'PROJECT_VIEWER'] as const),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ─── Invitations ───────────────────────────────────────────────────────

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  project_id?: string;
  project_role?: ProjectRole;
  status: InviteStatus;
  token: string;
  invited_by_id: string;
  invited_by_name: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  revoked_at?: string;
}

export const inviteSchema = z.object({
  email: z.string().email('Adresse email invalide'),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'] as const),
  project_id: z.string().optional(),
  project_role: z.enum(['PROJECT_ADMIN', 'PROJECT_EDITOR', 'PROJECT_VIEWER'] as const).optional(),
});

export type InviteInput = z.infer<typeof inviteSchema>;
