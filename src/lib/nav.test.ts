import { describe, it, expect } from "vitest";
import { NAV } from "./nav";
import { GATES, type GateKey } from "./featureGate";

describe("NAV config", () => {
  it("has unique routes that all start with '/'", () => {
    const routes = NAV.map((n) => n.to);
    expect(new Set(routes).size).toBe(routes.length);
    for (const r of routes) expect(r).toMatch(/^\//);
  });

  it("every gated item references a real gate", () => {
    for (const item of NAV) {
      if (item.gate) expect(Object.keys(GATES)).toContain(item.gate as GateKey);
    }
  });

  it("the always-open Starter surfaces are ungated", () => {
    const open = NAV.filter((n) => !n.gate).map((n) => n.to);
    expect(open).toEqual(expect.arrayContaining(["/", "/profiles", "/metrics", "/reminders", "/journey"]));
  });

  it("exposes Today and Vitals as primary (mobile bottom-bar) tabs", () => {
    const primaries = NAV.filter((n) => n.primary).map((n) => n.to);
    expect(primaries).toContain("/");
    expect(primaries).toContain("/metrics");
  });

  it("every item carries a label and an icon", () => {
    for (const item of NAV) {
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
    }
  });
});
