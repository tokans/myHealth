/**
 * The Tauri-backed `OcrAssetHost` — myHealth's implementation of the I/O the shared OCR
 * engine (`@scandoc/core/ocr`) needs but won't do itself.
 *
 * Download is via the Tauri HTTP plugin (host is allowlisted in capabilities; the engine
 * SHA-256-verifies the bytes before use). The cache lives under
 * `BaseDirectory.AppLocalData/ocr/`; the served URL is resolved with `convertFileSrc`
 * (the asset protocol, scoped to `$APPLOCALDATA/ocr/**` in tauri.conf.json).
 *
 * INVARIANT (suite #1/#7): on-device only. The single network hop is the allowlisted,
 * hash-verified language-data download; nothing is uploaded.
 */
import type { OcrAssetHost, DownloadOptions } from "@scandoc/core/ocr";
import { OCR_DIR } from "./config";

function rel(name: string): string {
  return `${OCR_DIR}/${name}`;
}

/** Download bytes via the Tauri HTTP plugin, streaming progress when possible. */
async function download(url: string, opts: DownloadOptions = {}): Promise<Uint8Array> {
  const { fetch } = await import("@tauri-apps/plugin-http");
  const res = await fetch(url, { method: "GET", signal: opts.signal });
  if (!res.ok) throw new Error(`OCR asset download failed: HTTP ${res.status}`);

  const total = Number(res.headers.get("content-length")) || undefined;
  const reader = res.body?.getReader?.();
  if (!reader) {
    // No streaming body — fall back to a single buffered read (indeterminate progress).
    const buf = new Uint8Array(await res.arrayBuffer());
    opts.onProgress?.(buf.length, total);
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      opts.onProgress?.(received, total);
    }
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export const tauriOcrHost: OcrAssetHost = {
  download,

  async hasCached(name: string): Promise<boolean> {
    const { exists, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    return exists(rel(name), { baseDir: BaseDirectory.AppLocalData });
  },

  async readCached(name: string): Promise<Uint8Array> {
    const { readFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    return readFile(rel(name), { baseDir: BaseDirectory.AppLocalData });
  },

  async writeCached(name: string, bytes: Uint8Array): Promise<void> {
    const { writeFile, mkdir, exists, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    if (!(await exists(OCR_DIR, { baseDir: BaseDirectory.AppLocalData }))) {
      await mkdir(OCR_DIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    }
    await writeFile(rel(name), bytes, { baseDir: BaseDirectory.AppLocalData });
  },

  async cacheDirUrl(): Promise<string> {
    const { appLocalDataDir, join } = await import("@tauri-apps/api/path");
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const dir = await join(await appLocalDataDir(), OCR_DIR);
    return convertFileSrc(dir);
  },
};
