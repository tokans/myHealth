/**
 * Vitest global setup. Registers jest-dom matchers (toBeInTheDocument, etc.) on
 * Vitest's expect and provides a minimal localStorage + matchMedia polyfill that a
 * few stores/components touch at import time. Loaded via vitest.config.ts.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees between tests so queries never see a previous render.
afterEach(() => {
  cleanup();
});

// jsdom ships localStorage, but guarantee a clean store per file run.
if (typeof window !== "undefined" && !("matchMedia" in window)) {
  // Some components probe matchMedia for theme; jsdom omits it.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
