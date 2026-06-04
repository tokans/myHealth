/**
 * Habit reminder sweep — regenerates derived reminders from app data and raises
 * ONE OS notification per sweep for anything due. Uses the shared
 * `runReminderSweep` engine; this file supplies the generators + DB adapters.
 * Called on launch/idle from App.tsx. Best-effort, no-op in browser.
 */
import { runReminderSweep } from "sharedcorelib/reminders";
import { isTauri } from "@/lib/environment";
import { localToday } from "@/lib/utils";
import { listProfiles } from "@/db/profiles";
import { getWaterDay } from "@/db/water";
import { listTasksForToday } from "@/db/tasks";
import { defaultWaterGlasses } from "@/domain/water";
import { buildHabitReminders, type HabitInput } from "@/domain/derivedReminders";
import { listOpenReminders, markReminderFired, syncDerivedReminders } from "@/db/reminders";

async function gatherDesired(day: string) {
  const profiles = await listProfiles();
  const water: HabitInput["water"] = [];
  const tasks: HabitInput["tasks"] = [];
  for (const p of profiles) {
    const w = await getWaterDay(p.id, day);
    water.push({
      profileId: p.id,
      name: p.name,
      glasses: w?.glasses ?? 0,
      target: w?.target_glasses ?? defaultWaterGlasses(),
    });
    for (const t of await listTasksForToday(p.id, day)) {
      tasks.push({ taskId: t.id, profileId: p.id, name: p.name, title: t.title, done: t.done });
    }
  }
  return buildHabitReminders({ day, water, tasks });
}

/** Run one habit-reminder sweep. Returns the open reminder count. */
export async function runHabitReminderSweep(): Promise<number> {
  if (!isTauri()) return 0;
  const today = localToday();
  return runReminderSweep({
    today,
    syncDerived: async () => {
      await syncDerivedReminders(await gatherDesired(today));
    },
    listOpen: () => listOpenReminders(),
    markFired: (id, t) => markReminderFired(id as number, t),
  });
}
