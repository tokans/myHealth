import { describe, it, expect, vi, beforeEach } from "vitest";

// Default (jsdom) is non-Tauri: the bytes path must be a clean no-op (paste fallback),
// never importing the OCR engine. isTauri drives `pickBytesRecognizer`.
vi.mock("@/lib/environment", () => ({ isTauri: vi.fn(() => false) }));

import { isTauri } from "@/lib/environment";
import { recognizeDocument, captureKindForMime } from "./capture";

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(false);
});

describe("captureKindForMime", () => {
  it("classifies images, pdfs and text", () => {
    expect(captureKindForMime("image/png")).toBe("photo");
    expect(captureKindForMime("application/pdf")).toBe("scanned-pdf");
    expect(captureKindForMime("text/plain", "a.txt")).toBe("plain-text");
    expect(captureKindForMime(null, "scan.jpg")).toBe("photo");
  });
});

describe("recognizeDocument", () => {
  it("decodes text-like input as trusted native-text", async () => {
    const cap = await recognizeDocument(enc("ASPIRIN 75mg"), "text/plain", "rx.txt");
    expect(cap.kind).toBe("plain-text");
    expect(cap.text).toBe("ASPIRIN 75mg");
    expect(cap.source).toBe("native-text");
    expect(cap.needsOcr).toBe(false);
  });

  it("falls back to the paste path for image bytes outside Tauri (no OCR engine loaded)", async () => {
    const cap = await recognizeDocument(new Uint8Array([1, 2, 3]), "image/png", "scan.png");
    expect(cap.kind).toBe("photo");
    expect(cap.text).toBe("");
    expect(cap.source).toBe("ocr");
    expect(cap.needsOcr).toBe(true);
  });

  it("treats an empty text file as needing input (needsOcr)", async () => {
    const cap = await recognizeDocument(enc("   "), "text/plain", "blank.txt");
    expect(cap.needsOcr).toBe(true);
  });
});
