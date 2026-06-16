#!/usr/bin/env node
/**
 * Local content-OTA dev server — lets you actually exercise the "Check now" button.
 *
 * Builds + SIGNS every content bundle (yoga, exercises) + the catalog with a
 * throwaway dev keypair (cached under `.dev-content/`), serves them over plain
 * HTTP at http://localhost:4321 in the exact `${baseUrl}/${tag}/…` layout the app
 * fetches, and writes the matching `VITE_CONTENT_*` vars to `.env.local` so a
 * `npm run tauri:dev` picks them up. Then open a content tab and click "Check now".
 *
 * DEV-ONLY. The keys are throwaway, the host is localhost (the user's own machine —
 * no remote egress), and `http://localhost:4321/*` is allow-listed for http ONLY in
 * the Tauri capability for this purpose. Node built-ins only; no deps.
 */
import { createServer } from "node:http";
import { createCipheriv, createPrivateKey, generateKeyPairSync, randomBytes, createHash, sign as edSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, extname } from "node:path";

const PORT = 4321;
const DEV_DIR = resolve(".dev-content");
const REL_DIR = join(DEV_DIR, "release");
const KEYS_FILE = join(DEV_DIR, "keys.json");
const SRC_ROOT = resolve("content");
const MANIFEST_FILE = "content.manifest.json";
const MIN_APP_VERSION = "0.1.0";

// ── keys (cached) ────────────────────────────────────────────────────────────
function loadOrCreateKeys() {
  mkdirSync(DEV_DIR, { recursive: true });
  if (existsSync(KEYS_FILE)) return JSON.parse(readFileSync(KEYS_FILE, "utf8"));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const keys = {
    signingPkcs8B64: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
    pubHex: Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url").toString("hex"),
    transportB64: randomBytes(32).toString("base64"),
  };
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
  return keys;
}

// ── build + sign (same layout as scripts/build-content.mjs) ──────────────────
function encryptTransport(plain, keyB64) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]);
}

function writeManifest(outDir, entries, keys) {
  mkdirSync(outDir, { recursive: true });
  const manifestEntries = entries.map(({ id, payload, version }) => {
    const file = `${id}.bin`;
    const enc = encryptTransport(Buffer.from(JSON.stringify(payload)), keys.transportB64);
    writeFileSync(join(outDir, file), enc);
    return { id, file, bytes: enc.length, sha256: createHash("sha256").update(enc).digest("hex"), version: Number(version ?? 1) };
  });
  const manifest = { revision: 1, generatedAt: new Date().toISOString(), schemaVersion: 1, minAppVersion: MIN_APP_VERSION, entries: manifestEntries };
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2));
  const pk = createPrivateKey({ key: Buffer.from(keys.signingPkcs8B64, "base64"), format: "der", type: "pkcs8" });
  writeFileSync(join(outDir, MANIFEST_FILE), bytes);
  writeFileSync(join(outDir, `${MANIFEST_FILE}.sig`), edSign(null, bytes, pk).toString("base64"));
  return manifestEntries.length;
}

function buildAll(keys) {
  // Catalog (optional).
  if (existsSync(join(SRC_ROOT, "catalog.json"))) {
    const catalog = JSON.parse(readFileSync(join(SRC_ROOT, "catalog.json"), "utf8"));
    const types = Array.isArray(catalog.types) ? catalog.types : [];
    if (types.length) {
      const n = writeManifest(join(REL_DIR, "content-catalog-latest"), types.map((t) => ({ id: t.key, payload: t, version: t.order ?? 1 })), keys);
      console.log(`  catalog: ${n} type(s) → content-catalog-latest`);
    }
  }
  // Each type with a bundles/ dir.
  for (const dir of readdirSync(SRC_ROOT)) {
    const bundleDir = join(SRC_ROOT, dir, "bundles");
    if (!statSync(join(SRC_ROOT, dir)).isDirectory() || !existsSync(bundleDir)) continue;
    const entries = readdirSync(bundleDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const b = JSON.parse(readFileSync(join(bundleDir, f), "utf8"));
        return { id: b.bundleId, payload: b, version: b.version };
      });
    if (!entries.length) continue;
    const n = writeManifest(join(REL_DIR, `content-${dir}-latest`), entries, keys);
    console.log(`  ${dir}: ${n} bundle(s) → content-${dir}-latest`);
  }
}

// ── write VITE env so `tauri:dev` is configured ──────────────────────────────
function writeEnv(keys) {
  const lines = [
    `VITE_CONTENT_BASE_URL=http://localhost:${PORT}`,
    `VITE_CONTENT_PUBKEY=${keys.pubHex}`,
    `VITE_CONTENT_TRANSPORT_KEY=${keys.transportB64}`,
  ];
  const envFile = resolve(".env.local");
  if (!existsSync(envFile)) {
    writeFileSync(envFile, lines.join("\n") + "\n");
    console.log("wrote .env.local (Vite loads it automatically)");
  } else if (!readFileSync(envFile, "utf8").includes("VITE_CONTENT_PUBKEY")) {
    writeFileSync(envFile, readFileSync(envFile, "utf8").replace(/\n*$/, "\n") + lines.join("\n") + "\n");
    console.log("appended VITE_CONTENT_* to existing .env.local");
  } else {
    console.log("\nAdd these to .env.local (or your shell) before `npm run tauri:dev`:\n  " + lines.join("\n  "));
  }
}

// ── static server ────────────────────────────────────────────────────────────
const TYPES = { ".json": "application/json", ".sig": "text/plain", ".bin": "application/octet-stream" };
function serve() {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
    const abs = join(REL_DIR, rel);
    if (!abs.startsWith(REL_DIR) || !existsSync(abs) || statSync(abs).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(abs)] ?? "application/octet-stream", "access-control-allow-origin": "*" });
    res.end(readFileSync(abs));
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      // The bundles + .env.local are already written; only the listen failed.
      console.log(`\nPort ${PORT} is already in use — a content server is probably already running.`);
      console.log(`If that's a previous \`npm run content:dev\`, you're all set: just run the app and click "Check now".`);
      console.log(`Otherwise free the port and re-run:`);
      console.log(`  PowerShell:  Get-NetTCPConnection -LocalPort ${PORT} | %% { Stop-Process -Id $_.OwningProcess -Force }`);
      console.log(`  macOS/Linux: lsof -ti:${PORT} | xargs kill`);
      process.exit(0);
    }
    throw err;
  });
  server.listen(PORT, () => console.log(`\nServing signed content on http://localhost:${PORT}  (Ctrl+C to stop)`));
}

const keys = loadOrCreateKeys();
console.log("building + signing content bundles…");
buildAll(keys);
writeEnv(keys);
console.log("\nNext: run `npm run tauri:dev` and click \"Check now\" on the Yoga or Exercises tab.");
serve();
