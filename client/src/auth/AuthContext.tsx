import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: User) => void;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  canWrite: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadFromStorage(): AuthState {
  try {
    const token = localStorage.getItem('access_token');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      const user = JSON.parse(userJson) as User;
      return { user, token, isAuthenticated: true };
    }
  } catch {
    // corrupted storage
  }
  return { user: null, token: null, isAuthenticated: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadFromStorage);

  const login = useCallback((token: string, user: User) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setState({ user, token, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('agilestest_current_project');
    setState({ user: null, token: null, isAuthenticated: false });
  }, []);

  const hasRole = useCallback((...roles: UserRole[]) => {
    return !!state.user && roles.some(r => r.toUpperCase() === state.user?.role?.toUpperCase());
  }, [state.user]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'access_token' || e.key === 'user') {
        setState(loadFromStorage());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const isAdminUser = !!state.user && state.user.role?.toUpperCase() === 'ADMIN';
  const canWriteUser = !!state.user && (state.user.role?.toUpperCase() === 'ADMIN' || state.user.role?.toUpperCase() === 'MANAGER');

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    hasRole,
    canWrite: canWriteUser,
    isAdmin: isAdminUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
