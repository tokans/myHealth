import { describe, it, expect, afterEach, vi } from "vitest";
import { ageFromDob, EMERGENCY_DISCLAIMER } from "./emergency";

describe("ageFromDob", () => {
  afterEach(() => vi.useRealTimers());

  function freeze(y: number, m: number, d: number) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, m, d, 12, 0, 0)); // local "now"
  }

  it("returns null for null / unparseable input", () => {
    expect(ageFromDob(null)).toBeNull();
    expect(ageFromDob("not-a-date")).toBeNull();
  });

  it("computes whole years, accounting for whether the birthday has passed", () => {
    freeze(2026, 5, 7); // 2026-06-07
    expect(ageFromDob("2000-06-07")).toBe(26); // birthday today
    expect(ageFromDob("2000-06-06")).toBe(26); // birthday yesterday
    expect(ageFromDob("2000-06-08")).toBe(25); // birthday tomorrow
    expect(ageFromDob("2000-12-31")).toBe(25); // later in the year
  });

  it("returns 0 for an infant born this year", () => {
    freeze(2026, 5, 7);
    expect(ageFromDob("2026-01-01")).toBe(0);
  });

  it("returns null for a future date of birth", () => {
    freeze(2026, 5, 7);
    expect(ageFromDob("2030-01-01")).toBeNull();
  });
});

describe("EMERGENCY_DISCLAIMER", () => {
  it("states it is not medical advice", () => {
    expect(EMERGENCY_DISCLAIMER).toMatch(/does not provide medical advice/i);
  });
});
