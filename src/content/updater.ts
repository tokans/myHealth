/**
 * Content OTA sync — myHealth's instance of the shared sync factory
 * (`sharedcorelib/content` → `createContentSync`). Supplies the app's release
 * base URL + catalog tag + signing keys (`VITE_CONTENT_*`), its store, and the
 * live type list; the verify/decrypt/throttle mechanism lives in core.
 *
 * `runContentSync()` is called on idle at startup (see `App.tsx`), self-throttled
 * to once/day. Receive-only; disabled (baked samples still work) until signing
 * keys are configured.
 */
import { createContentSync } from "sharedcorelib/content";
import { useContentStore } from "@/stores/content.store";
import { allContentTypes } from "@/content/registry";

const BASE_URL =
  (import.meta.env.VITE_CONTENT_BASE_URL as string | undefined) ??
  "https://github.com/tokans-org/myHealth/releases/download";
const CATALOG_TAG = (import.meta.env.VITE_CONTENT_CATALOG_TAG as string | undefined) ?? "content-catalog-latest";

const sync = createContentSync({
  store: useContentStore,
  listTypes: () => allContentTypes().map((t) => ({ key: t.key, releaseTag: t.releaseTag })),
  baseUrl: BASE_URL,
  catalogTag: CATALOG_TAG,
  pubkeyHex: (import.meta.env.VITE_CONTENT_PUBKEY as string | undefined) ?? "",
  transportKeyB64: (import.meta.env.VITE_CONTENT_TRANSPORT_KEY as string | undefined) ?? "",
  appVersion: "0.1.0",
  // DEV-only browser fallback so "Check now" works in the `npm run dev` preview
  // (no Tauri): plain `fetch` against the local content server (`npm run content:dev`).
  // Inside Tauri the core ignores this and uses the Tauri-HTTP path.
  fetchBytes: import.meta.env.DEV
    ? async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      }
    : undefined,
});

/** Whether OTA content sync is configured (signing keys present). */
export function contentUpdatesConfigured(): boolean {
  return sync.isConfigured();
}

/** Whether sync can actually run now (configured AND in Tauri, or the dev browser fallback). */
export function contentSyncAvailable(): boolean {
  return sync.canRun();
}

/** Run one daily content sync (catalog + per-type bundles). Best-effort, throttled. */
export function runContentSync(opts: { force?: boolean } = {}): Promise<boolean> {
  return sync.runContentSync(opts);
}

/** Force-check one content type's bundles (the page's "Check now" button). */
export function checkTypeNow(type: { key: string; releaseTag: string }): Promise<boolean> {
  return sync.checkTypeNow(type);
}
