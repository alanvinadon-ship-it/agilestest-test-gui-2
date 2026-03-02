/**
 * DocsPage — Section Documentation avec :
 * - Navigation latérale entre guides
 * - Table des matières dynamique (ancres)
 * - Recherche locale (filtre sur titres)
 * - Bouton "Copier lien section"
 * - Rendu Markdown depuis /docs/*.md
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen, Search, ChevronRight, Copy, Check,
  User, Shield, Server, HelpCircle, FileText,
  Hash, ExternalLink, Radio, ClipboardList, Target, BarChart3, Zap, Bell,
  Package, Container, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { DocSearchDialog, useDocSearchShortcut } from '../components/DocSearchDialog';
import { Kbd } from '@/components/ui/kbd';

// ─── Guide definitions ──────────────────────────────────────────────────

interface GuideEntry {
  slug: string;
  title: string;
  icon: typeof BookOpen;
  file: string;
  description: string;
}

const GUIDES: GuideEntry[] = [
  { slug: 'user-guide', title: 'Guide Utilisateur', icon: User, file: '/docs/USER_GUIDE.md', description: 'Testeur / Manager — parcours complet' },
  { slug: 'admin-guide', title: 'Guide Administration', icon: Shield, file: '/docs/ADMIN_GUIDE.md', description: 'Admin / DSI — RBAC, gouvernance, secrets' },
  { slug: 'ops-guide', title: 'Guide Exploitation', icon: Server, file: '/docs/OPS_GUIDE.md', description: 'Runner Docker, MinIO, diagnostics' },
  { slug: 'troubleshooting', title: 'Troubleshooting', icon: HelpCircle, file: '/docs/TROUBLESHOOTING.md', description: 'FAQ et résolution de problèmes' },
  { slug: 'capture-policy', title: 'Capture Policy', icon: Radio, file: '/docs/CAPTURE_POLICY.md', description: 'Capture réseau PCAP — tcpdump & Probe SPAN/TAP' },
  { slug: 'probe-hardening', title: 'Probe Hardening', icon: Shield, file: '/docs/PROBE_HARDENING.md', description: 'Durcissement Probe SPAN/TAP — sécurité, quotas, diagnostics' },
  { slug: 'drive-correlation', title: 'Drive Correlation', icon: BarChart3, file: '/docs/DRIVE_CORRELATION.md', description: 'Corrélation KPI ↔ route ↔ artefacts — segments, incidents, IA REPAIR' },
  { slug: 'drive-repair-real', title: 'Drive Repair Real', icon: Zap, file: '/docs/DRIVE_REPAIR_REAL.md', description: 'Repair Drive opérateur-grade — diagnostic multi-couches, preuves, rerun plan' },
  { slug: 'pilot-runbook', title: 'Runbook Pilote Orange', icon: BookOpen, file: '/docs/PILOT_ORANGE_RUNBOOK.md', description: 'Procédure complète du pilote V1 — 4 parcours' },
  { slug: 'pilot-checklist', title: 'Checklist Pilote', icon: ClipboardList, file: '/docs/PILOT_ORANGE_CHECKLIST.md', description: 'Checklists J-7/J-2/Jour J et par parcours' },  { slug: 'pilot-gonogo', title: 'Grille GO/NOGO', icon: Target, file: '/docs/PILOT_ORANGE_GO_NOGO_TEMPLATE.md', description: 'Critères d\'évaluation et décision GO/NOGO' },
  { slug: 'admin-notifications', title: 'Notifications Admin', icon: Bell, file: '/docs/ADMIN_NOTIFICATIONS.md', description: 'SMS Orange, Email SMTP, templates, règles, delivery logs' },
  { slug: 'install-compose', title: 'Install Docker Compose', icon: Container, file: '/docs/INSTALL_COMPOSE.md', description: 'Installation rapide sur VM Linux — Docker Compose' },
  { slug: 'install-k8s', title: 'Install Kubernetes', icon: Package, file: '/docs/INSTALL_K8S_GITOPS.md', description: 'Installation industrielle — Helm + GitOps + ArgoCD' },
  { slug: 'dr-runbook', title: 'DR Runbook K8s', icon: AlertTriangle, file: '/docs/DR_RUNBOOK.md', description: 'Disaster Recovery — backup, restore, rotation secrets' },
  { slug: 'parity-checklist', title: 'Parité Compose ↔ K8s', icon: ClipboardList, file: '/docs/PARITY_CHECKLIST.md', description: 'Checklist de parité fonctionnelle entre les deux modes' },
  { slug: 'smoke-tests', title: 'Smoke Tests', icon: Target, file: '/docs/SMOKE_TESTS.md', description: 'Étapes et résultats attendus des smoke tests' },
];

// ─── TOC extraction ─────────────────────────────────────────────────────

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split('\n');
  const toc: TocEntry[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, '').trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      toc.push({ id, text, level });
    }
  }
  return toc;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Component ──────────────────────────────────────────────────────────

export default function DocsPage() {
  const [, params] = useRoute('/docs/:slug');
  const [location, navigate] = useLocation();
  const slug = params?.slug || 'user-guide';
  const guide = GUIDES.find(g => g.slug === slug) || GUIDES[0];

  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const docSearch = useDocSearchShortcut();

  // Fetch markdown
  useEffect(() => {
    setLoading(true);
    fetch(guide.file)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        setMarkdown(text);
        setLoading(false);
      })
      .catch(() => {
        setMarkdown('# Erreur\n\nImpossible de charger la documentation.');
        setLoading(false);
      });
  }, [guide.file]);

  // TOC
  const toc = useMemo(() => extractToc(markdown), [markdown]);

  // Filtered TOC for search
  const filteredToc = useMemo(() => {
    if (!search.trim()) return toc;
    const q = search.toLowerCase();
    return toc.filter(entry => entry.text.toLowerCase().includes(q));
  }, [toc, search]);

  // Copy section link
  const copyLink = useCallback((id: string) => {
    const url = `${window.location.origin}/docs/${slug}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      toast.success('Lien copié');
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, [slug]);

  // Scroll to anchor on load
  useEffect(() => {
    if (!loading && window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  }, [loading]);

  // Scroll to section
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `#${id}`);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Documentation</h1>
            <p className="text-sm text-muted-foreground">Guides utilisateur, administration et exploitation</p>
          </div>
        </div>
        <button
          onClick={() => docSearch.setOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">Recherche globale</span>
          <div className="flex items-center gap-0.5 ml-1">
            <Kbd>⌘</Kbd><Kbd>K</Kbd>
          </div>
        </button>
      </div>

      <DocSearchDialog open={docSearch.open} onOpenChange={docSearch.setOpen} />

      <div className="flex gap-6">
        {/* Left sidebar — Guide nav + TOC */}
        <aside className="w-64 shrink-0 space-y-4">
          {/* Guide navigation */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Guides</p>
            </div>
            <div className="p-2">
              {GUIDES.map(g => {
                const isActive = g.slug === slug;
                const GIcon = g.icon;
                return (
                  <Link key={g.slug} href={`/docs/${g.slug}`}>
                    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}>
                      <GIcon className="w-4 h-4 shrink-0" />
                      <span className="font-medium truncate">{g.title}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une section..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* TOC */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Table des matières</p>
            </div>
            <div className="p-2 max-h-[60vh] overflow-y-auto">
              {filteredToc.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aucune section trouvée.</p>
              ) : (
                filteredToc.map((entry, i) => (
                  <div key={`${entry.id}-${i}`} className="group flex items-center">
                    <button
                      onClick={() => scrollTo(entry.id)}
                      className={`flex-1 text-left px-3 py-1.5 rounded text-xs transition-colors hover:bg-secondary hover:text-foreground ${
                        entry.level === 1 ? 'font-semibold text-foreground' :
                        entry.level === 2 ? 'pl-5 text-muted-foreground' :
                        entry.level === 3 ? 'pl-8 text-muted-foreground/80' :
                        'pl-10 text-muted-foreground/60'
                      }`}
                    >
                      {entry.text}
                    </button>
                    <button
                      onClick={() => copyLink(entry.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"
                      title="Copier le lien"
                    >
                      {copiedId === entry.id ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Main content — Markdown renderer */}
        <div className="flex-1 min-w-0">
          {/* Current guide info */}
          <div className="bg-card border border-border rounded-lg px-5 py-3 mb-4 flex items-center gap-3">
            <guide.icon className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-heading font-semibold text-foreground">{guide.title}</p>
              <p className="text-xs text-muted-foreground">{guide.description}</p>
            </div>
          </div>

          {loading ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Chargement de la documentation...</p>
            </div>
          ) : (
            <div
              ref={contentRef}
              className="bg-card border border-border rounded-lg px-8 py-6 prose-docs"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children, ...props }) => {
                    const text = String(children);
                    const id = slugify(text);
                    return (
                      <h1 id={id} className="text-2xl font-heading font-bold text-foreground mt-8 mb-4 first:mt-0 scroll-mt-20 group" {...props}>
                        <a href={`#${id}`} className="no-underline text-foreground hover:text-primary">
                          {children}
                        </a>
                      </h1>
                    );
                  },
                  h2: ({ children, ...props }) => {
                    const text = String(children);
                    const id = slugify(text);
                    return (
                      <h2 id={id} className="text-xl font-heading font-semibold text-foreground mt-8 mb-3 scroll-mt-20 border-b border-border pb-2 group" {...props}>
                        <a href={`#${id}`} className="no-underline text-foreground hover:text-primary flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          {children}
                        </a>
                      </h2>
                    );
                  },
                  h3: ({ children, ...props }) => {
                    const text = String(children);
                    const id = slugify(text);
                    return (
                      <h3 id={id} className="text-lg font-heading font-semibold text-foreground mt-6 mb-2 scroll-mt-20 group" {...props}>
                        <a href={`#${id}`} className="no-underline text-foreground hover:text-primary">
                          {children}
                        </a>
                      </h3>
                    );
                  },
                  h4: ({ children, ...props }) => {
                    const text = String(children);
                    const id = slugify(text);
                    return (
                      <h4 id={id} className="text-base font-heading font-medium text-foreground mt-4 mb-2 scroll-mt-20" {...props}>
                        {children}
                      </h4>
                    );
                  },
                  p: ({ children }) => (
                    <p className="text-sm text-foreground/90 leading-relaxed mb-3">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  a: ({ href, children }) => (
                    <a href={href} className="text-primary hover:text-primary/80 underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-foreground/90">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-foreground/90">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-primary/40 pl-4 my-4 text-sm text-muted-foreground italic">
                      {children}
                    </blockquote>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.includes('language-');
                    if (isBlock) {
                      return (
                        <div className="my-4 rounded-md overflow-hidden border border-border">
                          <div className="bg-secondary/50 px-4 py-1.5 border-b border-border">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">
                              {className?.replace('language-', '') || 'code'}
                            </span>
                          </div>
                          <pre className="bg-background/50 p-4 overflow-x-auto">
                            <code className="text-xs font-mono text-foreground/90 leading-relaxed" {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      );
                    }
                    return (
                      <code className="bg-secondary/60 text-primary px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => <>{children}</>,
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-secondary/30 border-b border-border">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="text-left px-4 py-2.5 text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-4 py-2.5 text-foreground/90 border-t border-border">{children}</td>
                  ),
                  hr: () => (
                    <hr className="my-8 border-border" />
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
