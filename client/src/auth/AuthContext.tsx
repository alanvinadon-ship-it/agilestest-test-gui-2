/**
 * AuthContext — Provides auth state from tRPC auth.me (server session cookie).
 *
 * MIGRATION NOTE:
 * - Removed all localStorage usage (access_token, user).
 * - Auth is now driven by the HTTP-only session cookie set by Manus OAuth.
 * - The `login()` method is kept for backward compat but is a no-op
 *   (OAuth callback sets the cookie server-side).
 * - `logout()` calls tRPC auth.logout which clears the cookie.
 */

import { createContext, useContext, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import type { UserRole } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canWrite: boolean;
  isAdmin: boolean;
}

/** Compat type that maps DB user → frontend User shape */
interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Map the DB role (lowercase: "admin" | "user") to the frontend enum (uppercase).
 * Also accounts for OWNER_OPEN_ID being treated as admin on the backend.
 */
function mapDbRole(dbRole: string | null | undefined): UserRole {
  switch (dbRole?.toLowerCase()) {
    case "admin":
      return "ADMIN";
    case "manager":
      return "MANAGER";
    default:
      return "VIEWER";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  // Map DB user to frontend AuthUser
  const user: AuthUser | null = useMemo(() => {
    const dbUser = meQuery.data;
    if (!dbUser) return null;
    return {
      id: String(dbUser.id),
      email: dbUser.email ?? "",
      full_name: dbUser.name ?? "",
      role: mapDbRole(dbUser.role),
      is_active: true,
      created_at: dbUser.createdAt ? new Date(dbUser.createdAt).toISOString() : "",
      updated_at: dbUser.updatedAt ? new Date(dbUser.updatedAt).toISOString() : "",
    };
  }, [meQuery.data]);

  const isAuthenticated = Boolean(user);
  const loading = meQuery.isLoading || logoutMutation.isPending;

  // login is a no-op — OAuth callback sets the cookie server-side
  const login = useCallback((_token: string, _user: AuthUser) => {
    // Refresh auth.me to pick up the new session
    utils.auth.me.invalidate();
  }, [utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Ignore errors
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      window.location.href = getLoginUrl();
    }
  }, [logoutMutation, utils]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.some((r) => r.toUpperCase() === user.role?.toUpperCase());
    },
    [user]
  );

  const isAdmin = Boolean(user && user.role === "ADMIN");
  const canWrite = Boolean(
    user && (user.role === "ADMIN" || user.role === "MANAGER")
  );

  const value: AuthContextValue = {
    user,
    token: null, // No more client-side token
    isAuthenticated,
    loading,
    login,
    logout,
    hasRole,
    canWrite,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
