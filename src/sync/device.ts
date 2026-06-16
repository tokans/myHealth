/**
 * A stable, local-only device id. Used purely as the last-writer-wins tie-break in
 * device-to-device sync (`sharedcorelib/sync` `isNewer`): when two devices edit the
 * same row at the same `updated_at`, the higher device id wins, so both peers
 * converge on the same result. Generated once and persisted to localStorage; never
 * transmitted as identity (it only rides along inside the encrypted sync bundle).
 */
const STORAGE_KEY = "myhealth.deviceId";

/** This device's stable id (generated + persisted on first use). */
export function deviceId(): string {
  if (typeof localStorage === "undefined") return "device";
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "device";
  }
}
