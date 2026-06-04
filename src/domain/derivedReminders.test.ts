import { describe, it, expect } from "vitest";
import { buildHabitReminders } from "./derivedReminders";

describe("buildHabitReminders", () => {
  const base = { day: "2026-06-04", water: [], tasks: [] };

  it("creates a hydration reminder only when below target", () => {
    const out = buildHabitReminders({
      ...base,
      water: [
        { profileId: 1, name: "Asha", glasses: 3, target: 8 },
        { profileId: 2, name: "Ravi", glasses: 8, target: 8 },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.dedupe_key).toBe("water:1:2026-06-04");
    expect(out[0]!.source).toBe("water");
  });

  it("creates a reminder per incomplete task and skips done ones", () => {
    const out = buildHabitReminders({
      ...base,
      tasks: [
        { taskId: 10, profileId: 1, name: "Asha", title: "Walk", done: false },
        { taskId: 11, profileId: 1, name: "Asha", title: "Stretch", done: true },
      ],
    });
    expect(out.map((r) => r.dedupe_key)).toEqual(["task:10:2026-06-04"]);
  });

  it("creates one daily reminder per active medication", () => {
    const out = buildHabitReminders({
      ...base,
      meds: [{ medId: 5, profileId: 1, name: "Asha", drug: "Metformin", strength: "500 mg" }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.dedupe_key).toBe("med:5:2026-06-04");
    expect(out[0]!.title).toBe("Take Metformin (500 mg)");
  });

  it("uses stable keys that are idempotent across calls", () => {
    const input = { ...base, water: [{ profileId: 1, name: "A", glasses: 0, target: 8 }] };
    expect(buildHabitReminders(input)).toEqual(buildHabitReminders(input));
  });
});
