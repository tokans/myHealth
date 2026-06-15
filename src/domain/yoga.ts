/**
 * Yoga sequences — pure, deterministic domain. No DB, no React, no network.
 *
 * A sequence is an ordered list of steps; each step has an instruction, an
 * optional hold/duration, and a "pic" (an inline SVG pose for baked samples, or
 * a `data:`/remote image URL for downloaded bundles). myHealth ships a few BAKED
 * sample sequences so the page works offline immediately; additional sequences
 * arrive as separately-downloadable, signed OTA **bundles** from the GitHub
 * release (see `src/masters/yoga.ts`) and are merged on top of the samples.
 *
 * This is movement guidance only — NOT medical advice. The page carries a
 * "check with your doctor" disclaimer; nothing here diagnoses or prescribes.
 */
import { poseDataUri, type PoseArt } from "@/domain/yogaArt";

export type YogaLevel = "beginner" | "intermediate" | "advanced";

export interface YogaStep {
  /** Pose / movement name, e.g. "Mountain Pose". */
  title: string;
  /** What to do, in plain language. */
  instruction: string;
  /** Seconds to hold or perform; omitted for "flow through" steps. */
  durationSec?: number;
  /** Baked pose illustration id (samples), resolved to an image at read time. */
  art?: PoseArt;
  /** Explicit image URL (downloaded bundles): a `data:` URI or remote https URL. */
  image?: string;
}

export interface YogaSequence {
  /** Stable id, unique across baked + downloaded (bundle ids should be prefixed). */
  id: string;
  name: string;
  /** Transliterated Sanskrit name, when it has one. */
  sanskrit?: string;
  level: YogaLevel;
  /** Short focus tag, e.g. "Flexibility", "Stress relief", "Morning energy". */
  focus: string;
  summary: string;
  steps: YogaStep[];
  /** Where this came from: baked into the app, or a downloaded bundle. */
  source: "baked" | "bundle";
  /** Owning bundle id for downloaded sequences (undefined for baked). */
  bundleId?: string;
}

/** A downloadable bundle of sequences — the unit published to a GitHub release. */
export interface YogaBundle {
  bundleId: string;
  name: string;
  description?: string;
  /** Monotonic revision of this bundle's content. */
  version: number;
  sequences: YogaSequence[];
}

// ── Baked sample sequences ───────────────────────────────────────────────────

/**
 * A handful of beginner-friendly samples that ship in the binary. Each step
 * carries a pose illustration (`art`). Keep this small — the depth lives in the
 * downloadable bundles.
 */
export const SAMPLE_SEQUENCES: YogaSequence[] = [
  {
    id: "sample-morning-wake-up",
    name: "Morning Wake-Up Flow",
    level: "beginner",
    focus: "Morning energy",
    summary: "A gentle five-pose flow to loosen up and breathe before your day starts.",
    source: "baked",
    steps: [
      {
        title: "Mountain Pose",
        instruction: "Stand tall, feet hip-width, arms by your sides. Take five slow breaths.",
        durationSec: 30,
        art: "mountain",
      },
      {
        title: "Standing Forward Fold",
        instruction: "Hinge at the hips and let your upper body hang. Soft knees, relaxed neck.",
        durationSec: 30,
        art: "forward-fold",
      },
      {
        title: "Cat–Cow",
        instruction: "On hands and knees, alternate arching and rounding your spine with the breath.",
        durationSec: 40,
        art: "cow",
      },
      {
        title: "Downward Dog",
        instruction: "Lift the hips into an inverted V. Pedal the heels; lengthen the spine.",
        durationSec: 30,
        art: "downward-dog",
      },
      {
        title: "Child's Pose",
        instruction: "Sit back onto your heels, arms forward, forehead down. Rest and breathe.",
        durationSec: 45,
        art: "child",
      },
    ],
  },
  {
    id: "sample-desk-relief",
    name: "Desk Relief Stretch",
    level: "beginner",
    focus: "Stress relief",
    summary: "Unwind tight shoulders and back after sitting — can be done in a few minutes.",
    source: "baked",
    steps: [
      {
        title: "Seated Twist",
        instruction: "Sit upright, place one hand behind you, and gently rotate your torso. Switch sides.",
        durationSec: 30,
        art: "seated-twist",
      },
      {
        title: "Cat–Cow",
        instruction: "Move to hands and knees and flow between arch and round to free the spine.",
        durationSec: 40,
        art: "cat",
      },
      {
        title: "Child's Pose",
        instruction: "Fold forward over your knees and let your shoulders drop. Breathe slowly.",
        durationSec: 45,
        art: "child",
      },
      {
        title: "Corpse Pose",
        instruction: "Lie flat, arms relaxed, eyes closed. Let the whole body soften.",
        durationSec: 60,
        art: "corpse",
      },
    ],
  },
  {
    id: "sample-balance-basics",
    name: "Balance Basics",
    level: "intermediate",
    focus: "Balance & focus",
    summary: "Build steadiness and concentration with standing balance and a gentle backbend.",
    source: "baked",
    steps: [
      {
        title: "Mountain Pose",
        instruction: "Ground both feet, lengthen the spine, and find a steady gaze ahead.",
        durationSec: 30,
        art: "mountain",
      },
      {
        title: "Tree Pose",
        instruction: "Shift weight to one foot, place the other sole on the calf or thigh, hands at heart. Switch sides.",
        durationSec: 40,
        art: "tree",
      },
      {
        title: "Warrior I",
        instruction: "Step one foot back, bend the front knee, and reach both arms overhead. Switch sides.",
        durationSec: 40,
        art: "warrior",
      },
      {
        title: "Bridge Pose",
        instruction: "Lie on your back, knees bent, and lift the hips while pressing through the feet.",
        durationSec: 30,
        art: "bridge",
      },
      {
        title: "Corpse Pose",
        instruction: "Release everything and rest flat for a few breaths to finish.",
        durationSec: 60,
        art: "corpse",
      },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a step's displayable image: an explicit URL wins, else the baked pose art. */
export function stepImage(step: YogaStep): string | undefined {
  if (step.image) return step.image;
  if (step.art) return poseDataUri(step.art);
  return undefined;
}

/** Total of all step durations, in seconds (steps without a duration count as 0). */
export function totalDurationSec(seq: YogaSequence): number {
  return seq.steps.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
}

/** Human "Xm Ys" / "Ys" label for a duration in seconds. */
export function formatDuration(totalSec: number): string {
  if (totalSec <= 0) return "—";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/**
 * Merge baked samples with downloaded-bundle sequences. Baked come first; a
 * downloaded sequence whose id collides with an already-seen one is dropped
 * (baked wins, mirroring the masters merge precedence). Stable + deterministic.
 */
export function mergeSequences(
  baked: YogaSequence[],
  downloaded: YogaSequence[],
): YogaSequence[] {
  const seen = new Set<string>();
  const out: YogaSequence[] = [];
  for (const seq of [...baked, ...downloaded]) {
    if (seen.has(seq.id)) continue;
    seen.add(seq.id);
    out.push(seq);
  }
  return out;
}

/** Distinct `focus` tags across the given sequences, in first-seen order. */
export function focusTags(seqs: YogaSequence[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of seqs) {
    if (seen.has(s.focus)) continue;
    seen.add(s.focus);
    out.push(s.focus);
  }
  return out;
}
