/**
 * Per-feature, human-friendly Excel export/import — **scoped to one profile**.
 *
 * Distinct from the whole-store backup (`@/lib/excelBackup` → `sharedcorelib/backup`),
 * which dumps every raw table one-sheet-each for disaster recovery. THIS module gives
 * each tab (Reminders, Goals, Schedule, Medications, Vitals) a small, readable workbook
 * for the **currently selected person only** that the user can edit offline in
 * Excel/Sheets and re-import:
 *   - friendly column headers, one sheet per feature (no `profile_id` — the whole file
 *     belongs to the active profile, whose name is in the file name),
 *   - `HH:MM` instead of minutes, "Every day" instead of `daily`, "Lower is better"
 *     instead of `decrease`, "Yes/No" for flags, metric labels instead of kinds,
 *   - a leading **ID** column: a row whose ID matches one of THIS profile's records
 *     UPDATES it; a row with a blank ID is ADDED as new (under the active profile). So
 *     you can tweak existing items and append new ones in the same file.
 *
 * Pure-ish: the SheetJS codec is lazy-imported; all DB access goes through the app's
 * typed `@/db` wrappers. No network — this is on-device data the user moves by hand.
 */
import { listRemindersForExport, createManualReminder, updateManualReminder, type Reminder } from "@/db/reminders";
import { listGoals, createGoal, updateGoal, type Goal } from "@/db/goals";
import { listBlocks, createBlock, updateBlock, type ScheduleKind } from "@/db/schedule";
import {
  listMedications, createMedicationFull, updateMedication, type MedicationFields,
} from "@/db/medications";
import { listMetricsForProfile, addMetric, updateMetric } from "@/db/metrics";
import { metricKind, METRIC_KINDS } from "@/lib/metricKinds";
import { minutesToHHMM, hhmmToMinutes } from "@/lib/utils";

/** A cell value as we write it (export) — strings/numbers, never undefined. */
export type FriendlyRow = Record<string, string | number | null>;
/** A cell value as SheetJS hands it back on import. */
export type RawRow = Record<string, string | number | boolean | Date | null | undefined>;

/** Everything a feature's export/import is scoped to — currently just the active person. */
export interface ExcelContext {
  profileId: number;
}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

export interface FeatureExcelSpec {
  /** Stable key — used for the file name (`myHealth-<key>-<profile>.xlsx`). */
  key: string;
  /** Human label — the sheet name and the dialog title. */
  label: string;
  /** Column order written to the sheet (also the import header contract). */
  headers: string[];
  /** Build the friendly rows for the active profile. */
  exportRows(ctx: ExcelContext): Promise<FriendlyRow[]>;
  /** Upsert parsed rows into the active profile; returns a human-readable summary. */
  importRows(rows: RawRow[], ctx: ExcelContext): Promise<ImportSummary>;
}

// ── codec ────────────────────────────────────────────────────────────────────

/** Excel sheet names are ≤31 chars and forbid []:*?/\ — sanitize. */
function safeSheetName(label: string): string {
  return label.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet1";
}

/**
 * Build the `.xlsx` bytes for one feature and one profile. Always writes the header row
 * (even with no data — a blank, fillable template), and reports how many data rows were
 * included so the UI can tell the user when it exported an empty template vs. real data.
 */
export async function exportFeatureWorkbook(
  spec: FeatureExcelSpec,
  ctx: ExcelContext,
): Promise<{ bytes: Uint8Array; rowCount: number }> {
  const XLSX = await import("xlsx");
  const rows = await spec.exportRows(ctx);
  // With data: a normal sheet. Empty: a header-only template (json_to_sheet([]) would
  // emit an empty sheet with no header, so write the header row explicitly).
  const ws = rows.length
    ? XLSX.utils.json_to_sheet(rows, { header: spec.headers })
    : XLSX.utils.aoa_to_sheet([spec.headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(spec.label));
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { bytes: new Uint8Array(buf), rowCount: rows.length };
}

/** Read the first sheet of a workbook into raw header-keyed rows. */
export async function parseFeatureWorkbook(bytes: ArrayBuffer | Uint8Array): Promise<RawRow[]> {
  const XLSX = await import("xlsx");
  // raw:false → cells come back as their formatted display strings (dates stay readable).
  const wb = XLSX.read(bytes, { type: "array" });
  const first = wb.SheetNames[0];
  if (!first) return [];
  const ws = wb.Sheets[first];
  return XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null, raw: false });
}

// ── value helpers ──────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

/** Coerce a cell to a 'YYYY-MM-DD' date string (handles text, Date, Excel serials). */
function dateStr(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date → JS date (epoch 1899-12-30, UTC to avoid TZ drift).
    const ms = Math.round((v - 25569) * 86400000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  return s; // leave anything else as the user typed it
}

/** Map a stored enum value to its friendly label (passthrough if unknown). */
function toLabel<T extends string>(v: T, map: Record<T, string>): string {
  return map[v] ?? v;
}
/** Map a friendly label (or the raw enum) back to a stored enum value. */
function fromLabel<T extends string>(v: unknown, map: Record<T, string>, fallback: T): T {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "") return fallback;
  for (const [k, label] of Object.entries(map) as [T, string][]) {
    if (label.toLowerCase() === s || k.toLowerCase() === s) return k;
  }
  return fallback;
}

/** The data row index → its 1-based spreadsheet row (header is row 1). */
const sheetRow = (i: number) => i + 2;

// ── enum label maps ──────────────────────────────────────────────────────────

const REMINDER_STATUS: Record<Reminder["status"], string> = {
  open: "Open", done: "Done", dismissed: "Dismissed",
};
const GOAL_DIRECTION: Record<Goal["direction"], string> = {
  decrease: "Lower is better", increase: "Higher is better", maintain: "Maintain",
};
const GOAL_STATUS: Record<Goal["status"], string> = {
  active: "Active", achieved: "Achieved", archived: "Archived",
};
const SCHEDULE_KIND: Record<ScheduleKind, string> = {
  medication: "Medication", meal: "Meal", activity: "Activity",
  appointment: "Appointment", other: "Other",
};
const SCHEDULE_DAYS: Record<string, string> = { daily: "Every day", weekdays: "Weekdays" };

function daysToLabel(days: string): string {
  return SCHEDULE_DAYS[days] ?? days;
}
function daysFromLabel(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "" || s === "every day" || s === "daily") return "daily";
  if (s === "weekdays") return "weekdays";
  return String(v).trim(); // pass through a CSV day list as-is
}

/** Metric kind → label and back (custom kinds pass through unchanged). */
function metricLabel(kind: string): string {
  return metricKind(kind)?.label ?? kind;
}
function metricKindFromLabel(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const lower = s.toLowerCase();
  const hit = METRIC_KINDS.find((m) => m.label.toLowerCase() === lower || m.kind.toLowerCase() === lower);
  return hit?.kind ?? s;
}

// ── feature specs ──────────────────────────────────────────────────────────────

function isAutoRow(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "auto" || s === "derived" || s === "true";
}

const reminders: FeatureExcelSpec = {
  key: "reminders",
  label: "Reminders",
  headers: ["ID", "What", "Details", "Due date", "Status", "Auto"],
  async exportRows({ profileId }) {
    return (await listRemindersForExport(profileId)).map((r) => ({
      ID: r.id,
      What: r.title,
      Details: r.detail ?? "",
      "Due date": r.due_date,
      Status: toLabel(r.status, REMINDER_STATUS),
      Auto: r.kind === "derived" ? "Yes" : "No",
    }));
  },
  async importRows(rows, { profileId }) {
    // Manual reminders that belong to THIS profile are the only upsert targets.
    const existing = new Set(
      (await listRemindersForExport(profileId)).filter((r) => r.kind === "manual").map((r) => r.id),
    );
    const out: ImportSummary = { added: 0, updated: 0, skipped: 0, warnings: [] };
    for (const [i, row] of rows.entries()) {
      // Auto/derived reminders are app-managed — never created or overwritten from a sheet.
      if (isAutoRow(row["Auto"])) {
        out.skipped++;
        out.warnings.push(`Row ${sheetRow(i)}: auto reminder — managed by the app, not imported.`);
        continue;
      }
      const title = str(row["What"]);
      if (!title) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: missing "What" — skipped.`); continue; }
      const due = dateStr(row["Due date"]);
      if (!due) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: missing "Due date" — skipped.`); continue; }
      const status = fromLabel(row["Status"], REMINDER_STATUS, "open");
      const id = num(row["ID"]);
      const fields = { profile_id: profileId, title, detail: str(row["Details"]), due_date: due, status };
      if (id != null && existing.has(id)) {
        await updateManualReminder(id, fields);
        out.updated++;
      } else {
        const newId = await createManualReminder({ profile_id: profileId, title, detail: fields.detail ?? undefined, due_date: due });
        if (status !== "open") await updateManualReminder(newId, fields);
        out.added++;
        if (id != null) out.warnings.push(`Row ${sheetRow(i)}: ID ${id} not found for this person — added as new.`);
      }
    }
    return out;
  },
};

const goals: FeatureExcelSpec = {
  key: "goals",
  label: "Goals",
  headers: ["ID", "Goal", "Metric", "Baseline", "Target", "Unit", "Direction", "Target date", "Status"],
  async exportRows({ profileId }) {
    return (await listGoals(profileId)).map((g) => ({
      ID: g.id,
      Goal: g.title,
      Metric: g.metric_kind ? metricLabel(g.metric_kind) : "",
      Baseline: g.baseline ?? "",
      Target: g.target ?? "",
      Unit: g.unit ?? "",
      Direction: toLabel(g.direction, GOAL_DIRECTION),
      "Target date": g.target_date ?? "",
      Status: toLabel(g.status, GOAL_STATUS),
    }));
  },
  async importRows(rows, { profileId }) {
    const existing = new Set((await listGoals(profileId)).map((g) => g.id));
    const out: ImportSummary = { added: 0, updated: 0, skipped: 0, warnings: [] };
    for (const [i, row] of rows.entries()) {
      const title = str(row["Goal"]);
      if (!title) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: missing "Goal" — skipped.`); continue; }
      const mk = metricKindFromLabel(row["Metric"]);
      const unit = str(row["Unit"]) ?? (mk ? metricKind(mk)?.unit ?? null : null);
      const fields = {
        profile_id: profileId,
        kind: mk ? "metric" : "habit",
        title,
        metric_kind: mk,
        baseline: num(row["Baseline"]),
        target: num(row["Target"]),
        unit,
        direction: fromLabel(row["Direction"], GOAL_DIRECTION, mk ? metricKind(mk)?.direction ?? "decrease" : "decrease"),
        target_date: dateStr(row["Target date"]),
        status: fromLabel(row["Status"], GOAL_STATUS, "active"),
      };
      const id = num(row["ID"]);
      if (id != null && existing.has(id)) {
        await updateGoal(id, fields);
        out.updated++;
      } else {
        const newId = await createGoal({
          profile_id: profileId, kind: fields.kind, title, metric_kind: mk,
          baseline: fields.baseline, target: fields.target, unit, direction: fields.direction,
          target_date: fields.target_date,
        });
        if (fields.status !== "active") await updateGoal(newId, fields);
        out.added++;
        if (id != null) out.warnings.push(`Row ${sheetRow(i)}: ID ${id} not found for this person — added as new.`);
      }
    }
    return out;
  },
};

const schedule: FeatureExcelSpec = {
  key: "schedule",
  label: "Schedule",
  headers: ["ID", "Type", "What", "Start", "End", "Days"],
  async exportRows({ profileId }) {
    return (await listBlocks(profileId)).map((b) => ({
      ID: b.id,
      Type: toLabel(b.kind, SCHEDULE_KIND),
      What: b.title,
      Start: minutesToHHMM(b.start_min),
      End: b.end_min != null ? minutesToHHMM(b.end_min) : "",
      Days: daysToLabel(b.days),
    }));
  },
  async importRows(rows, { profileId }) {
    const existing = new Set((await listBlocks(profileId)).map((b) => b.id));
    const out: ImportSummary = { added: 0, updated: 0, skipped: 0, warnings: [] };
    for (const [i, row] of rows.entries()) {
      const title = str(row["What"]);
      if (!title) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: missing "What" — skipped.`); continue; }
      const start = str(row["Start"]);
      if (!start) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: missing "Start" time — skipped.`); continue; }
      const endRaw = str(row["End"]);
      const fields = {
        profile_id: profileId,
        kind: fromLabel(row["Type"], SCHEDULE_KIND, "other"),
        title,
        start_min: hhmmToMinutes(start),
        end_min: endRaw ? hhmmToMinutes(endRaw) : null,
        days: daysFromLabel(row["Days"]),
      };
      const id = num(row["ID"]);
      if (id != null && existing.has(id)) {
        await updateBlock(id, fields);
        out.updated++;
      } else {
        await createBlock({ profile_id: profileId, kind: fields.kind, title, start_min: fields.start_min, end_min: fields.end_min, days: fields.days });
        out.added++;
        if (id != null) out.warnings.push(`Row ${sheetRow(i)}: ID ${id} not found for this person — added as new.`);
      }
    }
    return out;
  },
};

const YES_NO: Record<"1" | "0", string> = { "1": "Yes", "0": "No" };
function activeFromLabel(v: unknown): number {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "" || s === "yes" || s === "1" || s === "true" || s === "active") return 1;
  return 0;
}

const medications: FeatureExcelSpec = {
  key: "medications",
  label: "Medications",
  headers: ["ID", "Drug", "Strength", "Form", "Schedule", "Times", "Prescriber", "Start date", "End date", "Notes", "Active"],
  async exportRows({ profileId }) {
    return (await listMedications(profileId, false)).map((m) => ({
      ID: m.id,
      Drug: m.drug,
      Strength: m.strength ?? "",
      Form: m.form ?? "",
      Schedule: m.schedule ?? "",
      Times: m.times ?? "",
      Prescriber: m.prescriber ?? "",
      "Start date": m.start_date ?? "",
      "End date": m.end_date ?? "",
      Notes: m.notes ?? "",
      Active: m.active ? YES_NO["1"] : YES_NO["0"],
    }));
  },
  async importRows(rows, { profileId }) {
    const existing = new Set((await listMedications(profileId, false)).map((m) => m.id));
    const out: ImportSummary = { added: 0, updated: 0, skipped: 0, warnings: [] };
    for (const [i, row] of rows.entries()) {
      const drug = str(row["Drug"]);
      if (!drug) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: missing "Drug" — skipped.`); continue; }
      const fields: MedicationFields = {
        profile_id: profileId,
        drug,
        strength: str(row["Strength"]),
        form: str(row["Form"]),
        schedule: str(row["Schedule"]),
        times: str(row["Times"]),
        prescriber: str(row["Prescriber"]),
        start_date: dateStr(row["Start date"]),
        end_date: dateStr(row["End date"]),
        notes: str(row["Notes"]),
        active: activeFromLabel(row["Active"]),
      };
      const id = num(row["ID"]);
      if (id != null && existing.has(id)) {
        await updateMedication(id, fields);
        out.updated++;
      } else {
        await createMedicationFull(fields);
        out.added++;
        if (id != null) out.warnings.push(`Row ${sheetRow(i)}: ID ${id} not found for this person — added as new.`);
      }
    }
    return out;
  },
};

const vitals: FeatureExcelSpec = {
  key: "vitals",
  label: "Vitals",
  headers: ["ID", "Metric", "Value", "Unit", "Date", "Note"],
  async exportRows({ profileId }) {
    return (await listMetricsForProfile(profileId)).map((m) => ({
      ID: m.id,
      Metric: metricLabel(m.kind),
      Value: m.value,
      Unit: m.unit ?? "",
      Date: m.taken_at.slice(0, 16).replace("T", " "),
      Note: m.note ?? "",
    }));
  },
  async importRows(rows, { profileId }) {
    const existing = new Set((await listMetricsForProfile(profileId)).map((m) => m.id));
    const out: ImportSummary = { added: 0, updated: 0, skipped: 0, warnings: [] };
    for (const [i, row] of rows.entries()) {
      const kind = metricKindFromLabel(row["Metric"]);
      if (!kind) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: missing "Metric" — skipped.`); continue; }
      const value = num(row["Value"]);
      if (value == null) { out.skipped++; out.warnings.push(`Row ${sheetRow(i)}: "${kind}" has no numeric Value — skipped.`); continue; }
      const unit = str(row["Unit"]) ?? metricKind(kind)?.unit ?? null;
      const takenAt = str(row["Date"]) ?? new Date().toISOString().slice(0, 10);
      const fields = { profile_id: profileId, kind, value, unit, taken_at: takenAt, note: str(row["Note"]) };
      const id = num(row["ID"]);
      if (id != null && existing.has(id)) {
        await updateMetric(id, fields);
        out.updated++;
      } else {
        await addMetric({ profile_id: profileId, kind, value, unit: unit ?? undefined, taken_at: takenAt, note: fields.note ?? undefined });
        out.added++;
        if (id != null) out.warnings.push(`Row ${sheetRow(i)}: ID ${id} not found for this person — added as new.`);
      }
    }
    return out;
  },
};

/** Every feature that has an Excel export/import, keyed for lookup from a page. */
export const FEATURE_EXCEL: Record<string, FeatureExcelSpec> = {
  reminders, goals, schedule, medications, vitals,
};
