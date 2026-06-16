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
 * The gate shape, the store, AND the one-tier-ahead disclosure rule all come from
 * the shared core (`sharedcorelib/gating`); this file supplies myHealth's flag
 * shape, gate copy, tier/lock metadata, and the app's tier ranking.
 */
import {
  gateVisibility as coreGateVisibility,
  tierVisibility as coreTierVisibility,
  type TieredGate,
  type TierDisclosure,
  type GateVisibility,
} from "sharedcorelib/gating";

export type { GateVisibility };

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
  | "directory"
  | "sync"
  | "items";

/** Earned tiers a feature can require. Ordered low → high (grant tiers don't gate disclosure). */
export type EarnedTier = "tracker" | "caretaker" | "champion";

/**
 * A myHealth feature gate = the core {@link TieredGate} specialised to our flags,
 * gate keys, and earned tiers. `tier` (one-tier-ahead disclosure) and `lockBehavior`
 * (static, for prerequisite gates) come from the core type and stay mutually exclusive.
 */
export type HealthGate = TieredGate<GatingFlags, GateKey, EarnedTier>;

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

/** myHealth's tier knowledge, injected into the core disclosure resolvers. */
const DISCLOSURE: TierDisclosure<GatingFlags, EarnedTier> = {
  rankOf: (tier) => TIER_RANK[tier],
  clearedRank: earnedRank,
};

/**
 * Progressive-disclosure visibility for an earned TIER (the core one-tier-ahead
 * rule with myHealth's ranking): open at/above the tier, nudge exactly one tier
 * ahead, hidden further down. Used by tier-gated features (`gateVisibility`) and
 * the dynamic content tabs (each carries a `tier`).
 */
export function tierVisibility(tier: EarnedTier, flags: GatingFlags): GateVisibility {
  return coreTierVisibility(tier, flags, DISCLOSURE);
}

/**
 * Progressive-disclosure visibility for a gate (by key). Tier gates defer to
 * {@link tierVisibility}; prerequisite (data-presence) gates honor their static
 * `lockBehavior`.
 */
export function gateVisibility(gateKey: GateKey, flags: GatingFlags): GateVisibility {
  return coreGateVisibility(GATES[gateKey], flags, DISCLOSURE);
}
