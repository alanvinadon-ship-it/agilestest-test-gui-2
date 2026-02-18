import { Link, useLocation } from "wouter";
import { useCallback } from "react";
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
  LogOut,
  User,
  Package,
  Code2,
  BookOpen,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth/AuthContext";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { useProject } from "../state/projectStore";

const navSections = [
  {
    label: "Général",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/projects", icon: FolderKanban, label: "Projets" },
    ],
  },
  {
    label: "Configuration",
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
    items: [
      { href: "/executions", icon: Play, label: "Exécutions" },
      { href: "/captures", icon: Network, label: "Captures" },
      { href: "/probes", icon: Radio, label: "Sondes" },
    ],
  },
  {
    label: "Aide",
    items: [
      { href: "/docs/user-guide", icon: BookOpen, label: "Documentation" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);
  const { currentProject } = useProject();

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
              <p className="font-heading font-semibold text-sm text-foreground truncate">AgilesTest</p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">CLOUD TESTING</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-widest">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
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
                <p className="text-[10px] text-muted-foreground font-mono">{user.role}</p>
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
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
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
              <span>v0.1.1</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
