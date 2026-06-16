import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Exercises the per-feature Excel codec + specs against fully in-memory DB fakes.
 * Each spec's round-trip is: export rows → real SheetJS write → real read → import,
 * asserting friendly conversions (names, HH:MM, "Every day", "Lower is better",
 * Yes/No) and the update-by-ID vs add-new upsert behaviour.
 */

// Shared mutable fixtures the mocked DB wrappers read/write (hoisted for vi.mock).
const fx = vi.hoisted(() => ({
  profiles: [
    { id: 1, name: "Asha", is_self: 1 },
    { id: 2, name: "Ravi", is_self: 0 },
  ] as any[],
  reminders: [] as any[],
  goals: [] as any[],
  blocks: [] as any[],
  meds: [] as any[],
  metrics: [] as any[],
  created: [] as Array<{ table: string; row: any }>,
  updated: [] as Array<{ table: string; id: number; row: any }>,
}));

let nextId = 100;

vi.mock("@/db/profiles", () => ({ listProfiles: async () => fx.profiles }));
vi.mock("@/db/reminders", () => ({
  listManualReminders: async () => fx.reminders.filter((r) => r.kind === "manual"),
  listRemindersForExport: async () => fx.reminders.filter((r) => r.kind === "manual" || r.status === "open"),
  createManualReminder: async (r: any) => { fx.created.push({ table: "reminders", row: r }); return ++nextId; },
  updateManualReminder: async (id: number, r: any) => { fx.updated.push({ table: "reminders", id, row: r }); },
}));
vi.mock("@/db/goals", () => ({
  listAllGoals: async () => fx.goals,
  createGoal: async (g: any) => { fx.created.push({ table: "goals", row: g }); return ++nextId; },
  updateGoal: async (id: number, g: any) => { fx.updated.push({ table: "goals", id, row: g }); },
}));
vi.mock("@/db/schedule", () => ({
  listAllBlocks: async () => fx.blocks,
  createBlock: async (b: any) => { fx.created.push({ table: "schedule", row: b }); return ++nextId; },
  updateBlock: async (id: number, b: any) => { fx.updated.push({ table: "schedule", id, row: b }); },
}));
vi.mock("@/db/medications", () => ({
  listAllMedications: async () => fx.meds,
  createMedicationFull: async (m: any) => { fx.created.push({ table: "medications", row: m }); return ++nextId; },
  updateMedication: async (id: number, m: any) => { fx.updated.push({ table: "medications", id, row: m }); },
}));
vi.mock("@/db/metrics", () => ({
  listAllMetrics: async () => fx.metrics,
  addMetric: async (m: any) => { fx.created.push({ table: "metrics", row: m }); return ++nextId; },
  updateMetric: async (id: number, m: any) => { fx.updated.push({ table: "metrics", id, row: m }); },
}));

import {
  FEATURE_EXCEL,
  exportFeatureWorkbook,
  parseFeatureWorkbook,
  type FeatureExcelSpec,
} from "./featureExcel";

/** Export → bytes → parse back to header-keyed rows, the way the UI does it. */
async function roundTrip(spec: FeatureExcelSpec) {
  const { bytes } = await exportFeatureWorkbook(spec);
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
  it("exports a workbook whose first sheet round-trips to friendly rows", async () => {
    fx.reminders.push({ id: 7, profile_id: 1, kind: "manual", title: "Call clinic", detail: "Reschedule", due_date: "2026-06-20", status: "open" });
    const { bytes, rowCount } = await exportFeatureWorkbook(FEATURE_EXCEL.reminders!);
    expect(rowCount).toBe(1);
    const rows = await parseFeatureWorkbook(bytes);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ID: "7", Person: "Asha", What: "Call clinic", "Due date": "2026-06-20", Status: "Open", Auto: "No" });
  });

  it("with no data still writes a header-only template (rowCount 0)", async () => {
    const { bytes, rowCount } = await exportFeatureWorkbook(FEATURE_EXCEL.goals!);
    expect(rowCount).toBe(0);
    // The bytes carry the headers (a blank, fillable template), but no data rows.
    const rows = await parseFeatureWorkbook(bytes);
    expect(rows).toEqual([]);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(bytes, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]!];
    const grid = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(grid[0]).toEqual(FEATURE_EXCEL.goals!.headers);
  });
});

describe("reminders spec", () => {
  it("updates a row carrying an existing ID and adds a blank-ID row", async () => {
    fx.reminders.push({ id: 7, profile_id: 1, kind: "manual", title: "Call clinic", detail: null, due_date: "2026-06-20", status: "open" });
    const res = await FEATURE_EXCEL.reminders!.importRows([
      { ID: 7, Person: "Asha", What: "Call clinic back", Details: "", "Due date": "2026-06-21", Status: "Done" },
      { ID: "", Person: "Ravi", What: "Book test", Details: "fasting", "Due date": "2026-07-01", Status: "Open" },
    ]);
    expect(res).toMatchObject({ added: 1, updated: 1, skipped: 0 });
    expect(fx.updated[0]).toMatchObject({ table: "reminders", id: 7, row: { title: "Call clinic back", due_date: "2026-06-21", status: "done", profile_id: 1 } });
    expect(fx.created[0]).toMatchObject({ table: "reminders", row: { profile_id: 2, title: "Book test", due_date: "2026-07-01" } });
  });

  it("exports open auto/derived nudges but refuses to import them", async () => {
    fx.reminders.push({ id: 1, profile_id: 1, kind: "derived", title: "Drink water", detail: null, due_date: "2026-06-16", status: "open" });
    fx.reminders.push({ id: 2, profile_id: 1, kind: "manual", title: "Call clinic", detail: null, due_date: "2026-06-20", status: "open" });
    const rows = await roundTrip(FEATURE_EXCEL.reminders!);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.What === "Drink water")).toMatchObject({ Auto: "Yes" });

    const res = await FEATURE_EXCEL.reminders!.importRows(rows);
    expect(res.skipped).toBe(1); // the derived row
    expect(res.updated).toBe(1); // the manual row
    expect(fx.created).toHaveLength(0);
    expect(res.warnings.some((w) => /auto reminder/.test(w))).toBe(true);
  });

  it("skips a row missing What or Due date and warns on unknown person", async () => {
    const res = await FEATURE_EXCEL.reminders!.importRows([
      { ID: "", Person: "Asha", What: "", "Due date": "2026-06-20" },
      { ID: "", Person: "Nobody", What: "Walk", "Due date": "2026-06-20" },
    ]);
    expect(res.skipped).toBe(1);
    expect(res.added).toBe(1);
    expect(res.warnings.some((w) => /unknown person "Nobody"/.test(w))).toBe(true);
    expect(fx.created[0].row.profile_id).toBeNull();
  });
});

describe("goals spec", () => {
  it("maps friendly metric label, direction and unit on round-trip + import", async () => {
    fx.goals.push({ id: 3, profile_id: 1, kind: "metric", title: "Lose weight", metric_kind: "weight", baseline: 80, target: 72, unit: "kg", direction: "decrease", target_date: "2026-12-01", status: "active" });
    const rows = await roundTrip(FEATURE_EXCEL.goals!);
    expect(rows[0]).toMatchObject({ Metric: "Weight", Direction: "Lower is better", Target: "72", Unit: "kg" });

    const res = await FEATURE_EXCEL.goals!.importRows(rows);
    expect(res.updated).toBe(1);
    expect(fx.updated[0].row).toMatchObject({ metric_kind: "weight", direction: "decrease", target: 72, unit: "kg", profile_id: 1, status: "active" });
  });

  it("defaults a blank-person goal to the self profile", async () => {
    const res = await FEATURE_EXCEL.goals!.importRows([{ ID: "", Person: "", Goal: "Walk daily" }]);
    expect(res.added).toBe(1);
    expect(fx.created[0].row).toMatchObject({ profile_id: 1, kind: "habit", title: "Walk daily" });
  });
});

describe("schedule spec", () => {
  it("converts minutes↔HH:MM and daily↔Every day", async () => {
    fx.blocks.push({ id: 5, profile_id: 2, kind: "medication", title: "Morning meds", start_min: 510, end_min: null, days: "daily" });
    const rows = await roundTrip(FEATURE_EXCEL.schedule!);
    expect(rows[0]).toMatchObject({ Person: "Ravi", Type: "Medication", Start: "08:30", End: "", Days: "Every day" });

    const res = await FEATURE_EXCEL.schedule!.importRows([
      { ID: 5, Person: "Ravi", Type: "Medication", What: "Morning meds", Start: "09:00", End: "09:15", Days: "Weekdays" },
    ]);
    expect(res.updated).toBe(1);
    expect(fx.updated[0].row).toMatchObject({ start_min: 540, end_min: 555, days: "weekdays", kind: "medication" });
  });
});

describe("medications spec", () => {
  it("round-trips Active as Yes/No and upserts", async () => {
    fx.meds.push({ id: 9, profile_id: 1, drug: "Metformin", strength: "500 mg", form: "tablet", schedule: "BD", times: null, prescriber: "Dr A", start_date: "2026-01-01", end_date: null, notes: null, active: 1 });
    const rows = await roundTrip(FEATURE_EXCEL.medications!);
    expect(rows[0]).toMatchObject({ Drug: "Metformin", Strength: "500 mg", Active: "Yes" });

    const res = await FEATURE_EXCEL.medications!.importRows([
      { ID: "", Person: "Asha", Drug: "Aspirin", Strength: "75 mg", Schedule: "OD", Active: "No" },
    ]);
    expect(res.added).toBe(1);
    expect(fx.created[0].row).toMatchObject({ drug: "Aspirin", strength: "75 mg", schedule: "OD", active: 0, profile_id: 1 });
  });
});

describe("vitals spec", () => {
  it("maps metric label↔kind, fills the unit and skips non-numeric values", async () => {
    fx.metrics.push({ id: 11, profile_id: 1, kind: "weight", value: 78.5, unit: "kg", taken_at: "2026-06-01T08:00:00", note: null });
    const rows = await roundTrip(FEATURE_EXCEL.vitals!);
    expect(rows[0]).toMatchObject({ Metric: "Weight", Value: "78.5", Unit: "kg", Date: "2026-06-01 08:00" });

    const res = await FEATURE_EXCEL.vitals!.importRows([
      { ID: "", Person: "Asha", Metric: "Weight", Value: "77", Unit: "", Date: "2026-06-15" },
      { ID: "", Person: "Asha", Metric: "Weight", Value: "abc", Date: "2026-06-16" },
    ]);
    expect(res).toMatchObject({ added: 1, skipped: 1 });
    expect(fx.created[0].row).toMatchObject({ kind: "weight", value: 77, unit: "kg", taken_at: "2026-06-15" });
  });
});
