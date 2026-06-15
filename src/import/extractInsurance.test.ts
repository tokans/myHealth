import { describe, it, expect } from "vitest";
import { extractInsurance, normalizeDate } from "./extractInsurance";
import { matchInsurer } from "./insurerVocab";
import { INSURANCE_CLEAN, INSURANCE_OCR_NOISY, INSURANCE_MIXED } from "./__fixtures__/documents";

describe("normalizeDate", () => {
  it("parses day-first dd/mm/yyyy to ISO", () => {
    expect(normalizeDate("12/05/1980")).toBe("1980-05-12");
    expect(normalizeDate("01-04-2026")).toBe("2026-04-01");
  });
  it("passes through yyyy-mm-dd", () => {
    expect(normalizeDate("2012-11-21")).toBe("2012-11-21");
  });
  it("undoes OCR letter↔digit confusion in dates", () => {
    expect(normalizeDate("3l/O3/2O27")).toBe("2027-03-31");
    expect(normalizeDate("l8/02/1976")).toBe("1976-02-18");
  });
  it("windows a 2-digit year and rejects implausible dates", () => {
    expect(normalizeDate("04/06/85")).toBe("1985-06-04");
    expect(normalizeDate("99/99/9999")).toBeNull();
    expect(normalizeDate("not a date")).toBeNull();
  });
});

describe("matchInsurer", () => {
  it("maps a printed insurer to its canonical name", () => {
    expect(matchInsurer("STAR HEALTH & ALLIED INSURANCE")?.canonical).toBe("Star Health & Allied Insurance");
    expect(matchInsurer("niva bupa")?.canonical).toBe("Niva Bupa Health Insurance");
  });
  it("returns null when nothing is close", () => {
    expect(matchInsurer("Optima Restore")).toBeNull();
  });
});

describe("extractInsurance — clean card", () => {
  const out = extractInsurance(INSURANCE_CLEAN, { source: "native-text" });

  it("reads the policy fields", () => {
    expect(out.policy.insurer).toBe("Star Health & Allied Insurance");
    expect(out.policy.policyNumber).toBe("P/161000/01/2026/001234");
    expect(out.policy.groupNumber).toBe("GRP-5567");
    expect(out.policy.validFrom).toBe("2026-04-01");
    expect(out.policy.validThrough).toBe("2027-03-31");
  });

  it("extracts exactly the three covered members, with relationships mapped", () => {
    expect(out.members).toHaveLength(3);
    const [self, spouse, child] = out.members;
    expect(self.name).toBe("Rajesh Kumar");
    expect(self.relationship).toBe("self");
    expect(self.isSelf).toBe(true);
    expect(self.dob).toBe("1980-05-12");
    expect(self.memberId).toBe("1234501");

    expect(spouse.name).toBe("Sunita Kumar");
    expect(spouse.relationship).toBe("Spouse");

    expect(child.name).toBe("Aarav Kumar");
    expect(child.relationship).toBe("Child"); // "Son" maps to Child
    expect(child.dob).toBe("2012-11-21");
  });

  it("ignores header / footer lines (no junk members)", () => {
    const names = out.members.map((m) => m.name);
    expect(names).not.toContain("Members Covered");
    expect(names.some((n) => /helpline|cashless/i.test(n ?? ""))).toBe(false);
  });

  it("marks members confirm-required and unverified (human-in-the-loop)", () => {
    for (const m of out.members) {
      expect(m.confirmRequired).toBe(true);
      expect(m.verified).toBe(false);
    }
  });
});

describe("extractInsurance — OCR-noisy card", () => {
  const out = extractInsurance(INSURANCE_OCR_NOISY, { source: "ocr" });

  it("recovers the insurer from a labeled 'Underwritten by' line", () => {
    expect(out.policy.insurer).toBe("Niva Bupa Health Insurance");
  });

  it("parses members despite character confusion in dates and ids", () => {
    expect(out.members).toHaveLength(3);
    expect(out.members.map((m) => m.relationship)).toEqual(["self", "Spouse", "Child"]);
    expect(out.members[0].name).toBe("Priya Sharma");
    expect(out.members[1].dob).toBe("1976-02-18");
    expect(out.members[2].dob).toBe("2010-12-09");
  });

  it("does not treat the 'Valid upto' policy line as a member", () => {
    expect(out.members.some((m) => /valid/i.test(m.name ?? ""))).toBe(false);
  });
});

describe("extractInsurance — mixed card", () => {
  it("reads a self + spouse the family-reconcile step can act on", () => {
    const out = extractInsurance(INSURANCE_MIXED, { source: "native-text" });
    expect(out.policy.insurer).toBe("HDFC ERGO Health Insurance");
    expect(out.members.map((m) => [m.name, m.relationship])).toEqual([
      ["Asha D", "self"],
      ["Vikram D", "Spouse"],
    ]);
  });
});
