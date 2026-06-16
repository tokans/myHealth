import { describe, it, expect } from "vitest";
import {
  totalDurationSec,
  formatDuration,
  mergeEntries,
  focusTags,
  bundleEntries,
  stepImage,
  type ContentEntry,
  type ContentBundle,
} from "./model";

const entry = (id: string, over: Partial<ContentEntry> = {}): ContentEntry => ({
  id,
  name: id,
  summary: "s",
  source: "baked",
  steps: [],
  ...over,
});

describe("durations", () => {
  it("sums step durations, missing ones as zero", () => {
    const e = entry("a", {
      steps: [
        { title: "x", instruction: "i", durationSec: 30 },
        { title: "y", instruction: "i" },
        { title: "z", instruction: "i", durationSec: 90 },
      ],
    });
    expect(totalDurationSec(e)).toBe(120);
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(125)).toBe("2m 5s");
  });
});

describe("stepImage", () => {
  it("returns the image URL or undefined", () => {
    expect(stepImage({ title: "x", instruction: "i", image: "data:image/svg+xml,x" })).toBe("data:image/svg+xml,x");
    expect(stepImage({ title: "x", instruction: "i" })).toBeUndefined();
  });
});

describe("mergeEntries", () => {
  it("keeps baked first and drops id collisions (baked wins)", () => {
    const baked = [entry("a", { name: "Baked A" })];
    const downloaded = [entry("a", { name: "Bundle A", source: "bundle" }), entry("b", { source: "bundle" })];
    const merged = mergeEntries(baked, downloaded);
    expect(merged.map((e) => e.id)).toEqual(["a", "b"]);
    expect(merged[0]!.name).toBe("Baked A");
  });
});

describe("bundleEntries", () => {
  it("flattens bundles and tags source + bundleId", () => {
    const bundles: ContentBundle[] = [
      { bundleId: "p", name: "P", version: 1, entries: [entry("p1"), entry("p2")] },
    ];
    const flat = bundleEntries(bundles);
    expect(flat.map((e) => e.id)).toEqual(["p1", "p2"]);
    expect(flat.every((e) => e.source === "bundle" && e.bundleId === "p")).toBe(true);
  });
});

describe("focusTags", () => {
  it("returns distinct focus tags in first-seen order, skipping empty", () => {
    const entries = [entry("a", { focus: "x" }), entry("b", { focus: "y" }), entry("c", { focus: "x" }), entry("d")];
    expect(focusTags(entries)).toEqual(["x", "y"]);
  });
});
