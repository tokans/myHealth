import { execute, query } from "./client";
import type { DerivedReminder } from "@/domain/derivedReminders";

export interface Reminder {
  id: number;
  profile_id: number | null;
  kind: "manual" | "derived";
  source: string | null;
  dedupe_key: string | null;
  title: string;
  detail: string | null;
  due_date: string;
  status: "open" | "done" | "dismissed";
  snoozed_until: string | null;
  last_fired_on: string | null;
  created_at: string;
}

/**
 * Open reminders. With `profileId` it returns only that person's reminders (the
 * inbox, scoped to the active profile); with no argument it returns the whole
 * household's open reminders (the OS-notification sweep covers everyone at once).
 */
export async function listOpenReminders(profileId?: number): Promise<Reminder[]> {
  if (profileId != null) {
    return query<Reminder>(
      `SELECT * FROM reminders WHERE status = 'open' AND profile_id = ?1 ORDER BY due_date ASC`,
      [profileId],
    );
  }
  return query<Reminder>(`SELECT * FROM reminders WHERE status = 'open' ORDER BY due_date ASC`);
}

export async function markReminderFired(id: number, today: string): Promise<void> {
  await execute(`UPDATE reminders SET last_fired_on = ?2 WHERE id = ?1`, [id, today]);
}

/**
 * Reconcile derived reminders to the desired set:
 *   - upsert each desired one by dedupe_key WITHOUT touching status/snooze/fired
 *     (so user snooze/dismiss survives re-sync),
 *   - prune open derived reminders no longer desired (e.g. the task got done).
 */
export async function syncDerivedReminders(desired: DerivedReminder[]): Promise<void> {
  for (const d of desired) {
    await execute(
      `INSERT INTO reminders (profile_id, kind, source, dedupe_key, title, detail, due_date)
       VALUES (?1, 'derived', ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(dedupe_key) DO UPDATE SET
         title = excluded.title,
         detail = excluded.detail,
         due_date = excluded.due_date,
         profile_id = excluded.profile_id,
         source = excluded.source`,
      [d.profile_id, d.source, d.dedupe_key, d.title, d.detail ?? null, d.due_date],
    );
  }

  const keys = desired.map((d) => d.dedupe_key);
  if (keys.length === 0) {
    await execute(`DELETE FROM reminders WHERE kind = 'derived' AND status = 'open'`);
    return;
  }
  const placeholders = keys.map((_, i) => `?${i + 1}`).join(", ");
  await execute(
    `DELETE FROM reminders
       WHERE kind = 'derived' AND status = 'open' AND dedupe_key NOT IN (${placeholders})`,
    keys,
  );
}

/**
 * One profile's reminders for the Excel export: every manual reminder (any status) PLUS
 * the still-open auto/derived nudges (water/task/medication), so the sheet mirrors what
 * the user sees for that person. Auto rows are read-only on import (the app regenerates
 * them).
 */
export async function listRemindersForExport(profileId: number): Promise<Reminder[]> {
  return query<Reminder>(
    `SELECT * FROM reminders
       WHERE profile_id = ?1 AND (kind = 'manual' OR status = 'open')
       ORDER BY due_date ASC, id ASC`,
    [profileId],
  );
}

/** Update an existing MANUAL reminder (Excel import, update-by-ID path). */
export async function updateManualReminder(
  id: number,
  r: { profile_id: number | null; title: string; detail: string | null; due_date: string; status: Reminder["status"] },
): Promise<void> {
  await execute(
    `UPDATE reminders SET profile_id = ?2, title = ?3, detail = ?4, due_date = ?5, status = ?6
       WHERE id = ?1 AND kind = 'manual'`,
    [id, r.profile_id, r.title, r.detail, r.due_date, r.status],
  );
}

export async function createManualReminder(r: {
  profile_id?: number | null;
  title: string;
  detail?: string;
  due_date: string;
}): Promise<number> {
  const res = await execute(
    `INSERT INTO reminders (profile_id, kind, title, detail, due_date)
     VALUES (?1, 'manual', ?2, ?3, ?4)`,
    [r.profile_id ?? null, r.title, r.detail ?? null, r.due_date],
  );
  return res.lastInsertId ?? 0;
}

export async function snoozeReminder(id: number, until: string): Promise<void> {
  await execute(`UPDATE reminders SET snoozed_until = ?2 WHERE id = ?1`, [id, until]);
}

export async function completeReminder(id: number): Promise<void> {
  await execute(`UPDATE reminders SET status = 'done' WHERE id = ?1`, [id]);
}

export async function dismissReminder(id: number): Promise<void> {
  await execute(`UPDATE reminders SET status = 'dismissed' WHERE id = ?1`, [id]);
}
