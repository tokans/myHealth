import { describe, it, expect, afterEach, vi } from "vitest";
import { localToday, minutesToHHMM, hhmmToMinutes, cn } from "./utils";

describe("localToday", () => {
  afterEach(() => vi.useRealTimers());

  it("formats the local date as YYYY-MM-DD with zero padding", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0)); // Jan 5 2026, local
    expect(localToday()).toBe("2026-01-05");
  });

  it("pads two-digit months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 23, 9, 30, 0)); // Nov 23 2026
    expect(localToday()).toBe("2026-11-23");
  });
});

describe("minutesToHHMM", () => {
  it("converts minutes-from-midnight to HH:MM", () => {
    expect(minutesToHHMM(0)).toBe("00:00");
    expect(minutesToHHMM(90)).toBe("01:30");
    expect(minutesToHHMM(8 * 60 + 5)).toBe("08:05");
    expect(minutesToHHMM(23 * 60 + 59)).toBe("23:59");
  });
});

describe("hhmmToMinutes", () => {
  it("parses HH:MM to minutes-from-midnight", () => {
    expect(hhmmToMinutes("00:00")).toBe(0);
    expect(hhmmToMinutes("01:30")).toBe(90);
    expect(hhmmToMinutes("08:05")).toBe(485);
  });

  it("is the inverse of minutesToHHMM", () => {
    for (const m of [0, 1, 59, 60, 485, 1439]) {
      expect(hhmmToMinutes(minutesToHHMM(m))).toBe(m);
    }
  });

  it("returns 0 on malformed input", () => {
    expect(hhmmToMinutes("")).toBe(0);
    expect(hhmmToMinutes("notatime")).toBe(0);
  });
});

describe("cn", () => {
  it("merges class names (re-exported from shared ui)", () => {
    expect(typeof cn).toBe("function");
    expect(cn("a", false && "b", "c")).toContain("a");
    expect(cn("a", "c")).toContain("c");
  });
});
