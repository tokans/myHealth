import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The receive-only / no-phone-home moat, asserted structurally: NO source file in myHealth
 * may reference a network/egress primitive EXCEPT the two audited, allowlisted exceptions
 * below. myHealth is client-only — all health data stays on-device (SQLite + encrypted
 * vault); the only network is the receive-only, signed-then-verified reference-data path
 * (suite invariants 1/7 + myHealth hard constraints).
 *
 * This walks the whole `src/` tree (excluding tests) and fails if any forbidden token
 * appears outside the allowlist. The allowlist is path + reason pinned, so a NEW egress call
 * anywhere — or a new call in either exception file — still fails the build.
 *
 * Allowed exceptions (audited):
 *  1. `src/content/updater.ts` — a DEV-ONLY browser fallback (`import.meta.env.DEV`) so
 *     "Check now" works in the `npm run dev` preview against the local content server. It is
 *     constant-folded away in production; inside Tauri the core ignores it and uses the
 *     Tauri-HTTP path.
 *  2. `src/import/ocr/tauriHost.ts` — the Tauri-HTTP one-time OCR language-data download.
 *     The host is allowlisted in Tauri capabilities and the bytes are SHA-256-verified
 *     before use; nothing is uploaded (download-only).
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /\bnavigator\.sendBeacon\b/,
  /@tauri-apps\/plugin-http/,
  /from\s+["']node:(http|https|net|dgram|tls)["']/,
  /require\(\s*["']node:(http|https|net|dgram|tls)["']\s*\)/,
  /\baxios\b/,
  /createInsecure/,
];

/** Files allowed to reference a network primitive, with the reason each is exempt. */
const ALLOWLIST = new Set<string>([
  "src/content/updater.ts", // DEV-only browser fallback, guarded by import.meta.env.DEV
  "src/import/ocr/tauriHost.ts", // allowlisted + SHA-256-verified OCR language download
]);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      yield full;
    }
  }
}

describe("no egress — health data never leaves the device (receive-only moat)", () => {
  it("no source file references a network/egress primitive outside the audited allowlist", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      // Normalise to a `src/...` posix path so the allowlist is stable across OSes.
      const rel = "src/" + file.slice(SRC.length).replace(/\\/g, "/").replace(/^\//, "");
      const text = readFileSync(file, "utf8");
      for (const re of FORBIDDEN) {
        if (re.test(text)) {
          if (ALLOWLIST.has(rel)) continue; // audited exception (see header)
          offenders.push(`${rel} :: ${re}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the allowlisted exception files still exist (so the allowlist isn't silently stale)", () => {
    const files = [...walk(SRC)].map((f) => "src/" + f.slice(SRC.length).replace(/\\/g, "/").replace(/^\//, ""));
    for (const allowed of ALLOWLIST) {
      expect(files, `${allowed} is allowlisted but missing`).toContain(allowed);
    }
  });

  it("walked the core data + import modules (the walk actually ran)", () => {
    const files = [...walk(SRC)].map((f) => f.replace(/\\/g, "/"));
    expect(files.some((f) => f.endsWith("/db/documents.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("/db/sealedText.ts"))).toBe(true);
  });
});
