/**
 * 06 — Track a medication.
 * Medications lists the seeded current meds. Add one on camera (Metformin 500 mg,
 * once a day) and watch the med card render with strength + schedule. myHealth
 * records and reminds — it never advises on doses or checks interactions.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "06-medication",
  title: "Track a medication",
  shows: "Medications → add Metformin 500 mg (OD) → med card with strength + schedule.",

  async run(h) {
    h.log("open Medications");
    await h.goto("/medications");
    await h.waitFor("medications-add");
    await h.pause(1200);

    h.log("add a medication");
    await h.click("medications-add");
    await h.waitFor("med-drug");
    await h.type("med-drug", "Metformin");
    await h.type("med-strength", "500 mg");
    const sched = await h.browser.$('[data-testid="med-schedule"]');
    await sched.selectByAttribute("value", "OD");
    await h.pause(700);

    h.log("save — the medication is now tracked");
    await h.click("med-save");
    await h.pause(2200);
  },
};

export default scenario;
