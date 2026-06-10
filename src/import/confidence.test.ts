import { describe, it, expect } from "vitest";
import {
  tierByConfidence,
  requiresConfirmation,
  AUTO_THRESHOLD,
  DISAMBIGUATE_THRESHOLD,
} from "./confidence";

describe("tierByConfidence", () => {
  it("routes by the two thresholds", () => {
    expect(tierByConfidence(1)).toBe("auto");
    expect(tierByConfidence(AUTO_THRESHOLD)).toBe("auto");
    expect(tierByConfidence(0.89)).toBe("disambiguate");
    expect(tierByConfidence(DISAMBIGUATE_THRESHOLD)).toBe("disambiguate");
    expect(tierByConfidence(0.59)).toBe("manual");
    expect(tierByConfidence(0)).toBe("manual");
  });
  it("clamps out-of-range input", () => {
    expect(tierByConfidence(2)).toBe("auto");
    expect(tierByConfidence(-1)).toBe("manual");
  });
});

describe("requiresConfirmation", () => {
  it("requires confirmation for drug/dosage from OCR", () => {
    expect(requiresConfirmation("drug", "ocr")).toBe(true);
    expect(requiresConfirmation("dosage", "ocr")).toBe(true);
  });
  it("does not require it for native-text or human sources", () => {
    expect(requiresConfirmation("drug", "native-text")).toBe(false);
    expect(requiresConfirmation("dosage", "human")).toBe(false);
  });
  it("does not gate non-safety-critical fields", () => {
    expect(requiresConfirmation("other", "ocr")).toBe(false);
  });
});
