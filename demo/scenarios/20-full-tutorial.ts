/**
 * 20 — Full tutorial (single take).
 * One continuous tour across myHealth's surfaces, captioned by h.mark() calls
 * (each mark becomes an on-screen lower-third in the tutorial video, shown from
 * its moment until the next mark). `solo` → excluded from the marketing montage.
 *
 * The demo build seeds a full dataset + champion tier, so every surface is
 * populated and unlocked. Editing the captions = editing the h.mark() strings.
 */
import type { Scenario } from "./types.ts";

const scenario: Scenario = {
  id: "20-full-tutorial",
  title: "Full tutorial (single take)",
  shows:
    "End-to-end tour: Today → Vitals → Goals → Trends → Medications → Documents → Journey.",
  solo: true,

  async run(h) {
    h.mark("myHealth — your family's health record, on your device");
    await h.waitFor("today-root");
    await h.pause(1800);

    h.mark("Today: water and your daily habits");
    await h.click("today-add-water");
    await h.pause(500);
    await h.click("today-add-water");
    await h.pause(1400);

    h.mark("Vitals: log readings in two taps");
    await h.goto("/metrics");
    await h.waitFor("metrics-kind");
    const kind = await h.browser.$('[data-testid="metrics-kind"]');
    await kind.selectByAttribute("value", "weight");
    await h.type("metrics-value", "77.2");
    await h.click("metrics-save");
    await h.pause(1800);

    h.mark("Goals: targets with a projected ETA");
    await h.goto("/goals");
    await h.waitFor("goal-card");
    await h.pause(2200);

    h.mark("Trends: see your numbers move, with healthy ranges");
    await h.goto("/trends");
    await h.waitFor("trends-kind");
    const tkind = await h.browser.$('[data-testid="trends-kind"]');
    await tkind.selectByAttribute("value", "weight");
    await h.pause(2400);

    h.mark("Medications: what you take, and when");
    await h.goto("/medications");
    await h.waitFor("medications-add");
    await h.pause(2000);

    h.mark("Documents: reports and cards, encrypted on your device");
    await h.goto("/documents");
    await h.waitFor("documents-scan-insurance", 20_000);
    await h.pause(2200);

    h.mark("Your journey unlocks features as you go — private, offline, yours");
    await h.goto("/journey");
    await h.pause(2600);
  },
};

export default scenario;
