import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The household sweep raises ONE OS notification covering every profile, so each line
 * must say for whom it's meant. We assert the titles handed to the shared sweep engine
 * (which builds the notification body from `r.title`) are prefixed with the person's
 * name when there's more than one profile, and left alone for a single profile.
 */

vi.mock("@/lib/environment", () => ({ isTauri: () => true }));

const fx = vi.hoisted(() => ({
  profiles: [] as any[],
  open: [] as any[],
  titles: [] as string[],
}));

// Capture the reminders the app feeds the engine via its `listOpen` adapter.
vi.mock("sharedcorelib/reminders", () => ({
  runReminderSweep: async (a: any) => {
    const open = await a.listOpen();
    fx.titles = open.map((r: any) => r.title);
    return open.length;
  },
}));

vi.mock("@/db/profiles", () => ({ listProfiles: async () => fx.profiles }));
vi.mock("@/db/reminders", () => ({
  listOpenReminders: async () => fx.open,
  markReminderFired: vi.fn(),
  syncDerivedReminders: vi.fn(),
}));
// Imported by the module (only reached via syncDerived, which our mock never calls).
vi.mock("@/db/water", () => ({ getWaterDay: vi.fn() }));
vi.mock("@/db/tasks", () => ({ listTasksForToday: vi.fn() }));
vi.mock("@/db/medications", () => ({ listAllActiveMedications: vi.fn() }));

import { runHabitReminderSweep } from "./reminderSweep";

beforeEach(() => {
  fx.profiles.length = 0;
  fx.open.length = 0;
  fx.titles = [];
});

describe("runHabitReminderSweep — notification names the person", () => {
  it("prefixes each reminder with its owner's name when there are multiple profiles", async () => {
    fx.profiles.push({ id: 1, name: "Asha" }, { id: 2, name: "Ravi" });
    fx.open.push({ id: 10, profile_id: 1, title: "Drink water — 2/8 glasses" });
    fx.open.push({ id: 11, profile_id: 2, title: "Take Metformin (500 mg)" });
    await runHabitReminderSweep();
    expect(fx.titles).toEqual([
      "Asha: Drink water — 2/8 glasses",
      "Ravi: Take Metformin (500 mg)",
    ]);
  });

  it("leaves titles unadorned when there is only one profile (self is obvious)", async () => {
    fx.profiles.push({ id: 1, name: "Asha" });
    fx.open.push({ id: 10, profile_id: 1, title: "Drink water" });
    await runHabitReminderSweep();
    expect(fx.titles).toEqual(["Drink water"]);
  });

  it("leaves a reminder with no/unknown profile untouched", async () => {
    fx.profiles.push({ id: 1, name: "Asha" }, { id: 2, name: "Ravi" });
    fx.open.push({ id: 10, profile_id: null, title: "Generic nudge" });
    await runHabitReminderSweep();
    expect(fx.titles).toEqual(["Generic nudge"]);
  });
});
