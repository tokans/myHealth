import { openExternal } from "@/lib/openExternal";

/**
 * Donation ("Become a Supporter") and professional ("Verified Pro") sign-up links.
 *
 * The app has NO backend, so neither flow is confirmed by a callback. The donation
 * / enrollment runs on tokans.org; afterwards the user is emailed a signed+encrypted
 * grant file which they import (Settings → Support myHealth → "Import support file";
 * verified receive-only via `sharedcorelib/grant`, see src/grant/receiver.ts). These
 * helpers only open the hosted page in the browser. Mirrors myFinance's donate.ts.
 */

/** Hosted donation page (Supporter tier). */
export const DONATE_URL = "https://www.tokans.org/donate";

/** Professional enrollment page (Verified Pro tier). */
export const PARTNER_SIGNUP_URL = "https://www.tokans.org/professionals/signup";

/** Open the hosted donation page in the user's browser. */
export async function openDonatePage(): Promise<void> {
  await openExternal(DONATE_URL);
}

/** Open the professional enrollment page in the user's browser. */
export async function openPartnerSignup(): Promise<void> {
  await openExternal(PARTNER_SIGNUP_URL);
}
