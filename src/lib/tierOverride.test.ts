import { describe, it, expect } from "vitest";
import { ctxForTier, flagsForTier } from "./tierOverride";
import { resolveTier } from "./gamification";

// The override SOURCE reader (`?tier=` → localStorage → start tier + `allowed()`) now lives in
// sharedCoreLib (`sharedcorelib/ui` createTierOverride, pure resolver in `sharedcorelib/tiers`)
// and is covered by that package's tests. Here we test only the app-specific tier→context and
// tier→flags mappings that stayed in myHealth.

describe("ctxForTier", () => {
  it("synthesizes a context that resolves to the requested tier", () => {
    expect(resolveTier(ctxForTier("starter")).key).toBe("starter");
    expect(resolveTier(ctxForTier("tracker")).key).toBe("tracker");
    expect(resolveTier(ctxForTier("caretaker")).key).toBe("caretaker");
    expect(resolveTier(ctxForTier("champion")).key).toBe("champion");
    // Grant tiers outrank earned tiers.
    expect(resolveTier(ctxForTier("supporter")).key).toBe("supporter");
    expect(resolveTier(ctxForTier("pro")).key).toBe("pro");
  });

  it("does not over-reach: tracker is below caretaker", () => {
    const ctx = ctxForTier("tracker");
    expect(ctx.profileCount).toBeLessThan(2);
    expect(ctx.usedImport).toBe(false);
  });
});

describe("flagsForTier", () => {
  it("locks everything at starter", () => {
    expect(flagsForTier("starter")).toMatchObject({
      isTracker: false,
      isCaretaker: false,
      isChampion: false,
    });
  });

  it("opens tracker features (and data-presence flags) at tracker", () => {
    expect(flagsForTier("tracker")).toMatchObject({
      hasProfile: true,
      hasGoal: true,
      isTracker: true,
      isCaretaker: false,
      isChampion: false,
    });
  });

  it("opens everything at champion", () => {
    expect(flagsForTier("champion")).toMatchObject({
      isTracker: true,
      isCaretaker: true,
      isChampion: true,
    });
  });
});
