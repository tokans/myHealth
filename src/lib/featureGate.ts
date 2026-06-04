/**
 * Feature gates + the three visibility states that drive progressive disclosure.
 *
 *   - Open:  isUnlocked(flags) === true → render normally.
 *   - Nudge: locked, but shown with a one-line CTA telling the user the single
 *            next action that opens it (lockBehavior: "nudge").
 *   - Hidden: locked and NOT rendered at all until the tier is reached
 *            (lockBehavior: "hide") — so newcomers never see heavy features.
 *
 * The gate shape + store come from the shared core (`sharedcorelib/gating`); this
 * file supplies myHealth's flag shape, gate copy, and lock behavior.
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
  | "trends"
  | "import"
  | "directory"
  | "sync"
  | "items";

export interface HealthGate extends FeatureGate<GatingFlags, GateKey> {
  /** Whether a locked feature is teased (nudge) or fully hidden until unlock. */
  lockBehavior: "nudge" | "hide";
}

export const GATES: Record<GateKey, HealthGate> = {
  goals: {
    key: "goals",
    isUnlocked: (f) => f.hasMetric,
    lockBehavior: "nudge",
    lockedTitle: "Set a health goal",
    unlockHint: "Log a metric first so we have a baseline.",
    ctaLabel: "Log a metric",
    ctaTo: "/metrics",
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
    lockBehavior: "nudge",
    lockedTitle: "Plan your day",
    unlockHint: "Do a few days of tasks to unlock the schedule.",
    ctaLabel: "Go to Today",
    ctaTo: "/",
  },
  trends: {
    key: "trends",
    isUnlocked: (f) => f.isTracker,
    lockBehavior: "hide",
    lockedTitle: "Trends & charts",
    unlockHint: "Reach the Tracker tier to see trends.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  medications: {
    key: "medications",
    isUnlocked: (f) => f.isTracker,
    lockBehavior: "hide",
    lockedTitle: "Medications",
    unlockHint: "Reach the Tracker tier to track medications.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  import: {
    key: "import",
    isUnlocked: (f) => f.isCaretaker,
    lockBehavior: "hide",
    lockedTitle: "Import documents",
    unlockHint: "Reach the Caretaker tier to import prescriptions & lab reports.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  directory: {
    key: "directory",
    isUnlocked: (f) => f.isCaretaker,
    lockBehavior: "hide",
    lockedTitle: "Find professionals",
    unlockHint: "Reach the Caretaker tier (and once curated data is published).",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  sync: {
    key: "sync",
    isUnlocked: (f) => f.isChampion,
    lockBehavior: "hide",
    lockedTitle: "Sync across devices",
    unlockHint: "Reach the Champion tier to sync over your Wi-Fi.",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
  items: {
    key: "items",
    isUnlocked: (f) => f.isChampion,
    lockBehavior: "hide",
    lockedTitle: "Health items",
    unlockHint: "Reach the Champion tier (and once curated data is published).",
    ctaLabel: "View your journey",
    ctaTo: "/journey",
  },
};
