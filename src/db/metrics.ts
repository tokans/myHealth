import { execute, query } from "./client";

export interface Metric {
  id: number;
  profile_id: number;
  kind: string;
  value: number;
  unit: string | null;
  taken_at: string;
  source: "manual" | "import" | "device";
  confidence: number | null;
  note: string | null;
  created_at: string;
}

export async function addMetric(m: {
  profile_id: number;
  kind: string;
  value: number;
  unit?: string;
  taken_at: string;
  note?: string;
}): Promise<number> {
  const res = await execute(
    `INSERT INTO metrics (profile_id, kind, value, unit, taken_at, source, note)
     VALUES (?1, ?2, ?3, ?4, ?5, 'manual', ?6)`,
    [m.profile_id, m.kind, m.value, m.unit ?? null, m.taken_at, m.note ?? null],
  );
  return res.lastInsertId ?? 0;
}

export async function listMetrics(profileId: number, kind: string): Promise<Metric[]> {
  return query<Metric>(
    `SELECT * FROM metrics WHERE profile_id = ?1 AND kind = ?2 ORDER BY taken_at ASC`,
    [profileId, kind],
  );
}

export async function countMetrics(): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM metrics`);
  return rows[0]?.n ?? 0;
}

/** Distinct local days on which any metric/water/task activity was logged. */
export async function countDistinctMetricDays(): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(DISTINCT substr(taken_at, 1, 10)) AS n FROM metrics`,
  );
  return rows[0]?.n ?? 0;
}
