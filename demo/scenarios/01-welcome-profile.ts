/**
 * 01 — Your day & your family.
 * The calm home surface: Today shows water + daily tasks for the active person.
 * Bump water, tick off a task, then hop to Profiles and add a family member —
 * everything is scoped per person and stays on the device.
 *
 * The demo build seeds a self profile (+ family), so Today opens populated.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "01-welcome-profile",
  title: "Your day & your family",
  shows: "Today (water + a daily task) → Profiles → add a family member.",

  async run(h) {
    h.log("land on Today");
    await h.waitFor("today-root");
    await h.pause(1200);

    h.log("add a glass of water");
    await h.click("today-add-water");
    await h.pause(500);
    await h.click("today-add-water");
    await h.pause(800);

    h.log("add a daily task");
    await h.type("today-task-input", "Evening stretch");
    await h.click("today-add-task");
    await h.pause(1400);

    h.log("add a family member");
    await h.goto("/profiles");
    await h.waitFor("profiles-add");
    await h.click("profiles-add");
    await h.waitFor("profile-name");
    await h.type("profile-name", "Priya Sharma");
    const rel = await h.browser.$('[data-testid="profile-relationship"]');
    await rel.selectByAttribute("value", "mother").catch(() => {});
    await h.pause(700);
    await h.click("profile-save");
    await h.pause(1800);
  },
};

export default scenario;
