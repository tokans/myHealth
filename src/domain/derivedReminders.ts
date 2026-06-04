/**
 * Pure generators for *derived* reminders — auto-created from app data via a
 * stable `dedupe_key` so snooze/dismiss state survives re-sync. Day-precision,
 * deterministic, no DB. Phase 1 sources: hydration (water below target) and
 * incomplete daily tasks.
 */

export interface DerivedReminder {
  dedupe_key: string;
  profile_id: number;
  source: "water" | "task";
  title: string;
  detail?: string;
  due_date: string; // 'YYYY-MM-DD'
}

export interface HabitInput {
  day: string;
  water: { profileId: number; name: string; glasses: number; target: number }[];
  tasks: { taskId: number; profileId: number; name: string; title: string; done: boolean }[];
}

/** Build today's derived reminders from habit state. Stable keys → idempotent per day. */
export function buildHabitReminders(input: HabitInput): DerivedReminder[] {
  const out: DerivedReminder[] = [];

  for (const w of input.water) {
    if (w.glasses < w.target) {
      out.push({
        dedupe_key: `water:${w.profileId}:${input.day}`,
        profile_id: w.profileId,
        source: "water",
        title: `Drink water — ${w.glasses}/${w.target} glasses`,
        detail: w.name,
        due_date: input.day,
      });
    }
  }

  for (const t of input.tasks) {
    if (!t.done) {
      out.push({
        dedupe_key: `task:${t.taskId}:${input.day}`,
        profile_id: t.profileId,
        source: "task",
        title: t.title,
        detail: t.name,
        due_date: input.day,
      });
    }
  }

  return out;
}
