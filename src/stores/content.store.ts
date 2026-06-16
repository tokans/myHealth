/**
 * Downloaded-content store — myHealth's instance of the shared content store
 * factory (`sharedcorelib/content` → `createContentStore`). Holds, per content
 * type: downloaded bundles + the anti-downgrade revision; plus the remotely-
 * registered type catalog and the daily-sync timestamp. Persisted to localStorage
 * (public, non-sensitive reference data — no health PII, so no SQLite migration).
 * Receive-only: written solely by the verified OTA apply step.
 */
import { createContentStore } from "sharedcorelib/content";
import type { EarnedTier } from "@/lib/featureGate";

export const useContentStore = createContentStore<EarnedTier>({ storageKey: "myhealth.content.v1" });
