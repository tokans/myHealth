import { execute, query } from "./client";
import { localToday } from "@/lib/utils";

export interface WaterDay {
  id: number;
  profile_id: number;
  day: string;
  glasses: number;
  target_glasses: number;
}

export async function getWaterDay(profileId: number, day = localToday()): Promise<WaterDay | null> {
  const rows = await query<WaterDay>(
    `SELECT * FROM water_log WHERE profile_id = ?1 AND day = ?2 LIMIT 1`,
    [profileId, day],
  );
  return rows[0] ?? null;
}

/** Add `delta` glasses for today (creating the row, clamped at 0), returns new total. */
export async function addGlasses(
  profileId: number,
  delta: number,
  target = 8,
  day = localToday(),
): Promise<number> {
  await execute(
    `INSERT INTO water_log (profile_id, day, glasses, target_glasses)
     VALUES (?1, ?2, MAX(0, ?3), ?4)
     ON CONFLICT(profile_id, day)
     DO UPDATE SET glasses = MAX(0, glasses + ?3)`,
    [profileId, day, delta, target],
  );
  const row = await getWaterDay(profileId, day);
  return row?.glasses ?? 0;
}

export async function setWaterTarget(profileId: number, target: number, day = localToday()): Promise<void> {
  await execute(
    `INSERT INTO water_log (profile_id, day, glasses, target_glasses)
     VALUES (?1, ?2, 0, ?3)
     ON CONFLICT(profile_id, day) DO UPDATE SET target_glasses = ?3`,
    [profileId, day, target],
  );
}
