/**
 * AdminBrandingPage — /admin/branding
 * Allows admins to upload/change the app logo and favicon.
 */
import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Image, Upload, Trash2, Loader2, X, Palette, Globe,
} from 'lucide-react';
import { toast } from 'sonner';

const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';
const FAVICON_ACCEPT = 'image/png,image/x-icon,image/svg+xml,image/vnd.microsoft.icon';

const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
const FAVICON_MIME_TYPES = ['image/png', 'image/x-icon', 'image/svg+xml', 'image/vnd.microsoft.icon'] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminBrandingPage() {
  const utils = trpc.useUtils();
  const brandingQuery = trpc.branding.get.useQuery();

  const uploadLogoMutation = trpc.branding.uploadLogo.useMutation({
    onSuccess: () => {
      utils.branding.get.invalidate();
      toast.success('Logo mis à jour avec succès');
      setLogoPreview(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeLogoMutation = trpc.branding.removeLogo.useMutation({
    onSuccess: () => {
      utils.branding.get.invalidate();
      toast.success('Logo supprimé — le logo par défaut sera utilisé');
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadFaviconMutation = trpc.branding.uploadFavicon.useMutation({
    onSuccess: () => {
      utils.branding.get.invalidate();
      toast.success('Favicon mis à jour avec succès');
      setFaviconPreview(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeFaviconMutation = trpc.branding.removeFavicon.useMutation({
    onSuccess: () => {
      utils.branding.get.invalidate();
      toast.success('Favicon supprimé — le favicon par défaut sera utilisé');
    },
    onError: (err) => toast.error(err.message),
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<{ base64: string; mimeType: string } | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<{ base64: string; mimeType: string } | null>(null);
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [faviconDragActive, setFaviconDragActive] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = useCallback(async (file: File) => {
    if (!LOGO_MIME_TYPES.includes(file.type as any)) {
      toast.error('Format non supporté. Utilisez PNG, JPEG, WebP ou SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier ne doit pas dépasser 2 Mo.');
      return;
    }
    const base64 = await fileToBase64(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoFile({ base64, mimeType: file.type });
  }, []);

  const handleFaviconSelect = useCallback(async (file: File) => {
    if (!FAVICON_MIME_TYPES.includes(file.type as any)) {
      toast.error('Format non supporté. Utilisez PNG, ICO ou SVG.');
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error('Le favicon ne doit pas dépasser 512 Ko.');
      return;
    }
    const base64 = await fileToBase64(file);
    setFaviconPreview(URL.createObjectURL(file));
    setFaviconFile({ base64, mimeType: file.type });
  }, []);

  const handleLogoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleLogoSelect(file);
  }, [handleLogoSelect]);

  const handleFaviconDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setFaviconDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFaviconSelect(file);
  }, [handleFaviconSelect]);

  const submitLogo = useCallback(() => {
    if (!logoFile) return;
    uploadLogoMutation.mutate({
      base64: logoFile.base64,
      mimeType: logoFile.mimeType as any,
    });
  }, [logoFile, uploadLogoMutation]);

  const submitFavicon = useCallback(() => {
    if (!faviconFile) return;
    uploadFaviconMutation.mutate({
      base64: faviconFile.base64,
      mimeType: faviconFile.mimeType as any,
    });
  }, [faviconFile, uploadFaviconMutation]);

  const currentLogoUrl = brandingQuery.data?.logoUrl;
  const currentFaviconUrl = brandingQuery.data?.faviconUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Palette className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Personnalisation</h1>
          <p className="text-sm text-muted-foreground">Logo et favicon de l'application</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Section */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-heading font-semibold text-foreground">Logo</h2>
            </div>
            {currentLogoUrl && (
              <button
                onClick={() => removeLogoMutation.mutate()}
                disabled={removeLogoMutation.isPending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {removeLogoMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Supprimer
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Le logo est affiché dans la barre latérale et les en-têtes. Formats acceptés : PNG, JPEG, WebP, SVG. Taille max : 2 Mo. Dimensions recommandées : 200×200 px.
          </p>

          {/* Current logo preview */}
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">Actuel :</div>
            {currentLogoUrl ? (
              <img src={currentLogoUrl} alt="Logo actuel" className="h-12 w-12 object-contain rounded-md border border-border bg-secondary/30 p-1" />
            ) : (
              <div className="h-12 w-12 rounded-md bg-primary flex items-center justify-center border border-border">
                <span className="text-primary-foreground font-heading font-bold text-sm">AT</span>
              </div>
            )}
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setLogoDragActive(true); }}
            onDragLeave={() => setLogoDragActive(false)}
            onDrop={handleLogoDrop}
            onClick={() => logoInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              logoDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-secondary/20'
            }`}
          >
            <input
              ref={logoInputRef}
              type="file"
              accept={LOGO_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoSelect(file);
                e.target.value = '';
              }}
            />
            {logoPreview ? (
              <div className="space-y-3">
                <img src={logoPreview} alt="Aperçu logo" className="h-16 w-16 object-contain mx-auto rounded-md" />
                <p className="text-xs text-muted-foreground">Cliquez pour changer ou glissez un autre fichier</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Glissez un fichier ici ou cliquez pour sélectionner</p>
                <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, SVG — max 2 Mo</p>
              </div>
            )}
          </div>

          {/* Submit button */}
          {logoFile && (
            <div className="flex items-center gap-2">
              <button
                onClick={submitLogo}
                disabled={uploadLogoMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploadLogoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Enregistrer le logo
              </button>
              <button
                onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Favicon Section */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-heading font-semibold text-foreground">Favicon</h2>
            </div>
            {currentFaviconUrl && (
              <button
                onClick={() => removeFaviconMutation.mutate()}
                disabled={removeFaviconMutation.isPending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {removeFaviconMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Supprimer
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Le favicon est l'icône affichée dans l'onglet du navigateur. Formats acceptés : PNG, ICO, SVG. Taille max : 512 Ko. Dimensions recommandées : 32×32 ou 64×64 px.
          </p>

          {/* Current favicon preview */}
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">Actuel :</div>
            {currentFaviconUrl ? (
              <img src={currentFaviconUrl} alt="Favicon actuel" className="h-8 w-8 object-contain rounded border border-border bg-secondary/30 p-0.5" />
            ) : (
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center border border-border">
                <span className="text-[10px] text-muted-foreground font-mono">—</span>
              </div>
            )}
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setFaviconDragActive(true); }}
            onDragLeave={() => setFaviconDragActive(false)}
            onDrop={handleFaviconDrop}
            onClick={() => faviconInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              faviconDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-secondary/20'
            }`}
          >
            <input
              ref={faviconInputRef}
              type="file"
              accept={FAVICON_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFaviconSelect(file);
                e.target.value = '';
              }}
            />
            {faviconPreview ? (
              <div className="space-y-3">
                <img src={faviconPreview} alt="Aperçu favicon" className="h-12 w-12 object-contain mx-auto rounded" />
                <p className="text-xs text-muted-foreground">Cliquez pour changer ou glissez un autre fichier</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Glissez un fichier ici ou cliquez pour sélectionner</p>
                <p className="text-xs text-muted-foreground">PNG, ICO, SVG — max 512 Ko</p>
              </div>
            )}
          </div>

          {/* Submit button */}
          {faviconFile && (
            <div className="flex items-center gap-2">
              <button
                onClick={submitFavicon}
                disabled={uploadFaviconMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {uploadFaviconMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Enregistrer le favicon
              </button>
              <button
                onClick={() => { setFaviconPreview(null); setFaviconFile(null); }}
                className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <h3 className="text-sm font-heading font-semibold text-primary mb-1">Conseils</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Le logo est affiché dans la barre latérale (32×32 px) et dans les en-têtes.</li>
          <li>• Utilisez un fond transparent (PNG/SVG) pour un meilleur rendu sur le thème sombre.</li>
          <li>• Le favicon apparaît dans l'onglet du navigateur et les favoris. Privilégiez un format carré.</li>
          <li>• Les modifications sont appliquées immédiatement pour tous les utilisateurs.</li>
        </ul>
      </div>
    </div>
  );
}
