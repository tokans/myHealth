import { execute, query } from "./client";
import { T } from "./tables";

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
    `INSERT INTO ${T.metrics} (profile_id, kind, value, unit, taken_at, source, note)
     VALUES (?1, ?2, ?3, ?4, ?5, 'manual', ?6)`,
    [m.profile_id, m.kind, m.value, m.unit ?? null, m.taken_at, m.note ?? null],
  );
  return res.lastInsertId ?? 0;
}

export async function listMetrics(profileId: number, kind: string): Promise<Metric[]> {
  return query<Metric>(
    `SELECT * FROM ${T.metrics} WHERE profile_id = ?1 AND kind = ?2 ORDER BY taken_at ASC`,
    [profileId, kind],
  );
}

/**
 * All readings for a set of metric kinds for one profile, in a SINGLE query — so the
 * Goals page projects N goals without N round-trips (was one listMetrics() per goal).
 * Ordered by kind then time so callers can group in one pass.
 */
export async function listMetricsForKinds(profileId: number, kinds: string[]): Promise<Metric[]> {
  if (kinds.length === 0) return [];
  const placeholders = kinds.map((_, i) => `?${i + 2}`).join(", ");
  return query<Metric>(
    `SELECT * FROM ${T.metrics} WHERE profile_id = ?1 AND kind IN (${placeholders}) ORDER BY kind ASC, taken_at ASC`,
    [profileId, ...kinds],
  );
}

/** The most recent reading for each metric kind for a profile. */
export async function latestMetrics(profileId: number): Promise<Metric[]> {
  return query<Metric>(
    `SELECT m.* FROM ${T.metrics} m
     JOIN (SELECT kind, MAX(taken_at) AS mx FROM ${T.metrics} WHERE profile_id = ?1 GROUP BY kind) t
       ON m.kind = t.kind AND m.taken_at = t.mx
     WHERE m.profile_id = ?1
     ORDER BY m.kind`,
    [profileId],
  );
}

/** One profile's readings across all kinds — for the Excel export. */
export async function listMetricsForProfile(profileId: number): Promise<Metric[]> {
  return query<Metric>(
    `SELECT * FROM ${T.metrics} WHERE profile_id = ?1 ORDER BY kind ASC, taken_at ASC`,
    [profileId],
  );
}

/** Update an existing reading (Excel import, update-by-ID path). Source stays as-is. */
export async function updateMetric(
  id: number,
  m: { profile_id: number; kind: string; value: number; unit: string | null; taken_at: string; note: string | null },
): Promise<void> {
  await execute(
    `UPDATE ${T.metrics} SET profile_id = ?2, kind = ?3, value = ?4, unit = ?5, taken_at = ?6, note = ?7
       WHERE id = ?1`,
    [id, m.profile_id, m.kind, m.value, m.unit, m.taken_at, m.note],
  );
}

export async function countMetrics(): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${T.metrics}`);
  return rows[0]?.n ?? 0;
}

/** Distinct local days on which any metric/water/task activity was logged. */
export async function countDistinctMetricDays(): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(DISTINCT substr(taken_at, 1, 10)) AS n FROM ${T.metrics}`,
  );
  return rows[0]?.n ?? 0;
}
