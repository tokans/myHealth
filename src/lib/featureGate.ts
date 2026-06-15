/**
 * Feature gates + the three visibility states that drive progressive disclosure.
 *
 *   - Open:  isUnlocked(flags) === true → render normally.
 *   - Nudge: locked, but shown with a one-line CTA telling the user the single
 *            next action that opens it.
 *   - Hidden: locked and NOT rendered at all until it comes into view — so
 *            newcomers never see features that are several tiers away.
 *
 * Visibility is computed by the "one tier ahead" rule (see `gateVisibility`):
 * a tier-gated feature is teased (nudge) only to users EXACTLY one tier below it
 * and HIDDEN to anyone further down. So a Starter sees Tracker features locked but
 * nothing of Caretaker; a Tracker sees Caretaker locked but nothing of Champion;
 * and so on. Prerequisite gates (e.g. "add a family member") are not tiered and
 * carry a static `lockBehavior` instead.
 *
 * The gate shape + store come from the shared core (`sharedcorelib/gating`); this
 * file supplies myHealth's flag shape, gate copy, and tier/lock metadata.
 */
import type { FeatureGate } from "sharedcorelib/gating";

/** Boolean prerequisites progressive features gate on (computed in gating.store). */
export interface GatingFlags {
  /** A profile exists (gates "add a family member"). */
  hasProfile: boolean;
  /** At least one metric logged (gates goal-setting). */
  hasMetric: boolean;
  /** At least one active goal. */
  hasGoal: boolean;
  /** Tier bars. */
  isTracker: boolean;
  isCaretaker: boolean;
  isChampion: boolean;
}

export type GateKey =
  | "goals"
  | "family"
  | "schedule"
  | "medications"
  | "documents"
  | "ice"
  | "trends"
  | "yoga"
  | "directory"
  | "sync"
  | "items";

/** Earned tiers a feature can require. Ordered low → high (grant tiers don't gate disclosure). */
export type EarnedTier = "tracker" | "caretaker" | "champion";

export interface HealthGate extends FeatureGate<GatingFlags, GateKey> {
  /**
   * The earned tier this feature unlocks at. When set, visibility follows the
   * "one tier ahead" rule (`gateVisibility`): teased (nudge) one tier below,
   * hidden further down. Mutually exclusive with `lockBehavior`.
   */
  tier?: EarnedTier;
  /**
   * Static lock behavior for a PREREQUISITE (non-tier) gate — e.g. "add a family
   * member" depends on having your own profile, not on a tier. Ignored when
   * `tier` is set.
   */
  lockBehavior?: "nudge" | "hide";
}

export const GATES: Record<GateKey, HealthGate> = {
  goals: {
    key: "goals",
    isUnlocked: (f) => f.isTracker,
    tier: "tracker",
    lockedTitle: "Set a health goal",
    unlockHint: "Reach the Tracker tier to set goals with a projected ETA.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  family: {
    key: "family",
    isUnlocked: (f) => f.hasProfile,
    lockBehavior: "nudge",
    lockedTitle: "Add a family member",
    unlockHint: "Finish your own profile first.",
    ctaLabel: "Set up your profile",
    ctaTo: "/profiles",
  },
  schedule: {
    key: "schedule",
    isUnlocked: (f) => f.isTracker,
    tier: "tracker",
    lockedTitle: "Plan your day",
    unlockHint: "Reach the Tracker tier to unlock the schedule.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  trends: {
    key: "trends",
    isUnlocked: (f) => f.isTracker,
    tier: "tracker",
    lockedTitle: "Trends & charts",
    unlockHint: "Reach the Tracker tier to see trends.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  yoga: {
    key: "yoga",
    isUnlocked: (f) => f.isTracker,
    tier: "tracker",
    lockedTitle: "Yoga sequences",
    unlockHint: "Reach the Tracker tier to follow guided yoga sequences.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  medications: {
    key: "medications",
    isUnlocked: (f) => f.isCaretaker,
    tier: "caretaker",
    lockedTitle: "Medications",
    unlockHint: "Reach the Caretaker tier to track medications.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  documents: {
    key: "documents",
    isUnlocked: (f) => f.isCaretaker,
    tier: "caretaker",
    lockedTitle: "Document vault",
    unlockHint: "Reach the Caretaker tier to store encrypted reports & prescriptions.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  ice: {
    key: "ice",
    isUnlocked: (f) => f.isCaretaker,
    tier: "caretaker",
    lockedTitle: "Medical ICE card",
    unlockHint: "Reach the Caretaker tier to build a shareable emergency medical card.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  directory: {
    key: "directory",
    isUnlocked: (f) => f.isChampion,
    tier: "champion",
    lockedTitle: "Find professionals",
    unlockHint: "Reach the Champion tier (and once curated data is published).",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  sync: {
    key: "sync",
    isUnlocked: (f) => f.isChampion,
    tier: "champion",
    lockedTitle: "Sync across devices",
    unlockHint: "Reach the Champion tier to sync over your Wi-Fi.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  items: {
    key: "items",
    isUnlocked: (f) => f.isChampion,
    tier: "champion",
    lockedTitle: "Health items",
    unlockHint: "Reach the Champion tier (and once curated data is published).",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
};

/** Earned-tier ladder rank (1-based; 0 = Starter). Grant tiers are excluded. */
const TIER_RANK: Record<EarnedTier, number> = { tracker: 1, caretaker: 2, champion: 3 };

/** The highest earned-tier rank the user currently clears (0 = Starter). */
function earnedRank(flags: GatingFlags): number {
  let rank = 0;
  if (flags.isTracker) rank = Math.max(rank, TIER_RANK.tracker);
  if (flags.isCaretaker) rank = Math.max(rank, TIER_RANK.caretaker);
  if (flags.isChampion) rank = Math.max(rank, TIER_RANK.champion);
  return rank;
}

export type GateVisibility = "open" | "nudge" | "hidden";

/**
 * Progressive-disclosure visibility for a gate given the live flags:
 *
 *   open   — unlocked; render normally.
 *   nudge  — locked but teased with a CTA; shown ONLY one tier ahead.
 *   hidden — locked and not rendered; two or more tiers ahead.
 *
 * Tier gates reveal exactly one tier at a time, so the surface grows with the
 * user. Prerequisite gates fall back to their static `lockBehavior`.
 */
export function gateVisibility(gateKey: GateKey, flags: GatingFlags): GateVisibility {
  const gate = GATES[gateKey];
  if (gate.isUnlocked(flags)) return "open";
  if (gate.tier) {
    // Tease the next tier up (gap === 1); hide anything further up the ladder.
    return TIER_RANK[gate.tier] - earnedRank(flags) <= 1 ? "nudge" : "hidden";
  }
  // Prerequisite (data-presence) gate: honor its static behavior.
  return gate.lockBehavior === "nudge" ? "nudge" : "hidden";
}
