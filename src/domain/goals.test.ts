import { describe, it, expect } from "vitest";
import { projectGoal, type GoalPoint, type GoalSpec } from "./goals";

const weightLoss: GoalSpec = { baseline: 80, target: 72, direction: "decrease", targetDate: "2026-12-01" };

describe("projectGoal", () => {
  it("reports no_data when there are no points and no baseline value", () => {
    const p = projectGoal([], { baseline: null, target: 72, direction: "decrease" });
    expect(p.status).toBe("no_data");
  });

  it("computes progress and a forward ETA when trending toward target", () => {
    // 80 → 78 over 20 days = -0.1/day; 6 kg remaining → ~60 days out.
    const pts: GoalPoint[] = [
      { date: "2026-06-01", value: 80 },
      { date: "2026-06-21", value: 78 },
    ];
    const p = projectGoal(pts, weightLoss);
    expect(p.current).toBe(78);
    expect(p.perDay).toBeCloseTo(-0.1, 5);
    expect(Math.round(p.progressPct)).toBe(25); // 2 of 8 kg
    expect(p.etaDate).toBe("2026-08-20");
    expect(p.status).toBe("on_track");
  });

  it("flags behind when moving away from target", () => {
    const pts: GoalPoint[] = [
      { date: "2026-06-01", value: 80 },
      { date: "2026-06-21", value: 82 },
    ];
    const p = projectGoal(pts, weightLoss);
    expect(p.etaDate).toBeNull();
    expect(p.status).toBe("behind");
  });

  it("marks achieved once the target is met", () => {
    const p = projectGoal([{ date: "2026-06-01", value: 71 }], weightLoss);
    expect(p.status).toBe("achieved");
    expect(p.progressPct).toBe(100);
  });
});
