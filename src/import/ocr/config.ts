/**
 * myHealth's OCR configuration — env + bundled-asset paths.
 *
 * The OCR engine lives in `@scandoc/core/ocr` (shared, reusable). This module supplies
 * the app-specific bits: the download host + baked SHA-256 of the English language data
 * (env-injected, like the content OTA keys), and the same-origin URLs of the assets the
 * app bundles into `public/ocr/` (tesseract worker + core wasm + pdf.js worker).
 *
 * Double-gate: OCR is only attempted when `ocrConfigured()` (both env vars set) AND in
 * Tauri. Dev/browser/tests fall back to the paste path with zero network.
 */
export const OCR_LANG = "eng";
export const OCR_LANG_FILE = "eng.traineddata.gz";
export const OCR_DIR = "ocr"; // under BaseDirectory.AppLocalData and public/ocr/

/** Where the one downloaded asset (the language data) comes from + its expected hash. */
export const OCR_ASSET_BASE_URL = (import.meta.env.VITE_OCR_ASSET_BASE_URL as string | undefined) ?? "";
export const OCR_TRAINEDDATA_SHA256 =
  (import.meta.env.VITE_OCR_TRAINEDDATA_SHA256 as string | undefined) ?? "";

/** App-bundled, same-origin asset URLs (served from public/ocr/ — always offline). */
export const OCR_WORKER_PATH = "/ocr/worker.min.js";
export const OCR_CORE_PATH = "/ocr/"; // directory: tesseract probes SIMD vs non-SIMD
export const OCR_PDF_WORKER_SRC = "/ocr/pdf.worker.min.mjs";

export const OCR_MAX_PDF_PAGES = 5;

/** True when the download host + baked hash are both configured (build-time gate). */
export function ocrConfigured(): boolean {
  return !!OCR_ASSET_BASE_URL && /^[0-9a-f]{64}$/i.test(OCR_TRAINEDDATA_SHA256);
}
