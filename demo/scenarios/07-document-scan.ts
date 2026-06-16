/**
 * 07 — Encrypted document vault + scan.
 * Documents are AES-GCM-sealed on the device. In demo mode the vault
 * auto-unlocks, so we land straight in the vault, open the "Scan insurance card"
 * flow, and show the encrypted-on-device file picker.
 *
 * NOTE: the actual file pick + OCR extraction tail is captured BY HAND — the
 * file chooser is a native OS dialog WebDriver can't drive (there's no hidden
 * <input type=file>), so the scenario stops at the "Choose file" prompt. See
 * DEMO.md › Manual-recording checklist.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "07-document-scan",
  title: "Encrypted document vault + scan",
  shows: "Documents (vault auto-unlocks) → Scan insurance card → encrypted file picker.",

  async run(h) {
    h.log("open Documents (the vault auto-unlocks in demo mode)");
    await h.goto("/documents");
    // The vault unlock auto-runs; wait for the unlocked surface (the action buttons).
    await h.waitFor("documents-scan-insurance", 20_000);
    await h.pause(1400);

    h.log("start the insurance-card scan");
    await h.click("documents-scan-insurance");
    await h.waitFor("documents-choose-file");
    await h.pause(2200);
    // Stops here — the native file dialog + extraction tail is hand-captured.
  },
};

export default scenario;
