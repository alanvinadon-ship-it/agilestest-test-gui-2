/**
 * ScreenshotGallery — Galerie de captures d'écran par étape d'exécution
 *
 * Affiche les screenshots collectés pendant l'exécution Playwright :
 *   - Grille de vignettes avec badge de statut (PASSED/FAILED/SKIPPED)
 *   - Lightbox plein écran avec navigation clavier (← →, Esc)
 *   - Numéro d'étape et nom de l'action sur chaque vignette
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Image as ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Download,
  CheckCircle2,
  XCircle,
  SkipForward,
  Camera,
} from 'lucide-react';

interface Artifact {
  id: number;
  uid: string;
  type: string;
  filename: string;
  name?: string | null;
  storageUrl?: string | null;
  downloadUrl?: string | null;
  sizeBytes?: number | null;
  mimeType?: string | null;
}

interface ScreenshotGalleryProps {
  artifacts: Artifact[];
}

// ─── Status extraction from filename ────────────────────────────────────

function parseScreenshotInfo(art: Artifact): {
  stepIndex: number;
  status: 'passed' | 'failed' | 'skipped' | 'unknown';
  label: string;
} {
  // Filename pattern: step-{N}-{status}-{hash}.png
  const match = art.filename?.match(/step-(\d+)-(passed|failed|skipped)/i);
  if (match) {
    return {
      stepIndex: parseInt(match[1], 10),
      status: match[2].toLowerCase() as 'passed' | 'failed' | 'skipped',
      label: art.name || `Étape ${match[1]}`,
    };
  }
  // Fallback: try to extract from name
  const nameMatch = art.name?.match(/Étape\s+(\d+)\s*—\s*(PASSED|FAILED|SKIPPED)/i);
  if (nameMatch) {
    return {
      stepIndex: parseInt(nameMatch[1], 10),
      status: nameMatch[2].toLowerCase() as 'passed' | 'failed' | 'skipped',
      label: art.name || `Étape ${nameMatch[1]}`,
    };
  }
  return { stepIndex: 0, status: 'unknown', label: art.name || art.filename || 'Screenshot' };
}

const statusConfig = {
  passed: {
    icon: CheckCircle2,
    bgClass: 'bg-green-500/20 border-green-500/40',
    textClass: 'text-green-400',
    label: 'RÉUSSI',
  },
  failed: {
    icon: XCircle,
    bgClass: 'bg-red-500/20 border-red-500/40',
    textClass: 'text-red-400',
    label: 'ÉCHEC',
  },
  skipped: {
    icon: SkipForward,
    bgClass: 'bg-yellow-500/20 border-yellow-500/40',
    textClass: 'text-yellow-400',
    label: 'IGNORÉ',
  },
  unknown: {
    icon: Camera,
    bgClass: 'bg-primary/20 border-primary/40',
    textClass: 'text-primary',
    label: 'CAPTURE',
  },
};

// ─── Component ──────────────────────────────────────────────────────────

export default function ScreenshotGallery({ artifacts }: ScreenshotGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filter only screenshot artifacts
  const screenshots = artifacts
    .filter((a) => a.type === 'screenshot' && (a.storageUrl || a.downloadUrl))
    .map((a) => ({
      ...a,
      ...parseScreenshotInfo(a),
      url: a.storageUrl || a.downloadUrl || '',
    }))
    .sort((a, b) => a.stepIndex - b.stepIndex);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      if (e.key === 'ArrowRight')
        setLightboxIndex((prev) => (prev !== null && prev < screenshots.length - 1 ? prev + 1 : prev));
    },
    [lightboxIndex, screenshots.length],
  );

  useEffect(() => {
    if (lightboxIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, handleKeyDown]);

  if (screenshots.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary" />
          Captures d'écran
        </h2>
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucune capture d'écran. Les screenshots sont collectés en mode RÉEL (Playwright).
          </p>
        </div>
      </div>
    );
  }

  const currentScreenshot = lightboxIndex !== null ? screenshots[lightboxIndex] : null;

  return (
    <div>
      <h2 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
        <Camera className="w-5 h-5 text-primary" />
        Captures d'écran
        <span className="text-xs font-mono text-muted-foreground ml-1">({screenshots.length})</span>
      </h2>

      {/* Thumbnail Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {screenshots.map((shot, idx) => {
          const cfg = statusConfig[shot.status];
          const StatusIcon = cfg.icon;
          return (
            <button
              key={shot.id}
              onClick={() => setLightboxIndex(idx)}
              className="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {/* Thumbnail image */}
              <div className="aspect-video bg-background/50 relative overflow-hidden">
                <img
                  src={shot.url}
                  alt={shot.label}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {/* Info bar */}
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-mono font-bold text-primary shrink-0">#{shot.stepIndex}</span>
                  <span className="text-xs text-muted-foreground truncate">{shot.label}</span>
                </div>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.bgClass}`}>
                  <StatusIcon className={`w-3 h-3 ${cfg.textClass}`} />
                  <span className={cfg.textClass}>{cfg.label}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && currentScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent z-10">
            <div className="flex items-center gap-3">
              <span className="text-white font-mono font-bold text-sm">
                #{currentScreenshot.stepIndex}
              </span>
              <span className="text-white/80 text-sm">{currentScreenshot.label}</span>
              {(() => {
                const cfg = statusConfig[currentScreenshot.status];
                const StatusIcon = cfg.icon;
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.bgClass}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${cfg.textClass}`} />
                    <span className={cfg.textClass}>{cfg.label}</span>
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-sm font-mono">
                {lightboxIndex + 1} / {screenshots.length}
              </span>
              <a
                href={currentScreenshot.url}
                download={currentScreenshot.filename}
                onClick={(e) => e.stopPropagation()}
                className="text-white/60 hover:text-white transition-colors p-1"
                title="Télécharger"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={() => setLightboxIndex(null)}
                className="text-white/60 hover:text-white transition-colors p-1"
                title="Fermer (Esc)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Navigation arrows */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors"
              title="Précédent (←)"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          {lightboxIndex < screenshots.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors"
              title="Suivant (→)"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Image */}
          <img
            src={currentScreenshot.url}
            alt={currentScreenshot.label}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Bottom step navigation dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full px-4 py-2">
            {screenshots.map((shot, idx) => {
              const cfg = statusConfig[shot.status];
              return (
                <button
                  key={shot.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIndex(idx);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    idx === lightboxIndex
                      ? 'w-6 bg-primary'
                      : `${shot.status === 'passed' ? 'bg-green-500/60' : shot.status === 'failed' ? 'bg-red-500/60' : 'bg-yellow-500/60'} hover:opacity-80`
                  }`}
                  title={`Étape ${shot.stepIndex} — ${cfg.label}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
