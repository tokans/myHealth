import { describe, it, expect } from "vitest";
import { reconcileMembers } from "./memberReconcile";
import { extractInsurance } from "./extractInsurance";
import { INSURANCE_MIXED } from "./__fixtures__/documents";

const members = extractInsurance(INSURANCE_MIXED).members;

describe("reconcileMembers", () => {
  it("proposes only the members not already in the family", () => {
    const proposals = reconcileMembers(members, [{ id: 1, name: "Asha D", is_self: 1 }]);
    expect(proposals).toHaveLength(2);

    const asha = proposals.find((p) => p.member.name === "Asha D")!;
    expect(asha.existingId).toBe(1);
    expect(asha.selected).toBe(false); // already present → not re-added

    const vikram = proposals.find((p) => p.member.name === "Vikram D")!;
    expect(vikram.existingId).toBeNull();
    expect(vikram.selected).toBe(true); // missing → proposed for adding
  });

  it("maps the 'self' member to the existing self profile regardless of name", () => {
    // Card self is "Asha D" but the app's self is stored as "Me".
    const proposals = reconcileMembers(members, [{ id: 7, name: "Me", is_self: 1 }]);
    const selfProposal = proposals.find((p) => p.member.isSelf)!;
    expect(selfProposal.existingId).toBe(7);
    expect(selfProposal.selected).toBe(false);
  });

  it("proposes everyone when the family is empty", () => {
    const proposals = reconcileMembers(members, []);
    expect(proposals.every((p) => p.selected)).toBe(true);
    expect(proposals.every((p) => p.existingId === null)).toBe(true);
  });

  it("matches names case/spacing-insensitively", () => {
    const proposals = reconcileMembers(members, [{ id: 3, name: "  vikram   d " }]);
    const vikram = proposals.find((p) => p.member.name === "Vikram D")!;
    expect(vikram.existingId).toBe(3);
    expect(vikram.selected).toBe(false);
  });
});
