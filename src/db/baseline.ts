import { execute, query } from "./client";
import { T } from "./tables";

export type BaselineKind =
  | "allergy"
  | "condition"
  | "medication_note"
  | "surgery"
  | "lifestyle"
  | "family_history";

export interface BaselineItem {
  id: number;
  profile_id: number;
  kind: BaselineKind;
  label: string;
  detail: string | null;
  severity: "mild" | "moderate" | "severe" | null;
  created_at: string;
}

export async function listBaseline(profileId: number, kind?: BaselineKind): Promise<BaselineItem[]> {
  if (kind) {
    return query<BaselineItem>(
      `SELECT * FROM ${T.profileBaseline} WHERE profile_id = ?1 AND kind = ?2 ORDER BY id ASC`,
      [profileId, kind],
    );
  }
  return query<BaselineItem>(
    `SELECT * FROM ${T.profileBaseline} WHERE profile_id = ?1 ORDER BY kind, id`,
    [profileId],
  );
}

export async function addBaseline(b: {
  profile_id: number;
  kind: BaselineKind;
  label: string;
  detail?: string;
  severity?: BaselineItem["severity"];
}): Promise<number> {
  const res = await execute(
    `INSERT INTO ${T.profileBaseline} (profile_id, kind, label, detail, severity)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [b.profile_id, b.kind, b.label, b.detail ?? null, b.severity ?? null],
  );
  return res.lastInsertId ?? 0;
}

export async function deleteBaseline(id: number): Promise<void> {
  await execute(`DELETE FROM ${T.profileBaseline} WHERE id = ?1`, [id]);
}
