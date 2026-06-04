import { describe, it, expect } from "vitest";
import { buildVisitReportHtml, type VisitData } from "./visitReport";

const base: VisitData = {
  generatedOn: "2026-06-04",
  name: "Asha <Test>",
  age: 41,
  sex: "female",
  bloodGroup: "O+",
  allergies: [{ label: "Penicillin", severe: true }],
  conditions: ["Hypertension"],
  meds: [{ drug: "Metformin", strength: "500 mg", schedule: "BD" }],
  vitals: [{ label: "Weight", value: 72, unit: "kg", date: "2026-06-01" }],
  goals: [{ title: "Reach 70 kg", target: 70, unit: "kg", current: 72 }],
  emergency: { name: "Ravi", phone: "+91 90000 00000", email: null },
};

describe("buildVisitReportHtml", () => {
  it("escapes user content to prevent broken/injected markup", () => {
    const html = buildVisitReportHtml(base);
    expect(html).toContain("Asha &lt;Test&gt;");
    expect(html).not.toContain("Asha <Test>");
  });

  it("includes the key sections and values", () => {
    const html = buildVisitReportHtml(base);
    expect(html).toContain("Penicillin");
    expect(html).toContain("(severe)");
    expect(html).toContain("Metformin");
    expect(html).toContain("Weight");
    expect(html).toContain("O+");
  });

  it("renders 'None recorded' when a section is empty", () => {
    const html = buildVisitReportHtml({ ...base, conditions: [] });
    expect(html).toContain("None recorded");
  });
});
