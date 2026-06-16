/**
 * The app marketplace ("More from Tokans"), bound to myHealth's adapters.
 *
 * The catalog MECHANISM — join the published-apps registry with this client's local
 * install/sync state, decide each row's action (open / download / enroll / current), and gate
 * Patron/Partner-only apps by entitlement — lives in the shared core (`sharedcorelib/suite`
 * → `createAppCatalog`). This file supplies the DI adapters: the registry source, local-state
 * persistence, the OS-browser opener, sibling launch, platform detection, and entitlements.
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
import { createAppCatalog, type Entitlements } from "sharedcorelib/suite";
import { openExternal } from "@/lib/openExternal";
import { grantStatus } from "@/grant/receiver";
import { SUITE_APP_ID } from "./config";
import { listPublishedApps } from "./registry";
import { getLocalState, setLocalState } from "./localState";
import { detectPlatform } from "./platform";

/** Map myHealth's grant status to suite entitlements: Supporter ⇒ patron, Verified Pro ⇒ partner. */
function entitlements(): Entitlements {
  const g = grantStatus();
  return { isPatron: g.supporter, isPartner: g.pro };
}

export const suiteCatalog = createAppCatalog({
  currentAppId: SUITE_APP_ID,
  listPublishedApps,
  getLocalState,
  setLocalState,
  openExternal,
  // Best-effort OS launch of an installed sibling via its URL scheme; falls back to the
  // marketing page. A first-class native launch is a documented next step.
  launchApp: async (app) => {
    try {
      await openExternal(`${app.appId}://open`);
    } catch {
      await openExternal(app.marketingUrl);
    }
  },
  platform: detectPlatform,
  entitlements: async () => entitlements(),
});
