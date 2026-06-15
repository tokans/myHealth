import { describe, it, expect } from "vitest";
import { referenceRange, flagValue, summariseSeries, type TrendPoint } from "./trends";

const pts = (...vals: number[]): TrendPoint[] =>
  vals.map((value, i) => ({ date: `2026-06-${String(i + 1).padStart(2, "0")}`, value }));

describe("referenceRange", () => {
  it("returns a band for kinds with universal ranges", () => {
    expect(referenceRange("spo2")).toEqual({ low: 95, high: 100 });
    expect(referenceRange("heart_rate")).toEqual({ low: 60, high: 100 });
  });
  it("returns null for kinds without a universal range", () => {
    expect(referenceRange("weight")).toBeNull();
    expect(referenceRange("steps")).toBeNull();
    expect(referenceRange("unknown_kind")).toBeNull();
  });
});

describe("flagValue", () => {
  it("flags below / in / above the band", () => {
    expect(flagValue("heart_rate", 50)).toBe("below");
    expect(flagValue("heart_rate", 72)).toBe("in");
    expect(flagValue("heart_rate", 120)).toBe("above");
  });
  it("is inclusive at the band edges", () => {
    expect(flagValue("spo2", 95)).toBe("in");
    expect(flagValue("spo2", 100)).toBe("in");
  });
  it("is unknown when there's no band", () => {
    expect(flagValue("weight", 70)).toBe("unknown");
  });
});

describe("summariseSeries", () => {
  const weight = { kind: "weight", direction: "decrease" } as const;
  const spo2 = { kind: "spo2", direction: "increase" } as const;
  const temp = { kind: "temperature", direction: "maintain" } as const;

  it("returns an empty summary for no points", () => {
    const s = summariseSeries(weight, []);
    expect(s.count).toBe(0);
    expect(s.current).toBeNull();
    expect(s.delta).toBeNull();
    expect(s.direction).toBe("steady");
  });

  it("a single point has a current but no delta/direction", () => {
    const s = summariseSeries(weight, pts(80));
    expect(s.count).toBe(1);
    expect(s.current).toBe(80);
    expect(s.delta).toBeNull();
    expect(s.direction).toBe("steady");
  });

  it("computes current/first/delta/min/max across a series", () => {
    const s = summariseSeries(weight, pts(82, 80, 78));
    expect(s.first).toBe(82);
    expect(s.current).toBe(78);
    expect(s.delta).toBe(-4);
    expect(s.min).toBe(78);
    expect(s.max).toBe(82);
    expect(s.direction).toBe("falling");
  });

  it("falling weight is good; falling SpO₂ is bad (sentiment follows metric direction)", () => {
    expect(summariseSeries(weight, pts(82, 78)).sentiment).toBe("good");
    expect(summariseSeries(spo2, pts(99, 95)).sentiment).toBe("bad");
    expect(summariseSeries(spo2, pts(95, 99)).sentiment).toBe("good");
  });

  it("maintain metrics are always neutral", () => {
    expect(summariseSeries(temp, pts(36.5, 37.0)).sentiment).toBe("neutral");
  });

  it("treats sub-1% movement as steady", () => {
    const s = summariseSeries(weight, pts(80.0, 80.2)); // 0.25% < 1%
    expect(s.direction).toBe("steady");
    expect(s.sentiment).toBe("neutral");
  });

  it("reports the latest reading's range flag", () => {
    expect(summariseSeries(spo2, pts(98, 92)).latestFlag).toBe("below");
    expect(summariseSeries(spo2, pts(92, 98)).latestFlag).toBe("in");
  });
});
