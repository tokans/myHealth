import { describe, it, expect } from "vitest";
import { METRIC_KINDS, metricKind } from "./metricKinds";

describe("metricKind", () => {
  it("looks up a kind by key", () => {
    expect(metricKind("weight")?.label).toBe("Weight");
    expect(metricKind("weight")?.unit).toBe("kg");
    expect(metricKind("spo2")?.direction).toBe("increase");
  });

  it("returns undefined for an unknown kind", () => {
    expect(metricKind("nonexistent")).toBeUndefined();
  });
});

describe("METRIC_KINDS config", () => {
  it("has unique kind keys", () => {
    const kinds = METRIC_KINDS.map((m) => m.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("every entry has a label, unit and a valid direction", () => {
    for (const m of METRIC_KINDS) {
      expect(m.label).toBeTruthy();
      expect(m.unit).toBeTruthy();
      expect(["decrease", "increase", "maintain"]).toContain(m.direction);
    }
  });
});
