import { describe, it, expect } from "vitest";
import { defaultWaterGlasses, hydrationPct } from "./water";

describe("defaultWaterGlasses", () => {
  it("falls back to 8 when weight is unknown or invalid", () => {
    expect(defaultWaterGlasses()).toBe(8);
    expect(defaultWaterGlasses(null)).toBe(8);
    expect(defaultWaterGlasses(0)).toBe(8);
    expect(defaultWaterGlasses(-5)).toBe(8);
  });

  it("computes ~35 ml/kg ÷ 250 ml/glass, rounded", () => {
    expect(defaultWaterGlasses(70)).toBe(10); // 2450/250 = 9.8 → 10
    expect(defaultWaterGlasses(60)).toBe(8); //  2100/250 = 8.4 → 8
  });

  it("clamps to the 4–14 glass range", () => {
    expect(defaultWaterGlasses(20)).toBe(4); // would be ~3 → clamp up
    expect(defaultWaterGlasses(200)).toBe(14); // would be 28 → clamp down
  });
});

describe("hydrationPct", () => {
  it("is a clamped 0–100 percentage of target", () => {
    expect(hydrationPct(4, 8)).toBe(50);
    expect(hydrationPct(0, 8)).toBe(0);
    expect(hydrationPct(8, 8)).toBe(100);
    expect(hydrationPct(12, 8)).toBe(100); // over target clamps to 100
  });

  it("returns 0 for a non-positive target", () => {
    expect(hydrationPct(5, 0)).toBe(0);
    expect(hydrationPct(5, -1)).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    expect(hydrationPct(1, 3)).toBe(33);
    expect(hydrationPct(2, 3)).toBe(67);
  });
});
