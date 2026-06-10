import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/environment", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@/db/usage", () => ({ countDistinctLaunchDays: vi.fn() }));
vi.mock("@/db/profiles", () => ({ countProfiles: vi.fn() }));
vi.mock("@/db/goals", () => ({ countGoals: vi.fn() }));
vi.mock("@/db/metrics", () => ({ countMetrics: vi.fn(), countDistinctMetricDays: vi.fn() }));

import { isTauri } from "@/lib/environment";
import { countDistinctLaunchDays } from "@/db/usage";
import { countProfiles } from "@/db/profiles";
import { countGoals } from "@/db/goals";
import { countMetrics, countDistinctMetricDays } from "@/db/metrics";
import { useTierStore, selectTier, selectNextTier } from "./tier.store";
import { EMPTY_TIER_CONTEXT } from "@/lib/gamification";

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(true);
  useTierStore.setState({ ctx: EMPTY_TIER_CONTEXT, loaded: false });
});

describe("useTierStore.refresh", () => {
  it("uses the top-tier context in browser preview (isTauri false)", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    await useTierStore.getState().refresh();
    const s = useTierStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.ctx.distinctDays).toBe(30);
    expect(s.ctx.activeLogDays).toBe(30);
    expect(s.ctx.profileCount).toBe(2);
    expect(s.ctx.goalCount).toBe(2);
    expect(s.ctx.usedImport).toBe(true);
    expect(s.ctx.allFeaturesUsed).toBe(true);
    expect(countProfiles).not.toHaveBeenCalled();
  });

  it("aggregates db counts into the context (isTauri true)", async () => {
    vi.mocked(countDistinctLaunchDays).mockResolvedValue(8);
    vi.mocked(countDistinctMetricDays).mockResolvedValue(6); // -> activeLogDays
    vi.mocked(countProfiles).mockResolvedValue(2);
    vi.mocked(countGoals).mockResolvedValue(1);
    vi.mocked(countMetrics).mockResolvedValue(10);

    await useTierStore.getState().refresh();
    const s = useTierStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.ctx.distinctDays).toBe(8);
    expect(s.ctx.activeLogDays).toBe(6);
    expect(s.ctx.profileCount).toBe(2);
    expect(s.ctx.goalCount).toBe(1);
    // profiles>0 && metrics>0 && goals>0
    expect(s.ctx.allFeaturesUsed).toBe(true);
    expect(s.ctx.usedImport).toBe(false);
  });

  it("computes allFeaturesUsed false when any feature is unused", async () => {
    vi.mocked(countDistinctLaunchDays).mockResolvedValue(1);
    vi.mocked(countDistinctMetricDays).mockResolvedValue(1);
    vi.mocked(countProfiles).mockResolvedValue(1);
    vi.mocked(countGoals).mockResolvedValue(0); // no goals
    vi.mocked(countMetrics).mockResolvedValue(1);
    await useTierStore.getState().refresh();
    expect(useTierStore.getState().ctx.allFeaturesUsed).toBe(false);
  });

  it("marks loaded even when a counter rejects", async () => {
    vi.mocked(countDistinctLaunchDays).mockRejectedValue(new Error("boom"));
    vi.mocked(countDistinctMetricDays).mockResolvedValue(0);
    vi.mocked(countProfiles).mockResolvedValue(0);
    vi.mocked(countGoals).mockResolvedValue(0);
    vi.mocked(countMetrics).mockResolvedValue(0);
    await useTierStore.getState().refresh();
    expect(useTierStore.getState().loaded).toBe(true);
  });
});

describe("selectTier / selectNextTier", () => {
  it("resolves Starter for an empty context with the next tier being Tracker", () => {
    useTierStore.setState({ ctx: EMPTY_TIER_CONTEXT });
    const s = useTierStore.getState();
    expect(selectTier(s).key).toBe("starter");
    expect(selectNextTier(s)?.key).toBe("tracker");
  });

  it("resolves Tracker once logged on 5+ days", () => {
    useTierStore.setState({ ctx: { ...EMPTY_TIER_CONTEXT, activeLogDays: 5 } });
    const s = useTierStore.getState();
    expect(selectTier(s).key).toBe("tracker");
    // Caretaker is the next earned tier still unreached.
    expect(selectNextTier(s)?.key).toBe("caretaker");
  });

  it("returns null for the next tier at the top of the earned ladder (Champion)", () => {
    useTierStore.setState({
      ctx: {
        ...EMPTY_TIER_CONTEXT,
        distinctDays: 30,
        activeLogDays: 30,
        profileCount: 2,
        goalCount: 2,
        usedImport: true,
        allFeaturesUsed: true,
      },
    });
    const s = useTierStore.getState();
    expect(selectTier(s).key).toBe("champion");
    expect(selectNextTier(s)).toBeNull();
  });
});
