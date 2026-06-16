#!/usr/bin/env node
/**
 * Build + sign content release assets you upload to GitHub releases — the
 * separately-downloadable, daily-synced content path the app pulls from
 * (`src/content/updater.ts`). Mirrors the shared masters verify pipeline:
 * Ed25519-signed manifest → AES-256-GCM transport-encrypted payloads →
 * per-file SHA-256. Receive-only: the app downloads + verifies; never uploads.
 *
 * Node built-ins only. No deps, no network.
 *
 * Usage:
 *   node scripts/build-content.mjs keygen
 *       → prints a fresh Ed25519 signing keypair + an AES-256 transport key.
 *         Ship the PUBLIC key + transport key in the app build env
 *         (VITE_CONTENT_PUBKEY / VITE_CONTENT_TRANSPORT_KEY); keep the PRIVATE key secret.
 *
 *   CONTENT_SIGNING_KEY=<pkcs8-b64> CONTENT_TRANSPORT_KEY=<aes-b64> \
 *   node scripts/build-content.mjs build-type <type> [--src content] [--out dist/content-release] [--revision N]
 *       → packs content/<type>/bundles/*.json into yoga-style assets under
 *         <out>/<type>/ → upload to the release tagged "content-<type>-latest".
 *
 *   CONTENT_SIGNING_KEY=… CONTENT_TRANSPORT_KEY=… \
 *   node scripts/build-content.mjs build-catalog [--src content] [--out dist/content-release] [--revision N]
 *       → packs content/catalog.json's `types[]` into a catalog manifest under
 *         <out>/catalog/ → upload to the release tagged "content-catalog-latest".
 *         (Lets a brand-new tab appear without an app update.)
 *
 *   ... build-all   → build-catalog + build-type for every content/<dir>/ with a bundles/ folder.
 */
import { createCipheriv, createPrivateKey, generateKeyPairSync, randomBytes, createHash, sign as edSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const MIN_APP_VERSION = "0.1.0";
const SCHEMA_VERSION = 1;
const MANIFEST_FILE = "content.manifest.json";

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}
function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
function rawPubHex(publicKey) {
  const jwk = publicKey.export({ format: "jwk" });
  return Buffer.from(jwk.x, "base64url").toString("hex");
}

function keygen() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  const transport = randomBytes(32).toString("base64");
  console.log("# Content keys — keep the SIGNING key secret, ship the others in the app build env.\n");
  console.log(`CONTENT_SIGNING_KEY=${pkcs8}    # private (sign content; never ship)`);
  console.log(`VITE_CONTENT_PUBKEY=${rawPubHex(publicKey)}    # public (Ed25519, hex)`);
  console.log(`VITE_CONTENT_TRANSPORT_KEY=${transport}    # AES-256 transport (base64)`);
}

/** AES-256-GCM encrypt → `iv(12) || ciphertext || tag(16)` (the engine's transport layout). */
function encryptTransport(plain, keyB64) {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) fail("transport key must be 32 bytes (base64)");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, ct, cipher.getAuthTag()]);
}

function loadKeys() {
  const signingB64 = process.env.CONTENT_SIGNING_KEY || fail("set CONTENT_SIGNING_KEY (pkcs8 base64, see `keygen`)");
  const transportB64 = process.env.CONTENT_TRANSPORT_KEY || fail("set CONTENT_TRANSPORT_KEY (aes base64, see `keygen`)");
  const privateKey = createPrivateKey({ key: Buffer.from(signingB64, "base64"), format: "der", type: "pkcs8" });
  return { privateKey, transportB64 };
}

/** Write a signed manifest + encrypted entry files into outDir. `entries`: [{id, payload, version}]. */
function writeManifest(outDir, entries, revision, keys) {
  mkdirSync(outDir, { recursive: true });
  const manifestEntries = [];
  for (const { id, payload, version } of entries) {
    const file = `${id}.bin`;
    const enc = encryptTransport(Buffer.from(JSON.stringify(payload)), keys.transportB64);
    writeFileSync(join(outDir, file), enc);
    manifestEntries.push({
      id,
      file,
      bytes: enc.length,
      sha256: createHash("sha256").update(enc).digest("hex"),
      version: Number(version ?? 1),
    });
  }
  const manifest = {
    revision,
    generatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    minAppVersion: MIN_APP_VERSION,
    entries: manifestEntries,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, MANIFEST_FILE), manifestBytes);
  writeFileSync(join(outDir, `${MANIFEST_FILE}.sig`), edSign(null, manifestBytes, keys.privateKey).toString("base64"));
  return manifestEntries.length;
}

function buildType(type) {
  const keys = loadKeys();
  const srcRoot = resolve(arg("--src", "content"));
  const outRoot = resolve(arg("--out", "dist/content-release"));
  const revision = Number(arg("--revision", "1"));
  const bundleDir = join(srcRoot, type, "bundles");
  if (!existsSync(bundleDir)) fail(`no bundles dir at ${bundleDir}`);
  const files = readdirSync(bundleDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) fail(`no *.json bundles in ${bundleDir}`);
  const entries = files.map((f) => {
    const bundle = JSON.parse(readFileSync(join(bundleDir, f), "utf8"));
    if (!bundle.bundleId || !Array.isArray(bundle.entries) || bundle.entries.length === 0) {
      fail(`${f}: needs a bundleId and a non-empty entries[]`);
    }
    return { id: bundle.bundleId, payload: bundle, version: bundle.version };
  });
  const outDir = join(outRoot, type);
  const n = writeManifest(outDir, entries, revision, keys);
  console.log(`built type "${type}": ${n} bundle(s) → ${outDir} (upload to tag content-${type}-latest)`);
}

function buildCatalog() {
  const keys = loadKeys();
  const srcRoot = resolve(arg("--src", "content"));
  const outRoot = resolve(arg("--out", "dist/content-release"));
  const revision = Number(arg("--revision", "1"));
  const catalog = JSON.parse(readFileSync(join(srcRoot, "catalog.json"), "utf8"));
  const types = Array.isArray(catalog.types) ? catalog.types : [];
  if (types.length === 0) fail("catalog.json has no types[]");
  const entries = types.map((t) => {
    if (!t.key) fail("each catalog type needs a key");
    return { id: t.key, payload: t, version: t.order ?? 1 };
  });
  const outDir = join(outRoot, "catalog");
  const n = writeManifest(outDir, entries, revision, keys);
  console.log(`built catalog: ${n} type(s) → ${outDir} (upload to tag content-catalog-latest)`);
}

function buildAll() {
  buildCatalog();
  const srcRoot = resolve(arg("--src", "content"));
  for (const dir of readdirSync(srcRoot)) {
    if (statSync(join(srcRoot, dir)).isDirectory() && existsSync(join(srcRoot, dir, "bundles"))) {
      buildType(dir);
    }
  }
}

const cmd = process.argv[2];
if (cmd === "keygen") keygen();
else if (cmd === "build-type") buildType(process.argv[3] || fail("usage: build-type <type>"));
else if (cmd === "build-catalog") buildCatalog();
else if (cmd === "build-all") buildAll();
else fail("usage: build-content.mjs <keygen|build-type <type>|build-catalog|build-all> [--src content] [--out dir] [--revision N]");
