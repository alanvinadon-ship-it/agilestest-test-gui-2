/**
 * useSidebarCounts — Fetches badge counts for sidebar sections via tRPC.
 *
 * Refetch intervals:
 *  - If runningExecutions > 0 or redProbes > 0: every 10s (active monitoring)
 *  - Otherwise: every 60s (idle polling)
 */
import { trpc } from "@/lib/trpc";

/** Section label → count field mapping */
export type SidebarCountKey = "runningExecutions" | "pendingInvites" | "activeDriveSessions" | "redProbes";

const SECTION_COUNT_MAP: Record<string, SidebarCountKey> = {
  "Exécution": "runningExecutions",
  Administration: "pendingInvites",
  "Drive Test": "activeDriveSessions",
};

/** Refetch interval in ms */
const ACTIVE_INTERVAL = 10_000;  // 10s when executions running
const IDLE_INTERVAL = 60_000;    // 60s otherwise

export function useSidebarCounts() {
  const { data, isLoading } = trpc.ui.sidebarCounts.useQuery(undefined, {
    refetchInterval: (query) => {
      const counts = query.state.data;
      if (counts && (counts.runningExecutions > 0 || counts.redProbes > 0)) {
        return ACTIVE_INTERVAL;
      }
      return IDLE_INTERVAL;
    },
    staleTime: 5_000, // Consider data fresh for 5s
  });

  const counts = data ?? {
    runningExecutions: 0,
    pendingInvites: 0,
    activeDriveSessions: 0,
    redProbes: 0,
  };

  /**
   * Get the badge count for a sidebar section label.
   * For "Exécution" section: combines running executions + red probes.
   * Returns 0 if no mapping exists or count is 0.
   */
  function getCount(sectionLabel: string): number {
    const key = SECTION_COUNT_MAP[sectionLabel];
    if (!key) return 0;
    const base = counts[key] ?? 0;
    // For Exécution section, also include red probes
    if (sectionLabel === "Exécution") {
      return base + (counts.redProbes ?? 0);
    }
    return base;
  }

  /**
   * Format count for display: 0 → null (no badge), >99 → "99+"
   */
  function formatCount(sectionLabel: string): string | null {
    const count = getCount(sectionLabel);
    if (count <= 0) return null;
    if (count > 99) return "99+";
    return String(count);
  }

  return { counts, isLoading, getCount, formatCount };
}

export { SECTION_COUNT_MAP, ACTIVE_INTERVAL, IDLE_INTERVAL };
