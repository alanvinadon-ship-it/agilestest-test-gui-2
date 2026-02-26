/**
 * AcceptInvitePage — /invite/accept?token=...
 * Page publique permettant à un utilisateur invité de finaliser son inscription.
 * Flux : validation token (via tRPC backend) → formulaire (nom, mot de passe) → activation compte → redirection login
 */
import { useState, useEffect, useCallback } from 'react';
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

// ─── Types ──────────────────────────────────────────────────────────────
interface InviteInfo {
  email: string;
  role?: string;
  invitedByName?: string | null;
  expiresAt?: Date | string | null;
}

// ─── Component ──────────────────────────────────────────────────────────
export default function AcceptInvitePage() {
  const search = useSearch();
  const [, navigate] = useLocation();

  // Extract token from query string
  const params = new URLSearchParams(search);
  const token = params.get('token');

  // State
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'already' | 'success'>('loading');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // tRPC mutations
  const acceptInviteMutation = trpc.admin.acceptInvite.useMutation();

  // Validate token on mount via tRPC backend
  const validateQuery = trpc.admin.validateInviteToken.useQuery(
    { token: token || '' },
    { enabled: !!token, retry: false }
  );

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    if (validateQuery.isLoading) {
      setStatus('loading');
      return;
    }

    if (validateQuery.error) {
      setStatus('invalid');
      return;
    }

    if (validateQuery.data) {
      const result = validateQuery.data;
      if (result.valid && result.invite) {
        setInvite(result.invite as InviteInfo);
        setStatus('valid');
      } else {
        switch (result.reason) {
          case 'already':
            setInvite(result.invite as InviteInfo);
            setStatus('already');
            break;
          case 'expired':
            setInvite(result.invite as InviteInfo);
            setStatus('expired');
            break;
          case 'revoked':
          case 'invalid':
          default:
            setStatus('invalid');
            break;
        }
      }
    }
  }, [token, validateQuery.isLoading, validateQuery.error, validateQuery.data]);

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

  // Submit via tRPC backend
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !token) return;

    setSubmitting(true);
    try {
      const result = await acceptInviteMutation.mutateAsync({
        token,
        fullName: fullName.trim(),
        password,
      });
      setStatus('success');
      toast.success(`Bienvenue ${result.user.fullName} ! Votre compte est activé.`);

      // Redirect to login after 3s
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      const msg = err.message || "Erreur lors de l'activation du compte";
      toast.error(msg);
      if (msg.includes('expiré')) {
        setStatus('expired');
      }
    } finally {
      setSubmitting(false);
    }
  }, [token, fullName, password, validate, navigate, acceptInviteMutation]);

  // ─── Render ─────────────────────────────────────────────────────────────

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
        {status === 'expired' && invite && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-4">
              <AlertCircle className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground mb-2">Invitation expirée</h2>
            <p className="text-sm text-muted-foreground mb-2">
              L'invitation envoyée à <span className="text-foreground font-medium">{invite.email}</span> a expiré
              {invite.expiresAt && (
                <> le {new Date(invite.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
              )}.
            </p>
            {invite.invitedByName && (
              <p className="text-xs text-muted-foreground mb-6">
                Contactez <span className="text-foreground">{invite.invitedByName}</span> pour recevoir une nouvelle invitation.
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
        {status === 'already' && invite && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 mb-4">
              <CheckCircle2 className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-lg font-heading font-bold text-foreground mb-2">Invitation déjà acceptée</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Le compte <span className="text-foreground font-medium">{invite.email}</span> est déjà activé.
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
        {status === 'valid' && invite && (
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
                    <span className="text-foreground font-medium">{invite.email}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Rôle attribué</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span className="text-foreground font-medium">{ROLE_LABELS[invite.role || 'VIEWER'] || invite.role}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Nom complet
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); setErrors(p => ({ ...p, fullName: '' })); }}
                    placeholder="Prénom Nom"
                    className={`w-full pl-10 pr-4 py-2.5 bg-background border ${errors.fullName ? 'border-red-500' : 'border-border'} rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary`}
                  />
                </div>
                {errors.fullName && <p className="text-xs text-red-400 mt-1">{errors.fullName}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                    placeholder="Minimum 8 caractères"
                    className={`w-full pl-10 pr-10 py-2.5 bg-background border ${errors.password ? 'border-red-500' : 'border-border'} rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary`}
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
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })); }}
                    placeholder="Retapez le mot de passe"
                    className={`w-full pl-10 pr-10 py-2.5 bg-background border ${errors.confirmPassword ? 'border-red-500' : 'border-border'} rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary`}
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
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
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
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6 font-mono">
          AgilesTest v0.1.1 — Orange CIV
        </p>
      </div>
    </div>
  );
}
