/**
 * Dev/QA data seeder — populate `myhealth.db` with realistic dummy data so Trends,
 * Vitals, Goals, Today, Medications and Schedule have something to show without
 * hand-entering weeks of readings.
 *
 * LOCAL-only, DEV-only. Never runs in a production build (gated on `import.meta.env.DEV`,
 * with an explicit `VITE_ALLOW_SEED="1"` escape hatch that mirrors the tier override),
 * and only inside the desktop app (needs SQLite — a no-op in the browser preview).
 *
 * Triggers, first match wins (all read at startup, none transmitted):
 *   1. URL query   ?seed=on     seed if the DB is empty (no profiles yet)
 *                  ?seed=reset  wipe the seeded tables, then reseed
 *                  ?seed=clear  wipe the seeded tables, seed nothing
 *   2. env         VITE_SEED=on | reset | clear   (baked when you start dev)
 *
 * The data is deterministic (a fixed-seed PRNG), so a reset reproduces the same set.
 * `npm run dev:seed` / `npm run seed` set VITE_SEED=on for you (see scripts/start-seed.mjs).
 */
import { isTauri } from "@/lib/environment";
import { execute } from "@/db/client";
import { createProfile, countProfiles, listProfiles } from "@/db/profiles";
import { addMetric } from "@/db/metrics";
import { createGoal } from "@/db/goals";
import { createTask, setTaskDone } from "@/db/tasks";
import { addGlasses } from "@/db/water";
import { createMedication } from "@/db/medications";
import { createBlock } from "@/db/schedule";

type SeedMode = "on" | "reset" | "clear";

/** Tables this seeder owns; cleared (in FK-safe order) on reset/clear. */
const SEEDED_TABLES = [
  "task_completions",
  "daily_tasks",
  "water_log",
  "metrics",
  "goals",
  "medications",
  "schedule_blocks",
  "profiles",
];

/** Whether the seeder is permitted to run in the current build. */
function allowed(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ALLOW_SEED === "1";
}

/** Resolve the requested mode from the URL query or env, or null when unset/invalid. */
function requestedMode(): SeedMode | null {
  let raw: string | null = null;
  if (typeof window !== "undefined") {
    try {
      const search = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hashQ = hash.includes("?")
        ? new URLSearchParams(hash.slice(hash.indexOf("?") + 1))
        : null;
      raw = search.get("seed") ?? hashQ?.get("seed") ?? null;
    } catch {
      /* ignore */
    }
  }
  if (raw == null) raw = import.meta.env.VITE_SEED ?? null;
  const v = raw?.trim().toLowerCase();
  if (v === "on" || v === "1" || v === "true") return "on";
  if (v === "reset") return "reset";
  if (v === "clear") return "clear";
  return null;
}

/**
 * Seed the DB when requested. Returns true if it mutated data (so the caller can
 * refresh stores). Safe to call unconditionally on startup — a no-op unless a seed
 * mode is requested, the build allows it, and we're inside the desktop app.
 */
export async function maybeSeedDev(): Promise<boolean> {
  if (!allowed() || !isTauri()) return false;
  const mode = requestedMode();
  if (!mode) return false;

  try {
    if (mode === "reset" || mode === "clear") {
      await wipe();
      if (mode === "clear") {
        console.info("[seed] cleared seeded tables");
        return true;
      }
    }
    // `on` (and the post-wipe half of `reset`) only seed an empty DB, so we never
    // pile duplicate dummy people on top of real data.
    if ((await countProfiles()) > 0) {
      console.info("[seed] profiles already present — skipping (use ?seed=reset to wipe + reseed)");
      return mode === "reset"; // a reset still wiped, so a refresh is warranted
    }
    await seed();
    console.info("[seed] populated dummy data — Trends/Vitals/Goals/Today are ready");
    return true;
  } catch (e) {
    console.error("[seed] failed:", e);
    return false;
  }
}

async function wipe(): Promise<void> {
  for (const t of SEEDED_TABLES) await execute(`DELETE FROM ${t}`);
}

// ── Deterministic PRNG (mulberry32) so reseeds reproduce the same dataset ──────
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(0xc0ffee);
const jitter = (amp: number) => (rand() * 2 - 1) * amp;
const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Local YYYY-MM-DD for `n` days ago. */
function dayISO(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * A series of {daysAgo, value}: a linear drift from `from`→`to` across `spanDays`,
 * sampled every `everyDays`, with bounded noise and optional clamping.
 */
function series(opts: {
  from: number;
  to: number;
  spanDays: number;
  everyDays: number;
  noise: number;
  dp?: number;
  min?: number;
  max?: number;
}): { daysAgo: number; value: number }[] {
  const { from, to, spanDays, everyDays, noise, dp = 0, min = -Infinity, max = Infinity } = opts;
  const out: { daysAgo: number; value: number }[] = [];
  for (let d = spanDays; d >= 0; d -= everyDays) {
    const t = 1 - d / spanDays; // 0 at the oldest sample, 1 today
    let v = from + (to - from) * t + jitter(noise);
    v = Math.min(max, Math.max(min, v));
    out.push({ daysAgo: d, value: round(v, dp) });
  }
  return out;
}

async function addSeries(
  profileId: number,
  kind: string,
  unit: string,
  s: { daysAgo: number; value: number }[],
): Promise<void> {
  for (const p of s) {
    await addMetric({
      profile_id: profileId,
      kind,
      value: p.value,
      unit,
      taken_at: `${dayISO(p.daysAgo)} 08:00:00`,
    });
  }
}

async function seed(): Promise<void> {
  // ── People ──────────────────────────────────────────────────────────────────
  const meId = await createProfile({
    name: "Alex Sharma",
    is_self: 1,
    relationship: "self",
    dob: "1986-04-12",
    sex: "male",
    blood_group: "O+",
    height_cm: 178,
    notes: "Dev seed — self profile.",
  });
  const momId = await createProfile({
    name: "Priya Sharma",
    relationship: "mother",
    dob: "1958-11-02",
    sex: "female",
    blood_group: "B+",
    height_cm: 162,
    notes: "Dev seed — family profile.",
  });
  await createProfile({
    name: "Rohan Sharma",
    relationship: "son",
    dob: "2014-07-21",
    sex: "male",
    blood_group: "O+",
    height_cm: 138,
    notes: "Dev seed — child profile.",
  });

  // ── Vitals history (self): trending toward healthier ranges over ~120 days ────
  await addSeries(meId, "weight", "kg",
    series({ from: 84, to: 77.5, spanDays: 120, everyDays: 2, noise: 0.5, dp: 1 }));
  await addSeries(meId, "bp_systolic", "mmHg",
    series({ from: 132, to: 119, spanDays: 120, everyDays: 3, noise: 4 }));
  await addSeries(meId, "bp_diastolic", "mmHg",
    series({ from: 88, to: 78, spanDays: 120, everyDays: 3, noise: 3 }));
  await addSeries(meId, "glucose_fasting", "mg/dL",
    series({ from: 112, to: 95, spanDays: 120, everyDays: 7, noise: 5 }));
  await addSeries(meId, "heart_rate", "bpm",
    series({ from: 76, to: 66, spanDays: 120, everyDays: 2, noise: 3 }));
  await addSeries(meId, "spo2", "%",
    series({ from: 97, to: 98, spanDays: 90, everyDays: 3, noise: 1, min: 94, max: 100 }));
  await addSeries(meId, "temperature", "°C",
    series({ from: 36.6, to: 36.7, spanDays: 90, everyDays: 5, noise: 0.25, dp: 1, min: 35.8, max: 38 }));
  await addSeries(meId, "steps", "steps",
    series({ from: 5200, to: 9200, spanDays: 90, everyDays: 2, noise: 1400, min: 1500 }));

  // ── Vitals history (mother): a lighter set, BP a touch high for variety ───────
  await addSeries(momId, "bp_systolic", "mmHg",
    series({ from: 138, to: 128, spanDays: 90, everyDays: 4, noise: 5 }));
  await addSeries(momId, "bp_diastolic", "mmHg",
    series({ from: 90, to: 82, spanDays: 90, everyDays: 4, noise: 3 }));
  await addSeries(momId, "glucose_fasting", "mg/dL",
    series({ from: 124, to: 108, spanDays: 90, everyDays: 7, noise: 6 }));
  await addSeries(momId, "weight", "kg",
    series({ from: 68, to: 66, spanDays: 90, everyDays: 4, noise: 0.4, dp: 1 }));

  // ── Goals (self) ──────────────────────────────────────────────────────────────
  await createGoal({
    profile_id: meId,
    kind: "metric",
    title: "Reach 75 kg",
    metric_kind: "weight",
    baseline: 84,
    target: 75,
    unit: "kg",
    direction: "decrease",
    target_date: dayISO(-60), // 60 days out
  });
  await createGoal({
    profile_id: meId,
    kind: "metric",
    title: "10,000 steps a day",
    metric_kind: "steps",
    baseline: 5200,
    target: 10000,
    unit: "steps",
    direction: "increase",
    target_date: dayISO(-30),
  });
  await createGoal({
    profile_id: meId,
    kind: "metric",
    title: "Fasting glucose under 100",
    metric_kind: "glucose_fasting",
    baseline: 112,
    target: 99,
    unit: "mg/dL",
    direction: "decrease",
    target_date: dayISO(-45),
  });

  // ── Daily tasks (self) with completions across the last 21 days ───────────────
  const walk = await createTask({ profile_id: meId, title: "Morning walk", recurrence: "daily", reminder_time: "07:00" });
  const meds = await createTask({ profile_id: meId, title: "Take vitamins", recurrence: "daily", reminder_time: "09:00" });
  const stretch = await createTask({ profile_id: meId, title: "Stretch 10 min", recurrence: "weekdays", reminder_time: "18:30" });
  for (let d = 21; d >= 1; d--) {
    const day = dayISO(d);
    if (rand() < 0.8) await setTaskDone(walk, true, day);
    if (rand() < 0.9) await setTaskDone(meds, true, day);
    if (rand() < 0.6) await setTaskDone(stretch, true, day);
  }

  // ── Water log (self) for the last 14 days ─────────────────────────────────────
  for (let d = 14; d >= 0; d--) {
    const glasses = 4 + Math.floor(rand() * 5); // 4–8
    await addGlasses(meId, glasses, 8, dayISO(d));
  }

  // ── Medications (self + mother) ───────────────────────────────────────────────
  await createMedication({
    profile_id: meId,
    drug: "Metformin",
    strength: "500 mg",
    form: "tablet",
    schedule: "1-0-1",
    prescriber: "Dr. Mehta",
    start_date: dayISO(120),
    notes: "With meals.",
  });
  await createMedication({
    profile_id: meId,
    drug: "Vitamin D3",
    strength: "60000 IU",
    form: "capsule",
    schedule: "weekly",
    prescriber: "Dr. Mehta",
    start_date: dayISO(60),
  });
  await createMedication({
    profile_id: momId,
    drug: "Amlodipine",
    strength: "5 mg",
    form: "tablet",
    schedule: "1-0-0",
    prescriber: "Dr. Rao",
    start_date: dayISO(200),
    notes: "Blood pressure.",
  });

  // ── Schedule blocks (self) — minutes from midnight ────────────────────────────
  await createBlock({ profile_id: meId, kind: "activity", title: "Morning walk", start_min: 7 * 60, end_min: 7 * 60 + 40, days: "daily" });
  await createBlock({ profile_id: meId, kind: "meal", title: "Breakfast", start_min: 8 * 60, end_min: 8 * 60 + 30, days: "daily" });
  await createBlock({ profile_id: meId, kind: "medication", title: "Metformin", start_min: 8 * 60 + 15, days: "daily" });
  await createBlock({ profile_id: meId, kind: "meal", title: "Dinner", start_min: 20 * 60, end_min: 20 * 60 + 45, days: "daily" });
  await createBlock({ profile_id: meId, kind: "medication", title: "Metformin", start_min: 20 * 60 + 30, days: "daily" });
  await createBlock({ profile_id: meId, kind: "appointment", title: "Dr. Mehta — review", start_min: 11 * 60, end_min: 11 * 60 + 30, days: "6" });

  // Touch listProfiles so a failed self/family resolve surfaces here, not later.
  await listProfiles();
}
