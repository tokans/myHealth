import { execute, query } from "./client";
import { localToday } from "@/lib/utils";

export interface DailyTask {
  id: number;
  profile_id: number;
  title: string;
  recurrence: string; // 'daily' | 'weekdays' | CSV of 0-6
  reminder_time: string | null;
  active: number;
  created_at: string;
}

export interface TaskToday extends DailyTask {
  done: boolean;
}

/** True if a task with the given recurrence applies on the given weekday (0=Sun). */
export function appliesOn(recurrence: string, weekday: number): boolean {
  if (recurrence === "daily") return true;
  if (recurrence === "weekdays") return weekday >= 1 && weekday <= 5;
  return recurrence
    .split(",")
    .map((s) => Number(s.trim()))
    .includes(weekday);
}

export async function listTasks(profileId: number): Promise<DailyTask[]> {
  return query<DailyTask>(
    `SELECT * FROM daily_tasks WHERE profile_id = ?1 AND active = 1 ORDER BY created_at ASC`,
    [profileId],
  );
}

/** Tasks that apply today, each annotated with whether it's already done. */
export async function listTasksForToday(profileId: number, day = localToday()): Promise<TaskToday[]> {
  const weekday = new Date(day + "T00:00:00").getDay();
  const tasks = await listTasks(profileId);
  const done = await query<{ task_id: number }>(
    `SELECT task_id FROM task_completions WHERE done_on = ?1`,
    [day],
  );
  const doneSet = new Set(done.map((d) => d.task_id));
  return tasks
    .filter((t) => appliesOn(t.recurrence, weekday))
    .map((t) => ({ ...t, done: doneSet.has(t.id) }));
}

export async function createTask(t: {
  profile_id: number;
  title: string;
  recurrence?: string;
  reminder_time?: string;
}): Promise<number> {
  const res = await execute(
    `INSERT INTO daily_tasks (profile_id, title, recurrence, reminder_time)
     VALUES (?1, ?2, ?3, ?4)`,
    [t.profile_id, t.title, t.recurrence ?? "daily", t.reminder_time ?? null],
  );
  return res.lastInsertId ?? 0;
}

export async function setTaskDone(taskId: number, done: boolean, day = localToday()): Promise<void> {
  if (done) {
    await execute(
      `INSERT OR IGNORE INTO task_completions (task_id, done_on) VALUES (?1, ?2)`,
      [taskId, day],
    );
  } else {
    await execute(`DELETE FROM task_completions WHERE task_id = ?1 AND done_on = ?2`, [taskId, day]);
  }
}

export async function archiveTask(taskId: number): Promise<void> {
  await execute(`UPDATE daily_tasks SET active = 0 WHERE id = ?1`, [taskId]);
}
