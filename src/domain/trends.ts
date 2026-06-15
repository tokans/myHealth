/**
 * Deterministic trend + reference-range logic for charted vitals — no DB, no LLM.
 *
 * This is NOT medical interpretation: reference ranges are general, informational
 * adult guidance used only to draw a band and flag a reading in/below/above it.
 * No diagnosis, no advice. The UI carries a disclaimer.
 */
import type { MetricKind } from "@/lib/metricKinds";

export interface RefRange {
  low: number;
  high: number;
}

/**
 * General adult reference ranges, per metric kind. Informational band only.
 * Kinds without a meaningful universal range (weight, steps) return null —
 * those depend on the person/goal, so we chart them without a band.
 */
const REFERENCE_RANGES: Record<string, RefRange> = {
  bp_systolic: { low: 90, high: 120 },
  bp_diastolic: { low: 60, high: 80 },
  glucose_fasting: { low: 70, high: 99 },
  heart_rate: { low: 60, high: 100 },
  spo2: { low: 95, high: 100 },
  temperature: { low: 36.1, high: 37.2 },
};

export function referenceRange(kind: string): RefRange | null {
  return REFERENCE_RANGES[kind] ?? null;
}

export type RangeFlag = "below" | "in" | "above" | "unknown";

/** Where a single reading sits relative to its reference band (unknown if no band). */
export function flagValue(kind: string, value: number): RangeFlag {
  const range = referenceRange(kind);
  if (!range) return "unknown";
  if (value < range.low) return "below";
  if (value > range.high) return "above";
  return "in";
}

export type TrendDirection = "rising" | "falling" | "steady";
/** Whether the movement is toward ("good"), away from ("bad"), or neutral vs the metric's preferred direction. */
export type TrendSentiment = "good" | "bad" | "neutral";

export interface TrendPoint {
  date: string; // 'YYYY-MM-DD'
  value: number;
}

export interface TrendSummary {
  count: number;
  current: number | null;
  first: number | null;
  /** last − first across the series (null with <2 points). */
  delta: number | null;
  min: number | null;
  max: number | null;
  direction: TrendDirection;
  sentiment: TrendSentiment;
  /** Range flag of the most recent reading. */
  latestFlag: RangeFlag;
}

const EMPTY: TrendSummary = {
  count: 0,
  current: null,
  first: null,
  delta: null,
  min: null,
  max: null,
  direction: "steady",
  sentiment: "neutral",
  latestFlag: "unknown",
};

/**
 * Summarise an ascending-by-date series for one metric kind. `meta.direction`
 * (decrease/increase/maintain) drives the sentiment: a falling weight is "good",
 * a falling SpO₂ is "bad". `maintain` is always neutral.
 */
export function summariseSeries(
  meta: Pick<MetricKind, "kind" | "direction">,
  points: TrendPoint[],
): TrendSummary {
  if (points.length === 0) return { ...EMPTY };

  const values = points.map((p) => p.value);
  const first = values[0]!;
  const current = values[values.length - 1]!;
  const delta = points.length >= 2 ? current - first : null;

  // Treat tiny movement as steady (1% of the absolute first value, min epsilon).
  const epsilon = Math.max(Math.abs(first) * 0.01, 1e-9);
  let direction: TrendDirection = "steady";
  if (delta != null && Math.abs(delta) > epsilon) direction = delta > 0 ? "rising" : "falling";

  let sentiment: TrendSentiment = "neutral";
  if (direction !== "steady" && meta.direction !== "maintain") {
    const wantsRise = meta.direction === "increase";
    sentiment = direction === "rising" ? (wantsRise ? "good" : "bad") : wantsRise ? "bad" : "good";
  }

  return {
    count: points.length,
    current,
    first,
    delta,
    min: Math.min(...values),
    max: Math.max(...values),
    direction,
    sentiment,
    latestFlag: flagValue(meta.kind, current),
  };
}
