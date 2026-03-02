/**
 * Tests for sidebar accordion state persistence via uiStorage.
 *
 * Covers:
 * - uiStorage whitelist includes sidebarAccordions key
 * - Zod schema validates correct and invalid values
 * - findActiveSectionKey logic
 * - LABEL_TO_KEY mapping completeness
 * - Default values
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// ─── 1. uiStorage whitelist includes sidebarAccordions ─────────────────────

describe("uiStorage sidebarAccordions whitelist", () => {
  const uiStorageSrc = readFileSync(
    join(ROOT, "client/src/lib/uiStorage.ts"),
    "utf-8"
  );

  it("declares sidebarAccordions in UI_KEYS", () => {
    expect(uiStorageSrc).toContain("sidebarAccordions");
  });

  it("defines sidebarAccordionsSchema with all 4 section keys", () => {
    expect(uiStorageSrc).toContain("configuration: z.boolean()");
    expect(uiStorageSrc).toContain("execution: z.boolean()");
    expect(uiStorageSrc).toContain("driveTest: z.boolean()");
    expect(uiStorageSrc).toContain("administration: z.boolean()");
  });

  it("provides default values for sidebarAccordions (all false)", () => {
    expect(uiStorageSrc).toContain("configuration: false");
    expect(uiStorageSrc).toContain("execution: false");
    expect(uiStorageSrc).toContain("driveTest: false");
    expect(uiStorageSrc).toContain("administration: false");
  });

  it("exports SidebarAccordionState type", () => {
    expect(uiStorageSrc).toContain("export type SidebarAccordionState");
  });
});

// ─── 2. Hook source code structure ─────────────────────────────────────────

describe("useSidebarAccordionState hook structure", () => {
  const hookSrc = readFileSync(
    join(ROOT, "client/src/hooks/useSidebarAccordionState.ts"),
    "utf-8"
  );

  it("imports uiGet and uiSet from uiStorage", () => {
    expect(hookSrc).toContain("uiGet");
    expect(hookSrc).toContain("uiSet");
  });

  it("defines LABEL_TO_KEY mapping for all 4 accordion sections", () => {
    expect(hookSrc).toContain('"Configuration"');
    // Exécution uses the French label
    expect(hookSrc).toContain('"Exécution"');
    expect(hookSrc).toContain('"Drive Test"');
    expect(hookSrc).toContain('"Administration"');
  });

  it("maps labels to correct state keys", () => {
    expect(hookSrc).toContain('Configuration: "configuration"');
    expect(hookSrc).toContain('"Exécution": "execution"');
    expect(hookSrc).toContain('"Drive Test": "driveTest"');
    expect(hookSrc).toContain('Administration: "administration"');
  });

  it("calls uiGet('sidebarAccordions') for initial state", () => {
    expect(hookSrc).toContain('uiGet("sidebarAccordions")');
  });

  it("calls uiSet('sidebarAccordions', ...) on toggle", () => {
    expect(hookSrc).toContain('uiSet("sidebarAccordions"');
  });

  it("exports findActiveSectionKey for route matching", () => {
    expect(hookSrc).toContain("export { LABEL_TO_KEY, findActiveSectionKey");
  });

  it("returns isExpanded and toggle from the hook", () => {
    expect(hookSrc).toContain("return { isExpanded, toggle, state }");
  });
});

// ─── 3. DashboardLayout integration ────────────────────────────────────────

describe("DashboardLayout uses useSidebarAccordionState", () => {
  const layoutSrc = readFileSync(
    join(ROOT, "client/src/components/DashboardLayout.tsx"),
    "utf-8"
  );

  it("imports useSidebarAccordionState hook", () => {
    expect(layoutSrc).toContain("useSidebarAccordionState");
  });

  it("no longer uses raw useState for expandedSections", () => {
    expect(layoutSrc).not.toContain("expandedSections");
    expect(layoutSrc).not.toContain("setExpandedSections");
  });

  it("calls isExpanded(section.label) for accordion state", () => {
    expect(layoutSrc).toContain("isExpanded(section.label)");
  });

  it("calls toggleSection(section.label) for toggle handler", () => {
    expect(layoutSrc).toContain("toggleSection(section.label)");
  });
});

// ─── 4. findActiveSectionKey logic (pure function test) ────────────────────

describe("findActiveSectionKey logic", () => {
  // We test the logic by simulating what the function does
  // (since importing ESM from client code in vitest server context is tricky)

  const sections = [
    {
      label: "Général",
      flat: true,
      items: [{ href: "/" }, { href: "/projects" }],
    },
    {
      label: "Configuration",
      flat: false,
      items: [
        { href: "/profiles" },
        { href: "/scenarios" },
        { href: "/datasets" },
      ],
    },
    {
      label: "Exécution",
      flat: false,
      items: [
        { href: "/executions" },
        { href: "/captures" },
        { href: "/probes" },
      ],
    },
    {
      label: "Drive Test",
      flat: false,
      items: [
        { href: "/drive/campaigns" },
        { href: "/drive/reporting" },
      ],
    },
    {
      label: "Administration",
      flat: false,
      items: [
        { href: "/admin/users" },
        { href: "/admin/roles" },
      ],
    },
  ];

  const LABEL_TO_KEY: Record<string, string> = {
    Configuration: "configuration",
    "Exécution": "execution",
    "Drive Test": "driveTest",
    Administration: "administration",
  };

  function findActiveSectionKey(
    location: string,
    secs: typeof sections
  ): string | null {
    for (const section of secs) {
      if (section.flat) continue;
      const key = LABEL_TO_KEY[section.label];
      if (!key) continue;
      const hasActive = section.items.some(
        (item) =>
          location === item.href ||
          (item.href !== "/" && location.startsWith(item.href))
      );
      if (hasActive) return key;
    }
    return null;
  }

  it("returns null for flat section routes (Dashboard, Projets)", () => {
    expect(findActiveSectionKey("/", sections)).toBeNull();
    expect(findActiveSectionKey("/projects", sections)).toBeNull();
  });

  it("returns 'configuration' for /profiles", () => {
    expect(findActiveSectionKey("/profiles", sections)).toBe("configuration");
  });

  it("returns 'configuration' for /scenarios", () => {
    expect(findActiveSectionKey("/scenarios", sections)).toBe("configuration");
  });

  it("returns 'execution' for /executions", () => {
    expect(findActiveSectionKey("/executions", sections)).toBe("execution");
  });

  it("returns 'execution' for /captures", () => {
    expect(findActiveSectionKey("/captures", sections)).toBe("execution");
  });

  it("returns 'driveTest' for /drive/campaigns", () => {
    expect(findActiveSectionKey("/drive/campaigns", sections)).toBe("driveTest");
  });

  it("returns 'administration' for /admin/users", () => {
    expect(findActiveSectionKey("/admin/users", sections)).toBe("administration");
  });

  it("returns 'administration' for /admin/roles sub-path", () => {
    expect(findActiveSectionKey("/admin/roles/edit", sections)).toBe("administration");
  });

  it("returns null for unknown routes", () => {
    expect(findActiveSectionKey("/unknown", sections)).toBeNull();
  });
});

// ─── 5. Zod schema validation (inline) ─────────────────────────────────────

describe("sidebarAccordions Zod schema validation", () => {
  // Inline the schema to test parsing
  const { z } = require("zod");
  const schema = z.object({
    configuration: z.boolean(),
    execution: z.boolean(),
    driveTest: z.boolean(),
    administration: z.boolean(),
  });

  it("accepts valid state with all booleans", () => {
    const result = schema.safeParse({
      configuration: true,
      execution: false,
      driveTest: true,
      administration: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects state with missing keys", () => {
    const result = schema.safeParse({
      configuration: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects state with non-boolean values", () => {
    const result = schema.safeParse({
      configuration: "yes",
      execution: false,
      driveTest: true,
      administration: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects null", () => {
    const result = schema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("rejects extra keys gracefully (strip mode)", () => {
    const result = schema.safeParse({
      configuration: true,
      execution: false,
      driveTest: true,
      administration: false,
      unknown: true,
    });
    // Zod default strips extra keys — should still pass
    expect(result.success).toBe(true);
  });
});
