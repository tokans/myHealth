#!/usr/bin/env node
/**
 * Stage the on-device OCR engine assets.
 *
 * The OCR engine (`@scandoc/core/ocr`) runs tesseract.js + pdf.js in the webview. Their
 * worker scripts + WASM core are bundled INTO the app (offline, same-origin) from
 * node_modules; only the ~10 MB English language data is downloaded once at runtime,
 * SHA-256-verified, and cached on-device.
 *
 * Node built-ins only. The `copy` step does NO network (safe in prebuild); the
 * `traineddata` step fetches + gzips the language data to publish as a release asset.
 *
 * Usage:
 *   node scripts/build-ocr-assets.mjs copy
 *       → copy tesseract worker + core wasm + pdf.js worker into public/ocr/ (offline).
 *
 *   node scripts/build-ocr-assets.mjs traineddata [--out dist/ocr-release] [--lang eng]
 *       → download eng.traineddata, gzip it to <out>/eng.traineddata.gz, print its
 *         SHA-256 (bake as VITE_OCR_TRAINEDDATA_SHA256) + a manifest. Upload the .gz to
 *         the release the app's VITE_OCR_ASSET_BASE_URL points at.
 *
 *   node scripts/build-ocr-assets.mjs all   → copy + traineddata.
 */
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdirSync, copyFileSync, writeFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:https";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NM = join(ROOT, "node_modules");
const PUBLIC_OCR = join(ROOT, "public", "ocr");

/** Canonical tessdata_fast source for the language data (Apache-2.0). */
const TESSDATA_BASE = "https://github.com/tesseract-ocr/tessdata_fast/raw/main";

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function copyAssets() {
  mkdirSync(PUBLIC_OCR, { recursive: true });

  // 1) tesseract.js worker (single file).
  const worker = join(NM, "tesseract.js", "dist", "worker.min.js");
  if (!existsSync(worker)) throw new Error(`Missing ${worker} — run npm install first.`);
  copyFileSync(worker, join(PUBLIC_OCR, "worker.min.js"));

  // 2) tesseract.js-core: copy ONLY the two cores we can actually load. Three facts
  //    make 12 of the 14 shipped files dead weight on every platform bundle:
  //      (a) corePath is a DIRECTORY (`/ocr/`), so tesseract's worker loads a
  //          `tesseract-core[-simd]-lstm.wasm.js` via importScripts — never the bare
  //          `.wasm` (those are only fetched when corePath ends in a specific file) nor
  //          the small `.js` shims. Each `.wasm.js` EMBEDS its wasm as base64, so it is
  //          self-contained.
  //      (b) scandoc requests OEM.LSTM_ONLY (`createWorker(lang, 1, …)`), so the loader
  //          always picks the `-lstm` core — the legacy/full `tesseract-core.wasm.js`
  //          and `tesseract-core-simd.wasm.js` are never selected.
  //      (c) the only runtime branch left is SIMD-vs-not, so we keep both LSTM cores.
  //    Result: ~22 MB pruned from the APK/IPA/installer (was ~31 MB, now ~9 MB) with
  //    no behavior change. If any of (a)/(b) changes upstream, widen this list.
  const coreDir = join(NM, "tesseract.js-core");
  const CORE_FILES = ["tesseract-core-simd-lstm.wasm.js", "tesseract-core-lstm.wasm.js"];
  // Remove any stale tesseract-core* files from a previous (wider) copy so we don't
  // ship pruned variants left behind in the generated public/ocr/ dir.
  for (const f of readdirSync(PUBLIC_OCR)) {
    if (/^tesseract-core/.test(f) && !CORE_FILES.includes(f)) rmSync(join(PUBLIC_OCR, f));
  }
  let coreCount = 0;
  for (const f of CORE_FILES) {
    const src = join(coreDir, f);
    if (!existsSync(src)) throw new Error(`Missing ${src} — run npm install first.`);
    copyFileSync(src, join(PUBLIC_OCR, f));
    coreCount++;
  }

  // 3) pdf.js legacy worker (named to match OCR_PDF_WORKER_SRC).
  const pdfWorker = join(NM, "pdfjs-dist", "legacy", "build", "pdf.worker.min.mjs");
  if (!existsSync(pdfWorker)) throw new Error(`Missing ${pdfWorker} — run npm install first.`);
  copyFileSync(pdfWorker, join(PUBLIC_OCR, "pdf.worker.min.mjs"));

  console.log(`[ocr-assets] Copied tesseract worker + ${coreCount} core files + pdf.js worker → public/ocr/`);
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location)); // follow GitHub redirects
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function buildTraineddata() {
  const lang = arg("--lang", "eng");
  const out = join(ROOT, arg("--out", "dist/ocr-release"));
  mkdirSync(out, { recursive: true });

  const url = `${TESSDATA_BASE}/${lang}.traineddata`;
  console.log(`[ocr-assets] Downloading ${url} …`);
  const raw = await fetchBuffer(url);
  const gz = gzipSync(raw, { level: 9 });
  const file = `${lang}.traineddata.gz`;
  writeFileSync(join(out, file), gz);

  const sha = sha256Hex(gz);
  const manifest = {
    lang,
    file,
    bytes: gz.length,
    sha256: sha,
    source: url,
    builtWith: { "tesseract.js": pkgVersion("tesseract.js"), "pdfjs-dist": pkgVersion("pdfjs-dist") },
  };
  writeFileSync(join(out, "ocr.manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`[ocr-assets] Wrote ${out}/${file} (${(gz.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`[ocr-assets] Bake into the app build env:`);
  console.log(`    VITE_OCR_TRAINEDDATA_SHA256=${sha}`);
  console.log(`    VITE_OCR_ASSET_BASE_URL=https://<your-release-host>/<tag>`);
}

function pkgVersion(name) {
  try {
    return JSON.parse(readFileSync(join(NM, name, "package.json"), "utf8")).version;
  } catch {
    return "unknown";
  }
}

const cmd = process.argv[2] ?? "copy";
if (cmd === "copy") {
  copyAssets();
} else if (cmd === "traineddata") {
  await buildTraineddata();
} else if (cmd === "all") {
  copyAssets();
  await buildTraineddata();
} else {
  console.error(`Unknown command "${cmd}". Use: copy | traineddata | all`);
  process.exit(1);
}
