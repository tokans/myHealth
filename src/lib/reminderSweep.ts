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
import { listAllActiveMedications } from "@/db/medications";
import { defaultWaterGlasses } from "@/domain/water";
import { buildHabitReminders, type HabitInput } from "@/domain/derivedReminders";
import { listOpenReminders, markReminderFired, syncDerivedReminders } from "@/db/reminders";

async function gatherDesired(day: string) {
  const profiles = await listProfiles();
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));
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

  // Active, non-PRN medications → a daily "take" nudge.
  const meds: NonNullable<HabitInput["meds"]> = (await listAllActiveMedications())
    .filter((m) => m.schedule !== "PRN")
    .map((m) => ({
      medId: m.id,
      profileId: m.profile_id,
      name: nameById.get(m.profile_id) ?? "",
      drug: m.drug,
      strength: m.strength,
    }));

  return buildHabitReminders({ day, water, tasks, meds });
}

/** Refresh derived reminders from app data WITHOUT raising a notification (for the inbox). */
export async function syncHabitReminders(): Promise<void> {
  if (!isTauri()) return;
  await syncDerivedReminders(await gatherDesired(localToday()));
}

/** Run one habit-reminder sweep. Returns the open reminder count. */
export async function runHabitReminderSweep(): Promise<number> {
  if (!isTauri()) return 0;
  const today = localToday();
  // The sweep notifies across the whole household, so prefix each reminder with the
  // person it's for ("Asha: Drink water …") when there's more than one profile — that
  // way the single OS notification says for whom each nudge is meant. With only one
  // profile it's obviously self, so we leave titles unadorned. (We map a copy; the
  // stored reminder title and `markFired` id are untouched.)
  const profiles = await listProfiles();
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));
  const multi = profiles.length > 1;
  return runReminderSweep({
    today,
    syncDerived: async () => {
      await syncDerivedReminders(await gatherDesired(today));
    },
    listOpen: async () => {
      const open = await listOpenReminders();
      if (!multi) return open;
      return open.map((r) => {
        const name = r.profile_id != null ? nameById.get(r.profile_id) : undefined;
        return name ? { ...r, title: `${name}: ${r.title}` } : r;
      });
    },
    markFired: (id, t) => markReminderFired(id as number, t),
  });
}
