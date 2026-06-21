/**
 * The app marketplace ("More from Tokans"), bound to myHealth's adapters.
 *
 * The catalog MECHANISM — join the published-apps registry with this client's local
 * install/sync state, decide each row's action (open / download / enroll / current), gate
 * Patron/Partner-only apps by entitlement, AND the byte-identical glue (platform detection,
 * app-version reporter, local-state + registry-cache persistence) — all lives in the shared
 * core (`sharedcorelib/suite` → `createSuiteCatalog`, which folds the former platform.ts /
 * version.ts / localState.ts / registry.ts into one DI factory). This file now supplies ONLY
 * what genuinely varies per app: the app id, its baked seed, the OS-browser opener, and the
 * entitlement source. Local-state storage keys are normalized to `${appId}:suite:*` by core.
 *
 * Entitlements are read from the grant state (`src/grant/receiver.ts`): a Supporter satisfies
 * `patron` access, a Verified Pro satisfies `partner`. So an access-gated paid app shows
 * **Enroll** until the matching grant is imported, then **Download** — the same grant that
 * unlocks features here also unlocks the paid siblings in the marketplace.
 *
 * NO EGRESS: every adapter is local. `openExternal` is an OS-browser handoff of a static
 * marketing/download URL (capability-allowlisted), not a network call; phone-sync is a local
 * flag. No health data travels this path.
 */
import { createSuiteCatalog, type Entitlements } from "sharedcorelib/suite";
import { openExternal } from "@/lib/openExternal";
import { grantStatus } from "@/grant/receiver";
import { SUITE_APP_ID, SEED_PUBLISHED_APPS } from "./config";

/** Map myHealth's grant status to suite entitlements: Supporter ⇒ patron, Verified Pro ⇒ partner. */
function entitlements(): Entitlements {
  const g = grantStatus();
  return { isPatron: g.supporter, isPartner: g.pro };
}

export const suiteCatalog = createSuiteCatalog({
  appId: SUITE_APP_ID,
  seed: SEED_PUBLISHED_APPS,
  openExternal,
  entitlements: async () => entitlements(),
  // Best-effort OS launch of an installed sibling via its URL scheme; falls back to the
  // marketing page. (This matches the suite-standard default, but kept explicit for clarity.)
  launchApp: async (app) => {
    try {
      await openExternal(`${app.appId}://open`);
    } catch {
      await openExternal(app.marketingUrl);
    }
  },
});
