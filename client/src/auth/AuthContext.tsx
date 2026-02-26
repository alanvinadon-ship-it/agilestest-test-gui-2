/**
 * AuthContext — Server-persistent authentication via tRPC (auth.me).
 *
 * Replaces the old localStorage-based auth with cookie HTTPOnly session.
 * The session cookie is set by /api/oauth/callback and verified automatically
 * by the tRPC context on every request.
 *
 * Exposes the same interface as the old AuthContext for backward compatibility:
 *   user, isAuthenticated, isAdmin, canWrite, hasRole, login, logout
 *
 * The `login()` function is now a no-op (OAuth handles login via redirect).
 * Use `getLoginUrl()` to redirect to the Manus OAuth portal.
 */
import { createContext, useContext, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { getLoginUrl } from '@/const';
import type { UserRole } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Shape returned by auth.me (enriched with RBAC) */
type AuthUser = {
  id: string;
  openId: string;
  email: string;
  full_name: string;
  name: string;
  status: string;
  loginMethod: string | null;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
  role: string;
  appRoles: string[];
  effectiveRole: string;
  permissions: string[];
  isAdmin: boolean;
  canWrite: boolean;
  isActive: boolean;
};

/** Frontend-compatible User shape (matches types/index.ts User interface) */
export interface CompatUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Extended RBAC fields
  openId?: string;
  name?: string;
  appRoles?: string[];
  effectiveRole?: string;
  permissions?: string[];
}

export interface AuthContextValue {
  user: CompatUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  loading: boolean;
  error: Error | null;
  /** @deprecated OAuth handles login via redirect. Use getLoginUrl() instead. */
  login: (token: string, user: any) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  /** Refresh auth state from server */
  refresh: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/** Map server RBAC roles to frontend UserRole for backward compatibility */
function mapToFrontendRole(effectiveRole: string): UserRole {
  switch (effectiveRole) {
    case 'ORG_ADMIN':
      return 'ADMIN';
    case 'QA_MANAGER':
      return 'MANAGER';
    case 'TEST_ENGINEER':
    case 'SECURITY_ANALYST':
      return 'MANAGER'; // TEST_ENGINEER/SECURITY_ANALYST map to MANAGER for canWrite
    case 'VIEWER':
    default:
      return 'VIEWER';
  }
}

/** Convert server auth.me response to frontend CompatUser */
function toCompatUser(authUser: AuthUser): CompatUser {
  return {
    id: authUser.id,
    email: authUser.email,
    full_name: authUser.full_name,
    role: mapToFrontendRole(authUser.effectiveRole),
    is_active: authUser.isActive,
    created_at: authUser.createdAt,
    updated_at: authUser.updatedAt,
    // Extended fields
    openId: authUser.openId,
    name: authUser.name,
    appRoles: authUser.appRoles,
    effectiveRole: authUser.effectiveRole,
    permissions: authUser.permissions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  // Fetch current user from server (cookie-based session)
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000, // 30s cache
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Clear tRPC cache
      utils.auth.me.setData(undefined, null);
      // Clear any remaining localStorage artifacts
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('agilestest_current_project');
      localStorage.removeItem('manus-runtime-user-info');
    },
  });

  const user = useMemo<CompatUser | null>(() => {
    if (!meQuery.data) return null;
    return toCompatUser(meQuery.data as AuthUser);
  }, [meQuery.data]);

  const isAuthenticated = Boolean(user);
  const isAdmin = Boolean((meQuery.data as AuthUser | null)?.isAdmin);
  const canWrite = Boolean((meQuery.data as AuthUser | null)?.canWrite);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Even if mutation fails, clear local state
      utils.auth.me.setData(undefined, null);
    }
    // Redirect to login
    window.location.href = getLoginUrl();
  }, [logoutMutation, utils]);

  /**
   * @deprecated OAuth handles login via redirect.
   * This is kept for backward compatibility with LoginPage.
   * It will redirect to OAuth portal instead.
   */
  const login = useCallback((_token: string, _user: any) => {
    // No-op: OAuth handles login via cookie.
    // Redirect to OAuth portal if called.
    window.location.href = getLoginUrl();
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      // Check against both the mapped frontend role and the RBAC appRoles
      const frontendRole = user.role;
      const effectiveRole = user.effectiveRole ?? '';
      return roles.some(
        (r) =>
          r.toUpperCase() === frontendRole.toUpperCase() ||
          r.toUpperCase() === effectiveRole.toUpperCase()
      );
    },
    [user]
  );

  const refresh = useCallback(() => {
    meQuery.refetch();
  }, [meQuery]);

  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isAdmin,
    canWrite,
    loading: meQuery.isLoading || logoutMutation.isPending,
    error: (meQuery.error ?? logoutMutation.error ?? null) as Error | null,
    login,
    logout,
    hasRole,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
