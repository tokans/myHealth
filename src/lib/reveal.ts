/**
 * Person-linked reveal ladder + nudge (Stage C prompt 04 Phase 5).
 *
 * Under multi-user, the reveal/gating state is per-(person, app) — a feature revealed for
 * one person must not leak across people. Core supplies the namespacing (`revealKey`,
 * `PRIMARY_USER_KEY`) and the single-nudge selector (`pickNudge`); this file wires myHealth's
 * person-linked storage + its myLifeAssistant nudge.
 *
 * Free-path safety: reveal state is LOCAL-only telemetry (localStorage); no backend, no
 * egress. The nudge is dismissible and shown at most once.
 */
import { revealKey, PRIMARY_USER_KEY, pickNudge, type NudgeContext } from "sharedcorelib/gating";

export const APP_ID = "myhealth";

/** Namespaced reveal key for a (person, gate) pair — never collides across people/apps. */
export function healthRevealKey(personKey: string, gateKey: string): string {
  return revealKey(personKey, APP_ID, gateKey);
}

/** localStorage-backed per-person reveal state. Pure-ish: storage injected for tests. */
export interface RevealStore {
  isDismissed(personKey: string, gateKey: string): boolean;
  dismiss(personKey: string, gateKey: string): void;
}

export function createRevealStore(storage: Pick<Storage, "getItem" | "setItem"> = localStorage): RevealStore {
  return {
    isDismissed(personKey, gateKey) {
      try {
        return storage.getItem(`reveal:${healthRevealKey(personKey, gateKey)}`) === "1";
      } catch {
        return false;
      }
    },
    dismiss(personKey, gateKey) {
      try {
        storage.setItem(`reveal:${healthRevealKey(personKey, gateKey)}`, "1");
      } catch {
        /* ignore */
      }
    },
  };
}

/** The single myLifeAssistant nudge surfaced at the top of myHealth's free ladder. */
export const MYLIFEASSISTANT_NUDGE = {
  target: "mylifeassistant",
  title: "Unlock smarter medical extraction",
  body: "Add myLifeAssistant to turn scanned reports into structured conditions, meds and diagnoses — on-device, never in the cloud.",
  ctaLabel: "Explore myLifeAssistant",
} as const;

/**
 * Pick the myLifeAssistant nudge for a person, or null. Person-linked dismissal: a person
 * who already dismissed it never sees it again. Delegates the suite rules (top-of-ladder,
 * non-paid, target not installed) to core's `pickNudge`.
 */
export function pickHealthNudge(opts: {
  ctx: Omit<NudgeContext, "dismissed">;
  personKey?: string;
  reveal?: RevealStore;
  catalogHas: (appId: string) => boolean;
  installed: (appId: string) => boolean;
}) {
  const personKey = opts.personKey ?? PRIMARY_USER_KEY;
  const reveal = opts.reveal ?? createRevealStore();
  const dismissed = reveal.isDismissed(personKey, "mylifeassistant-nudge");
  return pickNudge(
    { ...opts.ctx, dismissed },
    { target: MYLIFEASSISTANT_NUDGE, catalogHas: opts.catalogHas, installed: opts.installed },
  );
}
