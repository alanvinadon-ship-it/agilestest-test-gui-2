/**
 * ADMIN-USERS-ROLES-1 — Admin Store (localStorage CRUD + API wrappers)
 * Gère : users (admin), memberships (projet), audit log
 */
import type { UserRole } from '../types';
import type {
  AdminUser,
  ProjectMembership,
  AuditEntry,
  ProjectRole,
  UserStatus,
  AuditAction,
  AuditEntityType,
  CreateUserInput,
  UpdateUserInput,
  AddMemberInput,
} from './types';

// ─── Helpers ────────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function traceId(): string {
  return `trc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

function getStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStore<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Seed default users ─────────────────────────────────────────────────

const SEED_USERS: AdminUser[] = [
  {
    id: 'user-admin-001',
    email: 'admin@agilestest.io',
    full_name: 'Admin Principal',
    role: 'ADMIN',
    is_active: true,
    status: 'ACTIVE',
    last_login_at: new Date().toISOString(),
    memberships_count: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'user-manager-001',
    email: 'manager@agilestest.io',
    full_name: 'Manager Projet',
    role: 'MANAGER',
    is_active: true,
    status: 'ACTIVE',
    last_login_at: '2026-02-15T10:00:00Z',
    memberships_count: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'user-viewer-001',
    email: 'viewer@agilestest.io',
    full_name: 'Viewer Lecture',
    role: 'VIEWER',
    is_active: true,
    status: 'ACTIVE',
    last_login_at: '2026-02-10T08:00:00Z',
    memberships_count: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

function ensureSeed(): void {
  const existing = getStore<AdminUser>('agilestest_admin_users');
  if (existing.length === 0) {
    setStore('agilestest_admin_users', SEED_USERS);
  }
}

// ─── Audit logging ──────────────────────────────────────────────────────

function logAudit(
  actorId: string,
  actorName: string,
  actorEmail: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  targetLabel: string,
  metadata: Record<string, unknown> = {}
): void {
  const entries = getStore<AuditEntry>('agilestest_audit_log');
  entries.unshift({
    id: uid(),
    timestamp: now(),
    actor_id: actorId,
    actor_name: actorName,
    actor_email: actorEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    target_label: targetLabel,
    metadata,
    trace_id: traceId(),
  });
  // Keep last 500 entries
  setStore('agilestest_audit_log', entries.slice(0, 500));
}

// ─── Admin Users CRUD ───────────────────────────────────────────────────

export const adminUsers = {
  list(params?: { search?: string; status?: UserStatus; role?: UserRole; page?: number; limit?: number }) {
    ensureSeed();
    let users = getStore<AdminUser>('agilestest_admin_users');

    if (params?.search) {
      const q = params.search.toLowerCase();
      users = users.filter(u =>
        u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    if (params?.status) {
      users = users.filter(u => u.status === params.status);
    }
    if (params?.role) {
      users = users.filter(u => u.role === params.role);
    }

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const total = users.length;
    const start = (page - 1) * limit;
    const data = users.slice(start, start + limit);

    return {
      data,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  },

  getById(id: string): AdminUser | undefined {
    ensureSeed();
    return getStore<AdminUser>('agilestest_admin_users').find(u => u.id === id);
  },

  create(input: CreateUserInput, actor: { id: string; name: string; email: string }): AdminUser {
    ensureSeed();
    const users = getStore<AdminUser>('agilestest_admin_users');

    // Check email uniqueness
    if (users.some(u => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error(`L'email ${input.email} est déjà utilisé.`);
    }

    const newUser: AdminUser = {
      id: `user-${uid()}`,
      email: input.email,
      full_name: input.full_name,
      role: input.role,
      is_active: true,
      status: 'ACTIVE',
      last_login_at: null,
      memberships_count: 0,
      created_at: now(),
      updated_at: now(),
    };

    users.push(newUser);
    setStore('agilestest_admin_users', users);

    logAudit(actor.id, actor.name, actor.email, 'USER_CREATED', 'user', newUser.id, newUser.full_name, {
      email: newUser.email,
      role: newUser.role,
    });

    return newUser;
  },

  update(id: string, input: UpdateUserInput, actor: { id: string; name: string; email: string }): AdminUser {
    ensureSeed();
    const users = getStore<AdminUser>('agilestest_admin_users');
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Utilisateur non trouvé');

    // Check email uniqueness if changing
    if (input.email && input.email.toLowerCase() !== users[idx].email.toLowerCase()) {
      if (users.some(u => u.email.toLowerCase() === input.email!.toLowerCase())) {
        throw new Error(`L'email ${input.email} est déjà utilisé.`);
      }
    }

    const changes: Record<string, unknown> = {};
    if (input.full_name && input.full_name !== users[idx].full_name) {
      changes.full_name = { from: users[idx].full_name, to: input.full_name };
      users[idx].full_name = input.full_name;
    }
    if (input.email && input.email !== users[idx].email) {
      changes.email = { from: users[idx].email, to: input.email };
      users[idx].email = input.email;
    }
    if (input.role && input.role !== users[idx].role) {
      changes.role = { from: users[idx].role, to: input.role };
      users[idx].role = input.role;
    }
    users[idx].updated_at = now();

    setStore('agilestest_admin_users', users);

    logAudit(actor.id, actor.name, actor.email, 'USER_UPDATED', 'user', id, users[idx].full_name, changes);

    return users[idx];
  },

  disable(id: string, actor: { id: string; name: string; email: string }): AdminUser {
    ensureSeed();
    const users = getStore<AdminUser>('agilestest_admin_users');
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Utilisateur non trouvé');

    users[idx].status = 'DISABLED';
    users[idx].is_active = false;
    users[idx].updated_at = now();
    setStore('agilestest_admin_users', users);

    logAudit(actor.id, actor.name, actor.email, 'USER_DISABLED', 'user', id, users[idx].full_name);

    return users[idx];
  },

  enable(id: string, actor: { id: string; name: string; email: string }): AdminUser {
    ensureSeed();
    const users = getStore<AdminUser>('agilestest_admin_users');
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Utilisateur non trouvé');

    users[idx].status = 'ACTIVE';
    users[idx].is_active = true;
    users[idx].updated_at = now();
    setStore('agilestest_admin_users', users);

    logAudit(actor.id, actor.name, actor.email, 'USER_ENABLED', 'user', id, users[idx].full_name);

    return users[idx];
  },

  resetPassword(id: string, actor: { id: string; name: string; email: string }): { success: boolean; message: string } {
    ensureSeed();
    const users = getStore<AdminUser>('agilestest_admin_users');
    const user = users.find(u => u.id === id);
    if (!user) throw new Error('Utilisateur non trouvé');

    logAudit(actor.id, actor.name, actor.email, 'USER_PASSWORD_RESET', 'user', id, user.full_name);

    return { success: true, message: `Lien de réinitialisation envoyé à ${user.email} (simulé)` };
  },
};

// ─── Project Memberships CRUD ───────────────────────────────────────────

export const adminMemberships = {
  listByProject(projectId: string): ProjectMembership[] {
    return getStore<ProjectMembership>('agilestest_memberships').filter(m => m.project_id === projectId);
  },

  listByUser(userId: string): ProjectMembership[] {
    return getStore<ProjectMembership>('agilestest_memberships').filter(m => m.user_id === userId);
  },

  add(
    projectId: string,
    projectName: string,
    input: AddMemberInput,
    actor: { id: string; name: string; email: string }
  ): ProjectMembership {
    const memberships = getStore<ProjectMembership>('agilestest_memberships');

    // Check duplicate
    if (memberships.some(m => m.project_id === projectId && m.user_id === input.user_id)) {
      throw new Error('Cet utilisateur est déjà membre du projet.');
    }

    // Get user info
    ensureSeed();
    const user = getStore<AdminUser>('agilestest_admin_users').find(u => u.id === input.user_id);
    if (!user) throw new Error('Utilisateur non trouvé');

    const membership: ProjectMembership = {
      id: `mem-${uid()}`,
      project_id: projectId,
      project_name: projectName,
      user_id: input.user_id,
      user_email: user.email,
      user_name: user.full_name,
      project_role: input.project_role,
      added_by: actor.id,
      created_at: now(),
      updated_at: now(),
    };

    memberships.push(membership);
    setStore('agilestest_memberships', memberships);

    // Update user memberships_count
    const users = getStore<AdminUser>('agilestest_admin_users');
    const uIdx = users.findIndex(u => u.id === input.user_id);
    if (uIdx !== -1) {
      users[uIdx].memberships_count = memberships.filter(m => m.user_id === input.user_id).length;
      setStore('agilestest_admin_users', users);
    }

    logAudit(actor.id, actor.name, actor.email, 'MEMBERSHIP_ADDED', 'membership', membership.id, `${user.full_name} → ${projectName}`, {
      project_id: projectId,
      project_role: input.project_role,
    });

    return membership;
  },

  updateRole(
    membershipId: string,
    projectRole: ProjectRole,
    actor: { id: string; name: string; email: string }
  ): ProjectMembership {
    const memberships = getStore<ProjectMembership>('agilestest_memberships');
    const idx = memberships.findIndex(m => m.id === membershipId);
    if (idx === -1) throw new Error('Membership non trouvé');

    const oldRole = memberships[idx].project_role;
    memberships[idx].project_role = projectRole;
    memberships[idx].updated_at = now();
    setStore('agilestest_memberships', memberships);

    logAudit(actor.id, actor.name, actor.email, 'MEMBERSHIP_UPDATED', 'membership', membershipId,
      `${memberships[idx].user_name} → ${memberships[idx].project_name}`, {
        from: oldRole,
        to: projectRole,
      });

    return memberships[idx];
  },

  remove(
    membershipId: string,
    actor: { id: string; name: string; email: string }
  ): void {
    const memberships = getStore<ProjectMembership>('agilestest_memberships');
    const idx = memberships.findIndex(m => m.id === membershipId);
    if (idx === -1) throw new Error('Membership non trouvé');

    const removed = memberships[idx];

    // Prevent removing last PROJECT_ADMIN
    const projectAdmins = memberships.filter(
      m => m.project_id === removed.project_id && m.project_role === 'PROJECT_ADMIN'
    );
    if (removed.project_role === 'PROJECT_ADMIN' && projectAdmins.length <= 1) {
      throw new Error('Impossible de supprimer le dernier Admin Projet. Assignez un autre admin avant.');
    }

    memberships.splice(idx, 1);
    setStore('agilestest_memberships', memberships);

    // Update user memberships_count
    const users = getStore<AdminUser>('agilestest_admin_users');
    const uIdx = users.findIndex(u => u.id === removed.user_id);
    if (uIdx !== -1) {
      users[uIdx].memberships_count = memberships.filter(m => m.user_id === removed.user_id).length;
      setStore('agilestest_admin_users', users);
    }

    logAudit(actor.id, actor.name, actor.email, 'MEMBERSHIP_REMOVED', 'membership', membershipId,
      `${removed.user_name} ✕ ${removed.project_name}`, {
        project_id: removed.project_id,
        project_role: removed.project_role,
      });
  },
};

// ─── Audit Log ──────────────────────────────────────────────────────────

export const adminAudit = {
  list(params?: { entity?: AuditEntityType; actor?: string; limit?: number }): AuditEntry[] {
    let entries = getStore<AuditEntry>('agilestest_audit_log');

    if (params?.entity) {
      entries = entries.filter(e => e.entity_type === params.entity);
    }
    if (params?.actor) {
      const q = params.actor.toLowerCase();
      entries = entries.filter(e =>
        e.actor_name.toLowerCase().includes(q) || e.actor_email.toLowerCase().includes(q)
      );
    }

    const limit = params?.limit || 100;
    return entries.slice(0, limit);
  },
};
