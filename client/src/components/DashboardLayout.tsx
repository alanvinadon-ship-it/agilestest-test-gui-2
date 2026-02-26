import { Link, useLocation } from "wouter";
import { useCallback, useMemo } from "react";
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
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth/AuthContext";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useProject } from "../state/projectStore";
import { useSidebarAccordionState } from "../hooks/useSidebarAccordionState";
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
    ],
  },
  {
    label: "Exécution",
    icon: Play,
    items: [
      { href: "/executions", icon: Play, label: "Exécutions" },
      { href: "/captures", icon: Network, label: "Captures" },
      { href: "/probes", icon: Radio, label: "Sondes" },
    ],
  },
  {
    label: "Drive Test",
    icon: Navigation,
    items: [
      { href: "/drive/campaigns", icon: Navigation, label: "Campagnes" },
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

// ─── Collapsible Nav Section ────────────────────────────────────────────

function NavSectionAccordion({
  section,
  collapsed,
  location,
  expanded,
  onToggle,
}: {
  section: NavSection;
  collapsed: boolean;
  location: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasActiveItem = section.items.some(
    (item) => location === item.href || (item.href !== "/" && location.startsWith(item.href))
  );

  // Flat sections: render items directly without accordion header
  if (section.flat) {
    return (
      <div>
        {!collapsed && (
          <p
            className={cn(
              "px-3 mb-1.5 text-[10px] font-mono font-medium uppercase tracking-widest",
              section.adminOnly ? "text-red-400/70" : "text-muted-foreground"
            )}
          >
            {section.label}
          </p>
        )}
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
                  {!collapsed && <span className="font-medium truncate">{item.label}</span>}
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
      {/* Accordion header */}
      {collapsed ? (
        // When sidebar is collapsed, show section icon as a tooltip trigger
        <div className="flex items-center justify-center py-2">
          <div
            className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
              hasActiveItem
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            title={section.label}
          >
            <section.icon className="w-4 h-4" />
          </div>
        </div>
      ) : (
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
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
              expanded ? "rotate-0" : "-rotate-90"
            )}
          />
          {/* Active indicator dot when collapsed */}
          {hasActiveItem && !expanded && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          )}
        </button>
      )}

      {/* Accordion content */}
      {!collapsed && (
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
      )}
    </div>
  );
}

// ─── Main Layout ────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);
  const { currentProject } = useProject();

  const navSections = useMemo(() => {
    return baseNavSections.filter((s) => !s.adminOnly || isAdmin);
  }, [isAdmin]);

  // Persisted accordion state via uiStorage
  const { isExpanded, toggle: toggleSection } = useSidebarAccordionState(location, navSections);

  return (
    <div className="min-h-screen flex blueprint-grid">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-heading font-bold text-sm">AT</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-heading font-semibold text-sm text-foreground truncate">
                AgilesTest
              </p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
                CLOUD TESTING
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navSections.map((section) => (
            <NavSectionAccordion
              key={section.label}
              section={section}
              collapsed={collapsed}
              location={location}
              expanded={isExpanded(section.label)}
              onToggle={() => toggleSection(section.label)}
            />
          ))}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-border">
          {!collapsed && user && (
            <div className="px-3 py-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{user.full_name}</p>
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
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 transition-all duration-200", collapsed ? "ml-16" : "ml-56")}>
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
