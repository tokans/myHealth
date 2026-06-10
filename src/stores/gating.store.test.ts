import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/environment", () => ({ isTauri: vi.fn(() => true) }));
// The shared factory imports isTauri from the package's env entry; mock that too
// so refresh() takes the in-Tauri branch (computeFlags) when we want it to.
vi.mock("sharedcorelib/env", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@/db/profiles", () => ({ countProfiles: vi.fn() }));
vi.mock("@/db/goals", () => ({ countGoals: vi.fn() }));
vi.mock("@/db/metrics", () => ({ countMetrics: vi.fn(), countDistinctMetricDays: vi.fn() }));
vi.mock("@/db/usage", () => ({ countDistinctLaunchDays: vi.fn() }));

import { isTauri as sharedIsTauri } from "sharedcorelib/env";
import { countProfiles } from "@/db/profiles";
import { countGoals } from "@/db/goals";
import { countMetrics, countDistinctMetricDays } from "@/db/metrics";
import { countDistinctLaunchDays } from "@/db/usage";
import { useGatingStore } from "./gating.store";

const LOCKED = {
  hasProfile: false,
  hasMetric: false,
  hasGoal: false,
  isTracker: false,
  isCaretaker: false,
  isChampion: false,
};

function setCounts(c: {
  profiles?: number;
  metrics?: number;
  goals?: number;
  metricDays?: number;
  launchDays?: number;
}) {
  vi.mocked(countProfiles).mockResolvedValue(c.profiles ?? 0);
  vi.mocked(countMetrics).mockResolvedValue(c.metrics ?? 0);
  vi.mocked(countGoals).mockResolvedValue(c.goals ?? 0);
  vi.mocked(countDistinctMetricDays).mockResolvedValue(c.metricDays ?? 0);
  vi.mocked(countDistinctLaunchDays).mockResolvedValue(c.launchDays ?? 0);
}

beforeEach(() => {
  vi.mocked(sharedIsTauri).mockReturnValue(true);
  useGatingStore.setState({ ...LOCKED, loaded: false });
});

describe("useGatingStore.refresh (browser preview)", () => {
  it("unlocks everything when not in Tauri", async () => {
    vi.mocked(sharedIsTauri).mockReturnValue(false);
    await useGatingStore.getState().refresh();
    const s = useGatingStore.getState();
    expect(s.hasProfile).toBe(true);
    expect(s.hasMetric).toBe(true);
    expect(s.hasGoal).toBe(true);
    expect(s.isTracker).toBe(true);
    expect(s.isCaretaker).toBe(true);
    expect(s.isChampion).toBe(true);
    expect(s.loaded).toBe(true);
    expect(countProfiles).not.toHaveBeenCalled();
  });
});

describe("useGatingStore.refresh (computeFlags from db counts)", () => {
  it("reflects presence flags from counts and stays below Tracker", async () => {
    setCounts({ profiles: 1, metrics: 2, goals: 0, metricDays: 1, launchDays: 1 });
    await useGatingStore.getState().refresh();
    const s = useGatingStore.getState();
    expect(s.hasProfile).toBe(true);
    expect(s.hasMetric).toBe(true);
    expect(s.hasGoal).toBe(false);
    expect(s.isTracker).toBe(false);
    expect(s.isCaretaker).toBe(false);
    expect(s.isChampion).toBe(false);
    expect(s.loaded).toBe(true);
  });

  it("sets isTracker once logged on 5+ days (Tracker threshold)", async () => {
    setCounts({ profiles: 1, metrics: 5, goals: 0, metricDays: 5, launchDays: 5 });
    await useGatingStore.getState().refresh();
    const s = useGatingStore.getState();
    expect(s.isTracker).toBe(true);
    expect(s.isCaretaker).toBe(false);
    expect(s.isChampion).toBe(false);
  });

  it("leaves all flags locked for an empty database", async () => {
    setCounts({});
    await useGatingStore.getState().refresh();
    const s = useGatingStore.getState();
    expect(s.hasProfile).toBe(false);
    expect(s.hasMetric).toBe(false);
    expect(s.hasGoal).toBe(false);
    expect(s.isTracker).toBe(false);
    expect(s.loaded).toBe(true);
  });

  it("sets isChampion when every Champion criterion is met", async () => {
    // champion: distinctDays>=20 && allFeaturesUsed && profileCount>=2 && goalCount>=2
    setCounts({ profiles: 2, metrics: 10, goals: 2, metricDays: 20, launchDays: 20 });
    await useGatingStore.getState().refresh();
    const s = useGatingStore.getState();
    expect(s.isChampion).toBe(true);
    expect(s.isTracker).toBe(true);
  });
});
