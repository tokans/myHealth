/**
 * 02 — Log a vital.
 * From Vitals, pick a metric (Weight), type a value, save — the reading appears
 * in the recent list. Quick, one-tap entry, stored on-device. The demo build
 * seeds a profile + history, so the recent list is already populated.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "02-log-vital",
  title: "Log a vital",
  shows: "Vitals → pick Weight → enter a value → save → it lands in the recent list.",

  async run(h) {
    h.log("open Vitals");
    await h.goto("/metrics");
    await h.waitFor("metrics-kind");
    await h.pause(1000);

    h.log("pick Weight and enter a reading");
    const kindSel = await h.browser.$('[data-testid="metrics-kind"]');
    await kindSel.selectByAttribute("value", "weight");
    await h.type("metrics-value", "77.5");
    await h.pause(800);

    h.log("save reading — it appears in the recent list");
    await h.click("metrics-save");
    await h.pause(2200);
  },
};

export default scenario;
