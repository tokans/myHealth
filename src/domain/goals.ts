/**
 * Deterministic goal projection — no DB, no LLM. Given a metric's history and a
 * goal spec (baseline, target, direction, optional target date), compute current
 * value, progress toward target, the recent trend, and an ETA. Advisory only.
 */
import { daysBetween, addDaysISO } from "sharedcorelib/reminders";

export type GoalDirection = "decrease" | "increase" | "maintain";
export type GoalStatus = "achieved" | "on_track" | "behind" | "no_data";

export interface GoalPoint {
  date: string; // 'YYYY-MM-DD'
  value: number;
}

export interface GoalSpec {
  baseline: number | null;
  target: number;
  direction: GoalDirection;
  targetDate?: string | null;
  /** For "maintain": how far from target still counts as achieved. Default 0.5. */
  tolerance?: number;
}

export interface GoalProjection {
  current: number | null;
  /** 0..100 progress from baseline toward target. */
  progressPct: number;
  /** Trend in units/day from first→last point (null with <2 points). */
  perDay: number | null;
  /** Projected date the target is reached (null if no usable trend / already met). */
  etaDate: string | null;
  status: GoalStatus;
}

function isAchieved(current: number, spec: GoalSpec): boolean {
  const tol = spec.tolerance ?? 0.5;
  if (spec.direction === "increase") return current >= spec.target;
  if (spec.direction === "decrease") return current <= spec.target;
  return Math.abs(current - spec.target) <= tol; // maintain
}

export function projectGoal(points: GoalPoint[], spec: GoalSpec): GoalProjection {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const baseline = spec.baseline ?? first?.value ?? null;
  const current = last?.value ?? baseline;

  if (current == null || baseline == null) {
    return { current: current ?? null, progressPct: 0, perDay: null, etaDate: null, status: "no_data" };
  }

  // Progress fraction from baseline → target (works for both directions; a
  // zero span means progress is all-or-nothing).
  const span = spec.target - baseline;
  const progressPct =
    span === 0
      ? isAchieved(current, spec)
        ? 100
        : 0
      : clamp(((current - baseline) / span) * 100, 0, 100);

  if (isAchieved(current, spec)) {
    return { current, progressPct: 100, perDay: trend(first, last), etaDate: null, status: "achieved" };
  }

  const perDay = trend(first, last);
  const remaining = spec.target - current;
  const movingTowardTarget = perDay != null && perDay !== 0 && Math.sign(perDay) === Math.sign(remaining);

  let etaDate: string | null = null;
  if (movingTowardTarget && last) {
    etaDate = addDaysISO(last.date, Math.ceil(remaining / perDay!));
  }

  let status: GoalStatus;
  if (!movingTowardTarget) {
    status = "behind";
  } else if (spec.targetDate && etaDate) {
    status = daysBetween(etaDate, spec.targetDate) >= 0 ? "on_track" : "behind";
  } else {
    status = "on_track";
  }

  return { current, progressPct, perDay, etaDate, status };
}

function trend(first?: GoalPoint, last?: GoalPoint): number | null {
  if (!first || !last) return null;
  const days = daysBetween(first.date, last.date);
  if (days <= 0) return null;
  return (last.value - first.value) / days;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
