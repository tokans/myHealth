/**
 * Person-linked (member_class, feature) policy for myHealth — UI-SOFT gating only
 * (decision 19; contract `multiuser-activation.md` §1–2). This is the PAID multi-user
 * activation seam and is ADDITIVE: it changes nothing for the free single-user install
 * (member_class resolves to `owner`, which every rule allows) and is independent of the
 * existing no-login family-profile switcher (decision 18 — medical data follows that
 * model, NOT child-soft hiding).
 *
 * Suite-standard sensitive categories (decision 19) are finance / credentials / estate.
 * myHealth has little of that surface; we tag the gates that DO touch a sensitive
 * category and let `createChildSoftPolicy()` hide them from `child_user` /
 * `managed_dependent`. Medical features (metrics, meds, documents, ICE, schedule) are
 * NOT tagged — a child's own medical data stays visible under the family-profile model.
 *
 * UI-soft means: a denied feature is hidden/locked, nothing more. Any confidentiality
 * boundary is a crypto-hard private compartment (invariant), never this policy.
 */
import {
  createChildSoftPolicy,
  type MemberClassPolicy,
} from "sharedcorelib/multiuser";
import type { GateKey } from "@/lib/featureGate";

/**
 * Sensitivity categories per gate, drawn from the suite-standard set
 * (finance/credentials/estate). Only gates that genuinely touch one are tagged; an
 * untagged gate has no member-class restriction (any member, incl. a child, may see it).
 *
 * myHealth's only sensitive-category surface is the document vault (which now also
 * subsumes import), which can hold estate-adjacent paperwork (advance directives,
 * insurance, legal-ish records) — tagged `estate` so a `child_user` does not get the
 * document affordance. Everything else (metrics, goals, meds, schedule, ICE, trends) is
 * medical and stays open.
 */
export const GATE_CATEGORIES: Partial<Record<GateKey, readonly string[]>> = {
  documents: ["estate"],
};

/**
 * myHealth's compiled member-class policy: the suite child-soft defaults (deny the
 * sensitive categories to child_user/managed_dependent), no app-specific extra rules —
 * any adult is a co-admin (decision 19), and `owner` (the free single user) is allowed
 * everything by construction.
 */
export const memberPolicy: MemberClassPolicy = createChildSoftPolicy();
