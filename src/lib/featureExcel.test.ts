import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Exercises the per-feature, **per-profile** Excel codec + specs against in-memory DB
 * fakes. Each spec's round-trip is: export rows for a profile → real SheetJS write →
 * real read → import into that profile, asserting friendly conversions (HH:MM, "Every
 * day", "Lower is better", Yes/No, metric labels), the update-by-ID-vs-add upsert, and
 * that exports/imports are scoped to ONE profile (no cross-profile leakage).
 */

const P1 = 1; // the "active" profile under test
const P2 = 2; // another profile that must never appear in P1's export

// Shared mutable fixtures the mocked DB wrappers read/write (hoisted for vi.mock).
const fx = vi.hoisted(() => ({
  reminders: [] as any[],
  goals: [] as any[],
  blocks: [] as any[],
  meds: [] as any[],
  metrics: [] as any[],
  created: [] as Array<{ table: string; row: any }>,
  updated: [] as Array<{ table: string; id: number; row: any }>,
}));

let nextId = 100;
const forProfile = (arr: any[], pid: number) => arr.filter((r) => r.profile_id === pid);

vi.mock("@/db/reminders", () => ({
  listRemindersForExport: async (pid: number) =>
    forProfile(fx.reminders, pid).filter((r) => r.kind === "manual" || r.status === "open"),
  createManualReminder: async (r: any) => { fx.created.push({ table: "reminders", row: r }); return ++nextId; },
  updateManualReminder: async (id: number, r: any) => { fx.updated.push({ table: "reminders", id, row: r }); },
}));
vi.mock("@/db/goals", () => ({
  listGoals: async (pid: number) => forProfile(fx.goals, pid).filter((g) => g.status !== "archived"),
  createGoal: async (g: any) => { fx.created.push({ table: "goals", row: g }); return ++nextId; },
  updateGoal: async (id: number, g: any) => { fx.updated.push({ table: "goals", id, row: g }); },
}));
vi.mock("@/db/schedule", () => ({
  listBlocks: async (pid: number) => forProfile(fx.blocks, pid),
  createBlock: async (b: any) => { fx.created.push({ table: "schedule", row: b }); return ++nextId; },
  updateBlock: async (id: number, b: any) => { fx.updated.push({ table: "schedule", id, row: b }); },
}));
vi.mock("@/db/medications", () => ({
  listMedications: async (pid: number, _activeOnly = true) => forProfile(fx.meds, pid),
  createMedicationFull: async (m: any) => { fx.created.push({ table: "medications", row: m }); return ++nextId; },
  updateMedication: async (id: number, m: any) => { fx.updated.push({ table: "medications", id, row: m }); },
}));
vi.mock("@/db/metrics", () => ({
  listMetricsForProfile: async (pid: number) => forProfile(fx.metrics, pid),
  addMetric: async (m: any) => { fx.created.push({ table: "metrics", row: m }); return ++nextId; },
  updateMetric: async (id: number, m: any) => { fx.updated.push({ table: "metrics", id, row: m }); },
}));

import {
  FEATURE_EXCEL,
  exportFeatureWorkbook,
  parseFeatureWorkbook,
  type FeatureExcelSpec,
} from "./featureExcel";

/** Export P1's rows → bytes → parse back to header-keyed rows, the way the UI does it. */
async function roundTrip(spec: FeatureExcelSpec, pid = P1) {
  const { bytes } = await exportFeatureWorkbook(spec, { profileId: pid });
  return parseFeatureWorkbook(bytes);
}

beforeEach(() => {
  fx.reminders.length = 0;
  fx.goals.length = 0;
  fx.blocks.length = 0;
  fx.meds.length = 0;
  fx.metrics.length = 0;
  fx.created.length = 0;
  fx.updated.length = 0;
  nextId = 100;
});

describe("codec", () => {
  it("exports a workbook whose first sheet round-trips to friendly rows (no Person column)", async () => {
    fx.reminders.push({ id: 7, profile_id: P1, kind: "manual", title: "Call clinic", detail: "Reschedule", due_date: "2026-06-20", status: "open" });
    const { bytes, rowCount } = await exportFeatureWorkbook(FEATURE_EXCEL.reminders!, { profileId: P1 });
    expect(rowCount).toBe(1);
    const rows = await parseFeatureWorkbook(bytes);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ID: "7", What: "Call clinic", "Due date": "2026-06-20", Status: "Open", Auto: "No" });
    expect(rows[0]).not.toHaveProperty("Person");
  });

  it("with no data still writes a header-only template (rowCount 0)", async () => {
    const { bytes, rowCount } = await exportFeatureWorkbook(FEATURE_EXCEL.goals!, { profileId: P1 });
    expect(rowCount).toBe(0);
    const rows = await parseFeatureWorkbook(bytes);
    expect(rows).toEqual([]);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(bytes, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]!];
    const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(grid[0]).toEqual(FEATURE_EXCEL.goals!.headers);
  });
});

describe("per-profile scoping", () => {
  it("export only contains the active profile's rows", async () => {
    fx.goals.push({ id: 1, profile_id: P1, kind: "metric", title: "Asha goal", metric_kind: "weight", baseline: 80, target: 72, unit: "kg", direction: "decrease", target_date: null, status: "active" });
    fx.goals.push({ id: 2, profile_id: P2, kind: "metric", title: "Ravi goal", metric_kind: "weight", baseline: 90, target: 80, unit: "kg", direction: "decrease", target_date: null, status: "active" });
    const rows = await roundTrip(FEATURE_EXCEL.goals!, P1);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.Goal).toBe("Asha goal");
  });

  it("import assigns every row to the active profile and never updates another profile's record by ID", async () => {
    fx.goals.push({ id: 2, profile_id: P2, kind: "metric", title: "Ravi goal", metric_kind: "weight", baseline: 90, target: 80, unit: "kg", direction: "decrease", target_date: null, status: "active" });
    // A sheet that references ID 2 (which belongs to P2) while the active profile is P1.
    const res = await FEATURE_EXCEL.goals!.importRows([{ ID: 2, Goal: "Hijack attempt", Metric: "Weight", Target: 70 }], { profileId: P1 });
    expect(res.updated).toBe(0);
    expect(res.added).toBe(1);
    expect(fx.updated).toHaveLength(0);
    expect(fx.created[0].row.profile_id).toBe(P1);
  });
});

describe("reminders spec", () => {
  it("updates an existing manual row and adds a blank-ID row, scoped to the active profile", async () => {
    fx.reminders.push({ id: 7, profile_id: P1, kind: "manual", title: "Call clinic", detail: null, due_date: "2026-06-20", status: "open" });
    const res = await FEATURE_EXCEL.reminders!.importRows([
      { ID: 7, What: "Call clinic back", Details: "", "Due date": "2026-06-21", Status: "Done" },
      { ID: "", What: "Book test", Details: "fasting", "Due date": "2026-07-01", Status: "Open" },
    ], { profileId: P1 });
    expect(res).toMatchObject({ added: 1, updated: 1, skipped: 0 });
    expect(fx.updated[0]).toMatchObject({ table: "reminders", id: 7, row: { title: "Call clinic back", due_date: "2026-06-21", status: "done", profile_id: P1 } });
    expect(fx.created[0]).toMatchObject({ table: "reminders", row: { profile_id: P1, title: "Book test", due_date: "2026-07-01" } });
  });

  it("exports open auto/derived nudges but refuses to import them", async () => {
    fx.reminders.push({ id: 1, profile_id: P1, kind: "derived", title: "Drink water", detail: null, due_date: "2026-06-16", status: "open" });
    fx.reminders.push({ id: 2, profile_id: P1, kind: "manual", title: "Call clinic", detail: null, due_date: "2026-06-20", status: "open" });
    const rows = await roundTrip(FEATURE_EXCEL.reminders!);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.What === "Drink water")).toMatchObject({ Auto: "Yes" });

    const res = await FEATURE_EXCEL.reminders!.importRows(rows, { profileId: P1 });
    expect(res.skipped).toBe(1); // the derived row
    expect(res.updated).toBe(1); // the manual row
    expect(fx.created).toHaveLength(0);
    expect(res.warnings.some((w) => /auto reminder/.test(w))).toBe(true);
  });

  it("skips a row missing What or Due date", async () => {
    const res = await FEATURE_EXCEL.reminders!.importRows([
      { ID: "", What: "", "Due date": "2026-06-20" },
      { ID: "", What: "Walk", "Due date": "" },
    ], { profileId: P1 });
    expect(res.skipped).toBe(2);
    expect(res.added).toBe(0);
  });
});

describe("goals spec", () => {
  it("maps friendly metric label, direction and unit on round-trip + import", async () => {
    fx.goals.push({ id: 3, profile_id: P1, kind: "metric", title: "Lose weight", metric_kind: "weight", baseline: 80, target: 72, unit: "kg", direction: "decrease", target_date: "2026-12-01", status: "active" });
    const rows = await roundTrip(FEATURE_EXCEL.goals!);
    expect(rows[0]).toMatchObject({ Metric: "Weight", Direction: "Lower is better", Target: "72", Unit: "kg" });

    const res = await FEATURE_EXCEL.goals!.importRows(rows, { profileId: P1 });
    expect(res.updated).toBe(1);
    expect(fx.updated[0].row).toMatchObject({ metric_kind: "weight", direction: "decrease", target: 72, unit: "kg", profile_id: P1, status: "active" });
  });
});

describe("schedule spec", () => {
  it("converts minutes↔HH:MM and daily↔Every day", async () => {
    fx.blocks.push({ id: 5, profile_id: P1, kind: "medication", title: "Morning meds", start_min: 510, end_min: null, days: "daily" });
    const rows = await roundTrip(FEATURE_EXCEL.schedule!);
    expect(rows[0]).toMatchObject({ Type: "Medication", Start: "08:30", End: "", Days: "Every day" });

    const res = await FEATURE_EXCEL.schedule!.importRows([
      { ID: 5, Type: "Medication", What: "Morning meds", Start: "09:00", End: "09:15", Days: "Weekdays" },
    ], { profileId: P1 });
    expect(res.updated).toBe(1);
    expect(fx.updated[0].row).toMatchObject({ start_min: 540, end_min: 555, days: "weekdays", kind: "medication", profile_id: P1 });
  });
});

describe("medications spec", () => {
  it("round-trips Active as Yes/No and upserts under the active profile", async () => {
    fx.meds.push({ id: 9, profile_id: P1, drug: "Metformin", strength: "500 mg", form: "tablet", schedule: "BD", times: null, prescriber: "Dr A", start_date: "2026-01-01", end_date: null, notes: null, active: 1 });
    const rows = await roundTrip(FEATURE_EXCEL.medications!);
    expect(rows[0]).toMatchObject({ Drug: "Metformin", Strength: "500 mg", Active: "Yes" });

    const res = await FEATURE_EXCEL.medications!.importRows([
      { ID: "", Drug: "Aspirin", Strength: "75 mg", Schedule: "OD", Active: "No" },
    ], { profileId: P1 });
    expect(res.added).toBe(1);
    expect(fx.created[0].row).toMatchObject({ drug: "Aspirin", strength: "75 mg", schedule: "OD", active: 0, profile_id: P1 });
  });
});

describe("vitals spec", () => {
  it("maps metric label↔kind, fills the unit and skips non-numeric values", async () => {
    fx.metrics.push({ id: 11, profile_id: P1, kind: "weight", value: 78.5, unit: "kg", taken_at: "2026-06-01T08:00:00", note: null });
    const rows = await roundTrip(FEATURE_EXCEL.vitals!);
    expect(rows[0]).toMatchObject({ Metric: "Weight", Value: "78.5", Unit: "kg", Date: "2026-06-01 08:00" });

    const res = await FEATURE_EXCEL.vitals!.importRows([
      { ID: "", Metric: "Weight", Value: "77", Unit: "", Date: "2026-06-15" },
      { ID: "", Metric: "Weight", Value: "abc", Date: "2026-06-16" },
    ], { profileId: P1 });
    expect(res).toMatchObject({ added: 1, skipped: 1 });
    expect(fx.created[0].row).toMatchObject({ kind: "weight", value: 77, unit: "kg", taken_at: "2026-06-15", profile_id: P1 });
  });
});
