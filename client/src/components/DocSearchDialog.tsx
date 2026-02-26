/**
 * DocSearchDialog — Recherche full-text globale dans toute la documentation.
 *
 * - Raccourci clavier Ctrl+K / ⌘+K pour ouvrir
 * - Charge et indexe tous les guides Markdown au premier usage
 * - Recherche dans le contenu (pas seulement les titres)
 * - Affiche un extrait contextuel avec surlignage du terme
 * - Navigation directe vers le guide + section trouvée
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Search, FileText, Loader2, ArrowRight, X,
  BookOpen, Shield, Server, HelpCircle, Radio,
  BarChart3, Zap, ClipboardList, Target, Bell,
  Package, Container, AlertTriangle, User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import type { LucideIcon } from 'lucide-react';

// ─── Guide registry (mirrors DocsPage GUIDES) ─────────────────────────

interface GuideEntry {
  slug: string;
  title: string;
  icon: LucideIcon;
  file: string;
  category: string;
}

const GUIDES: GuideEntry[] = [
  { slug: 'user-guide', title: 'Guide Utilisateur', icon: User, file: '/docs/USER_GUIDE.md', category: 'Guides' },
  { slug: 'admin-guide', title: 'Guide Administration', icon: Shield, file: '/docs/ADMIN_GUIDE.md', category: 'Guides' },
  { slug: 'ops-guide', title: 'Guide Exploitation', icon: Server, file: '/docs/OPS_GUIDE.md', category: 'Guides' },
  { slug: 'troubleshooting', title: 'Troubleshooting', icon: HelpCircle, file: '/docs/TROUBLESHOOTING.md', category: 'Guides' },
  { slug: 'capture-policy', title: 'Capture Policy', icon: Radio, file: '/docs/CAPTURE_POLICY.md', category: 'Technique' },
  { slug: 'probe-hardening', title: 'Probe Hardening', icon: Shield, file: '/docs/PROBE_HARDENING.md', category: 'Technique' },
  { slug: 'drive-correlation', title: 'Drive Correlation', icon: BarChart3, file: '/docs/DRIVE_CORRELATION.md', category: 'Technique' },
  { slug: 'drive-repair-real', title: 'Drive Repair Real', icon: Zap, file: '/docs/DRIVE_REPAIR_REAL.md', category: 'Technique' },
  { slug: 'pilot-runbook', title: 'Runbook Pilote Orange', icon: BookOpen, file: '/docs/PILOT_ORANGE_RUNBOOK.md', category: 'Pilote' },
  { slug: 'pilot-checklist', title: 'Checklist Pilote', icon: ClipboardList, file: '/docs/PILOT_ORANGE_CHECKLIST.md', category: 'Pilote' },
  { slug: 'pilot-gonogo', title: 'Grille GO/NOGO', icon: Target, file: '/docs/PILOT_ORANGE_GO_NOGO_TEMPLATE.md', category: 'Pilote' },
  { slug: 'admin-notifications', title: 'Notifications Admin', icon: Bell, file: '/docs/ADMIN_NOTIFICATIONS.md', category: 'Admin' },
  { slug: 'install-compose', title: 'Install Docker Compose', icon: Container, file: '/docs/INSTALL_COMPOSE.md', category: 'Installation' },
  { slug: 'install-k8s', title: 'Install Kubernetes', icon: Package, file: '/docs/INSTALL_K8S_GITOPS.md', category: 'Installation' },
  { slug: 'dr-runbook', title: 'DR Runbook K8s', icon: AlertTriangle, file: '/docs/DR_RUNBOOK.md', category: 'Installation' },
  { slug: 'parity-checklist', title: 'Parité Compose ↔ K8s', icon: ClipboardList, file: '/docs/PARITY_CHECKLIST.md', category: 'Installation' },
  { slug: 'smoke-tests', title: 'Smoke Tests', icon: Target, file: '/docs/SMOKE_TESTS.md', category: 'Installation' },
];

// ─── Types ──────────────────────────────────────────────────────────────

interface SearchResult {
  guideSlug: string;
  guideTitle: string;
  guideIcon: LucideIcon;
  category: string;
  sectionId: string;
  sectionTitle: string;
  excerpt: string;
  score: number;
}

interface IndexedSection {
  guideSlug: string;
  guideTitle: string;
  guideIcon: LucideIcon;
  category: string;
  sectionId: string;
  sectionTitle: string;
  content: string; // lowercase for search
}

// ─── Helpers ────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSections(markdown: string, guide: GuideEntry): IndexedSection[] {
  const lines = markdown.split('\n');
  const sections: IndexedSection[] = [];
  let currentTitle = guide.title;
  let currentId = '';
  let currentContent: string[] = [];
  let inCodeBlock = false;

  const flush = () => {
    if (currentContent.length > 0) {
      sections.push({
        guideSlug: guide.slug,
        guideTitle: guide.title,
        guideIcon: guide.icon,
        category: guide.category,
        sectionId: currentId,
        sectionTitle: currentTitle,
        content: currentContent.join(' ').toLowerCase(),
      });
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      flush();
      currentTitle = match[2].replace(/\*\*/g, '').trim();
      currentId = slugify(currentTitle);
      currentContent = [currentTitle];
    } else {
      const clean = line.replace(/[#*`\[\]()>|_~]/g, ' ').trim();
      if (clean) currentContent.push(clean);
    }
  }
  flush();
  return sections;
}

function highlightExcerpt(content: string, query: string, maxLen = 160): string {
  const lowerContent = content;
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);
  if (idx === -1) return content.slice(0, maxLen) + (content.length > maxLen ? '...' : '');

  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 100);
  let excerpt = '';
  if (start > 0) excerpt += '...';
  excerpt += content.slice(start, end);
  if (end < content.length) excerpt += '...';
  return excerpt;
}

// ─── Component ──────────────────────────────────────────────────────────

interface DocSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocSearchDialog({ open, onOpenChange }: DocSearchDialogProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<IndexedSection[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [indexed, setIndexed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Build index on first open
  useEffect(() => {
    if (!open || indexed) return;
    setIndexing(true);

    const loadAll = async () => {
      const allSections: IndexedSection[] = [];
      const results = await Promise.allSettled(
        GUIDES.map(async (guide) => {
          const resp = await fetch(guide.file);
          if (!resp.ok) return [];
          const text = await resp.text();
          return buildSections(text, guide);
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') allSections.push(...r.value);
      }
      setIndex(allSections);
      setIndexed(true);
      setIndexing(false);
    };
    loadAll();
  }, [open, indexed]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Search
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return [];

    const scored: SearchResult[] = [];
    for (const section of index) {
      let score = 0;
      const titleLower = section.sectionTitle.toLowerCase();

      for (const word of words) {
        // Title match (high weight)
        if (titleLower.includes(word)) score += 10;
        // Content match
        const contentMatches = section.content.split(word).length - 1;
        if (contentMatches > 0) score += Math.min(contentMatches, 5);
      }

      // Exact phrase match bonus
      if (section.content.includes(q)) score += 15;
      if (titleLower.includes(q)) score += 20;

      if (score > 0) {
        scored.push({
          guideSlug: section.guideSlug,
          guideTitle: section.guideTitle,
          guideIcon: section.guideIcon,
          category: section.category,
          sectionId: section.sectionId,
          sectionTitle: section.sectionTitle,
          excerpt: highlightExcerpt(section.content, q),
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20);
  }, [query, index]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [results.length, query]);

  // Navigate to result
  const goToResult = useCallback((result: SearchResult) => {
    onOpenChange(false);
    const hash = result.sectionId ? `#${result.sectionId}` : '';
    navigate(`/docs/${result.guideSlug}`);
    // Scroll to section after navigation
    if (result.sectionId) {
      setTimeout(() => {
        const el = document.getElementById(result.sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [navigate, onOpenChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      goToResult(results[selectedIdx]);
    }
  }, [results, selectedIdx, goToResult]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll('[data-search-item]');
    items[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  // Render excerpt with highlighted query
  const renderExcerpt = (excerpt: string, q: string) => {
    if (!q.trim()) return excerpt;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = excerpt.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Rechercher dans la documentation</DialogTitle>
        <DialogDescription>Recherche full-text dans tous les guides</DialogDescription>
      </DialogHeader>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden" showCloseButton={false}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher dans la documentation..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Kbd>Esc</Kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[400px] overflow-y-auto">
          {indexing ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Indexation des guides...</span>
            </div>
          ) : !query.trim() || query.trim().length < 2 ? (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {index.length} sections indexées dans {GUIDES.length} guides
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun résultat pour « {query} »
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Essayez avec d'autres termes
              </p>
            </div>
          ) : (
            <div className="py-1">
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  {results.length} résultat{results.length > 1 ? 's' : ''}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  ↑↓ naviguer · ↵ ouvrir
                </span>
              </div>
              {results.map((result, i) => {
                const Icon = result.guideIcon;
                return (
                  <button
                    key={`${result.guideSlug}-${result.sectionId}-${i}`}
                    data-search-item
                    onClick={() => goToResult(result)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                      i === selectedIdx
                        ? 'bg-primary/10'
                        : 'hover:bg-secondary/50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-md bg-secondary/60 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-foreground truncate">
                          {result.sectionTitle}
                        </span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {result.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.guideTitle}
                      </p>
                      <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 leading-relaxed">
                        {renderExcerpt(result.excerpt, query)}
                      </p>
                    </div>
                    <ArrowRight className={`w-4 h-4 shrink-0 mt-1 transition-colors ${
                      i === selectedIdx ? 'text-primary' : 'text-muted-foreground/40'
                    }`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground/60">
          <span>Recherche dans {GUIDES.length} guides de documentation</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> ouvrir
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hook for global shortcut ───────────────────────────────────────────

export function useDocSearchShortcut() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen };
}
