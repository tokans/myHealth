import { describe, it, expect } from "vitest";
import { matchDrug, parseStrength, normalizeFrequency, FREQUENCY_MAP } from "./formulary";

describe("matchDrug", () => {
  it("resolves a brand to its generic with full confidence on an exact read", () => {
    const m = matchDrug("Crocin");
    expect(m?.generic).toBe("Paracetamol");
    expect(m?.brand).toBe("Crocin");
    expect(m?.score).toBe(1);
  });

  it("matches a generic name directly", () => {
    expect(matchDrug("Metformin")?.generic).toBe("Metformin");
  });

  it("snaps an OCR-mangled read to the right drug at reduced confidence", () => {
    const m = matchDrug("Te1ma"); // Telma with l→1
    expect(m?.generic).toBe("Telmisartan");
    expect(m?.score).toBeLessThan(1);
    expect(m?.score).toBeGreaterThan(0.6);
  });

  it("returns ranked candidates for disambiguation", () => {
    const m = matchDrug("Omez");
    expect(m?.candidates[0].generic).toBe("Omeprazole");
    expect(m?.candidates.length).toBeGreaterThan(0);
    // candidates are sorted high→low
    const scores = m!.candidates.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("returns null for an unrecognizable / empty read", () => {
    expect(matchDrug("Xyzqplmn")).toBeNull();
    expect(matchDrug("")).toBeNull();
  });
});

describe("parseStrength", () => {
  it("parses value + unit, OCR-tolerant", () => {
    expect(parseStrength("500mg")).toEqual({ value: 500, unit: "mg", text: "500 mg" });
    expect(parseStrength("5OO mg")).toEqual({ value: 500, unit: "mg", text: "500 mg" });
    expect(parseStrength("Crocin 500 mg BD")?.value).toBe(500);
  });

  it("normalizes unit spellings", () => {
    expect(parseStrength("100 mcg")?.unit).toBe("mcg");
    expect(parseStrength("100 ug")?.unit).toBe("mcg");
    expect(parseStrength("10 units")?.unit).toBe("units");
    expect(parseStrength("10 unit")?.unit).toBe("units");
  });

  it("returns null when there is no unit-bearing strength", () => {
    expect(parseStrength("Dolo 650")).toBeNull();
    expect(parseStrength("BD x 5 days")).toBeNull();
  });
});

describe("normalizeFrequency", () => {
  it("maps standard abbreviations", () => {
    expect(normalizeFrequency("OD")).toBe("once daily");
    expect(normalizeFrequency("bd")).toBe("twice daily");
    expect(normalizeFrequency("TDS")).toBe("three times daily");
    expect(normalizeFrequency("QID")).toBe("four times daily");
    expect(normalizeFrequency("HS")).toBe("at bedtime");
    expect(normalizeFrequency("SOS")).toBe("as needed");
    expect(normalizeFrequency("q6h")).toBe("every 6 hours");
  });

  it("interprets India-style positional dosing", () => {
    expect(normalizeFrequency("1-0-1")).toBe("twice daily");
    expect(normalizeFrequency("1-1-1")).toBe("three times daily");
    expect(normalizeFrequency("0-0-1")).toBe("once daily");
  });

  it("tolerates OCR'd positional digits", () => {
    expect(normalizeFrequency("l-0-l")).toBe("twice daily");
  });

  it("returns null for unknown tokens and exposes the map", () => {
    expect(normalizeFrequency("nonsense")).toBeNull();
    expect(FREQUENCY_MAP.prn).toBe("as needed");
  });
});
