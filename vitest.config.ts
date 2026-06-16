import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Test runner config. The app's vite.config.ts is tuned for the Tauri build, so
// tests get their own config: jsdom (for React component tests), the `@/` alias,
// and a setup file that wires jest-dom matchers.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // `sharedcorelib` is a symlinked file: dep with its OWN node_modules (react/
    // zustand devDeps for the lib's tests). Without deduping, a core-created store
    // (e.g. createContentStore) would bind a SECOND React copy and crash component
    // tests with "Cannot read properties of null". Collapse to the app's single copy.
    dedupe: ["react", "react-dom", "zustand"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
  },
});
