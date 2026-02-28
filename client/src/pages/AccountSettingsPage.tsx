/**
 * AccountSettingsPage — User account settings with change password section.
 * Only users with a password (invite-based accounts) see the password section.
 */
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  User, Mail, Shield, Lock, Eye, EyeOff, Loader2, Check, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { trpc } from "@/lib/trpc";

// ─── Password strength indicator ────────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Très faible", color: "bg-red-500" };
  if (score === 2) return { score, label: "Faible", color: "bg-orange-500" };
  if (score === 3) return { score, label: "Moyen", color: "bg-yellow-500" };
  if (score === 4) return { score, label: "Fort", color: "bg-green-500" };
  return { score, label: "Très fort", color: "bg-emerald-500" };
}

// ─── Password field component ───────────────────────────────────────────────
function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete ?? "off"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2 rounded-md border text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            error ? "border-destructive" : "border-border"
          }`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function AccountSettingsPage() {
  const { user } = useAuth();

  // Fetch full user data from auth.me to check if passwordHash exists
  const meQuery = trpc.auth.me.useQuery(undefined, {
    staleTime: 60_000,
  });

  const hasPassword = useMemo(() => {
    const dbUser = meQuery.data;
    return Boolean(dbUser?.passwordHash);
  }, [meQuery.data]);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const changeMutation = trpc.auth.changePassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    },
    onError: (err) => {
      const msg = err.message || "Erreur lors du changement de mot de passe";
      setErrors({ form: msg });
    },
  });

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!currentPassword) {
      errs.currentPassword = "Le mot de passe actuel est requis";
    }
    if (!newPassword) {
      errs.newPassword = "Le nouveau mot de passe est requis";
    } else if (newPassword.length < 8) {
      errs.newPassword = "Au moins 8 caractères requis";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      errs.newPassword = "Doit contenir une majuscule, une minuscule et un chiffre";
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Veuillez confirmer le nouveau mot de passe";
    } else if (newPassword !== confirmPassword) {
      errs.confirmPassword = "Les mots de passe ne correspondent pas";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [currentPassword, newPassword, confirmPassword]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      changeMutation.mutate({ currentPassword, newPassword });
    },
    [currentPassword, newPassword, validate, changeMutation]
  );

  const isSubmitting = changeMutation.isPending;

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Paramètres du compte
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les informations de votre compte.
        </p>
      </div>

      {/* User info section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Informations personnelles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nom complet</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/50 border border-border">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user.full_name || "—"}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Adresse email</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/50 border border-border">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user.email || "—"}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rôle</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/50 border border-border">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user.role}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Méthode de connexion</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/50 border border-border">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">
                {hasPassword ? "Email / Mot de passe" : "OAuth (Manus)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Change password section — only for accounts with password */}
      {hasPassword ? (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-1 flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Changer le mot de passe
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Saisissez votre mot de passe actuel puis définissez un nouveau mot de passe.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            {/* Form-level error */}
            {errors.form && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errors.form}</span>
              </div>
            )}

            <PasswordField
              id="current-password"
              label="Mot de passe actuel"
              value={currentPassword}
              onChange={(v) => {
                setCurrentPassword(v);
                setErrors((prev) => { const { currentPassword: _, form: __, ...rest } = prev; return rest; });
              }}
              error={errors.currentPassword}
              disabled={isSubmitting}
              placeholder="Votre mot de passe actuel"
              autoComplete="current-password"
            />

            <PasswordField
              id="new-password"
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={(v) => {
                setNewPassword(v);
                setErrors((prev) => { const { newPassword: _, form: __, ...rest } = prev; return rest; });
              }}
              error={errors.newPassword}
              disabled={isSubmitting}
              placeholder="Au moins 8 caractères"
              autoComplete="new-password"
            />

            {/* Strength indicator */}
            {newPassword.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i <= strength.score ? strength.color : "bg-border"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Force : <span className="font-medium">{strength.label}</span>
                </p>
              </div>
            )}

            <PasswordField
              id="confirm-password"
              label="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={(v) => {
                setConfirmPassword(v);
                setErrors((prev) => { const { confirmPassword: _, form: __, ...rest } = prev; return rest; });
              }}
              error={errors.confirmPassword}
              disabled={isSubmitting}
              placeholder="Retapez le nouveau mot de passe"
              autoComplete="new-password"
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Modification en cours...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Modifier le mot de passe
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-1 flex items-center gap-2">
            <Lock className="w-5 h-5 text-muted-foreground" />
            Mot de passe
          </h2>
          <p className="text-sm text-muted-foreground">
            Votre compte utilise la connexion OAuth (Manus). La gestion du mot de passe n'est pas disponible pour ce type de compte.
          </p>
        </div>
      )}
    </div>
  );
}
