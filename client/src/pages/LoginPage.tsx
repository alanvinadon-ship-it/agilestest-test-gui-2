/**
 * LoginPage — Dual login: Keycloak OAuth + Email/Password (for invited users).
 */
import { useState, useCallback, useMemo } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { toast } from "sonner";
import {
  Shield, LogIn, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

type LoginMode = "choice" | "email";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const initialMode = useMemo<LoginMode>(() => {
    const params = new URLSearchParams(search);
    return params.get("mode") === "email" ? "email" : "choice";
  }, []);
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      toast.success("Connexion réussie !");
      // Force full page reload to pick up the new session cookie
      window.location.href = "/";
    },
    onError: (err) => {
      const msg = err.message || "Erreur de connexion";
      setErrors({ form: msg });
    },
  });

  const handleOAuthLogin = () => {
    window.location.href = getLoginUrl();
  };

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!email.trim()) {
      errs.email = "L'adresse email est requise";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Adresse email invalide";
    }
    if (!password) {
      errs.password = "Le mot de passe est requis";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [email, password]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      loginMutation.mutate({ email: email.trim(), password });
    },
    [email, password, validate, loginMutation]
  );

  const isSubmitting = loginMutation.isPending;

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
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-heading font-semibold text-foreground mb-1">
              Connexion
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "choice"
                ? "Choisissez votre méthode de connexion."
                : "Connectez-vous avec votre email et mot de passe."}
            </p>
          </div>

          <div className="px-6 pb-6">
            {/* ─── Choice mode ──────────────────────────────────────── */}
            {mode === "choice" && (
              <div className="space-y-3">
                {/* OAuth button */}
                <button
                  type="button"
                  onClick={handleOAuthLogin}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Se connecter avec Keycloak
                </button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-muted-foreground">ou</span>
                  </div>
                </div>

                {/* Email login button */}
                <button
                  type="button"
                  onClick={() => setMode("email")}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Se connecter par email
                </button>

                <p className="text-xs text-muted-foreground text-center pt-1">
                  La connexion par email est réservée aux utilisateurs invités.
                </p>
              </div>
            )}

            {/* ─── Email form mode ──────────────────────────────────── */}
            {mode === "email" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Form-level error */}
                {errors.form && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                    {errors.form}
                  </div>
                )}

                {/* Email field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setErrors((prev) => {
                          const { email: _, form: __, ...rest } = prev;
                          return rest;
                        });
                      }}
                      placeholder="nom@entreprise.com"
                      className={`w-full pl-10 pr-3 py-2 rounded-md border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        errors.email ? "border-destructive" : "border-border"
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Password field */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => {
                          const { password: _, form: __, ...rest } = prev;
                          return rest;
                        });
                      }}
                      placeholder="Votre mot de passe"
                      className={`w-full pl-10 pr-10 py-2 rounded-md border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        errors.password ? "border-destructive" : "border-border"
                      }`}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Forgot password link */}
                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Se connecter
                    </>
                  )}
                </button>

                {/* Back to choice */}
                <button
                  type="button"
                  onClick={() => {
                    setMode("choice");
                    setErrors({});
                    setPassword("");
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  ← Retour aux options de connexion
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          AgilesTest v0.2.0 — Orange CIV
        </p>
      </div>
    </div>
  );
}
