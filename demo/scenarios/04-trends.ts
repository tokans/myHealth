/**
 * 04 — Trends with healthy ranges.
 * Trends charts the seeded 120-day series with a shaded reference-range band and
 * a deterministic trend/sentiment summary. Pick Weight (a clean downward trend),
 * then Blood pressure to show the band move.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "04-trends",
  title: "Trends with healthy ranges",
  shows: "Trends → Weight (downward trend) → Blood pressure → reference band + summary.",

  async run(h) {
    h.log("open Trends");
    await h.goto("/trends");
    await h.waitFor("trends-kind");
    await h.pause(1600);

    h.log("show Weight trending down");
    const kind = await h.browser.$('[data-testid="trends-kind"]');
    await kind.selectByAttribute("value", "weight");
    await h.pause(2200);

    h.log("switch to Blood pressure (systolic)");
    await kind.selectByAttribute("value", "bp_systolic");
    await h.pause(2400);
  },
};

export default scenario;
