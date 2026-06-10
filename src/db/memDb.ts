import type { SqlDb } from "sharedcorelib/db";

/**
 * Tiny in-memory SqlDb for unit tests. Interprets the narrow SQL the entity/facet/ICE
 * stores emit: CREATE TABLE (noop), INSERT OR REPLACE, SELECT * [WHERE col = ?]
 * [ORDER BY col], DELETE ... WHERE col = ?. Rows are keyed by the first column of each
 * INSERT (the PK / person_key). Mirrors the fake the core's own entity tests use.
 */
export function memDb(): SqlDb {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const tbl = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };
  const tableOf = (sql: string) => sql.match(/(?:INTO|FROM)\s+"([^"]+)"/i)?.[1] ?? "";
  return {
    execute: async (sql, params = []) => {
      const s = sql.trim();
      if (/^CREATE TABLE/i.test(s)) return {};
      if (/^INSERT OR REPLACE/i.test(s)) {
        const cols = [...s.matchAll(/"([^"]+)"/g)].slice(1).map((m) => m[1]!); // skip table name
        const row: Record<string, unknown> = {};
        cols.forEach((c, i) => (row[c] = (params as unknown[])[i]));
        tbl(tableOf(s)).set(String(row[cols[0]!]), row);
        return { rowsAffected: 1 };
      }
      if (/^DELETE/i.test(s)) {
        const t = tbl(tableOf(s));
        const key = String((params as unknown[])[0]);
        const col = s.match(/WHERE\s+(\w+)\s*=/i)?.[1];
        for (const [k, v] of t) if (col && String(v[col]) === key) t.delete(k);
        return { rowsAffected: 1 };
      }
      return {};
    },
    select: async (sql, params = []) => {
      const rows = [...tbl(tableOf(sql)).values()];
      let out = rows;
      const where = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      if (where) out = rows.filter((r) => String(r[where[1]!]) === String((params as unknown[])[0]));
      const order = sql.match(/ORDER BY\s+(\w+)/i);
      if (order) out = [...out].sort((a, b) => String(a[order[1]!]).localeCompare(String(b[order[1]!])));
      const limit = sql.match(/LIMIT\s+(\d+)/i);
      if (limit) out = out.slice(0, Number(limit[1]));
      return out as never;
    },
  };
}
