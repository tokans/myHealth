/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev/QA: start the app at a given tier (see src/lib/tierOverride.ts). */
  readonly VITE_TIER?: string;
  /** Opt-in to honor VITE_TIER / ?tier in a PRODUCTION build (dev honors it always). */
  readonly VITE_ALLOW_TIER_OVERRIDE?: string;
  /** Yoga OTA bundles: rolling GitHub-release base URL holding the newest bundle. */
  readonly VITE_YOGA_BASE_URL?: string;
  /** Yoga OTA bundles: Ed25519 signing public key (hex). Absent → downloads disabled. */
  readonly VITE_YOGA_PUBKEY?: string;
  /** Yoga OTA bundles: AES-256-GCM transport key (base64). Absent → downloads disabled. */
  readonly VITE_YOGA_TRANSPORT_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
