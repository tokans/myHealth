/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev/QA: start the app at a given tier (see src/lib/tierOverride.ts). */
  readonly VITE_TIER?: string;
  /** Opt-in to honor VITE_TIER / ?tier in a PRODUCTION build (dev honors it always). */
  readonly VITE_ALLOW_TIER_OVERRIDE?: string;
  /** Content OTA: GitHub-releases download base URL (per-type tag appended). */
  readonly VITE_CONTENT_BASE_URL?: string;
  /** Content OTA: release tag holding the signed remote type catalog. */
  readonly VITE_CONTENT_CATALOG_TAG?: string;
  /** Content OTA: Ed25519 signing public key (hex). Absent → sync disabled. */
  readonly VITE_CONTENT_PUBKEY?: string;
  /** Content OTA: AES-256-GCM transport key (base64). Absent → sync disabled. */
  readonly VITE_CONTENT_TRANSPORT_KEY?: string;
  /** OCR: base URL the English language data (eng.traineddata.gz) is downloaded from once. */
  readonly VITE_OCR_ASSET_BASE_URL?: string;
  /** OCR: baked lowercase-hex SHA-256 of eng.traineddata.gz. With base URL → OCR enabled. */
  readonly VITE_OCR_TRAINEDDATA_SHA256?: string;
  /** Grant: Ed25519 public key (hex) for support/pro grant files. Absent → grant import disabled. */
  readonly VITE_GRANT_PUBKEY?: string;
  /** Grant: AES-256-GCM transport key (base64) for grant files. Absent → grant import disabled. */
  readonly VITE_GRANT_TRANSPORT_KEY?: string;
  /** Demo-capture rig only: "1" enables demo mode (auto-unlock vault, fixed save paths). */
  readonly VITE_DEMO_MODE?: string;
  /** Demo-capture rig only: directory demo-mode file writes target (set by the engine). */
  readonly VITE_DEMO_OUTPUT_DIR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
