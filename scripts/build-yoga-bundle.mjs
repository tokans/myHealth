#!/usr/bin/env node
/**
 * Build + sign yoga sequence bundles into release assets you upload to a GitHub
 * release — the separately-downloadable OTA path the app pulls from
 * (`src/masters/yoga.ts`). Mirrors the shared masters engine's verify pipeline:
 * Ed25519-signed manifest → AES-256-GCM transport-encrypted payloads → per-file
 * SHA-256. Receive-only: the app downloads + verifies these; it never uploads.
 *
 * Node built-ins only (node:crypto/fs/path). No deps, no network.
 *
 * Usage:
 *   node scripts/build-yoga-bundle.mjs keygen
 *       → prints a fresh Ed25519 signing keypair + an AES-256 transport key.
 *         Put the PUBLIC key + transport key in the app build env
 *         (VITE_YOGA_PUBKEY / VITE_YOGA_TRANSPORT_KEY); keep the PRIVATE key secret.
 *
 *   YOGA_SIGNING_KEY=<pkcs8-b64> YOGA_TRANSPORT_KEY=<aes-b64> \
 *   node scripts/build-yoga-bundle.mjs build [--src scripts/yoga-bundles] [--out dist/yoga-release] [--revision N]
 *       → reads every *.json bundle under --src, encrypts each, writes
 *         yoga.manifest.json(+.sig) + one <bundleId>.bundle per bundle into --out.
 *         Upload the contents of --out to the GitHub release tagged
 *         "yoga-masters-latest" (the rolling tag the app fetches).
 */
import { createCipheriv, createPrivateKey, generateKeyPairSync, randomBytes, createHash, sign as edSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const MIN_APP_VERSION = "0.1.0";
const SCHEMA_VERSION = 1;
const MANIFEST_FILE = "yoga.manifest.json";

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

/** Ed25519 raw 32-byte public key (hex) from a Node KeyObject (via JWK x). */
function rawPubHex(publicKey) {
  const jwk = publicKey.export({ format: "jwk" });
  return Buffer.from(jwk.x, "base64url").toString("hex");
}

function keygen() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  const transport = randomBytes(32).toString("base64");
  console.log("# Yoga bundle keys — keep the SIGNING key secret, ship the others in the app build env.\n");
  console.log(`YOGA_SIGNING_KEY=${pkcs8}    # private (sign bundles; never ship)`);
  console.log(`VITE_YOGA_PUBKEY=${rawPubHex(publicKey)}    # public (Ed25519, hex)`);
  console.log(`VITE_YOGA_TRANSPORT_KEY=${transport}    # AES-256 transport (base64)`);
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

function build() {
  const signingB64 = process.env.YOGA_SIGNING_KEY || fail("set YOGA_SIGNING_KEY (pkcs8 base64, see `keygen`)");
  const transportB64 = process.env.YOGA_TRANSPORT_KEY || fail("set YOGA_TRANSPORT_KEY (aes base64, see `keygen`)");
  const srcDir = resolve(arg("--src", "scripts/yoga-bundles"));
  const outDir = resolve(arg("--out", "dist/yoga-release"));
  const revision = Number(arg("--revision", "1"));

  const privateKey = createPrivateKey({
    key: Buffer.from(signingB64, "base64"),
    format: "der",
    type: "pkcs8",
  });

  const files = readdirSync(srcDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) fail(`no *.json bundles found in ${srcDir}`);

  mkdirSync(outDir, { recursive: true });
  const entries = [];
  for (const f of files) {
    const bundle = JSON.parse(readFileSync(join(srcDir, f), "utf8"));
    if (!bundle.bundleId || !Array.isArray(bundle.sequences) || bundle.sequences.length === 0) {
      fail(`${f}: needs a bundleId and a non-empty sequences[]`);
    }
    const file = `${bundle.bundleId}.bundle`;
    const enc = encryptTransport(Buffer.from(JSON.stringify(bundle)), transportB64);
    writeFileSync(join(outDir, file), enc);
    entries.push({
      id: bundle.bundleId,
      file,
      bytes: enc.length,
      sha256: createHash("sha256").update(enc).digest("hex"),
      version: Number(bundle.version ?? 1),
    });
    console.log(`packed ${bundle.bundleId} (${bundle.sequences.length} sequences, ${enc.length} bytes)`);
  }

  const manifest = {
    revision,
    generatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    minAppVersion: MIN_APP_VERSION,
    entries,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  writeFileSync(join(outDir, MANIFEST_FILE), manifestBytes);
  // Detached Ed25519 signature over the exact manifest bytes, stored as base64 text.
  const sig = edSign(null, manifestBytes, privateKey).toString("base64");
  writeFileSync(join(outDir, `${MANIFEST_FILE}.sig`), sig);

  console.log(`\nwrote ${outDir}:`);
  console.log(`  ${MANIFEST_FILE} (revision ${revision}), ${MANIFEST_FILE}.sig, ${entries.length} bundle file(s)`);
  console.log(`upload these to the GitHub release tagged "yoga-masters-latest".`);
}

const cmd = process.argv[2];
if (cmd === "keygen") keygen();
else if (cmd === "build") build();
else fail("usage: build-yoga-bundle.mjs <keygen|build> [--src dir] [--out dir] [--revision N]");
