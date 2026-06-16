/**
 * myHealth OCR wiring — assembles the shared `@scandoc/core/ocr` engine with the app's
 * Tauri host + bundled asset paths into a ready-to-use `Recognizer`.
 *
 * The basic OCR is FREE and on-device; the paid AI extraction (OpenMed) stays separate.
 */
import { createTesseractRecognizer, isLangProvisioned, rasterizePdf, type OcrProgress } from "@scandoc/core/ocr";
import type { Recognizer } from "@scandoc/core";
import { tauriOcrHost } from "./tauriHost";
import {
  OCR_ASSET_BASE_URL,
  OCR_CORE_PATH,
  OCR_LANG,
  OCR_LANG_FILE,
  OCR_MAX_PDF_PAGES,
  OCR_PDF_SCALE,
  OCR_PDF_WORKER_SRC,
  OCR_TRAINEDDATA_SHA256,
  OCR_WORKER_PATH,
} from "./config";

export { ocrConfigured } from "./config";

export interface MakeOcrOptions {
  onProgress?: (p: OcrProgress) => void;
  signal?: AbortSignal;
}

/** Build the Tesseract recognizer bound to myHealth's host + bundled assets. */
export function makeOcrRecognizer(opts: MakeOcrOptions = {}): Recognizer {
  return createTesseractRecognizer(
    {
      host: tauriOcrHost,
      baseUrl: OCR_ASSET_BASE_URL,
      langFile: OCR_LANG_FILE,
      langSha256: OCR_TRAINEDDATA_SHA256,
      lang: OCR_LANG,
      workerPath: OCR_WORKER_PATH,
      corePath: OCR_CORE_PATH,
    },
    {
      onProgress: opts.onProgress,
      signal: opts.signal,
      // The app owns the heavy peerDeps: dynamic-import them HERE so Vite resolves +
      // code-splits them (the symlinked lib can't resolve them from its own dist).
      loadCreateWorker: async () => (await import("tesseract.js")).createWorker,
      rasterize: async (bytes) =>
        rasterizePdf(
          await import("pdfjs-dist/legacy/build/pdf.mjs"),
          bytes,
          OCR_PDF_WORKER_SRC,
          OCR_MAX_PDF_PAGES,
          OCR_PDF_SCALE,
        ),
    },
  );
}

/** Has the English language data already been downloaded + verified on this device? */
export function ocrLangProvisioned(): Promise<boolean> {
  return isLangProvisioned({
    host: tauriOcrHost,
    baseUrl: OCR_ASSET_BASE_URL,
    langFile: OCR_LANG_FILE,
    langSha256: OCR_TRAINEDDATA_SHA256,
  });
}
