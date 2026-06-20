import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { backupVite } from "sharedcorelib/vite";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

// Node polyfills + aliases for the OPTIONAL Excel backup-password path (officecrypto-tool
// is Node-targeted; the Tauri webview has no Buffer/crypto/stream). Centralized in core so
// every suite app shares one fix — see sharedcorelib `vite/backup-polyfills.mjs`.
const backup = backupVite();

export default defineConfig({
  plugins: [react(), ...backup.plugins],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...backup.alias,
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // The lazy officecrypto (~950 KB) backup chunk is code-split off first paint; raise the
    // warning floor (from core) so it doesn't trip it.
    chunkSizeWarningLimit: backup.chunkSizeWarningLimit,
    // Heavy, on-demand-only vendor chunks (OCR engine, SheetJS, charts) must never get
    // a <link modulepreload> on first paint — they belong to lazy routes/actions and
    // would otherwise be eagerly downloaded. modulepreload is only a hint, so dropping
    // these entries is safe: the chunks still load when their dynamic import runs.
    modulePreload: {
      resolveDependencies: (_file, deps) =>
        deps.filter((d) => !/[\\/]vendor-(ocr|xlsx|charts)-/.test(d)),
    },
    rollupOptions: {
      output: {
        // Split the single large entry bundle into cacheable vendor chunks so no
        // one chunk dwarfs the rest. Grouped by concern rather than per-package to
        // avoid a long tail of tiny files. App code (incl. sharedcorelib) stays in
        // the entry/index chunk.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep the lazy backup-password subtree (officecrypto + Node polyfills) OFF the
          // eager catch-all `vendor` below — let rolldown default-split it onto its own
          // async chunk so ~700 KB of crypto polyfill never hits first paint.
          if (backup.isBackupModule(id)) return;
          // Heavy, lazy-only libs FIRST so they get their OWN chunk and stay off first paint:
          // the core backup module already does `await import("xlsx")`, but without this split a
          // catch-all "vendor" chunk swallowed xlsx into the eager path. Now it loads only when
          // a user exports an Excel backup from Settings.
          if (/[\\/]node_modules[\\/]xlsx[\\/]/.test(id)) return "vendor-xlsx";
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return "vendor-react";
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return "vendor-query";
          if (/[\\/]node_modules[\\/](tesseract\.js|pdfjs-dist)[\\/]/.test(id)) return "vendor-ocr";
          // recharts + its d3 deps are heavy (~500 KB) and used ONLY by the lazy Trends
          // page. Without this rule they fall into the catch-all "vendor" chunk, which IS
          // eager (it also holds first-paint deps), dragging charts onto first paint.
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap)[\\/]/.test(id))
            return "vendor-charts";
          if (/[\\/]node_modules[\\/](@radix-ui|lucide-react|react-hook-form)[\\/]/.test(id))
            return "vendor-ui";
          if (/[\\/]node_modules[\\/](zod|date-fns|@noble)[\\/]/.test(id)) return "vendor-utils";
          return "vendor";
        },
      },
    },
  },
});
