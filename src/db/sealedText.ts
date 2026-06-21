/**
 * Vault sealing for a document's OCR/import `extracted_text` (decision #26).
 *
 * The document BYTES are already AES-256-GCM blobs sealed under the per-device document
 * key (the vault DEK) via `vault.saveBlob` → `vault.sealBytes`. The extracted text must
 * get the SAME protection: it is medical free-text and must never sit in suite.db as
 * plaintext (the legacy `documents.extracted_text` column was PLAINTEXT — the bug this
 * fixes). We reuse the audited primitive — `vault.sealBytes(plain, aad)` /
 * `vault.openBytes(sealed, aad)` (AES-256-GCM under the per-device DEK) — NO new crypto.
 *
 * Wire format of the stored cell: `"scv1:" + base64(GCM-sealed-bytes)`. The DEK requires
 * the vault to be unlocked; document features are already vault-gated (see Documents.tsx),
 * so a reader/writer of extracted text always holds an unlocked vault. The AAD binds the
 * ciphertext to the document blob's file_name so a sealed text cell can't be transplanted
 * onto another document.
 *
 * INVARIANT: no health data egresses — sealing/opening is local; the suite-DB descriptor
 * tags the cell `Secret`, so backup exports emit only a sha256 fingerprint, never the value.
 */
import { sealBytes, openBytes } from "@/vault/stronghold";

/**
 * The leading format/version of a sealed `extracted_text_enc` cell. The cell is
 * `"scv" + SEALED_TEXT_VERSION + ":" + base64(GCM-sealed-bytes)`; the version lets the
 * wire format evolve. Reads are BACKWARD-COMPATIBLE — a value without this prefix is
 * treated as legacy plaintext and returned as-is (see openExtractedText), so existing rows
 * never become unreadable.
 */
export const SEALED_TEXT_VERSION = 1;
const PREFIX = `scv${SEALED_TEXT_VERSION}:`;

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  // btoa exists in the webview; Buffer is the Node/test fallback.
  return typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64");
}

function fromB64(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** True when a stored value is already a sealed `extracted_text_enc` cell. */
export function isSealedText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Seal extracted text for storage in `myhealth_documents.extracted_text_enc`. `aad` binds
 * the ciphertext to the document blob's file_name. Requires the vault to be unlocked.
 * Returns null for empty/absent input (nothing to seal).
 */
export async function sealExtractedText(
  plain: string | null | undefined,
  aad: string,
): Promise<string | null> {
  if (plain == null || plain === "") return null;
  const sealed = await sealBytes(new TextEncoder().encode(plain), aad);
  return PREFIX + toB64(sealed);
}

/**
 * Open a sealed `extracted_text_enc` cell back to plaintext. Requires the vault to be
 * unlocked. Pass-through for null/empty; if the value is NOT sealed (legacy plaintext that
 * somehow survived), it is returned as-is so readers degrade gracefully.
 */
export async function openExtractedText(
  stored: string | null | undefined,
  aad: string,
): Promise<string | null> {
  if (stored == null || stored === "") return null;
  if (!isSealedText(stored)) return stored;
  const bytes = await openBytes(fromB64(stored.slice(PREFIX.length)), aad);
  return new TextDecoder().decode(bytes);
}
