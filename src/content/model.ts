/**
 * Generic "content library" model — the framework behind every content tab
 * (Yoga, Exercises, …). A content TYPE is one tab; it holds ENTRIES (a yoga
 * sequence, a workout) each made of ordered STEPS (a pose, a movement) with an
 * instruction, an optional hold/duration, and an optional pic.
 *
 * Pure types + helpers. No DB, no React, no network. A type ships a few BAKED
 * sample entries in the app (offline-ready) and can pull richer entries from
 * separately-downloadable, signed bundles published to a GitHub release — both
 * remotely-registered and refreshed by the daily content sync (`updater.ts`).
 *
 * This is general movement/activity guidance only — never medical advice.
 */
import type { LucideIcon } from "lucide-react";
import type { EarnedTier } from "@/lib/featureGate";

export type ContentLevel = "beginner" | "intermediate" | "advanced";

export interface ContentStep {
  /** Step / pose / movement name. */
  title: string;
  /** What to do, in plain language. */
  instruction: string;
  /** Seconds to hold or perform; omitted for "flow through" steps. */
  durationSec?: number;
  /** Pic: a `data:` URI (baked art) or an https image URL. */
  image?: string;
}

export interface ContentEntry {
  /** Stable id, unique within a type across baked + downloaded. */
  id: string;
  name: string;
  level?: ContentLevel;
  /** Short focus tag, e.g. "Relaxation", "Strength". */
  focus?: string;
  summary: string;
  steps: ContentStep[];
  source: "baked" | "bundle";
  /** Owning bundle id for downloaded entries (undefined for baked). */
  bundleId?: string;
}

/** A downloadable bundle of entries — the unit published to a GitHub release. */
export interface ContentBundle {
  bundleId: string;
  name: string;
  description?: string;
  /** Monotonic revision of this bundle's content. */
  version: number;
  entries: ContentEntry[];
}

/** Serializable type metadata — the shape the remote catalog publishes. */
export interface ContentTypeMeta {
  key: string;
  label: string;
  /** Lucide icon name (resolved to a component for rendering). */
  iconName: string;
  /** Earned tier this tab unlocks at (progressive disclosure). */
  tier: EarnedTier;
  /** GitHub release tag holding this type's downloadable bundles. */
  releaseTag: string;
  description?: string;
  /** Noun for one entry in the UI, e.g. "sequence", "workout". Default "routine". */
  entryNoun?: string;
  /** Sort order among tabs (lower first). Default 100. */
  order?: number;
}

/** A runtime content type — metadata with a resolved icon + baked samples. */
export interface ContentType {
  key: string;
  label: string;
  icon: LucideIcon;
  tier: EarnedTier;
  releaseTag: string;
  description?: string;
  entryNoun: string;
  order: number;
  /** Baked sample entries shipped in the app (empty for remote-only types). */
  samples: ContentEntry[];
  /** Where the type was registered from. */
  source: "baked" | "remote";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A step's displayable image (already a `data:`/https URL, or undefined). */
export function stepImage(step: ContentStep): string | undefined {
  return step.image;
}

/** Total of all step durations, in seconds (missing durations count as 0). */
export function totalDurationSec(entry: ContentEntry): number {
  return entry.steps.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);
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
 * Merge baked samples with downloaded-bundle entries. Baked come first; a
 * downloaded entry whose id collides with an already-seen one is dropped (baked
 * wins, mirroring the masters merge precedence). Stable + deterministic.
 */
export function mergeEntries(baked: ContentEntry[], downloaded: ContentEntry[]): ContentEntry[] {
  const seen = new Set<string>();
  const out: ContentEntry[] = [];
  for (const entry of [...baked, ...downloaded]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/** Distinct `focus` tags across the given entries, in first-seen order. */
export function focusTags(entries: ContentEntry[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    if (!e.focus || seen.has(e.focus)) continue;
    seen.add(e.focus);
    out.push(e.focus);
  }
  return out;
}

/** Flatten a type's downloaded bundles into entries tagged with source/bundleId. */
export function bundleEntries(bundles: ContentBundle[]): ContentEntry[] {
  return bundles.flatMap((b) =>
    b.entries.map((e) => ({ ...e, source: "bundle" as const, bundleId: b.bundleId })),
  );
}
