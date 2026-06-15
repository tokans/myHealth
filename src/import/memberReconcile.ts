/**
 * Reconcile members read off an insurance card against the family already in the app.
 *
 * Pure and name-based: a card member is "already in the family" when its (normalized)
 * name matches an existing profile, and a "self"/primary member maps to the existing
 * self profile. Everything else is proposed for adding — but only the human confirms
 * (see Documents.tsx): this just computes the default selection.
 */
import { normalizeToken } from "@scandoc/core";
import type { MemberField } from "./extractInsurance";

export interface MemberProposal {
  member: MemberField;
  /** Existing profile id when this member already exists, else null. */
  existingId: number | null;
  existingName: string | null;
  /** Default selection: add only members not already present (self is never re-added). */
  selected: boolean;
}

export interface ExistingProfile {
  id: number;
  name: string;
  is_self?: number;
}

export function reconcileMembers(members: MemberField[], existing: ExistingProfile[]): MemberProposal[] {
  const byName = new Map(existing.map((p) => [normalizeToken(p.name), p]));
  const selfProfile = existing.find((p) => p.is_self) ?? null;
  return members
    .filter((m) => m.name)
    .map((m) => {
      const nameHit = byName.get(normalizeToken(m.name!)) ?? null;
      const match = nameHit ?? (m.isSelf ? selfProfile : null);
      return {
        member: m,
        existingId: match?.id ?? null,
        existingName: match?.name ?? null,
        selected: match == null, // propose adding only the missing members
      };
    });
}
