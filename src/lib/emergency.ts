/** Emergency/ICE helpers — click-to-call/email from the shared core + app copy. */
export { telHref, mailtoHref, hasActionableContact } from "sharedcorelib/ice";

export const EMERGENCY_DISCLAIMER =
  "For information only. In an emergency call your local emergency number. " +
  "myHealth does not provide medical advice, diagnosis, or treatment.";

/** Whole years from a 'YYYY-MM-DD' date of birth, or null. */
export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}
