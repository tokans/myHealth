/**
 * Per-app suite config for the app marketplace.
 *
 * The marketplace MECHANISM (join the published-apps registry with local install state,
 * decide each row's action, gate Patron/Partner apps by entitlement) lives in the shared
 * core (`sharedcorelib/suite` → `createAppCatalog`). This file holds only myHealth's data:
 * a baked seed of the publisher's apps so the marketplace renders something useful before
 * any signed registry arrives over the air.
 *
 * NO EGRESS: the seed is static metadata. The only outbound action the catalog exposes is
 * the OS-browser HANDOFF of a marketing/download URL the user clicks — never a fetch/socket,
 * and never any health data. Hosts stay within the opener allowlist (github.com/tokans/* +
 * tokans.org/*).
 */
import type { PublishedApp } from "sharedcorelib/suite";
import { APP_ID } from "@/db/healthFacet";

/** This app's stable suite id — flags the current row in the marketplace. */
export const SUITE_APP_ID = APP_ID; // "myhealth"

const releases = (repo: string) => ({
  windows: `https://github.com/tokans/${repo}/releases/latest`,
  macos: `https://github.com/tokans/${repo}/releases/latest`,
  linux: `https://github.com/tokans/${repo}/releases/latest`,
});

/**
 * Baked seed of the publisher's apps, including THIS app (myHealth). A signed over-the-air
 * `registry` (when it arrives) overrides this; until then the marketplace lists these so a
 * user can already discover siblings. `latestVersion` is "0.0.0" so no spurious "update
 * available" shows until a real registry supplies true versions. The two paid products are
 * access-gated (`patron`/`partner`) — until the user holds that grant the marketplace offers
 * **Enroll** instead of **Download**.
 */
export const SEED_PUBLISHED_APPS: PublishedApp[] = [
  {
    appId: SUITE_APP_ID, // "myhealth"
    name: "myHealth",
    tagline: "Your family's private health record",
    description: "Conditions, medications, vitals and ICE cards — encrypted on your device.",
    marketingUrl: "https://www.tokans.org/apps/myhealth",
    downloadLinks: releases("myHealth"),
    latestVersion: "0.0.0",
    latestCoreVersion: "0.0.0",
    access: "open",
  },
  {
    appId: "myfinance",
    name: "myFinance",
    tagline: "Private, local-first personal finance",
    description: "Net worth, goals, tax, FIRE and family-readiness — all on your device.",
    marketingUrl: "https://www.tokans.org/apps/myfinance",
    downloadLinks: releases("myFinance"),
    latestVersion: "0.0.0",
    latestCoreVersion: "0.0.0",
    access: "open",
  },
  {
    appId: "mythoughts",
    name: "myThoughts",
    tagline: "Private journaling, thoughts & mood — yours alone",
    description: "A private journal and mood tracker; every entry in your own crypto-hard compartment.",
    marketingUrl: "https://www.tokans.org/apps/mythoughts",
    downloadLinks: releases("myThoughts"),
    latestVersion: "0.0.0",
    latestCoreVersion: "0.0.0",
    access: "open",
  },
  {
    appId: "mylifeassistant",
    name: "myLifeAssistant",
    tagline: "Your whole life, in context — the premium suite assistant",
    description:
      "Opt-in, privacy-guarded AI that turns your suite data into gentle cross-app insight. Your data never leaves the device without your say-so.",
    marketingUrl: "https://www.tokans.org/apps/mylifeassistant",
    enrollUrl: "https://www.tokans.org/donate",
    downloadLinks: releases("myLifeAssistant"),
    latestVersion: "0.0.0",
    latestCoreVersion: "0.0.0",
    access: "patron",
  },
  {
    appId: "myworkassistant",
    name: "myWorkAssistant",
    tagline: "The professional companion — for verified practitioners",
    description: "A backend-backed assistant for verified professionals (sign-in required).",
    marketingUrl: "https://www.tokans.org/apps/myworkassistant",
    enrollUrl: "https://www.tokans.org/professionals/signup",
    downloadLinks: releases("myWorkAssistant"),
    latestVersion: "0.0.0",
    latestCoreVersion: "0.0.0",
    access: "partner",
    hasBackend: true,
  },
];
