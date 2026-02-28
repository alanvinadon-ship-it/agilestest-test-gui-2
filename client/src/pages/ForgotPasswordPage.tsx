/**
 * ForgotPasswordPage — Request a password reset link by email.
 * Requires SMTP to be configured (reads from localNotifSettings).
 */
import { useState, useCallback } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Shield, Mail, ArrowLeft, Loader2, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { localNotifSettings } from "@/notifications";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSent(true);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Erreur lors de l'envoi de l'email.");
    },
  });

  const validate = useCallback((): boolean => {
    if (!email.trim()) {
      setError("L'adresse email est requise");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Adresse email invalide");
      return false;
    }
    setError("");
    return true;
  }, [email]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      // Get SMTP config from local notification settings
      const rawEmail = localNotifSettings.getRawEmailSettings();
      const isSmtpLive =
        rawEmail.enabled &&
        rawEmail.provider === "SMTP" &&
        rawEmail.host &&
        rawEmail.username &&
        rawEmail.password;

      if (!isSmtpLive) {
        setError(
          "La configuration SMTP n'est pas active. Contactez un administrateur pour configurer l'envoi d'emails (Admin > Notifications > Email)."
        );
        return;
      }

      resetMutation.mutate({
        email: email.trim(),
        origin: window.location.origin,
        smtp: {
          host: rawEmail.host!,
          port: rawEmail.port,
          secure: rawEmail.secure,
          username: rawEmail.username!,
          password: rawEmail.password!,
          from_email: rawEmail.from_email || "noreply@agilestest.io",
          from_name: rawEmail.from_name || "AgilesTest",
          reply_to: rawEmail.reply_to || undefined,
          timeout_ms: rawEmail.timeout_ms,
        },
      });
    },
    [email, validate, resetMutation]
  );

  const isSubmitting = resetMutation.isPending;

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
            RÉINITIALISATION DU MOT DE PASSE
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-lg font-heading font-semibold text-foreground mb-1">
              {sent ? "Email envoyé" : "Mot de passe oublié ?"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {sent
                ? "Vérifiez votre boîte de réception."
                : "Entrez votre adresse email pour recevoir un lien de réinitialisation."}
            </p>
          </div>

          <div className="px-6 pb-6">
            {sent ? (
              /* ─── Success state ─── */
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  <div className="text-sm text-foreground">
                    <p>
                      Si l'adresse <strong>{email}</strong> est associée à un compte,
                      un email contenant un lien de réinitialisation a été envoyé.
                    </p>
                    <p className="text-muted-foreground mt-2">
                      Le lien expire dans <strong>60 minutes</strong>. Pensez à vérifier
                      vos spams si vous ne le trouvez pas.
                    </p>
                  </div>
                </div>

                <Link
                  href="/login?mode=email"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              /* ─── Form state ─── */
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-sm font-medium text-foreground mb-1.5"
                  >
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError("");
                      }}
                      placeholder="nom@entreprise.com"
                      className={`w-full pl-10 pr-3 py-2 rounded-md border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                        error ? "border-destructive" : "border-border"
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer le lien de réinitialisation
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
