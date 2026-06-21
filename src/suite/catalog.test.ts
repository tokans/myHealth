import { describe, it, expect, beforeEach } from "vitest";
import { suiteCatalog } from "./catalog";
import { SEED_PUBLISHED_APPS, SUITE_APP_ID } from "./config";
import { applyGrant, clearGrant } from "@/grant/receiver";

beforeEach(() => {
  localStorage.clear();
  clearGrant();
});

const byId = async (id: string) => (await suiteCatalog.list()).find((a) => a.appId === id)!;

describe("published-apps registry", () => {
  it("falls back to the baked seed when nothing is cached", async () => {
    // The core local-state adapter unions the OTA cache (empty here) over the baked seed,
    // so every seeded app — including the current one — is listed.
    const apps = await suiteCatalog.list();
    for (const seeded of SEED_PUBLISHED_APPS) {
      expect(apps.some((a) => a.appId === seeded.appId)).toBe(true);
    }
    expect(apps.some((a) => a.appId === SUITE_APP_ID)).toBe(true);
  });
});

describe("marketplace catalog", () => {
  it("marks the current app and offers Download for open siblings", async () => {
    const self = await byId(SUITE_APP_ID);
    expect(self.isCurrentApp).toBe(true);
    expect(self.primaryAction).toBe("current");
    expect(self.local.installed).toBe(true);

    const finance = await byId("myfinance");
    expect(finance.isCurrentApp).toBe(false);
    expect(finance.primaryAction).toBe("download"); // open access, not installed
  });

  it("gates Patron/Partner apps to Enroll until the matching grant is held", async () => {
    expect((await byId("mylifeassistant")).primaryAction).toBe("enroll"); // patron-gated
    expect((await byId("myworkassistant")).primaryAction).toBe("enroll"); // partner-gated

    // A Supporter (patron) grant unlocks the patron app...
    applyGrant({ v: 1, kind: "patron" });
    expect((await byId("mylifeassistant")).primaryAction).toBe("download");
    expect((await byId("myworkassistant")).primaryAction).toBe("enroll"); // still needs partner

    // ...and a Verified Pro (partner) grant unlocks the partner app.
    applyGrant({ v: 1, kind: "partner" });
    expect((await byId("myworkassistant")).primaryAction).toBe("download");
  });

  it("listAvailable excludes the current app; listInstalled includes it", async () => {
    const available = await suiteCatalog.listAvailable();
    expect(available.some((a) => a.appId === SUITE_APP_ID)).toBe(false);
    const installed = await suiteCatalog.listInstalled();
    expect(installed.some((a) => a.appId === SUITE_APP_ID)).toBe(true);
  });
});
