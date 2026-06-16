/**
 * Single owner of the live TierContext. Aggregates local-only signals (launch
 * days, active log days, profile/goal counts, feature usage) so the shell badge,
 * the "Your journey" strip, and feature gates all read one picture.
 */
import { create } from "zustand";
import { isTauri } from "@/lib/environment";
import { tierOverride, ctxForTier } from "@/lib/tierOverride";
import { countDistinctLaunchDays } from "@/db/usage";
import { countProfiles } from "@/db/profiles";
import { countGoals } from "@/db/goals";
import { countMetrics, countDistinctMetricDays } from "@/db/metrics";
import { grantStatus } from "@/grant/receiver";
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
    // Dev/QA: a tier override wins over real signals, in every environment.
    const override = tierOverride();
    if (override) {
      set({ ctx: ctxForTier(override), loaded: true });
      return;
    }
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
      // Grant tiers come from a received, signed grant file (receive-only — see
      // src/grant/receiver.ts). Absent ⇒ both false (earned ladder only).
      const grant = grantStatus();
      set({
        ctx: {
          distinctDays: days,
          activeLogDays: logDays,
          profileCount: profiles,
          goalCount: goals,
          usedImport: false, // wired in Phase 2 (import)
          allFeaturesUsed,
          isSupporter: grant.supporter,
          isPro: grant.pro,
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

/**
 * Selector: is this install entitled to the PAID multi-user surfaces (decision 15)?
 * Multi-user (the login-capable member switch + person-linked gating) is paid-gated; in
 * myHealth the paid/grant signals are the grant-backed Supporter/Pro tiers. A free
 * install has both false, so the paid `userSwitch` chrome never mounts (invariant 3) and
 * the no-login family profiles (decision 18) remain the only person switcher.
 */
export function selectMultiUserEntitled(s: TierState): boolean {
  return s.ctx.isSupporter || s.ctx.isPro;
}
