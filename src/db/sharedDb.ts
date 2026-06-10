import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/environment";
import { registerSchemas, type SqlDb } from "sharedcorelib/db";
import { createIceStore, type IceStore } from "sharedcorelib/ice";
import { MYHEALTH_SCHEMAS } from "./schemas";
import { createHealthPeople, type HealthPeople } from "./entities";
import { createHealthTimeline, type HealthTimeline } from "./sharedTimeline";
import {
  createHealthBreakGlassContributor,
  type PersonBreakGlassInput,
} from "@/breakglass/contributor";
import type { BreakGlassContributor } from "sharedcorelib/breakglass";

/**
 * Shared suite database wiring (sharedcorelib/db). The suite shares ONE SQLite —
 * `<shared core>/db/suite.db`, path from the `shared_core_db_path` Tauri command — with
 * per-app + common tables. This is SEPARATE from and additive to myHealth's own
 * `myhealth.db` (see db/client.ts), which is untouched. Standalone-safe: outside Tauri
 * (or if the shared dir is unusable) callers just skip the shared store.
 *
 * On launch myHealth registers its schemas (idempotent, append-only) so the common
 * `common#IceCard` emergency-card table exists; the Ice page reads/writes it so the same
 * card is shared with myFinance.
 */
let dbPromise: Promise<Database> | null = null;

async function openSharedDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const path = await invoke<string>("shared_core_db_path");
      return Database.load(`sqlite:${path}`);
    })();
  }
  return dbPromise;
}

/** Adapt the Tauri SQL plugin handle to the lib's injected `SqlDb` interface. */
function adapter(db: Database): SqlDb {
  return {
    select: <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      db.select<T[]>(sql, params),
    execute: async (sql: string, params: unknown[] = []) => {
      const r = await db.execute(sql, params);
      return { rowsAffected: r.rowsAffected, lastInsertId: r.lastInsertId ?? undefined };
    },
  };
}

/**
 * Register myHealth's schemas into the shared suite DB and ensure the common ICE table
 * exists. Best-effort + idempotent — call once on launch (inside Tauri). A schema
 * conflict THROWS (caught here) so the shared store is never corrupted.
 */
export async function initSharedDb(): Promise<void> {
  if (!isTauri()) return;
  try {
    const sql = adapter(await openSharedDb());
    await registerSchemas(sql, MYHEALTH_SCHEMAS);
    await createIceStore(sql).ensure();
    // Shared-entity spine (person/event/document) + myHealth's medical facet.
    await createHealthPeople(sql).ensure();
  } catch (e) {
    console.warn("shared-db init skipped:", e);
  }
}

/**
 * Handle on the shared person spine + myHealth's medical facet (profiles, pets, family).
 * Returns null outside Tauri / if the shared DB can't be opened, so pages degrade to the
 * app's own `myhealth.db` profiles. No health data egresses — all local SQLite.
 */
export async function healthPeople(): Promise<HealthPeople | null> {
  if (!isTauri()) return null;
  try {
    return createHealthPeople(adapter(await openSharedDb()));
  } catch (e) {
    console.warn("shared people store unavailable:", e);
    return null;
  }
}

/**
 * Handle on the shared `document` + `event` spine for medical docs and visits. Document
 * BYTES stay AES-GCM under the per-device key in the vault; only opaque `blob_ref`
 * metadata is mirrored here. Returns null outside Tauri. No health data egresses.
 */
export async function healthTimeline(): Promise<HealthTimeline | null> {
  if (!isTauri()) return null;
  try {
    return createHealthTimeline(adapter(await openSharedDb()));
  } catch (e) {
    console.warn("shared timeline unavailable:", e);
    return null;
  }
}

/**
 * myHealth's live break-glass contributor (the suite's SECOND consumer of core
 * break-glass). It reads each person's common ICE card + medical facet from the shared
 * suite DB and exposes them as tier-redacted sections. Returns null outside Tauri. The
 * assembled slice is sealed by core under an out-of-band passphrase — NO health data
 * egresses; this is local assembly only.
 */
export async function healthBreakGlassContributor(): Promise<BreakGlassContributor | null> {
  if (!isTauri()) return null;
  try {
    const sql = adapter(await openSharedDb());
    const people = createHealthPeople(sql);
    const ice = createIceStore(sql);
    return createHealthBreakGlassContributor(async (): Promise<PersonBreakGlassInput[]> => {
      const all = await people.list();
      const out: PersonBreakGlassInput[] = [];
      for (const pw of all) {
        out.push({
          displayName: pw.person.display_name ?? pw.person.person_key,
          ice: await ice.get(pw.person.person_key),
          facet: pw.facet,
        });
      }
      return out;
    });
  } catch (e) {
    console.warn("break-glass contributor unavailable:", e);
    return null;
  }
}

/**
 * Handle on the shared common ICE card table — the cross-app emergency card. Returns
 * null outside Tauri / if the shared DB can't be opened, so the Ice page degrades to its
 * own profile-based card.
 */
export async function iceStore(): Promise<IceStore | null> {
  if (!isTauri()) return null;
  try {
    return createIceStore(adapter(await openSharedDb()));
  } catch (e) {
    console.warn("shared ICE store unavailable:", e);
    return null;
  }
}
