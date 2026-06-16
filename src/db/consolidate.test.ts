import { describe, it, expect } from "vitest";
import type { SqlDb } from "sharedcorelib/db";
import { migrateLegacyDb, isConsolidated, type SealText } from "./consolidate";

/**
 * A small in-memory SqlDb that understands exactly the SQL the migrator emits:
 *   - SELECT * FROM <t>                          → all rows
 *   - SELECT COUNT(*) AS n FROM <t> [WHERE ...]  → {n}
 *   - INSERT [OR IGNORE|REPLACE] INTO <t> (cols) VALUES (?...) [ON CONFLICT(pk) DO UPDATE ...]
 *   - UPDATE <t> SET ... WHERE ...               (not needed by the migrator path)
 * Rows are keyed by the first listed column (the PK / person_key) for OR IGNORE / conflict.
 */
function fakeDb(seed: Record<string, Record<string, unknown>[]> = {}): SqlDb & {
  rows: (t: string) => Record<string, unknown>[];
} {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const tbl = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };
  for (const [name, rows] of Object.entries(seed)) {
    rows.forEach((r, i) => tbl(name).set(String(r[Object.keys(r)[0]!] ?? i), { ...r }));
  }

  return {
    rows: (t: string) => [...tbl(t).values()],
    select: (async (sql: string, params: unknown[] = []) => {
      const from = sql.match(/FROM\s+([A-Za-z0-9_]+)/i)?.[1] ?? "";
      const all = [...tbl(from).values()];
      if (/COUNT\(\*\)/i.test(sql)) {
        let rows = all;
        const where = sql.match(/WHERE\s+([A-Za-z_]+)\s*=\s*\?/i);
        if (where) rows = rows.filter((r) => String(r[where[1]!]) === String(params[0]));
        // status IN (...) filters used by the ledger checks
        const statusIn = sql.match(/status\s+IN\s*\(([^)]+)\)/i);
        if (statusIn) {
          const allowed = statusIn[1]!.split(",").map((s) => s.trim().replace(/'/g, ""));
          rows = rows.filter((r) => allowed.includes(String(r.status)));
        }
        const eqStatus = sql.match(/status\s*=\s*'([^']+)'/i);
        if (eqStatus) rows = rows.filter((r) => String(r.status) === eqStatus[1]);
        return [{ n: rows.length }];
      }
      return all;
    }) as SqlDb["select"],
    execute: async (sql: string, params: unknown[] = []) => {
      const m = sql.match(/INTO\s+([A-Za-z0-9_]+)\s*\(([^)]+)\)/i);
      if (m) {
        const t = m[1]!;
        const cols = m[2]!.split(",").map((c) => c.trim());
        const row: Record<string, unknown> = {};
        cols.forEach((c, i) => (row[c] = params[i]));
        const key = String(row[cols[0]!]);
        const orIgnore = /INSERT\s+OR\s+IGNORE/i.test(sql);
        if (orIgnore && tbl(t).has(key)) return { rowsAffected: 0 };
        // ON CONFLICT DO UPDATE → upsert (merge): replace is fine for our assertions.
        tbl(t).set(key, row);
        return { rowsAffected: 1 };
      }
      return { rowsAffected: 0 };
    },
  };
}

const passThroughSeal: SealText = async (plain) => (plain == null ? null : `scv1:SEALED(${plain})`);

describe("migrateLegacyDb", () => {
  it("copies simple tables 1:1 and records verified ledger rows", async () => {
    const legacy = fakeDb({
      settings: [{ key: "locale", value: "en" }],
      app_launches: [{ launch_day: "2026-06-01", opens: 3 }],
      metrics: [
        { id: 1, profile_id: 1, kind: "weight", value: 80, taken_at: "2026-06-01", source: "manual" },
        { id: 2, profile_id: 1, kind: "weight", value: 79, taken_at: "2026-06-02", source: "manual" },
      ],
      profiles: [],
      documents: [],
      profile_baseline: [],
      goals: [],
      reminders: [],
      daily_tasks: [],
      task_completions: [],
      water_log: [],
      schedule_blocks: [],
      medications: [],
    });
    const suite = fakeDb();

    const res = await migrateLegacyDb(legacy, suite, passThroughSeal);
    expect(res.migrated).toBe(true);

    expect(suite.rows("myhealth_settings")).toHaveLength(1);
    expect(suite.rows("myhealth_metrics")).toHaveLength(2);
    // every legacy id is preserved
    expect(suite.rows("myhealth_metrics").map((r) => r.id).sort()).toEqual([1, 2]);

    const verified = suite.rows("myhealth_migration_ledger").filter((r) => r.status === "verified");
    expect(verified.find((r) => r.table_name === "myhealth_metrics")?.rows_copied).toBe(2);
    expect(await isConsolidated(suite)).toBe(true);
  });

  it("fans a legacy profile onto person + facet + the thin link (preserving the integer id)", async () => {
    const legacy = fakeDb({
      profiles: [
        {
          id: 5,
          name: "Me",
          relationship: null,
          is_self: 1,
          dob: "1990-01-01",
          sex: "male",
          blood_group: "O+",
          height_cm: 180,
          photo_ref: null,
          notes: "n",
          emergency_contact: "Jane",
          emergency_phone: "999",
          emergency_email: null,
          organ_donor: 1,
          advance_directive: "DNR",
          created_at: "2026-01-01",
        },
      ],
      documents: [],
      settings: [], app_launches: [], profile_baseline: [], metrics: [], goals: [],
      reminders: [], daily_tasks: [], task_completions: [], water_log: [], schedule_blocks: [], medications: [],
    });
    const suite = fakeDb();
    await migrateLegacyDb(legacy, suite, passThroughSeal);

    const link = suite.rows("myhealth_profiles");
    expect(link).toHaveLength(1);
    expect(link[0]!.id).toBe(5);
    expect(link[0]!.person_key).toBe("self"); // is_self → 'self'
    expect(link[0]!.emergency_contact).toBe("Jane");

    const person = suite.rows("common_person")[0]!;
    expect(person.display_name).toBe("Me");
    expect(person.contact_phone).toBe("999"); // emergency phone → spine contact

    const facet = suite.rows("myhealth_health_facet")[0]!;
    expect(facet.sex).toBe("male");
    expect(facet.organ_donor).toBe(1);
    expect(facet.advance_directive).toBe("DNR");
  });

  it("seals documents.extracted_text in transit (no plaintext lands in suite.db)", async () => {
    const legacy = fakeDb({
      documents: [
        { id: 1, profile_id: 1, doc_type: "lab_report", title: "CBC", provider: null, doc_date: null, file_name: "blob-1", mime: "application/pdf", size_bytes: 10, extracted_text: "WBC 6.1", created_at: "2026-01-01" },
        { id: 2, profile_id: 1, doc_type: "bill", title: "B", provider: null, doc_date: null, file_name: "blob-2", mime: null, size_bytes: 5, extracted_text: null, created_at: "2026-01-02" },
      ],
      profiles: [],
      settings: [], app_launches: [], profile_baseline: [], metrics: [], goals: [],
      reminders: [], daily_tasks: [], task_completions: [], water_log: [], schedule_blocks: [], medications: [],
    });
    const suite = fakeDb();
    await migrateLegacyDb(legacy, suite, passThroughSeal);

    const docs = suite.rows("myhealth_documents").sort((a, b) => Number(a.id) - Number(b.id));
    expect(docs).toHaveLength(2);
    // The plaintext column is GONE — only the sealed `extracted_text_enc` column is written.
    expect(docs[0]).not.toHaveProperty("extracted_text");
    expect(docs[0]!.extracted_text_enc).toBe("scv1:SEALED(WBC 6.1)"); // sealed via the injected SealText
    expect(docs[1]!.extracted_text_enc).toBeNull(); // null stays null
  });

  it("is idempotent/resumable: a second run skips already-verified tables", async () => {
    const legacy = fakeDb({
      metrics: [{ id: 1, profile_id: 1, kind: "weight", value: 80, taken_at: "t", source: "manual" }],
      profiles: [], documents: [],
      settings: [], app_launches: [], profile_baseline: [], goals: [],
      reminders: [], daily_tasks: [], task_completions: [], water_log: [], schedule_blocks: [], medications: [],
    });
    const suite = fakeDb();
    const first = await migrateLegacyDb(legacy, suite, passThroughSeal);
    expect(first.skipped).toHaveLength(0);

    const second = await migrateLegacyDb(legacy, suite, passThroughSeal);
    expect(second.skipped).toContain("myhealth_metrics");
    expect(second.skipped).toContain("myhealth_profiles");
    // no duplicate rows from the second pass (OR IGNORE on preserved ids)
    expect(suite.rows("myhealth_metrics")).toHaveLength(1);
  });

  it("verify fails (throws) when a row-count mismatch is detected", async () => {
    // legacy reports 2 metric rows but the suite copy will only see what's seeded; force a
    // mismatch by making the COUNT path disagree via a stubbed legacy select.
    const legacy = fakeDb({
      metrics: [{ id: 1, profile_id: 1, kind: "w", value: 1, taken_at: "t", source: "manual" }],
      profiles: [], documents: [],
      settings: [], app_launches: [], profile_baseline: [], goals: [],
      reminders: [], daily_tasks: [], task_completions: [], water_log: [], schedule_blocks: [], medications: [],
    });
    const realSelect = legacy.select.bind(legacy);
    // Inflate the COUNT for metrics only, leaving the row copy at 1 → mismatch.
    legacy.select = (async (sql: string, params: unknown[] = []) => {
      if (/COUNT\(\*\)/i.test(sql) && /FROM\s+metrics/i.test(sql)) return [{ n: 99 }];
      return realSelect(sql, params);
    }) as SqlDb["select"];
    const suite = fakeDb();
    await expect(migrateLegacyDb(legacy, suite, passThroughSeal)).rejects.toThrow(/verify failed/i);
  });
});
