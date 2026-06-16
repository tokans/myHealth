/**
 * myHealth's device-to-device sync engine — the shared-suite-DB merge engine from
 * `sharedcorelib/sync`, scoped to the tables myHealth may sync.
 *
 * `createMergeEngine` walks the on-disk schema registry and syncs ONLY the tables
 * this app owns (`owner === "myhealth"` — the medical facet) plus the co-owned
 * `common` spine (person / event / document / ICE card). It can never reach another
 * app's private tables. Conflicts resolve last-writer-wins (`updated_at`, device-id
 * tie-break), applied identically on both peers so they converge.
 *
 * SCOPE NOTE: this is the SHARED suite DB (`suite.db`). The app-local `myhealth.db`
 * (water/tasks/metrics/goals/etc.) is a separate store the lib's generic engine
 * doesn't cover; syncing it would need an app-specific merge spec (future work).
 *
 * Device-to-device only — NO backend. The encrypted-byte channel is the injected
 * transport (today a file the user moves between devices; see ./transport.ts).
 */
import { createMergeEngine, type MergeEngine } from "sharedcorelib/sync";
import { loadRegistry } from "sharedcorelib/db";
import { isTauri } from "@/lib/environment";
import { openSharedDbAdapter } from "@/db/sharedDb";
import { APP_ID } from "@/db/healthFacet";
import { deviceId } from "./device";

/**
 * Build the merge engine over the shared suite DB. Returns null outside Tauri or if
 * the shared DB can't be opened (so the page degrades gracefully). No data egresses
 * here — this only reads the local registry + opens the local SQLite file.
 */
export async function syncEngine(): Promise<MergeEngine | null> {
  if (!isTauri()) return null;
  try {
    const sql = await openSharedDbAdapter();
    const registry = await loadRegistry(sql);
    return createMergeEngine({
      db: sql,
      registry,
      appId: APP_ID,
      localDeviceId: deviceId(),
    });
  } catch (e) {
    console.warn("sync engine unavailable:", e);
    return null;
  }
}
