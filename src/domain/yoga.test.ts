import { describe, it, expect } from "vitest";
import {
  SAMPLE_SEQUENCES,
  stepImage,
  totalDurationSec,
  formatDuration,
  mergeSequences,
  focusTags,
  type YogaSequence,
} from "./yoga";
import { poseDataUri, POSE_ART_IDS, poseSvg } from "./yogaArt";

describe("baked sample sequences", () => {
  it("ships at least three samples, each with steps and a stable id", () => {
    expect(SAMPLE_SEQUENCES.length).toBeGreaterThanOrEqual(3);
    const ids = SAMPLE_SEQUENCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const seq of SAMPLE_SEQUENCES) {
      expect(seq.source).toBe("baked");
      expect(seq.steps.length).toBeGreaterThan(0);
      expect(seq.name).toBeTruthy();
      expect(seq.focus).toBeTruthy();
    }
  });

  it("every step has an instruction and a resolvable picture", () => {
    for (const seq of SAMPLE_SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.title).toBeTruthy();
        expect(step.instruction).toBeTruthy();
        expect(stepImage(step)).toMatch(/^data:image\/svg\+xml/);
      }
    }
  });

  it("references only known pose-art ids", () => {
    for (const seq of SAMPLE_SEQUENCES) {
      for (const step of seq.steps) {
        if (step.art) expect(POSE_ART_IDS).toContain(step.art);
      }
    }
  });
});

describe("pose art", () => {
  it("renders a valid svg for every art id", () => {
    for (const id of POSE_ART_IDS) {
      const svg = poseSvg(id);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(poseDataUri(id)).toContain("svg%3E"); // encoded "svg>"
    }
  });
});

describe("stepImage", () => {
  it("prefers an explicit image url over the baked art", () => {
    expect(stepImage({ title: "x", instruction: "y", image: "https://e/x.png", art: "tree" })).toBe(
      "https://e/x.png",
    );
  });
  it("falls back to the pose art when no image is given", () => {
    expect(stepImage({ title: "x", instruction: "y", art: "tree" })).toBe(poseDataUri("tree"));
  });
  it("returns undefined when neither is present", () => {
    expect(stepImage({ title: "x", instruction: "y" })).toBeUndefined();
  });
});

describe("durations", () => {
  it("sums step durations, treating missing ones as zero", () => {
    const seq: YogaSequence = {
      id: "t",
      name: "T",
      level: "beginner",
      focus: "f",
      summary: "s",
      source: "baked",
      steps: [
        { title: "a", instruction: "i", durationSec: 30 },
        { title: "b", instruction: "i" },
        { title: "c", instruction: "i", durationSec: 90 },
      ],
    };
    expect(totalDurationSec(seq)).toBe(120);
  });

  it("formats durations as minutes/seconds", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(125)).toBe("2m 5s");
  });
});

describe("mergeSequences", () => {
  const baked: YogaSequence[] = [
    { id: "a", name: "Baked A", level: "beginner", focus: "f", summary: "s", source: "baked", steps: [] },
  ];
  const downloaded: YogaSequence[] = [
    { id: "a", name: "Bundle A", level: "beginner", focus: "f", summary: "s", source: "bundle", bundleId: "x", steps: [] },
    { id: "b", name: "Bundle B", level: "advanced", focus: "g", summary: "s", source: "bundle", bundleId: "x", steps: [] },
  ];

  it("keeps baked first and drops id collisions (baked wins)", () => {
    const merged = mergeSequences(baked, downloaded);
    expect(merged.map((s) => s.id)).toEqual(["a", "b"]);
    expect(merged[0]!.name).toBe("Baked A");
  });

  it("is a no-op shape when nothing is downloaded", () => {
    expect(mergeSequences(baked, [])).toEqual(baked);
  });
});

describe("focusTags", () => {
  it("returns distinct focus tags in first-seen order", () => {
    expect(focusTags(SAMPLE_SEQUENCES)).toEqual([...new Set(SAMPLE_SEQUENCES.map((s) => s.focus))]);
  });
});
