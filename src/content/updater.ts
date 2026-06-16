/**
 * Content over-the-air sync — the daily background job.
 *
 * Like the masters engine, this pulls signed, encrypted assets from a GitHub
 * release and applies them, receive-only. Two layers:
 *   1. the CATALOG — registers content types remotely, so a brand-new tab can
 *      appear without an app update;
 *   2. per-type BUNDLES — the downloadable entries (yoga sequences, workouts …).
 *
 * Each pass: Ed25519 verify → revision/app-version gate → per-file SHA-256 →
 * AES-256-GCM decrypt → zod-validate → store. Signing keys are app config
 * (`VITE_CONTENT_*`); absent → sync disabled (baked samples still work). Throttled
 * to once/day; `runContentSync()` is called on idle at startup (see `App.tsx`).
 */
import { createOtaUpdater, genericManifestSchema, type VerifiedEntry } from "sharedcorelib/masters";
import { isTauri } from "@/lib/environment";
import { useContentStore } from "@/stores/content.store";
import { allContentTypes } from "@/content/registry";
import { contentBundleSchema, contentTypeMetaSchema } from "@/content/schema";
import type { ContentType } from "@/content/model";

const APP_VERSION = "0.1.0";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MANIFEST_FILE = "content.manifest.json";

const BASE_URL =
  (import.meta.env.VITE_CONTENT_BASE_URL as string | undefined) ??
  "https://github.com/tokans-org/myHealth/releases/download";
const CATALOG_TAG = (import.meta.env.VITE_CONTENT_CATALOG_TAG as string | undefined) ?? "content-catalog-latest";
const PUBKEY = import.meta.env.VITE_CONTENT_PUBKEY as string | undefined;
const TRANSPORT_KEY = import.meta.env.VITE_CONTENT_TRANSPORT_KEY as string | undefined;

/** Whether OTA content sync is configured (signing keys present). */
export function contentUpdatesConfigured(): boolean {
  return !!PUBKEY && !!TRANSPORT_KEY;
}

const releaseUrl = (tag: string) => `${BASE_URL.replace(/\/+$/, "")}/${tag}`;

function makeUpdater(tag: string, getLastRevision: () => Promise<number>, apply: (e: VerifiedEntry) => Promise<void>, onApplied: (rev: number) => void) {
  return createOtaUpdater({
    baseUrl: releaseUrl(tag),
    manifestFile: MANIFEST_FILE,
    pubkeyHex: PUBKEY ?? "",
    transportKeyB64: TRANSPORT_KEY ?? "",
    manifestSchema: genericManifestSchema,
    enabled: contentUpdatesConfigured,
    getAppVersion: async () => APP_VERSION,
    getLastRevision,
    applyEntry: apply,
    onApplied,
  });
}

/** Register types from the remote catalog. */
function catalogUpdater() {
  const store = useContentStore.getState();
  return makeUpdater(
    CATALOG_TAG,
    async () => useContentStore.getState().catalogRevision,
    async (entry) => store.registerRemoteType(contentTypeMetaSchema.parse(entry.payload)),
    (rev) => useContentStore.getState().setCatalogRevision(rev),
  );
}

/** Download bundles for one content type. */
function typeUpdater(type: ContentType) {
  const store = useContentStore.getState();
  return makeUpdater(
    type.releaseTag,
    async () => useContentStore.getState().revisionByType[type.key] ?? 0,
    async (entry) => {
      const parsed = contentBundleSchema.parse(entry.payload);
      store.upsertBundle(type.key, {
        bundleId: parsed.bundleId,
        name: parsed.name,
        description: parsed.description,
        version: parsed.version,
        entries: parsed.entries.map((e) => ({ ...e, source: "bundle" as const, bundleId: parsed.bundleId })),
      });
    },
    (rev) => useContentStore.getState().setRevision(type.key, rev),
  );
}

/** True if the daily check is due (24h since the last run), or forced. */
function isDue(force: boolean): boolean {
  if (force) return true;
  return Date.now() - useContentStore.getState().lastCheckedAt >= ONE_DAY_MS;
}

/**
 * Run one content sync: refresh the remote catalog, then check every known
 * type's bundles. Best-effort + fail-silent (offline / no bundle / bad signature
 * / downgrade all leave existing content untouched). Throttled to once per day
 * unless `force`. Returns true if anything was applied.
 */
export async function runContentSync(opts: { force?: boolean } = {}): Promise<boolean> {
  const force = opts.force ?? false;
  if (!isTauri() || !contentUpdatesConfigured() || !isDue(force)) return false;

  let applied = false;
  // 1) Remote catalog → may register new types.
  applied = (await catalogUpdater().runUpdate({ force: true })) || applied;
  // 2) Each known type's bundles (re-read so freshly-registered types are included).
  for (const type of allContentTypes()) {
    applied = (await typeUpdater(type).runUpdate({ force: true })) || applied;
  }
  useContentStore.getState().markChecked(Date.now());
  return applied;
}

/** Force-check just one content type's bundles (the page's "Check now" button). */
export async function checkTypeNow(type: ContentType): Promise<boolean> {
  if (!isTauri() || !contentUpdatesConfigured()) return false;
  const applied = await typeUpdater(type).runUpdate({ force: true });
  useContentStore.getState().markChecked(Date.now());
  return applied;
}
