/**
 * myHealth OCR wiring — assembles the shared `@scandoc/core/ocr` engine with the app's
 * Tauri host + bundled asset paths into a ready-to-use `Recognizer`.
 *
 * The basic OCR is FREE and on-device; the paid AI extraction (OpenMed) stays separate.
 */
import {
  createTesseractRecognizer,
  isLangProvisioned,
  type Recognizer,
  type OcrProgress,
} from "@scandoc/core/ocr";
import { tauriOcrHost } from "./tauriHost";
import {
  OCR_ASSET_BASE_URL,
  OCR_CORE_PATH,
  OCR_LANG,
  OCR_LANG_FILE,
  OCR_MAX_PDF_PAGES,
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
      pdfWorkerSrc: OCR_PDF_WORKER_SRC,
      maxPdfPages: OCR_MAX_PDF_PAGES,
    },
    { onProgress: opts.onProgress, signal: opts.signal },
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
