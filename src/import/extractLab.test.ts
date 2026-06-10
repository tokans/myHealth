import { describe, it, expect } from "vitest";
import { extractLab } from "./extractLab";
import { LAB_CLEAN, LAB_OCR_NOISY, LAB_NO_RANGE } from "./__fixtures__/documents";

describe("extractLab — clean tabular report", () => {
  const { items } = extractLab(LAB_CLEAN);

  it("drops the title, patient header and signatory, keeping only result rows", () => {
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.test)).toEqual(["Hemoglobin", "WBC Count", "Platelet Count"]);
  });

  it("parses value, unit and reference range, and derives a normal flag", () => {
    const hb = items[0];
    expect(hb.value).toBe(13.5);
    expect(hb.unit).toBe("g/dL");
    expect(hb.refLow).toBe(13);
    expect(hb.refHigh).toBe(17);
    expect(hb.flag).toBe("normal");
    expect(hb.tier).toBe("auto");
  });
});

describe("extractLab — noisy OCR with synonyms, flags and digit confusion", () => {
  const { items } = extractLab(LAB_OCR_NOISY);
  const by = (test: string) => items.find((i) => i.test === test)!;

  it("maps synonyms (Hb, TLC) to canonical tests", () => {
    expect(by("Hemoglobin").rawName).toBe("Hb");
    expect(by("WBC Count").rawName).toBe("TLC");
  });

  it("honours an explicit low flag", () => {
    const hb = by("Hemoglobin");
    expect(hb.value).toBe(9.2);
    expect(hb.flag).toBe("L");
  });

  it("recovers an OCR'd value (11O→110) and an explicit high flag", () => {
    const glu = by("Fasting Glucose");
    expect(glu.value).toBe(110);
    expect(glu.flag).toBe("H");
    expect(glu.refLow).toBe(70);
    expect(glu.refHigh).toBe(100);
  });

  it("does not mistake the digit inside a test name (HbA1c) for the value", () => {
    const a1c = by("HbA1c");
    expect(a1c.value).toBe(6.8);
    expect(a1c.unit).toBe("%");
    expect(a1c.flag).toBe("H"); // 6.8 > ref high 6.0 (en-dash range)
  });

  it("recovers an OCR'd value with a letter-for-1 (l.2→1.2) at the range boundary", () => {
    const creat = by("Serum Creatinine");
    expect(creat.value).toBe(1.2);
    expect(creat.flag).toBe("normal"); // 1.2 == ref high 1.2, inclusive
  });

  it("leaves flag/range null when only a threshold (<200) is printed, not a range", () => {
    const chol = by("Total Cholesterol");
    expect(chol.value).toBe(245);
    expect(chol.refLow).toBeNull();
    expect(chol.flag).toBeNull();
  });
});

describe("extractLab — value present but no printed range", () => {
  const { items } = extractLab(LAB_NO_RANGE);

  it("keeps the value/unit but reports range and flag as unknown", () => {
    expect(items).toHaveLength(2);
    const tsh = items.find((i) => i.test === "TSH")!;
    expect(tsh.value).toBe(3.4);
    expect(tsh.unit).toBe("uIU/mL");
    expect(tsh.refLow).toBeNull();
    expect(tsh.refHigh).toBeNull();
    expect(tsh.flag).toBeNull();
  });
});

describe("extractLab — provenance & empties", () => {
  it("defaults to OCR source and accepts an explicit one", () => {
    expect(extractLab("Hb 13 g/dL 13-17").source).toBe("ocr");
    expect(extractLab("Hb 13 g/dL 13-17", { source: "native-text" }).source).toBe("native-text");
  });
  it("returns no items for empty or non-test input", () => {
    expect(extractLab("").items).toEqual([]);
    expect(extractLab("PATIENT NAME: ASHA\n-- end --").items).toEqual([]);
  });
});
