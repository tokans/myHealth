import { execute, query } from "./client";
import { T } from "./tables";
import type { GoalDirection } from "@/domain/goals";

export interface Goal {
  id: number;
  profile_id: number;
  kind: string;
  title: string;
  metric_kind: string | null;
  baseline: number | null;
  target: number | null;
  unit: string | null;
  direction: GoalDirection;
  target_date: string | null;
  status: "active" | "achieved" | "archived";
  created_at: string;
  archived_at: string | null;
}

export async function listGoals(profileId: number): Promise<Goal[]> {
  return query<Goal>(
    `SELECT * FROM ${T.goals} WHERE profile_id = ?1 AND status != 'archived' ORDER BY created_at DESC`,
    [profileId],
  );
}

export async function createGoal(g: {
  profile_id: number;
  kind: string;
  title: string;
  metric_kind?: string | null;
  baseline?: number | null;
  target?: number | null;
  unit?: string | null;
  direction?: GoalDirection;
  target_date?: string | null;
}): Promise<number> {
  const res = await execute(
    `INSERT INTO ${T.goals} (profile_id, kind, title, metric_kind, baseline, target, unit, direction, target_date)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    [
      g.profile_id,
      g.kind,
      g.title,
      g.metric_kind ?? null,
      g.baseline ?? null,
      g.target ?? null,
      g.unit ?? null,
      g.direction ?? "decrease",
      g.target_date ?? null,
    ],
  );
  return res.lastInsertId ?? 0;
}

export async function archiveGoal(id: number): Promise<void> {
  await execute(
    `UPDATE ${T.goals} SET status = 'archived', archived_at = datetime('now') WHERE id = ?1`,
    [id],
  );
}

export async function countGoals(): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T.goals} WHERE status = 'active'`);
  return rows[0]?.n ?? 0;
}
