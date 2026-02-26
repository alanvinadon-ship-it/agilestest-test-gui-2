/**
 * LoginPage — Redirects to Manus OAuth portal for authentication.
 *
 * The old email/password form has been replaced by OAuth-based login.
 * If the user is already authenticated (cookie valid), they are redirected to "/".
 * Otherwise, they see a branded login page with a "Se connecter" button
 * that redirects to the Manus OAuth portal.
 */
import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getLoginUrl } from '@/const';
import { Loader2, LogIn, Shield } from 'lucide-react';
import { useLocation } from 'wouter';

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate('/');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Vérification de la session...</p>
        </div>
      </div>
    );
  }

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

        {/* Login card */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-1">Connexion</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Connectez-vous via votre compte Manus pour accéder à la console de test.
          </p>

          <button
            onClick={handleLogin}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Se connecter avec Manus
          </button>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Authentification sécurisée via OAuth 2.0 — Session persistante par cookie HTTPOnly.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          AgilesTest v0.4.0 — Orange CIV
        </p>
      </div>
    </div>
  );
}
