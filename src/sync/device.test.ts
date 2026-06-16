import { describe, it, expect, beforeEach } from "vitest";
import { deviceId } from "./device";

beforeEach(() => {
  localStorage.clear();
});

describe("deviceId", () => {
  it("generates a stable id, persisted across calls", () => {
    const a = deviceId();
    expect(a).toBeTruthy();
    expect(deviceId()).toBe(a); // same on a second call
    expect(localStorage.getItem("myhealth.deviceId")).toBe(a);
  });
});
