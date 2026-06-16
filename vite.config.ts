import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
    rollupOptions: {
      output: {
        // Split the single large entry bundle into cacheable vendor chunks so no
        // one chunk dwarfs the rest. Grouped by concern rather than per-package to
        // avoid a long tail of tiny files. App code (incl. sharedcorelib) stays in
        // the entry/index chunk.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return "vendor-react";
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return "vendor-query";
          if (/[\\/]node_modules[\\/](tesseract\.js|pdfjs-dist)[\\/]/.test(id)) return "vendor-ocr";
          if (/[\\/]node_modules[\\/](@radix-ui|lucide-react|react-hook-form)[\\/]/.test(id))
            return "vendor-ui";
          if (/[\\/]node_modules[\\/](zod|date-fns|@noble)[\\/]/.test(id)) return "vendor-utils";
          return "vendor";
        },
      },
    },
  },
});
