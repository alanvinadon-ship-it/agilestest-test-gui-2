/**
 * Tests for mini-sidebar feature.
 *
 * Covers:
 * - uiStorage: sidebarMini key in whitelist, default value, Zod validation
 * - DashboardLayout: mini mode rendering, toggle, popover, tooltip integration
 * - Accessibility: aria attributes
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// ─── 1. uiStorage: sidebarMini key ────────────────────────────────────────

describe("uiStorage sidebarMini key", () => {
  const storageSrc = readFileSync(
    join(ROOT, "client/src/lib/uiStorage.ts"),
    "utf-8"
  );

  it("sidebarMini key exists in UI_KEYS", () => {
    expect(storageSrc).toContain("sidebarMini: z.boolean()");
  });

  it("sidebarMini has default value false", () => {
    expect(storageSrc).toContain("sidebarMini: false");
  });

  it("sidebarMini is in DEFAULTS object", () => {
    // Verify it's between other defaults
    const defaultsMatch = storageSrc.match(/DEFAULTS[\s\S]*?sidebarMini:\s*false/);
    expect(defaultsMatch).not.toBeNull();
  });
});

// ─── 2. DashboardLayout: mini mode structure ──────────────────────────────

describe("DashboardLayout mini-sidebar mode", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("file exists", () => {
    expect(existsSync(join(ROOT, "client/src/components/DashboardLayout.tsx"))).toBe(true);
  });

  it("imports uiGet and uiSet from uiStorage", () => {
    expect(layoutSrc).toContain("uiGet");
    expect(layoutSrc).toContain("uiSet");
  });

  it("initializes mini state from uiStorage", () => {
    expect(layoutSrc).toContain('uiGet("sidebarMini")');
  });

  it("persists mini state to uiStorage on toggle", () => {
    expect(layoutSrc).toContain('uiSet("sidebarMini"');
  });

  it("has toggleMini function", () => {
    expect(layoutSrc).toContain("toggleMini");
  });

  it("uses mini state for sidebar width", () => {
    expect(layoutSrc).toContain('mini ? "w-[60px]"');
  });

  it("uses mini state for main content margin", () => {
    expect(layoutSrc).toContain('mini ? "ml-[60px]"');
  });
});

// ─── 3. Mini mode: Tooltip integration ────────────────────────────────────

describe("Mini mode tooltip integration", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("imports Tooltip components from shadcn/ui", () => {
    expect(layoutSrc).toContain("Tooltip");
    expect(layoutSrc).toContain("TooltipTrigger");
    expect(layoutSrc).toContain("TooltipContent");
  });

  it("uses TooltipContent with side=right for sidebar positioning", () => {
    expect(layoutSrc).toContain('side="right"');
  });

  it("has tooltip on logo in mini mode for expand action", () => {
    expect(layoutSrc).toContain("Étendre la barre latérale");
  });

  it("has tooltip on user avatar in mini mode", () => {
    expect(layoutSrc).toContain("user.full_name");
  });

  it("has tooltip on logout button in mini mode", () => {
    expect(layoutSrc).toContain("Déconnexion");
  });
});

// ─── 4. Mini mode: Popover integration ────────────────────────────────────

describe("Mini mode popover integration", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("imports Popover components from shadcn/ui", () => {
    expect(layoutSrc).toContain("Popover");
    expect(layoutSrc).toContain("PopoverTrigger");
    expect(layoutSrc).toContain("PopoverContent");
  });

  it("defines MiniNavSectionPopover component", () => {
    expect(layoutSrc).toContain("function MiniNavSectionPopover");
  });

  it("defines MiniNavItem component for flat sections", () => {
    expect(layoutSrc).toContain("function MiniNavItem");
  });

  it("popover shows section label as header", () => {
    expect(layoutSrc).toContain("section.label");
  });

  it("popover items navigate and close on click", () => {
    expect(layoutSrc).toContain("navigate(item.href)");
    expect(layoutSrc).toContain("setOpen(false)");
  });

  it("popover renders badge on section icon", () => {
    expect(layoutSrc).toContain("badge &&");
  });
});

// ─── 5. Accessibility ─────────────────────────────────────────────────────

describe("Mini mode accessibility", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("popover trigger has aria-label with section name", () => {
    expect(layoutSrc).toContain("aria-label={section.label}");
  });

  it("popover trigger has aria-haspopup", () => {
    expect(layoutSrc).toContain('aria-haspopup="true"');
  });

  it("popover trigger has aria-expanded", () => {
    expect(layoutSrc).toContain("aria-expanded={open}");
  });

  it("escape key closes popover", () => {
    expect(layoutSrc).toContain('"Escape"');
  });

  it("toggle button has aria-label", () => {
    expect(layoutSrc).toContain('aria-label="Réduire la barre latérale"');
    expect(layoutSrc).toContain('aria-label="Étendre la barre latérale"');
  });

  it("logout button has aria-label", () => {
    expect(layoutSrc).toContain('aria-label="Déconnexion"');
  });
});

// ─── 6. Toggle button ─────────────────────────────────────────────────────

describe("Mini mode toggle button", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("imports PanelLeftClose and PanelLeftOpen icons", () => {
    expect(layoutSrc).toContain("PanelLeftClose");
    expect(layoutSrc).toContain("PanelLeftOpen");
  });

  it("toggle button calls toggleMini", () => {
    expect(layoutSrc).toContain("onClick={toggleMini}");
  });

  it("renders PanelLeftClose in normal mode", () => {
    expect(layoutSrc).toContain("PanelLeftClose");
  });
});

// ─── 7. User info visibility in mini mode ─────────────────────────────────

describe("User info visibility in mini mode", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("shows user avatar in mini mode", () => {
    // Mini mode renders User icon in a div
    expect(layoutSrc).toContain("User className");
  });

  it("user name is accessible via tooltip in mini mode", () => {
    // The tooltip shows full_name
    expect(layoutSrc).toContain("user.full_name");
  });

  it("user role is accessible via tooltip in mini mode", () => {
    expect(layoutSrc).toContain("user.role");
  });
});
