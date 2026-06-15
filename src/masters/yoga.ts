/**
 * Yoga bundles — the separately-downloadable OTA path.
 *
 * Yoga sequences ship two ways: a few BAKED samples in the binary
 * (`domain/yoga.ts`), and richer **bundles** published as signed assets to a
 * GitHub release and pulled on demand here. This module wires the shared,
 * app-agnostic OTA engine (`sharedcorelib/masters` → `createOtaUpdater`) to
 * myHealth's yoga store: it fetches `yoga.manifest.json[.sig]` from the release,
 * verifies the Ed25519 signature, gates revision/app-version, checks each file's
 * SHA-256, AES-256-GCM-decrypts the payload, validates the bundle shape with zod,
 * and writes it into `useYogaStore`. Receive-only — nothing is uploaded.
 *
 * The signing public key + transport key are app config supplied at build time
 * (`VITE_YOGA_*`). When they're absent the updater is DISABLED (the page still
 * works from the baked samples) — we never attempt a fetch with placeholder keys.
 * See `scripts/build-yoga-bundle.mjs` for how a bundle is built + signed for a
 * release, and `docs/PLAN.md` §4 for the masters/OTA roadmap.
 */
import { z } from "zod";
import {
  createOtaUpdater,
  genericManifestSchema,
  type OtaUpdater,
  type VerifiedEntry,
} from "sharedcorelib/masters";
import { useYogaStore } from "@/stores/yoga.store";

/** Rolling GitHub-release base URL that always holds the newest yoga bundle. */
export const YOGA_RELEASE_BASE_URL =
  (import.meta.env.VITE_YOGA_BASE_URL as string | undefined) ??
  "https://github.com/tokans-org/myHealth/releases/download/yoga-masters-latest";

const PUBKEY = import.meta.env.VITE_YOGA_PUBKEY as string | undefined;
const TRANSPORT_KEY = import.meta.env.VITE_YOGA_TRANSPORT_KEY as string | undefined;

/** App version gating `minAppVersion` (kept in sync with package.json). */
const APP_VERSION = "0.1.0";

// ── Bundle payload schema (validated AFTER signature + decrypt) ───────────────

const stepSchema = z.object({
  title: z.string().min(1).max(120),
  instruction: z.string().min(1).max(2000),
  durationSec: z.number().int().positive().max(36000).optional(),
  // Bundles ship their own pics as an image (baked `art` ids are an in-app concept).
  // Only data: URIs or https images — never javascript:/http: — keep it receive-only + safe.
  image: z
    .string()
    .max(2_000_000)
    .regex(/^(data:image\/|https:\/\/)/)
    .optional(),
});

const sequenceSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  sanskrit: z.string().max(160).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  focus: z.string().min(1).max(80),
  summary: z.string().min(1).max(600),
  steps: z.array(stepSchema).min(1).max(60),
});

/** Zod schema for a verified yoga bundle payload (exported for tests/tools). */
export const yogaBundleSchema = z.object({
  bundleId: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  version: z.number().int().nonnegative(),
  sequences: z.array(sequenceSchema).min(1).max(200),
});

/** Whether OTA yoga downloads are configured (signing keys present). */
export function yogaUpdatesConfigured(): boolean {
  return !!PUBKEY && !!TRANSPORT_KEY;
}

/** Apply one verified manifest entry (a yoga bundle) into the store. */
function applyEntry(entry: VerifiedEntry): void {
  const parsed = yogaBundleSchema.parse(entry.payload);
  useYogaStore.getState().upsertBundle({
    bundleId: parsed.bundleId,
    name: parsed.name,
    description: parsed.description,
    version: parsed.version,
    sequences: parsed.sequences.map((seq) => ({
      ...seq,
      source: "bundle" as const,
      bundleId: parsed.bundleId,
    })),
  });
}

/** Build the yoga OTA updater bound to myHealth's config + store. */
export function createYogaUpdater(): OtaUpdater {
  return createOtaUpdater({
    baseUrl: YOGA_RELEASE_BASE_URL,
    manifestFile: "yoga.manifest.json",
    pubkeyHex: PUBKEY ?? "",
    transportKeyB64: TRANSPORT_KEY ?? "",
    manifestSchema: genericManifestSchema,
    enabled: yogaUpdatesConfigured,
    getAppVersion: async () => APP_VERSION,
    getLastRevision: async () => useYogaStore.getState().revision,
    applyEntry: async (entry) => applyEntry(entry),
    onApplied: (revision) => useYogaStore.getState().setRevision(revision),
  });
}

/**
 * Run one yoga-bundle update check. Best-effort + fail-silent: offline, no
 * bundle, an unconfigured key, a bad signature, or a downgrade attempt all just
 * leave the existing downloaded bundles untouched. `force` bypasses throttling.
 * Returns true if any bundle was applied.
 */
export async function checkYogaUpdates(opts: { force?: boolean } = {}): Promise<boolean> {
  return createYogaUpdater().runUpdate(opts);
}
