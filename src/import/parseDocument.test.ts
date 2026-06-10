import { describe, it, expect } from "vitest";
import { parseDocument } from "./index";
import { RX_CLEAN, LAB_CLEAN } from "./__fixtures__/documents";

describe("parseDocument router", () => {
  it("routes prescriptions to the prescription extractor", () => {
    const doc = parseDocument("prescription", RX_CLEAN);
    expect(doc.kind).toBe("prescription");
    if (doc.kind === "prescription") {
      expect(doc.items[0].drug).toBe("Paracetamol");
    }
  });

  it("routes lab reports to the lab extractor", () => {
    const doc = parseDocument("lab_report", LAB_CLEAN);
    expect(doc.kind).toBe("lab_report");
    if (doc.kind === "lab_report") {
      expect(doc.items[0].test).toBe("Hemoglobin");
    }
  });

  it("threads the source option through", () => {
    const doc = parseDocument("prescription", "Tab Crocin 500mg OD", { source: "native-text" });
    expect(doc.source).toBe("native-text");
  });
});
