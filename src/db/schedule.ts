import { execute, query } from "./client";

export type ScheduleKind = "medication" | "meal" | "activity" | "appointment" | "other";

export interface ScheduleBlock {
  id: number;
  profile_id: number;
  kind: ScheduleKind;
  title: string;
  start_min: number;
  end_min: number | null;
  days: string; // 'daily' | 'weekdays' | CSV 0-6
  ref: string | null;
  created_at: string;
}

export async function listBlocks(profileId: number): Promise<ScheduleBlock[]> {
  return query<ScheduleBlock>(
    `SELECT * FROM schedule_blocks WHERE profile_id = ?1 ORDER BY start_min ASC, id ASC`,
    [profileId],
  );
}

export async function createBlock(b: {
  profile_id: number;
  kind: ScheduleKind;
  title: string;
  start_min: number;
  end_min?: number | null;
  days?: string;
}): Promise<number> {
  const res = await execute(
    `INSERT INTO schedule_blocks (profile_id, kind, title, start_min, end_min, days)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    [b.profile_id, b.kind, b.title, b.start_min, b.end_min ?? null, b.days ?? "daily"],
  );
  return res.lastInsertId ?? 0;
}

/** All schedule blocks across profiles — for the Excel export. */
export async function listAllBlocks(): Promise<ScheduleBlock[]> {
  return query<ScheduleBlock>(
    `SELECT * FROM schedule_blocks ORDER BY profile_id ASC, start_min ASC, id ASC`,
  );
}

/** Update an existing schedule block (Excel import, update-by-ID path). */
export async function updateBlock(
  id: number,
  b: { profile_id: number; kind: ScheduleKind; title: string; start_min: number; end_min: number | null; days: string },
): Promise<void> {
  await execute(
    `UPDATE schedule_blocks SET profile_id = ?2, kind = ?3, title = ?4, start_min = ?5, end_min = ?6, days = ?7
       WHERE id = ?1`,
    [id, b.profile_id, b.kind, b.title, b.start_min, b.end_min, b.days],
  );
}

export async function deleteBlock(id: number): Promise<void> {
  await execute(`DELETE FROM schedule_blocks WHERE id = ?1`, [id]);
}
