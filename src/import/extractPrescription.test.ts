import { describe, it, expect } from "vitest";
import { extractPrescription } from "./extractPrescription";
import { RX_CLEAN, RX_OCR_NOISY, RX_ABBREV, RX_UNREADABLE } from "./__fixtures__/documents";

describe("extractPrescription — clean printed/EHR document", () => {
  const { items } = extractPrescription(RX_CLEAN);

  it("ignores header/patient lines and extracts only the three medications", () => {
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.drug)).toEqual(["Paracetamol", "Omeprazole", "Telmisartan"]);
  });

  it("captures strength, form, frequency, duration and instructions", () => {
    const crocin = items[0];
    expect(crocin.brand).toBe("Crocin");
    expect(crocin.strength).toBe("500 mg");
    expect(crocin.form).toBe("tablet");
    expect(crocin.frequency).toBe("twice daily");
    expect(crocin.frequencyRaw).toBe("BD");
    expect(crocin.duration).toBe("5 days");
    expect(crocin.instructions).toBe("after food");
  });

  it("auto-tiers exact reads but still marks them confirm-required and unverified", () => {
    for (const i of items) {
      expect(i.confidence).toBe(1);
      expect(i.tier).toBe("auto");
      expect(i.confirmRequired).toBe(true); // safety overlay: never silently saved
      expect(i.verified).toBe(false);
    }
  });
});

describe("extractPrescription — noisy phone-photo OCR", () => {
  const { items } = extractPrescription(RX_OCR_NOISY);

  it("snaps OCR-mangled names to the correct drugs", () => {
    expect(items.map((i) => i.drug)).toEqual([
      "Paracetamol", // CroÇin
      "Omeprazole", //  0mez
      "Telmisartan", // Te1ma
      "Metformin", //   Metf0rmin
    ]);
  });

  it("routes the reduced-confidence reads to the disambiguation tier", () => {
    for (const i of items) {
      expect(i.confidence).toBeGreaterThan(0.6);
      expect(i.confidence).toBeLessThan(1);
      expect(i.tier).toBe("disambiguate");
      expect(i.candidates.length).toBeGreaterThan(0);
    }
  });

  it("still recovers strengths and India-style positional dosing through the OCR noise", () => {
    expect(items[0].strength).toBe("500 mg"); // 5OO mg
    expect(items[0].frequency).toBe("twice daily"); // 1-0-1
    expect(items[3].strength).toBe("500 mg"); // Metf0rmin 5OO mg
  });
});

describe("extractPrescription — abbreviations & embedded strengths", () => {
  const items = extractPrescription(RX_ABBREV).items;

  it("handles combo brands and multi-dose abbreviations", () => {
    const aug = items.find((i) => i.drug === "Amoxicillin+Clavulanate")!;
    expect(aug.brand).toBe("Augmentin");
    expect(aug.strength).toBe("625 mg");
    expect(aug.frequency).toBe("three times daily"); // TDS
    expect(aug.duration).toBe("7 days");
  });

  it("flags an ambiguous unit-less strength (Dolo 650) for manual review rather than guessing", () => {
    const dolo = items.find((i) => i.rawName.startsWith("Dolo"))!;
    expect(dolo.strength).toBeNull(); // "650" has no unit → not auto-parsed
    expect(dolo.tier).toBe("manual"); // low confidence → human-in-the-loop
  });
});

describe("extractPrescription — unreadable / handwriting-like", () => {
  const items = extractPrescription(RX_UNREADABLE).items;

  it("keeps the line (it has dosage signals) but resolves no drug and demands manual entry", () => {
    expect(items).toHaveLength(2);
    for (const i of items) {
      expect(i.drug).toBeNull();
      expect(i.confidence).toBe(0);
      expect(i.tier).toBe("manual");
      expect(i.candidates).toEqual([]);
    }
    // dosage signals were still captured to pre-fill the manual form
    expect(items[0].strength).toBe("100 mg");
    expect(items[0].frequency).toBe("once daily");
  });
});

describe("extractPrescription — provenance", () => {
  it("defaults to OCR source (confirm-required) and honours an explicit native-text source", () => {
    expect(extractPrescription("Tab Crocin 500mg OD").source).toBe("ocr");
    const native = extractPrescription("Tab Crocin 500mg OD", { source: "native-text" });
    expect(native.source).toBe("native-text");
    expect(native.items[0].confirmRequired).toBe(false);
  });

  it("returns no items for empty or pure-noise input", () => {
    expect(extractPrescription("").items).toEqual([]);
    expect(extractPrescription("Dr. Mehta\nPatient: Asha\nDate: 2026-06-04").items).toEqual([]);
  });
});
