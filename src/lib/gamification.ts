/**
 * myHealth engagement tiers — the progressive-disclosure ladder.
 *
 * The app opens minimal (Starter) and earns the user into depth as they use it,
 * so a newcomer is never intimidated. The ladder + predicates are app-specific
 * (below); the resolution MECHANISM (highest-reached, specific-bar check, next-up
 * list) comes from the shared core (`sharedcorelib/tiers`).
 *
 * Earned: Starter → Tracker → Caretaker → Champion. Grant-only: Supporter
 * (donation) and Verified Pro (professional), placed last so they outrank earned
 * tiers. All unlock signals are LOCAL-ONLY telemetry — never transmitted.
 */
import { Sprout, LineChart, Compass, Award, Heart, BadgeCheck, type LucideIcon } from "lucide-react";
import {
  resolveTier as resolveTierGeneric,
  tierReached,
  nextEarnedTiers as nextEarnedGeneric,
  type TierDef,
} from "sharedcorelib/tiers";

/** Everything a tier predicate can depend on. Assembled by stores/tier.store.ts. */
export interface TierContext {
  /** Distinct local calendar days the app has been opened. */
  distinctDays: number;
  /** Distinct local days on which the user logged data (metrics/water/tasks). */
  activeLogDays: number;
  /** Number of health profiles (self + family). */
  profileCount: number;
  /** Active goals count. */
  goalCount: number;
  /** Has the user run a document import at least once. */
  usedImport: boolean;
  /** Every core feature touched once (the Champion data-presence proxy). */
  allFeaturesUsed: boolean;
  /** Granted via a signed donation file. */
  isSupporter: boolean;
  /** Granted to a verified health professional. */
  isPro: boolean;
}

export type TierKey = "starter" | "tracker" | "caretaker" | "champion" | "supporter" | "pro";

export interface Tier extends TierDef<TierContext> {
  key: TierKey;
  icon: LucideIcon;
  /** Tailwind text colour for the badge/icon. */
  className: string;
}

/** Low → high. Resolution walks highest-first; grant tiers placed last outrank earned. */
export const TIERS: Tier[] = [
  {
    key: "starter",
    label: "Starter",
    icon: Sprout,
    className: "text-emerald-600 dark:text-emerald-400",
    criteria: "Just getting started — log a few things to begin your journey.",
    reached: () => true,
  },
  {
    key: "tracker",
    label: "Tracker",
    icon: LineChart,
    className: "text-sky-600 dark:text-sky-400",
    criteria: "Log on 5 different days (or log on 3 days and set a goal).",
    reached: (ctx) =>
      ctx.activeLogDays >= 5 || (ctx.activeLogDays >= 3 && ctx.goalCount >= 1),
  },
  {
    key: "caretaker",
    label: "Caretaker",
    icon: Compass,
    className: "text-violet-600 dark:text-violet-400",
    criteria: "Add a family member, stay active for ~a month, and import a report.",
    reached: (ctx) => ctx.profileCount >= 2 && ctx.distinctDays >= 8 && ctx.usedImport,
  },
  {
    key: "champion",
    label: "Champion",
    icon: Award,
    className: "text-amber-600 dark:text-amber-400",
    criteria: "Open the app on 20 days, use every feature, and track 2+ people with goals.",
    reached: (ctx) =>
      ctx.distinctDays >= 20 && ctx.allFeaturesUsed && ctx.profileCount >= 2 && ctx.goalCount >= 2,
  },
  {
    key: "supporter",
    label: "Supporter",
    icon: Heart,
    className: "text-rose-600 dark:text-rose-400",
    criteria: "Support the project with a donation.",
    grant: true,
    reached: (ctx) => ctx.isSupporter,
  },
  {
    key: "pro",
    label: "Verified Pro",
    icon: BadgeCheck,
    className: "text-teal-600 dark:text-teal-400",
    criteria: "Verified health professional.",
    grant: true,
    reached: (ctx) => ctx.isPro,
  },
];

export const EMPTY_TIER_CONTEXT: TierContext = {
  distinctDays: 0,
  activeLogDays: 0,
  profileCount: 0,
  goalCount: 0,
  usedImport: false,
  allFeaturesUsed: false,
  isSupporter: false,
  isPro: false,
};

/** The highest tier the context qualifies for. */
export function resolveTier(ctx: TierContext): Tier {
  return resolveTierGeneric(TIERS, ctx);
}

/** Whether the context clears one specific tier's own bar (e.g. gate device sync on Champion). */
export function reachedTier(key: TierKey, ctx: TierContext): boolean {
  return tierReached(TIERS, key, ctx);
}

/** Earned tiers not yet reached, ascending — the "next up" list for the journey strip. */
export function nextEarnedTiers(ctx: TierContext): Tier[] {
  return nextEarnedGeneric(TIERS, ctx);
}
