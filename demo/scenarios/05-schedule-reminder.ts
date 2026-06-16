/**
 * 05 — Schedule → reminders.
 * Add a schedule block (a morning walk) — schedule blocks become daily reminder
 * nudges. Hop to Reminders to see the inbox (seeded water/task/med nudges plus
 * the new one) and complete a reminder.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "05-schedule-reminder",
  title: "Schedule → reminders",
  shows: "Schedule → add a block → Reminders inbox → complete a reminder.",

  async run(h) {
    h.log("open Schedule");
    await h.goto("/schedule");
    await h.waitFor("schedule-add");
    await h.pause(1000);

    h.log("add a morning-walk block");
    await h.click("schedule-add");
    await h.waitFor("block-title");
    await h.type("block-title", "Morning walk");
    await h.type("block-start", "07:00");
    await h.pause(600);
    await h.click("block-save");
    await h.pause(1400);

    h.log("open Reminders — nudges appear automatically");
    await h.goto("/reminders");
    await h.waitFor("reminder-row");
    await h.pause(1600);

    h.log("complete the first reminder");
    await h.click("reminder-complete");
    await h.pause(1800);
  },
};

export default scenario;
