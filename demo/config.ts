/**
 * myHealth demo-rig config. The reusable engine lives in @mydemo/core; this
 * file is the app-specific injection point — identity, the demo-mode build
 * flag, the window/driver setup, and the local state wiped before each run.
 *
 * Scenarios import { DIRS } from here; the edit EDL imports { DIRS, VIDEO }.
 * Everything else (launch, capture, encode, compose) is the package's job.
 *
 * Off-camera data: myHealth seeds via `npm run seed` and sets the starting tier
 * via VITE_TIER (baked here so gated features — Goals/Trends/Medications/
 * Documents — are reachable in the recorded build). Scenarios that need a tier
 * higher than the bake call it out in their `setup`.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "@mydemo/core";

const demoDir = dirname(fileURLToPath(import.meta.url));
/** Repo root (one level up from demo/). */
export const ROOT = resolve(demoDir, "..");

/** Resolved engine config, passed into every @mydemo/core call. */
export const config = defineConfig({
  rootDir: ROOT,
  demoDir,
  app: {
    // OS window title (ffmpeg gdigrab capture + focus), Tauri bundle id
    // (per-user app-data dir), cargo package name (debug binary file name).
    windowTitle: "myHealth",
    identifier: "com.myhealth.app",
    binName: "myhealth",
  },
  devUrl: "http://localhost:1420/",
  // A stable test-id that proves the UI booted before we start capturing. The
  // app's nav is the shared SuiteShell (no per-link test-ids), so scenarios
  // navigate by hash route via h.goto(); this anchor is an in-page element on
  // the initial Today route.
  navAnchor: "today-root",
  // Mirrors src/lib/demoMode.ts; the rig types this where the vault unlock appears.
  masterPassword: "demo1234",
  window: { width: 1440, height: 900 },
  // `--demo` makes the Rust side maximize the window (see src-tauri/src/lib.rs).
  driverArgs: ["--demo"],
  // The only place the demo flags are baked in: VITE_DEMO_MODE auto-unlocks the
  // vault + redirects file saves; VITE_TIER + VITE_ALLOW_TIER_OVERRIDE open the
  // gated features so scenarios can reach them. VITE_DEMO_OUTPUT_DIR +
  // TAURI_ENV_PLATFORM are injected by the engine.
  build: {
    frontendEnv: {
      VITE_DEMO_MODE: "1",
      VITE_TIER: "champion",
      VITE_ALLOW_TIER_OVERRIDE: "1",
      // Seed the deterministic demo dataset (3 profiles, 120-day vitals, goals,
      // medications, schedule) on launch. The rig wipes the DB before each
      // scenario, so each one starts from the same freshly-seeded state — see
      // scripts/start-seed.mjs / src/dev/seed.ts.
      VITE_SEED: "on",
    },
  },
  // Wiped before each recording for a clean first-run (app DB + vault snapshot).
  resetFiles: ["myhealth.db", "myhealth.db-wal", "myhealth.db-shm", "vault.stronghold"],
});

/** Convenience re-exports so scenarios / the EDL keep importing from one place. */
export const DIRS = config.dirs;
export const VIDEO = config.video;
