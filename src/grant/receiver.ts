/**
 * Receive-only entitlement grants → the Supporter / Verified Pro tiers.
 *
 * After a donation (→ Supporter) or a professional enrollment (→ Verified Pro) at
 * the publisher portal, the user receives a small signed-then-encrypted `.grant`
 * file. This module RECEIVES it — the app never uploads anything about the user
 * (invariant 1/2; receive-only). Core does the crypto (`sharedcorelib/grant`):
 * Ed25519-verify the ciphertext → AES-256-GCM decrypt → shape-check; we only
 * supply the baked grant keys, the payload schema, and where to read the file.
 *
 * The resolved status is persisted locally (localStorage, never transmitted) and
 * read by the tier store (badge/journey) and the gating store (a Supporter/Pro
 * unlocks every feature via the gating `override` — donation only ACCELERATES the
 * free ladder, never paywalls the safety floor).
 *
 * Double-gated like the OTA content path: grant import is disabled unless the
 * signing keys are configured (`VITE_GRANT_*`) AND running in Tauri — a placeholder
 * build can never verify or fetch a grant.
 */
import { z } from "zod";
import { createGrantReceiver } from "sharedcorelib/grant";
import { isTauri } from "@/lib/environment";

const PUBKEY = import.meta.env.VITE_GRANT_PUBKEY as string | undefined;
const TRANSPORT_KEY = import.meta.env.VITE_GRANT_TRANSPORT_KEY as string | undefined;

/** Whether grant import is configured (signing keys present). */
export function grantConfigured(): boolean {
  return !!PUBKEY && !!TRANSPORT_KEY;
}

/**
 * The decrypted grant payload myHealth accepts. `patron` (donation) → Supporter,
 * `partner` (professional) → Verified Pro. `.passthrough()` so future fields don't
 * break older clients.
 */
export const healthGrantSchema = z
  .object({ v: z.literal(1), kind: z.enum(["patron", "partner"]) })
  .passthrough();
export type HealthGrant = z.infer<typeof healthGrantSchema>;

/** Locally-resolved grant entitlement. Persisted; never transmitted. */
export interface GrantStatus {
  supporter: boolean;
  pro: boolean;
}
export const NO_GRANT: GrantStatus = { supporter: false, pro: false };

const STORAGE_KEY = "myhealth.grant";

/** The persisted grant status (all-false when none / unreadable). */
export function grantStatus(): GrantStatus {
  if (typeof localStorage === "undefined") return NO_GRANT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return NO_GRANT;
    const v = JSON.parse(raw) as Partial<GrantStatus>;
    return { supporter: !!v.supporter, pro: !!v.pro };
  } catch {
    return NO_GRANT;
  }
}

function persist(s: GrantStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Forget any imported grant (e.g. a "remove" action). */
export function clearGrant(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Merge a verified grant into the persisted status — additive, so prior grants survive. */
export function applyGrant(g: HealthGrant): GrantStatus {
  const cur = grantStatus();
  const next: GrantStatus = {
    supporter: cur.supporter || g.kind === "patron",
    pro: cur.pro || g.kind === "partner",
  };
  persist(next);
  return next;
}

/** Read the `.grant` file the portal handed the user, via the OS picker. Receive-only. */
async function readDroppedFile(): Promise<Uint8Array | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const path = await open({
    multiple: false,
    filters: [{ name: "Support file", extensions: ["grant", "json"] }],
  });
  if (!path || typeof path !== "string") return null;
  return await readFile(path);
}

const receiver = grantConfigured()
  ? createGrantReceiver<HealthGrant>({
      pubkeyHex: PUBKEY!,
      transportKeyB64: TRANSPORT_KEY!,
      parsePayload: (raw) => healthGrantSchema.parse(raw),
      readDroppedFile,
    })
  : null;

/**
 * Import a support / professional grant file the user chooses. Verify-then-parse
 * runs in core; on success the new status is persisted and returned. Returns null
 * when grants aren't configured, the user cancels, or the file is absent/invalid
 * (existing status untouched). Receive-only — nothing is uploaded.
 */
export async function importGrantFromFile(): Promise<GrantStatus | null> {
  if (!receiver) return null;
  const payload = await receiver.fromFile();
  return payload ? applyGrant(payload) : null;
}
