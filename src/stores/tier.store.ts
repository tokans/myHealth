/**
 * Single owner of the live TierContext. Aggregates local-only signals (launch
 * days, active log days, profile/goal counts, feature usage) so the shell badge,
 * the "Your journey" strip, and feature gates all read one picture.
 */
import { create } from "zustand";
import { isTauri } from "@/lib/environment";
import { countDistinctLaunchDays } from "@/db/usage";
import { countProfiles } from "@/db/profiles";
import { countGoals } from "@/db/goals";
import { countMetrics, countDistinctMetricDays } from "@/db/metrics";
import {
  EMPTY_TIER_CONTEXT,
  resolveTier,
  nextEarnedTiers,
  type Tier,
  type TierContext,
} from "@/lib/gamification";

interface TierState {
  ctx: TierContext;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const useTierStore = create<TierState>((set) => ({
  ctx: EMPTY_TIER_CONTEXT,
  loaded: false,
  refresh: async () => {
    if (!isTauri()) {
      // Browser/dev preview: show the top tier so nothing is hidden in preview.
      set({
        ctx: {
          ...EMPTY_TIER_CONTEXT,
          distinctDays: 30,
          activeLogDays: 30,
          profileCount: 2,
          goalCount: 2,
          usedImport: true,
          allFeaturesUsed: true,
        },
        loaded: true,
      });
      return;
    }
    try {
      const [days, logDays, profiles, goals, metrics] = await Promise.all([
        countDistinctLaunchDays(),
        countDistinctMetricDays(),
        countProfiles(),
        countGoals(),
        countMetrics(),
      ]);
      const allFeaturesUsed = profiles > 0 && metrics > 0 && goals > 0;
      set({
        ctx: {
          distinctDays: days,
          activeLogDays: logDays,
          profileCount: profiles,
          goalCount: goals,
          usedImport: false, // wired in Phase 2 (import)
          allFeaturesUsed,
          isSupporter: false, // wired in Phase 4 (patron file)
          isPro: false,
        },
        loaded: true,
      });
    } catch (e) {
      console.error("Failed to refresh tier state:", e);
      set({ loaded: true });
    }
  },
}));

/** Convenience selector: the resolved tier for the current context. */
export function selectTier(s: TierState): Tier {
  return resolveTier(s.ctx);
}

/** Selector: the next earned tier to aim for (or null at the top). */
export function selectNextTier(s: TierState): Tier | null {
  return nextEarnedTiers(s.ctx)[0] ?? null;
}
