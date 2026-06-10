import { describe, it, expect } from "vitest";
import {
  resolveTier,
  reachedTier,
  nextEarnedTiers,
  TIERS,
  EMPTY_TIER_CONTEXT,
  type TierContext,
} from "./gamification";

const ctx = (over: Partial<TierContext> = {}): TierContext => ({ ...EMPTY_TIER_CONTEXT, ...over });

describe("resolveTier", () => {
  it("starts everyone at Starter", () => {
    expect(resolveTier(EMPTY_TIER_CONTEXT).key).toBe("starter");
  });

  it("reaches Tracker via 5 active log days, or 3 days + a goal", () => {
    expect(resolveTier(ctx({ activeLogDays: 5 })).key).toBe("tracker");
    expect(resolveTier(ctx({ activeLogDays: 3, goalCount: 1 })).key).toBe("tracker");
    expect(resolveTier(ctx({ activeLogDays: 3 })).key).toBe("starter"); // 3 days, no goal
  });

  it("reaches Caretaker with family + ~a month active + an import", () => {
    expect(resolveTier(ctx({ profileCount: 2, distinctDays: 8, usedImport: true, activeLogDays: 5 })).key).toBe(
      "caretaker",
    );
    // missing the import keeps it below Caretaker
    expect(resolveTier(ctx({ profileCount: 2, distinctDays: 8, usedImport: false, activeLogDays: 5 })).key).toBe(
      "tracker",
    );
  });

  it("reaches Champion with the full data-presence proxy", () => {
    const champ = ctx({
      distinctDays: 20,
      activeLogDays: 20,
      profileCount: 2,
      goalCount: 2,
      usedImport: true,
      allFeaturesUsed: true,
    });
    expect(resolveTier(champ).key).toBe("champion");
  });

  it("grant tiers outrank earned tiers", () => {
    expect(resolveTier(ctx({ isSupporter: true })).key).toBe("supporter");
    expect(resolveTier(ctx({ isPro: true })).key).toBe("pro");
    // pro is last in the ladder, so it wins over supporter
    expect(resolveTier(ctx({ isSupporter: true, isPro: true })).key).toBe("pro");
  });
});

describe("reachedTier", () => {
  it("checks a specific tier's own bar regardless of higher tiers", () => {
    expect(reachedTier("tracker", ctx({ activeLogDays: 5 }))).toBe(true);
    expect(reachedTier("caretaker", ctx({ activeLogDays: 5 }))).toBe(false);
    expect(reachedTier("starter", EMPTY_TIER_CONTEXT)).toBe(true);
  });
});

describe("nextEarnedTiers", () => {
  it("lists the not-yet-reached earned tiers ascending", () => {
    const next = nextEarnedTiers(EMPTY_TIER_CONTEXT).map((t) => t.key);
    expect(next[0]).toBe("tracker");
    expect(next).not.toContain("supporter"); // grant tiers excluded
    expect(next).not.toContain("starter"); // already reached
  });

  it("is empty once Champion is reached", () => {
    const champ = ctx({
      distinctDays: 20,
      activeLogDays: 20,
      profileCount: 2,
      goalCount: 2,
      usedImport: true,
      allFeaturesUsed: true,
    });
    expect(nextEarnedTiers(champ)).toEqual([]);
  });
});

describe("TIERS config", () => {
  it("has unique keys and the grant tiers flagged", () => {
    const keys = TIERS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(TIERS.find((t) => t.key === "supporter")?.grant).toBe(true);
    expect(TIERS.find((t) => t.key === "pro")?.grant).toBe(true);
  });
});
