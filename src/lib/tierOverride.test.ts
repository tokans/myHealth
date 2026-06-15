import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ctxForTier, flagsForTier, tierOverride } from "./tierOverride";
import { resolveTier } from "./gamification";

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

describe("tierOverride", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
    // jsdom location.search is read-only; replace it for the test.
    Object.defineProperty(window, "location", {
      value: { ...window.location, search: "", hash: "" },
      writable: true,
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("returns null when nothing is set", () => {
    expect(tierOverride()).toBeNull();
  });

  it("reads a valid tier from the query string and persists it", () => {
    window.location.search = "?tier=caretaker";
    expect(tierOverride()).toBe("caretaker");
    // Persisted, so it survives a reload (no query).
    window.location.search = "";
    expect(tierOverride()).toBe("caretaker");
  });

  it("?tier=clear removes a persisted override", () => {
    localStorage.setItem("myhealth.tierOverride", "champion");
    window.location.search = "?tier=clear";
    expect(tierOverride()).toBeNull();
  });

  it("ignores unknown values", () => {
    window.location.search = "?tier=wizard";
    expect(tierOverride()).toBeNull();
  });

  it("falls back to VITE_TIER", () => {
    vi.stubEnv("VITE_TIER", "tracker");
    expect(tierOverride()).toBe("tracker");
  });
});
