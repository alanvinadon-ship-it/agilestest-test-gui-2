import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ClipboardCheck,
  Network,
  Gauge,
  ListChecks,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", shortLabel: "Dash" },
  { href: "/vabf", icon: ClipboardCheck, label: "VABF / VSR", shortLabel: "VABF" },
  { href: "/span", icon: Network, label: "Capture SPAN", shortLabel: "SPAN" },
  { href: "/vabe", icon: Gauge, label: "VABE Charge", shortLabel: "VABE" },
  { href: "/checklists", icon: ListChecks, label: "Checklists", shortLabel: "Check" },
  { href: "/config", icon: Settings, label: "Configuration", shortLabel: "Config" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-heading font-bold text-sm">AT</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-heading font-semibold text-sm text-foreground truncate">AgilesTest</p>
              <p className="text-[10px] text-muted-foreground font-mono tracking-wider">TEST CONSOLE</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary glow-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="font-medium truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-10 flex items-center justify-center border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 transition-all duration-200", collapsed ? "ml-16" : "ml-56")}>
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-semibold text-lg text-foreground">
              {navItems.find(n => n.href === location || (n.href !== "/" && location.startsWith(n.href)))?.label ?? "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="status-led status-led-success animate-pulse-glow" />
              <span>v0.1.1</span>
            </div>
            <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs font-heading font-bold">OC</span>
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
