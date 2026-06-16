/** Local-only launch telemetry. Never transmitted — only unlocks tiers on-device. */
import { execute, query } from "./client";
import { T } from "./tables";
import { localToday } from "@/lib/utils";

/** Record an app open for today (idempotent per day, increments the counter). */
export async function recordLaunch(): Promise<void> {
  const day = localToday();
  await execute(
    `INSERT INTO ${T.appLaunches} (launch_day, opens) VALUES (?1, 1)
     ON CONFLICT(launch_day) DO UPDATE SET opens = opens + 1, last_at = datetime('now')`,
    [day],
  );
}

/** Distinct local calendar days the app has been opened. Drives tier progression. */
export async function countDistinctLaunchDays(): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T.appLaunches}`);
  return rows[0]?.n ?? 0;
}
