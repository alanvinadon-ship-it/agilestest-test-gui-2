import { Link, useLocation } from "wouter";
import { useCallback, useMemo, useEffect } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Settings2,
  FileText,
  Database,
  Play,
  Radio,
  Network,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
  Package,
  Code2,
  BookOpen,
  Users,
  ShieldCheck,
  ScrollText,
  KeyRound,
  Signal,
  BarChart3,
  Navigation,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Webhook,
  BookTemplate,
  GitCompareArrows,
  TrendingUp,
  Palette,
  Brain,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "../auth/AuthContext";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useProject } from "../state/projectStore";
import { useSidebarAccordionState } from "../hooks/useSidebarAccordionState";
import { useSidebarCounts } from "../hooks/useSidebarCounts";
import { uiGet, uiSet } from "../lib/uiStorage";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface NavSection {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  adminOnly?: boolean;
  /** If true, items are shown directly without accordion (e.g. single-item sections) */
  flat?: boolean;
}

const baseNavSections: NavSection[] = [
  {
    label: "Général",
    icon: LayoutDashboard,
    flat: true,
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard", icon: BarChart3, label: "Analytique" },
      { href: "/analytics", icon: TrendingUp, label: "Analytique Globale" },
      { href: "/projects", icon: FolderKanban, label: "Projets" },
      { href: "/settings", icon: Settings2, label: "Paramètres Projet" },
    ],
  },
  {
    label: "Configuration",
    icon: Settings2,
    items: [
      { href: "/profiles", icon: Settings2, label: "Profils de test" },
      { href: "/scenarios", icon: FileText, label: "Scénarios" },
      { href: "/datasets", icon: Database, label: "Datasets (Instances)" },
      { href: "/bundles", icon: Package, label: "Bundles" },
      { href: "/dataset-types", icon: Database, label: "Gabarits Datasets" },
      { href: "/scripts", icon: Code2, label: "Scripts Générés" },
      { href: "/templates", icon: BookTemplate, label: "Templates" },
      { href: "/import-export", icon: Package, label: "Import / Export" },
    ],
  },
  {
    label: "Exécution",
    icon: Play,
    items: [
      { href: "/executions", icon: Play, label: "Exécutions" },
      { href: "/executions-compare", icon: GitCompareArrows, label: "Comparer" },
      { href: "/captures", icon: Network, label: "Captures" },
      { href: "/probes", icon: Radio, label: "Sondes" },
      { href: "/probes/monitoring", icon: Activity, label: "Monitoring" },
      { href: "/webhooks", icon: Webhook, label: "Webhooks" },
      { href: "/collector", icon: Activity, label: "Collector" },
    ],
  },
  {
    label: "Drive Test",
    icon: Navigation,
    items: [
      { href: "/drive/campaigns", icon: Navigation, label: "Campagnes" },
      { href: "/drive/runs", icon: Signal, label: "Runs Terrain" },
      { href: "/drive/reporting", icon: BarChart3, label: "Reporting" },
    ],
  },
  {
    label: "Administration",
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { href: "/admin/users", icon: Users, label: "Utilisateurs" },
      { href: "/admin/project-access", icon: KeyRound, label: "Accès Projets" },
      { href: "/admin/roles", icon: ShieldCheck, label: "Rôles & Permissions" },
      { href: "/admin/rbac", icon: ShieldCheck, label: "Matrice RBAC" },
      { href: "/admin/audit", icon: ScrollText, label: "Journal d'audit" },
      { href: "/admin/notifications", icon: Bell, label: "Notifications" },
      { href: "/admin/branding", icon: Palette, label: "Personnalisation" },
      { href: "/admin/ai-settings", icon: Brain, label: "Clés IA" },
      { href: "/admin/keycloak", icon: KeyRound, label: "Keycloak" },
    ],
  },
  {
    label: "Aide",
    icon: BookOpen,
    flat: true,
    items: [
      { href: "/docs/user-guide", icon: BookOpen, label: "Documentation" },
    ],
  },
];

// ─── Mini-sidebar: Popover with sub-items ──────────────────────────────

function MiniNavItem({
  item,
  location,
}: {
  item: NavItem;
  location: string;
}) {
  const isActive =
    location === item.href || (item.href !== "/" && location.startsWith(item.href));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={item.href}>
          <div
            className={cn(
              "w-10 h-10 rounded-md flex items-center justify-center transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <item.icon className="w-4 h-4" />
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function MiniNavSectionPopover({
  section,
  location,
  badge,
  navigate,
}: {
  section: NavSection;
  location: string;
  badge?: string | null;
  navigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const hasActiveItem = section.items.some(
    (item) => location === item.href || (item.href !== "/" && location.startsWith(item.href))
  );

  // For flat sections with single items, render as simple tooltip icons
  if (section.flat) {
    return (
      <div className="space-y-0.5 flex flex-col items-center">
        {section.items.map((item) => (
          <MiniNavItem key={item.href} item={item} location={location} />
        ))}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "relative w-10 h-10 rounded-md flex items-center justify-center transition-colors",
                hasActiveItem
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              aria-label={section.label}
              aria-haspopup="true"
              aria-expanded={open}
            >
              <section.icon className="w-4 h-4" />
              {badge && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold leading-none bg-primary text-primary-foreground">
                  {badge}
                </span>
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="right" sideOffset={8}>
            {section.label}
          </TooltipContent>
        )}
      </Tooltip>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-52 p-1.5"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        <p
          className={cn(
            "px-2 py-1 text-[10px] font-mono font-medium uppercase tracking-widest",
            section.adminOnly ? "text-red-400/70" : "text-muted-foreground"
          )}
        >
          {section.label}
        </p>
        <div className="space-y-0.5 mt-0.5">
          {section.items.map((item) => {
            const isActive =
              location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => {
                  navigate(item.href);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium truncate text-[13px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Collapsible Nav Section (normal mode) ─────────────────────────────

function NavSectionAccordion({
  section,
  location,
  expanded,
  onToggle,
  badge,
}: {
  section: NavSection;
  location: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string | null;
}) {
  const hasActiveItem = section.items.some(
    (item) => location === item.href || (item.href !== "/" && location.startsWith(item.href))
  );

  // Flat sections: render items directly without accordion header
  if (section.flat) {
    return (
      <div>
        <p
          className={cn(
            "px-3 mb-1.5 text-[10px] font-mono font-medium uppercase tracking-widest",
            section.adminOnly ? "text-red-400/70" : "text-muted-foreground"
          )}
        >
          {section.label}
        </p>
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const isActive =
              location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="font-medium truncate">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // Accordion sections: collapsible with chevron
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors group",
          hasActiveItem && !expanded
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        )}
      >
        <section.icon className="w-4 h-4 shrink-0" />
        <span
          className={cn(
            "flex-1 text-left font-semibold text-[11px] uppercase tracking-wider truncate",
            section.adminOnly && "text-red-400/70"
          )}
        >
          {section.label}
        </span>
        {badge && (
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none bg-primary text-primary-foreground shrink-0"
            aria-label={`${badge} éléments actifs`}
          >
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
            expanded ? "rotate-0" : "-rotate-90"
          )}
        />
        {/* Active indicator dot when collapsed */}
        {hasActiveItem && !expanded && !badge && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
        )}
      </button>

      {/* Accordion content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-0.5 pt-0.5 pl-2">
          {section.items.map((item) => {
            const isActive =
              location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium truncate text-[13px]">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Layout ────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout, isAdmin } = useAuth();

  // Fetch avatar URL from auth.me
  const meQuery = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const avatarUrl = meQuery.data?.avatarUrl ?? null;

  // Fetch branding (logo + favicon)
  const brandingQuery = trpc.branding.get.useQuery(undefined, { staleTime: 60_000 });
  const customLogoUrl = brandingQuery.data?.logoUrl ?? null;
  const customFaviconUrl = brandingQuery.data?.faviconUrl ?? null;

  // Dynamic favicon injection
  useEffect(() => {
    if (!customFaviconUrl) {
      // Remove any custom favicon link to revert to default
      const existing = document.querySelector('link[data-branding-favicon]');
      if (existing) existing.remove();
      return;
    }
    let link = document.querySelector('link[data-branding-favicon]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('data-branding-favicon', 'true');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = customFaviconUrl;
  }, [customFaviconUrl]);

  // Persisted mini-sidebar state via uiStorage
  const [mini, setMini] = useState(() => uiGet("sidebarMini"));

  const toggleMini = useCallback(() => {
    setMini((prev) => {
      const next = !prev;
      uiSet("sidebarMini", next);
      return next;
    });
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);
  const { currentProject } = useProject();

  const navSections = useMemo(() => {
    return baseNavSections.filter((s) => !s.adminOnly || isAdmin);
  }, [isAdmin]);

  // Persisted accordion state via uiStorage (only used in normal mode)
  const { isExpanded, toggle: toggleSection } = useSidebarAccordionState(location, navSections);

  // Badge counts from backend
  const { formatCount } = useSidebarCounts();

  return (
    <div className="min-h-screen flex blueprint-grid">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-200",
          mini ? "w-[60px]" : "w-56"
        )}
      >
        {/* Logo + Toggle */}
        <div className="h-14 flex items-center gap-2 px-3 border-b border-border shrink-0">
          {mini ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleMini}
                  className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity overflow-hidden"
                  aria-label="Étendre la barre latérale"
                >
                  {customLogoUrl ? (
                    <img src={customLogoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                  ) : (
                    <span className="text-primary-foreground font-heading font-bold text-sm">AT</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Étendre la barre latérale
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0 overflow-hidden">
                {customLogoUrl ? (
                  <img src={customLogoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-primary-foreground font-heading font-bold text-sm">AT</span>
                )}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="font-heading font-semibold text-sm text-foreground truncate">
                  AgilesTest
                </p>
                <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                  CLOUD TESTING
                </p>
              </div>
              <button
                onClick={toggleMini}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                title="Réduire la barre latérale"
                aria-label="Réduire la barre latérale"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className={cn(
          "flex-1 py-3 overflow-y-auto",
          mini ? "px-1 space-y-1 flex flex-col items-center" : "px-2 space-y-1"
        )}>
          {mini
            ? navSections.map((section) => (
                <MiniNavSectionPopover
                  key={section.label}
                  section={section}
                  location={location}
                  badge={formatCount(section.label)}
                  navigate={navigate}
                />
              ))
            : navSections.map((section) => (
                <NavSectionAccordion
                  key={section.label}
                  section={section}
                  location={location}
                  expanded={isExpanded(section.label)}
                  onToggle={() => toggleSection(section.label)}
                  badge={formatCount(section.label)}
                />
              ))}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-border">
          {mini ? (
            /* Mini mode: user avatar with tooltip */
            user && (
              <div className="flex flex-col items-center py-2 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/account">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={user.full_name} className="w-8 h-8 rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors">
                          <User className="w-3.5 h-3.5 text-primary" />
                        </div>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-[10px] opacity-70">{user.role}</p>
                      <p className="text-[10px] opacity-50 mt-0.5">Paramètres du compte</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Déconnexion"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    Déconnexion
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          ) : (
            /* Normal mode: full user info */
            <>
              {user && (
                <div className="px-3 py-2 flex items-center gap-2">
                  <Link href="/account">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={user.full_name} className="w-7 h-7 rounded-md object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity" />
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center shrink-0 cursor-pointer hover:bg-primary/30 transition-colors">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href="/account">
                      <p className="text-xs font-medium text-foreground truncate hover:text-primary transition-colors cursor-pointer">{user.full_name}</p>
                    </Link>
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] text-muted-foreground font-mono">{user.role}</p>
                      {isAdmin && <ShieldCheck className="w-2.5 h-2.5 text-red-400" />}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Déconnexion"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 transition-all duration-200", mini ? "ml-[60px]" : "ml-56")}>
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <ProjectSwitcher />
            {currentProject && (
              <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                {currentProject.domain}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="status-led status-led-success animate-pulse-glow" />
              <span>v0.1.2</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
