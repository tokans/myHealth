/**
 * Live gating flags. Start locked; `refresh()` recomputes from the app's own data;
 * a browser/dev preview treats everything as unlocked (so previews aren't stuck on
 * a locked screen). Store pattern comes from `sharedcorelib/gating`.
 */
import { createGatingStore } from "sharedcorelib/gating";
import { useShallow } from "zustand/react/shallow";
import { countProfiles } from "@/db/profiles";
import { countGoals } from "@/db/goals";
import { countMetrics, countDistinctMetricDays } from "@/db/metrics";
import { countDistinctLaunchDays } from "@/db/usage";
import { reachedTier, EMPTY_TIER_CONTEXT, type TierKey } from "@/lib/gamification";
import { tierOverride, flagsForTier } from "@/lib/tierOverride";
import { grantStatus } from "@/grant/receiver";
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
  // A received Supporter/Pro grant unlocks every feature (donation only accelerates
  // the free ladder — see src/grant/receiver.ts). Skips the per-feature computation.
  override: async () => {
    const g = grantStatus();
    return g.supporter || g.pro;
  },
  computeFlags: async () => {
    // Dev/QA: a tier override pins the gates (also handled in the refresh wrapper
    // below for the browser-preview path, which skips computeFlags entirely).
    const override = tierOverride.get() as TierKey | null;
    if (override) return flagsForTier(override);
    // Hot-path short-circuit: refresh() runs after nearly every data mutation, and the
    // count below includes a full-table `COUNT(DISTINCT substr(taken_at,…))` scan. Earned
    // tiers are cumulative (usage-driven) and never regress once cleared, so once every
    // flag is set there is nothing left to compute — skip the five COUNT queries entirely.
    const cur = useGatingStore.getState();
    if (
      cur.loaded &&
      cur.hasProfile &&
      cur.hasMetric &&
      cur.hasGoal &&
      cur.isTracker &&
      cur.isCaretaker &&
      cur.isChampion
    ) {
      return UNLOCKED_ALL;
    }
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

/**
 * Subscribe to ONLY the six gating flags (shallow-compared), not the whole store.
 *
 * `useGatingStore()` with no selector re-renders its consumer on every state change,
 * including the new `refresh` closure and `loaded` toggle. Since `refresh()` is called
 * after nearly every data mutation and AppShell wraps every route, that caused a
 * whole-app re-render on each "log a vital / add a med". This narrow shallow selector
 * re-renders a consumer only when a flag's VALUE actually changes (tier crossings),
 * which is rare. Use this in render-path consumers (AppShell, FeatureGuard, Content).
 */
export const useGatingFlags = (): GatingFlags =>
  useGatingStore(
    useShallow((s) => ({
      hasProfile: s.hasProfile,
      hasMetric: s.hasMetric,
      hasGoal: s.hasGoal,
      isTracker: s.isTracker,
      isCaretaker: s.isCaretaker,
      isChampion: s.isChampion,
    })),
  );

// In a browser preview the shared store unlocks everything before `computeFlags`
// runs, so pin the override here too — this makes a tier override behave identically
// in `npm run dev` and `npm run tauri:dev`.
const _baseRefresh = useGatingStore.getState().refresh;
useGatingStore.setState({
  refresh: async () => {
    const override = tierOverride.get() as TierKey | null;
    if (override) {
      useGatingStore.setState({ ...flagsForTier(override), loaded: true });
      return;
    }
    await _baseRefresh();
  },
});
