/**
 * Dev/QA tier override — start the app at ANY tier to test progressive disclosure
 * without grinding the real unlock criteria (launch days, active log days, etc.).
 *
 * Sources, first match wins (all LOCAL-only, never transmitted):
 *   1. URL query   ?tier=champion         e.g. http://localhost:1420/?tier=champion#/
 *   2. localStorage  "myhealth.tierOverride"  (a URL param persists here, so it survives
 *                                              reloads + in-app navigation)
 *   3. env         VITE_TIER=champion      (baked when you start dev / build)
 *
 * Valid values: starter | tracker | caretaker | champion | supporter | pro.
 * Use ?tier=clear (or off/empty) to remove a persisted override.
 *
 * Honored in `npm run dev` / `npm run tauri:dev` ALWAYS; in a PRODUCTION build only
 * when VITE_ALLOW_TIER_OVERRIDE="1", so it can never leak into shipped installers.
 */
import { createTierOverride } from "sharedcorelib/ui";
import {
  EMPTY_TIER_CONTEXT,
  reachedTier,
  type TierContext,
  type TierKey,
} from "@/lib/gamification";
import type { GatingFlags } from "@/lib/featureGate";

const VALID: TierKey[] = ["starter", "tracker", "caretaker", "champion", "supporter", "pro"];

/**
 * The shared dev/test tier override (source reader + persistence + `allowed()`). The env flags
 * are injected here — the shared lib never reads `import.meta.env` itself. Source precedence is
 * URL `?tier=` → localStorage → build-time start tier (`VITE_TIER`). `tierOverride.get()` returns
 * the active override key (or null); `tierOverride.allowed()` reports whether overrides are
 * honored (dev build, or the `VITE_ALLOW_TIER_OVERRIDE="1"` prod escape hatch).
 */
export const tierOverride = createTierOverride({
  storageKey: "myhealth.tierOverride",
  validKeys: VALID,
  env: {
    dev: import.meta.env.DEV,
    allowInProd: import.meta.env.VITE_ALLOW_TIER_OVERRIDE === "1",
    startTier: import.meta.env.VITE_TIER,
  },
});

/**
 * A synthetic TierContext that clears the target tier's bar (and every earned bar
 * below it), so the badge, journey strip, and all feature gates behave as if the
 * user genuinely reached that tier.
 */
export function ctxForTier(key: TierKey): TierContext {
  const championBase: TierContext = {
    ...EMPTY_TIER_CONTEXT,
    distinctDays: 20,
    activeLogDays: 20,
    profileCount: 2,
    goalCount: 2,
    usedImport: true,
    allFeaturesUsed: true,
  };
  switch (key) {
    case "starter":
      return { ...EMPTY_TIER_CONTEXT };
    case "tracker":
      return { ...EMPTY_TIER_CONTEXT, activeLogDays: 5 };
    case "caretaker":
      return {
        ...EMPTY_TIER_CONTEXT,
        activeLogDays: 5,
        profileCount: 2,
        distinctDays: 8,
        usedImport: true,
      };
    case "champion":
      return championBase;
    case "supporter":
      return { ...championBase, isSupporter: true };
    case "pro":
      return { ...championBase, isPro: true };
  }
}

/** The gating flags implied by an override tier (mirrors gating.store's computeFlags). */
export function flagsForTier(key: TierKey): GatingFlags {
  const ctx = ctxForTier(key);
  const isTracker = reachedTier("tracker", ctx);
  return {
    // Data-presence flags: a real user at Tracker+ has these, so unlock them too.
    hasProfile: ctx.profileCount > 0 || isTracker,
    hasMetric: ctx.allFeaturesUsed || isTracker,
    hasGoal: ctx.goalCount > 0 || isTracker,
    isTracker,
    isCaretaker: reachedTier("caretaker", ctx),
    isChampion: reachedTier("champion", ctx),
  };
}
