/**
 * useSidebarAccordionState — Persists accordion open/closed state via uiStorage.
 *
 * Priority logic:
 *  1) Load persisted state from uiStorage on mount
 *  2) Auto-open the section containing the active route (force open=true)
 *  3) On every user toggle, save to uiStorage
 *
 * Section label → key mapping:
 *  "Configuration"  → configuration
 *  "Exécution"      → execution
 *  "Drive Test"     → driveTest
 *  "Administration" → administration
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { uiGet, uiSet, type SidebarAccordionState } from "@/lib/uiStorage";

/** Maps section labels (from NavSection) to SidebarAccordionState keys */
const LABEL_TO_KEY: Record<string, keyof SidebarAccordionState> = {
  Configuration: "configuration",
  "Exécution": "execution",
  "Drive Test": "driveTest",
  Administration: "administration",
};

const ACCORDION_KEYS = Object.values(LABEL_TO_KEY);

interface NavSectionLike {
  label: string;
  flat?: boolean;
  items: { href: string }[];
}

/**
 * Determine which accordion key (if any) contains the active route.
 */
function findActiveSectionKey(
  location: string,
  sections: NavSectionLike[]
): keyof SidebarAccordionState | null {
  for (const section of sections) {
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

export function useSidebarAccordionState(
  location: string,
  sections: NavSectionLike[]
) {
  // 1) Load persisted state on mount
  const [state, setState] = useState<SidebarAccordionState>(() => {
    const persisted = uiGet("sidebarAccordions");
    // Apply auto-open for the active route on initial load
    const activeKey = findActiveSectionKey(location, sections);
    if (activeKey) {
      return { ...persisted, [activeKey]: true };
    }
    return persisted;
  });

  // Track previous location to detect navigation
  const prevLocationRef = useRef(location);

  // 2) Auto-open section when navigating to a new route
  useEffect(() => {
    if (location === prevLocationRef.current) return;
    prevLocationRef.current = location;

    const activeKey = findActiveSectionKey(location, sections);
    if (activeKey && !state[activeKey]) {
      setState((prev) => {
        const next = { ...prev, [activeKey]: true };
        uiSet("sidebarAccordions", next);
        return next;
      });
    }
  }, [location, sections, state]);

  // 3) Toggle handler — persists to uiStorage
  const toggle = useCallback(
    (label: string) => {
      const key = LABEL_TO_KEY[label];
      if (!key) return;
      setState((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        uiSet("sidebarAccordions", next);
        return next;
      });
    },
    []
  );

  // Check if a section is expanded (by label)
  const isExpanded = useCallback(
    (label: string): boolean => {
      const key = LABEL_TO_KEY[label];
      if (!key) return false;
      return state[key];
    },
    [state]
  );

  return { isExpanded, toggle, state };
}

// Export for testing
export { LABEL_TO_KEY, findActiveSectionKey, ACCORDION_KEYS };
export type { NavSectionLike };
