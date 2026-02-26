import { Shield, LogIn } from "lucide-react";
import { getLoginUrl } from "@/const";

/**
 * LoginPage — Redirects to Manus OAuth.
 *
 * MIGRATION NOTE:
 * - Removed local accounts, localStorage passwords, adminApi.login.
 * - Auth is now handled by Manus OAuth (server-side session cookie).
 */
export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen flex items-center justify-center blueprint-grid bg-background">
      <div className="w-full max-w-md mx-4">
        {/* Logo section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            AgilesTest
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono tracking-wider">
            PLATEFORME DE TEST CLOUD
          </p>
        </div>

        {/* Login card */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-1">
            Connexion
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Connectez-vous pour accéder à la console de test.
          </p>

          <button
            type="button"
            onClick={handleLogin}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Se connecter avec Manus
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          AgilesTest v0.2.0 — Orange CIV
        </p>
      </div>
    </div>
  );
}
