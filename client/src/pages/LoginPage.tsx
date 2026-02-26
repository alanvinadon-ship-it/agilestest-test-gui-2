import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { adminApi } from '../api/adminApi';
import { Loader2, LogIn, AlertCircle, Shield } from 'lucide-react';
import type { User } from '../types';
import { adminUsers } from '../admin/adminStore';

// ─── Comptes locaux autorisés (fallback quand l'API n'est pas disponible) ────
const LOCAL_ACCOUNTS: Array<{ email: string; password: string; user: User }> = [
  {
    email: 'admin@agilestest.io',
    password: 'admin123',
    user: {
      id: 'local-admin-001',
      email: 'admin@agilestest.io',
      full_name: 'Administrateur AgilesTest',
      role: 'ADMIN',
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  },
];

function generateLocalToken(user: User): string {
  // Token JWT-like pour le mode local (base64 encodé)
  const header = btoa(JSON.stringify({ alg: 'local', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24h
    }),
  );
  const sig = btoa('local-signature');
  return `${header}.${payload}.${sig}`;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Essayer l'API distante d'abord
      const response = await adminApi.login({ email, password });
      login(response.access_token, response.user);
    } catch {
      // 2. Fallback : vérifier les comptes locaux
      const localAccount = LOCAL_ACCOUNTS.find(
        (a) => a.email === email && a.password === password,
      );

      if (localAccount) {
        const token = generateLocalToken(localAccount.user);
        login(token, localAccount.user);
      } else {
        // 3. Fallback : vérifier les comptes créés via invitation (localStorage)
        const storedPasswords = JSON.parse(localStorage.getItem('agilestest_passwords') || '{}');
        const storedPwd = storedPasswords[email.toLowerCase()];
        if (storedPwd && storedPwd === password) {
          const adminUser = adminUsers.list({ search: email }).data.find(
            u => u.email.toLowerCase() === email.toLowerCase() && u.status === 'ACTIVE'
          );
          if (adminUser) {
            const invitedUser: User = {
              id: adminUser.id,
              email: adminUser.email,
              full_name: adminUser.full_name,
              role: adminUser.role,
              is_active: true,
              created_at: adminUser.created_at,
              updated_at: adminUser.updated_at,
            };
            const token = generateLocalToken(invitedUser);
            login(token, invitedUser);
          } else {
            setError('Identifiants invalides. Veuillez r\u00e9essayer.');
          }
        } else {
          setError('Identifiants invalides. Veuillez r\u00e9essayer.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center blueprint-grid bg-background">
      <div className="w-full max-w-md mx-4">
        {/* Logo section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">AgilesTest</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono tracking-wider">PLATEFORME DE TEST CLOUD</p>
        </div>

        {/* Login form */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Connexion</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Connectez-vous pour accéder à la console de test.
          </p>

          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@agilestest.io"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Compte par défaut : <span className="font-mono text-foreground">admin@agilestest.io</span> / <span className="font-mono text-foreground">admin123</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          AgilesTest v0.1.1 — Orange CIV
        </p>
      </div>
    </div>
  );
}
