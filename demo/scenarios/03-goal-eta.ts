/**
 * 03 — Goal with a projected ETA.
 * Goals already carry projections from the seeded readings (On-track / progress
 * / ETA). Create a new measurable goal on camera and watch its card render with
 * a status badge + progress bar + projected ETA — deterministic, advisory.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "03-goal-eta",
  title: "Goal with a projected ETA",
  shows: "Goals → new goal (Reach 75 kg) → card shows On-track + progress + ETA.",

  async run(h) {
    h.log("open Goals");
    await h.goto("/goals");
    await h.waitFor("goals-new");
    await h.pause(1200);

    h.log("create a measurable goal");
    await h.click("goals-new");
    await h.waitFor("goal-title");
    await h.type("goal-title", "Reach 75 kg");
    const metric = await h.browser.$('[data-testid="goal-metric"]');
    await metric.selectByAttribute("value", "weight");
    await h.pause(400);
    await h.type("goal-baseline", "84");
    await h.type("goal-target", "75");
    await h.pause(700);

    h.log("save — the goal card shows its projection");
    await h.click("goal-save");
    await h.waitFor("goal-card");
    await h.pause(2400);
  },
};

export default scenario;
