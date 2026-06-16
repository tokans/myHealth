/**
 * The capture → recognized-text bridge for myHealth's document scan flow.
 *
 * A thin wrapper over `@scandoc/core`'s `Recognizer` seam. Two recognizers exist:
 *   - `nativeTextRecognizer` — the offline identity recognizer (text/plain-text PDFs
 *     decode to trusted `native-text`; bytes come back empty + `ocr`).
 *   - the shared Tesseract OCR engine (`@scandoc/core/ocr`, wired in `./ocr`) — used
 *     for image / scanned-PDF bytes when in Tauri AND OCR is configured. Basic OCR is
 *     FREE and fully on-device (WASM in the webview); the AI extraction (OpenMed) is
 *     the separate paid path.
 *
 * INVARIANT (suite #1/#7): the only network hop is the allowlisted, hash-verified
 * language-data download (in the OCR engine); document bytes never leave the device.
 */
import { nativeTextRecognizer, type CaptureKind, type FieldSource } from "@scandoc/core";
import type { OcrProgress } from "@scandoc/core/ocr";
import { isTauri } from "@/lib/environment";

export interface Capture {
  /** Recognized text (empty when bytes still need OCR / OCR is unavailable). */
  text: string;
  /** Provenance feeding `requiresConfirmation`: native text is trusted, OCR is not. */
  source: FieldSource;
  /** How the document arrived — drives which recognition path is taken. */
  kind: CaptureKind;
  /** True when the bytes still need OCR (no text recognized). */
  needsOcr: boolean;
}

/** Per-call recognition options (OCR progress + cancellation). */
export interface RecognizeOptions {
  onProgress?: (p: OcrProgress) => void;
  signal?: AbortSignal;
}

/** Map a file's MIME (and name fallback) to the recognizer's capture kind. */
export function captureKindForMime(mime: string | null, name?: string): CaptureKind {
  const ext = name?.split(".").pop()?.toLowerCase();
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "heic", "tiff"].includes(ext ?? "")) {
    return "photo";
  }
  if (mime === "application/pdf" || ext === "pdf") {
    // We can't yet tell a text PDF from a scanned one without a parser — assume scanned
    // (the safe, confirm-everything path) until the sidecar can extract embedded text.
    return "scanned-pdf";
  }
  if (mime?.startsWith("text/") || ["txt", "csv", "md"].includes(ext ?? "")) return "plain-text";
  return "plain-text";
}

const TEXT_LIKE: CaptureKind[] = ["plain-text", "native-text-pdf"];

/**
 * Recognize a picked/captured document to text via the core Recognizer seam.
 *
 * Text-like input decodes to UTF-8 (trusted). Image / scanned-PDF bytes are OCR'd by
 * the shared Tesseract engine when in Tauri AND OCR is configured; otherwise they come
 * back empty + `ocr` so the review UI can prompt for a paste. `needsOcr` is derived
 * from whether any text was recognized, so a successful OCR clears the paste hint.
 */
export async function recognizeDocument(
  bytes: Uint8Array,
  mime: string | null,
  name?: string,
  opts: RecognizeOptions = {},
): Promise<Capture> {
  const kind = captureKindForMime(mime, name);

  if (TEXT_LIKE.includes(kind)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const out = await nativeTextRecognizer().recognize({ kind, text });
    return { text: out.text, source: out.source, kind, needsOcr: out.text.trim() === "" };
  }

  const recognizer = await pickBytesRecognizer(opts);
  const out = await recognizer.recognize({ kind, bytes, langs: ["eng"] });
  return { text: out.text, source: out.source, kind, needsOcr: out.text.trim() === "" };
}

/**
 * Choose the recognizer for image / scanned-PDF bytes: the on-device Tesseract OCR
 * engine when usable (Tauri + configured), else the no-op native recognizer (browser,
 * tests, or an unconfigured build) so callers always get the paste fallback. The OCR
 * engine is dynamically imported so tesseract.js never bloats the entry chunk or the
 * browser/jsdom path.
 */
async function pickBytesRecognizer(opts: RecognizeOptions) {
  if (!isTauri()) return nativeTextRecognizer();
  const { ocrConfigured, makeOcrRecognizer } = await import("./ocr");
  if (!ocrConfigured()) return nativeTextRecognizer();
  return makeOcrRecognizer({ onProgress: opts.onProgress, signal: opts.signal });
}
