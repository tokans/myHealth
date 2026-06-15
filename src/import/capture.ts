/**
 * The capture → recognized-text bridge for myHealth's document scan flow.
 *
 * This is a thin wrapper over `@scandoc/core`'s `Recognizer` seam (the typed plug
 * point where a real local OCR sidecar lands LATER). No OCR engine ships today, so
 * the only recognizer is `nativeTextRecognizer`, the offline identity recognizer:
 *   - text/plain-text PDFs  → decoded UTF-8 text, tagged `native-text` (trusted)
 *   - images / scanned PDFs → empty text, tagged `ocr` (the user pastes/edits the
 *     text in the review UI until a sidecar can read the bytes)
 *
 * INVARIANT (suite #1/#7): nothing here egresses — bytes stay on-device; this only
 * decodes text we already hold. When the OCR sidecar arrives it swaps in as the
 * Recognizer with no change to callers.
 */
import { nativeTextRecognizer, type CaptureKind, type FieldSource } from "@scandoc/core";

export interface Capture {
  /** Recognized text (empty when bytes need OCR we don't bundle yet). */
  text: string;
  /** Provenance feeding `requiresConfirmation`: native text is trusted, OCR is not. */
  source: FieldSource;
  /** How the document arrived — drives which recognition path a future sidecar takes. */
  kind: CaptureKind;
  /** True when the bytes still need OCR (image/scanned PDF, no engine yet). */
  needsOcr: boolean;
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
 * Recognize a picked document to text via the core Recognizer seam. Text-like input
 * is decoded to UTF-8 and passed through; everything else comes back empty + `ocr`
 * (needsOcr) so the review UI can prompt for a paste until the sidecar exists.
 */
export async function recognizeDocument(
  bytes: Uint8Array,
  mime: string | null,
  name?: string,
): Promise<Capture> {
  const kind = captureKindForMime(mime, name);
  const recognizer = nativeTextRecognizer();
  if (TEXT_LIKE.includes(kind)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const out = await recognizer.recognize({ kind, text });
    return { text: out.text, source: out.source, kind, needsOcr: false };
  }
  const out = await recognizer.recognize({ kind, bytes });
  return { text: out.text, source: out.source, kind, needsOcr: true };
}
