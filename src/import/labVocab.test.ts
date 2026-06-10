import { describe, it, expect } from "vitest";
import { matchTest, LAB_TESTS } from "./labVocab";

describe("matchTest", () => {
  it("resolves synonyms to one canonical test", () => {
    expect(matchTest("Hb")?.canonical).toBe("Hemoglobin");
    expect(matchTest("HGB")?.canonical).toBe("Hemoglobin");
    expect(matchTest("Haemoglobin")?.canonical).toBe("Hemoglobin");
    expect(matchTest("TLC")?.canonical).toBe("WBC Count");
    expect(matchTest("FBS")?.canonical).toBe("Fasting Glucose");
  });

  it("carries the canonical unit and a LOINC code", () => {
    const m = matchTest("Hemoglobin");
    expect(m?.unit).toBe("g/dL");
    expect(m?.loinc).toBe("718-7");
  });

  it("returns ranked candidates", () => {
    const m = matchTest("creatinine");
    expect(m?.canonical).toBe("Serum Creatinine");
    expect(m?.candidates.length).toBeGreaterThan(0);
  });

  it("returns null for a non-test string or empty input", () => {
    expect(matchTest("Authorized Signatory")).toBeNull();
    expect(matchTest("")).toBeNull();
  });

  it("every vocab entry round-trips through its own canonical name", () => {
    for (const t of LAB_TESTS) {
      expect(matchTest(t.canonical)?.canonical).toBe(t.canonical);
    }
  });
});
