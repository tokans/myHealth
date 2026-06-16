/**
 * Ordered scenario registry. Add scenarios here as they're implemented; the
 * recorder records them in this order (and `--all` records every non-`solo` one).
 */
import type { Scenario } from "@mydemo/core";

import welcomeProfile from "./01-welcome-profile.ts";
import logVital from "./02-log-vital.ts";
import goalEta from "./03-goal-eta.ts";
import trends from "./04-trends.ts";
import scheduleReminder from "./05-schedule-reminder.ts";
import medication from "./06-medication.ts";
import documentScan from "./07-document-scan.ts";
import fullTutorial from "./20-full-tutorial.ts";

export const SCENARIOS: Scenario[] = [
  welcomeProfile,
  logVital,
  goalEta,
  trends,
  scheduleReminder,
  medication,
  documentScan,
  fullTutorial,
];
