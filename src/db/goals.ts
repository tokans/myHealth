import { query } from "./client";

export async function countGoals(): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM goals WHERE status = 'active'`);
  return rows[0]?.n ?? 0;
}
