/**
 * AcceptInvitePage — /invite/accept?token=...
 * Page publique permettant à un utilisateur invité de finaliser son inscription.
 * Flux : vérification token via tRPC → formulaire (nom, mot de passe) → acceptation → redirection login
 */
import { useState, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { toast } from 'sonner';
import {
  Shield, UserPlus, Loader2, AlertCircle, CheckCircle2,
  Eye, EyeOff, Mail, User, Lock, ArrowRight, XCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

// ─── Role labels ────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  VIEWER: 'Lecteur',
};

// ─── Password strength ─────────────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Faible', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Moyen', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Bon', color: 'bg-blue-500' };
  return { score, label: 'Fort', color: 'bg-emerald-500' };
}

// ─── Component ──────────────────────────────────────────────────────────
export default function AcceptInvitePage() {
  const search = useSearch();
  const [, navigate] = useLocation();

  // Extract token from query string
  const params = new URLSearchParams(search);
  const token = params.get('token') ?? '';

  // Form state
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);

  // tRPC: verify token
  const { data: verifyResult, isLoading: verifying } = trpc.invite.verifyToken.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // tRPC: accept invite
  const acceptMutation = trpc.invite.accept.useMutation({
    onSuccess: (data) => {
      setAccepted(true);
      toast.success(`Bienvenue ${data.fullName} ! Votre compte est activé.`);
      setTimeout(() => navigate('/login?mode=email'), 3000);
    },
    onError: (err) => {
      toast.error(err.message || "Erreur lors de l'activation du compte");
    },
  });

  // Form validation
  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) {
      errs.fullName = 'Le nom complet est requis';
    } else if (fullName.trim().length < 2) {
      errs.fullName = 'Le nom doit contenir au moins 2 caractères';
    }
    if (!password) {
      errs.password = 'Le mot de passe est requis';
    } else if (password.length < 8) {
      errs.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Veuillez confirmer le mot de passe';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [fullName, password, confirmPassword]);

  // Submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !token) return;
    acceptMutation.mutate({ token, fullName: fullName.trim(), password });
  }, [token, fullName, password, validate, acceptMutation]);

  const pwStrength = getPasswordStrength(password);

  // ─── Determine status ──────────────────────────────────────────────────
  const status = !token
    ? 'invalid'
    : verifying
    ? 'loading'
    : accepted
    ? 'success'
    : !verifyResult
    ? 'loading'
    : verifyResult.valid
    ? 'valid'
    : verifyResult.reason === 'ALREADY_ACCEPTED'
    ? 'already'
    : verifyResult.reason === 'EXPIRED'
    ? 'expired'
    : 'invalid';

  return (
    <div className="min-h-screen flex items-center justify-center blueprint-grid bg-background">
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">AgilesTest</h1>
          <p className="text-xs tracking-[0.25em] text-muted-foreground font-mono mt-1">
            PLATEFORME DE TEST CLOUD
          </p>
        </div>

        {/* ─── Loading ─────────────────────────────────────────── */}
        {status === 'loading' && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Vérification de l'invitation...</p>
          </div>
        )}

        {/* ─── Invalid token ───────────────────────────────────── */}
        {status === 'invalid' && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground mb-2">Lien invalide</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ce lien d'invitation est invalide ou a été révoqué. Veuillez contacter l'administrateur pour recevoir une nouvelle invitation.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Retour à la connexion
            </button>
          </div>
        )}

        {/* ─── Expired ─────────────────────────────────────────── */}
        {status === 'expired' && verifyResult && !verifyResult.valid && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-4">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground mb-2">Invitation expirée</h2>
            <p className="text-sm text-muted-foreground mb-2">
              L'invitation envoyée à <span className="text-foreground font-medium">{'email' in verifyResult ? verifyResult.email : ''}</span> a expiré
              {'expiresAt' in verifyResult && verifyResult.expiresAt
                ? ` le ${new Date(verifyResult.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : ''}.
            </p>
            {'invitedByName' in verifyResult && verifyResult.invitedByName && (
              <p className="text-xs text-muted-foreground mb-6">
                Contactez <span className="text-foreground">{verifyResult.invitedByName}</span> pour recevoir une nouvelle invitation.
              </p>
            )}
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Retour à la connexion
            </button>
          </div>
        )}

        {/* ─── Already accepted ────────────────────────────────── */}
        {status === 'already' && verifyResult && !verifyResult.valid && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 mb-4">
              <CheckCircle2 className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground mb-2">Invitation déjà acceptée</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Le compte <span className="text-foreground font-medium">{'email' in verifyResult ? verifyResult.email : ''}</span> est déjà activé.
              Vous pouvez vous connecter directement.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Se connecter
            </button>
          </div>
        )}

        {/* ─── Success ─────────────────────────────────────────── */}
        {status === 'success' && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground mb-2">Compte activé !</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Bienvenue sur AgilesTest, <span className="text-foreground font-medium">{fullName}</span>.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Vous allez être redirigé vers la page de connexion...
            </p>
            <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto" />
          </div>
        )}

        {/* ─── Registration form ───────────────────────────────── */}
        {status === 'valid' && verifyResult && verifyResult.valid && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-heading font-bold text-foreground">Finaliser votre inscription</h2>
                  <p className="text-xs text-muted-foreground">Complétez les informations ci-dessous pour activer votre compte</p>
                </div>
              </div>
            </div>

            {/* Invitation summary */}
            <div className="px-6 py-4 bg-primary/5 border-b border-border">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span className="text-foreground font-medium">{verifyResult.email}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Rôle attribué</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span className="text-foreground font-medium">{ROLE_LABELS[verifyResult.role] ?? verifyResult.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Full Name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Jean Dupont"
                    className={`w-full pl-10 pr-3 py-2.5 bg-background border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.fullName ? 'border-red-500' : 'border-border'}`}
                  />
                </div>
                {errors.fullName && <p className="text-xs text-red-400 mt-1">{errors.fullName}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className={`w-full pl-10 pr-10 py-2.5 bg-background border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.password ? 'border-red-500' : 'border-border'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i <= pwStrength.score ? pwStrength.color : 'bg-border'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Force : <span className="text-foreground">{pwStrength.label}</span></p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    className={`w-full pl-10 pr-10 py-2.5 bg-background border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.confirmPassword ? 'border-red-500' : 'border-border'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={acceptMutation.isPending}
                className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activation en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Activer mon compte
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                Vous avez déjà un compte ?{' '}
                <button onClick={() => navigate('/login')} className="text-primary hover:underline">
                  Se connecter
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
