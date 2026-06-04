import { execute, query } from "./client";

export interface Profile {
  id: number;
  name: string;
  relationship: string | null;
  is_self: number;
  dob: string | null;
  sex: "female" | "male" | "other" | "unspecified";
  blood_group: string | null;
  height_cm: number | null;
  photo_ref: string | null;
  notes: string | null;
  created_at: string;
}

export type NewProfile = Pick<Profile, "name"> &
  Partial<Pick<Profile, "relationship" | "is_self" | "dob" | "sex" | "blood_group" | "height_cm" | "notes">>;

export async function listProfiles(): Promise<Profile[]> {
  return query<Profile>(`SELECT * FROM profiles ORDER BY is_self DESC, name ASC`);
}

export async function getSelfProfile(): Promise<Profile | null> {
  const rows = await query<Profile>(`SELECT * FROM profiles WHERE is_self = 1 LIMIT 1`);
  return rows[0] ?? null;
}

export async function countProfiles(): Promise<number> {
  const rows = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM profiles`);
  return rows[0]?.n ?? 0;
}

export async function createProfile(p: NewProfile): Promise<number> {
  const res = await execute(
    `INSERT INTO profiles (name, relationship, is_self, dob, sex, blood_group, height_cm, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    [
      p.name,
      p.relationship ?? null,
      p.is_self ?? 0,
      p.dob ?? null,
      p.sex ?? "unspecified",
      p.blood_group ?? null,
      p.height_cm ?? null,
      p.notes ?? null,
    ],
  );
  return res.lastInsertId ?? 0;
}

export async function deleteProfile(id: number): Promise<void> {
  await execute(`DELETE FROM profiles WHERE id = ?1`, [id]);
}
