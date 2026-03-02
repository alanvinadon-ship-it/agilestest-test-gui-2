/**
 * ResetPasswordPage — Set a new password using a reset token from email link.
 */
import { useState, useCallback, useMemo } from "react";
import { useSearch, Link } from "wouter";
import { toast } from "sonner";
import {
  Shield, Lock, Eye, EyeOff, Loader2, ArrowRight, ArrowLeft,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function ResetPasswordPage() {
  const search = useSearch();
  const token = useMemo(() => new URLSearchParams(search).get("token") ?? "", [search]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  // Verify token validity
  const tokenQuery = trpc.auth.verifyResetToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      toast.success("Mot de passe réinitialisé avec succès !");
    },
    onError: (err: { message?: string }) => {
      setErrors({ form: err.message || "Erreur lors de la réinitialisation." });
    },
  });

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!password) {
      errs.password = "Le mot de passe est requis";
    } else if (password.length < 8) {
      errs.password = "Le mot de passe doit contenir au moins 8 caractères";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errs.password = "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Veuillez confirmer le mot de passe";
    } else if (password !== confirmPassword) {
      errs.confirmPassword = "Les mots de passe ne correspondent pas";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [password, confirmPassword]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      resetMutation.mutate({ token, newPassword: password });
    },
    [token, password, validate, resetMutation]
  );

  const isSubmitting = resetMutation.isPending;

  // Password strength indicator
  const passwordStrength = useMemo(() => {
    if (!password) return { level: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { level: score, label: "Faible", color: "bg-red-500" };
    if (score <= 3) return { level: score, label: "Moyen", color: "bg-yellow-500" };
    return { level: score, label: "Fort", color: "bg-green-500" };
  }, [password]);

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
            NOUVEAU MOT DE PASSE
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-heading font-semibold text-foreground mb-1">
              {success
                ? "Mot de passe réinitialisé"
                : !token
                ? "Lien invalide"
                : tokenQuery.isLoading
                ? "Vérification..."
                : tokenQuery.data?.valid
                ? "Nouveau mot de passe"
                : "Lien expiré ou invalide"}
            </h2>
          </div>

          <div className="px-6 pb-6">
            {/* No token */}
            {!token && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">
                    Ce lien de réinitialisation est invalide. Veuillez demander un nouveau lien.
                  </p>
                </div>
                <Link
                  href="/forgot-password"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Demander un nouveau lien
                </Link>
              </div>
            )}

            {/* Loading */}
            {token && tokenQuery.isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Vérification du lien...</span>
              </div>
            )}

            {/* Token invalid/expired */}
            {token && !tokenQuery.isLoading && !tokenQuery.data?.valid && !success && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm text-foreground">
                    <p>Ce lien de réinitialisation est invalide ou a expiré.</p>
                    <p className="text-muted-foreground mt-1">
                      Les liens expirent après 60 minutes. Veuillez en demander un nouveau.
                    </p>
                  </div>
                </div>
                <Link
                  href="/forgot-password"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Demander un nouveau lien
                </Link>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-foreground">
                    <p>Votre mot de passe a été réinitialisé avec succès.</p>
                    <p className="text-muted-foreground mt-1">
                      Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                    </p>
                  </div>
                </div>
                <Link
                  href="/login?mode=email"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                  Se connecter
                </Link>
              </div>
            )}

            {/* Reset form */}
            {token && !tokenQuery.isLoading && tokenQuery.data?.valid && !success && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {tokenQuery.data.email && (
                  <p className="text-sm text-muted-foreground">
                    Définissez un nouveau mot de passe pour <strong className="text-foreground">{tokenQuery.data.email}</strong>.
                  </p>
                )}

                {errors.form && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errors.form}</span>
                  </div>
                )}

                {/* New password */}
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => {
                          const { password: _, form: __, ...rest } = prev;
                          return rest;
                        });
                      }}
                      placeholder="Minimum 8 caractères"
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
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive mt-1">{errors.password}</p>
                  )}
                  {/* Strength indicator */}
                  {password && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${passwordStrength.color}`}
                          style={{ width: `${(passwordStrength.level / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{passwordStrength.label}</span>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setErrors((prev) => {
                          const { confirmPassword: _, form: __, ...rest } = prev;
                          return rest;
                        });
                      }}
                      placeholder="Retapez le mot de passe"
                      className={`w-full pl-10 pr-3 py-2 rounded-md border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        errors.confirmPassword ? "border-destructive" : "border-border"
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive mt-1">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Réinitialisation en cours...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Réinitialiser le mot de passe
                    </>
                  )}
                </button>

                <Link
                  href="/login?mode=email"
                  className="w-full inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pt-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la connexion
                </Link>
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
