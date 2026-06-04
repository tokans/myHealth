/**
 * Live gating flags. Start locked; `refresh()` recomputes from the app's own data;
 * a browser/dev preview treats everything as unlocked (so previews aren't stuck on
 * a locked screen). Store pattern comes from `sharedcorelib/gating`.
 */
import { createGatingStore } from "sharedcorelib/gating";
import { countProfiles } from "@/db/profiles";
import { countGoals } from "@/db/goals";
import { countMetrics, countDistinctMetricDays } from "@/db/metrics";
import { countDistinctLaunchDays } from "@/db/usage";
import { reachedTier, EMPTY_TIER_CONTEXT } from "@/lib/gamification";
import type { GatingFlags } from "@/lib/featureGate";

const UNLOCKED_ALL: GatingFlags = {
  hasProfile: true,
  hasMetric: true,
  hasGoal: true,
  isTracker: true,
  isCaretaker: true,
  isChampion: true,
};

const LOCKED: GatingFlags = {
  hasProfile: false,
  hasMetric: false,
  hasGoal: false,
  isTracker: false,
  isCaretaker: false,
  isChampion: false,
};

export const useGatingStore = createGatingStore<GatingFlags>({
  initialFlags: LOCKED,
  unlockedAll: UNLOCKED_ALL,
  computeFlags: async () => {
    const [profiles, metrics, goals, logDays, days] = await Promise.all([
      countProfiles(),
      countMetrics(),
      countGoals(),
      countDistinctMetricDays(),
      countDistinctLaunchDays(),
    ]);
    const ctx = {
      ...EMPTY_TIER_CONTEXT,
      distinctDays: days,
      activeLogDays: logDays,
      profileCount: profiles,
      goalCount: goals,
      allFeaturesUsed: profiles > 0 && metrics > 0 && goals > 0,
    };
    return {
      hasProfile: profiles > 0,
      hasMetric: metrics > 0,
      hasGoal: goals > 0,
      isTracker: reachedTier("tracker", ctx),
      isCaretaker: reachedTier("caretaker", ctx),
      isChampion: reachedTier("champion", ctx),
    };
  },
});
