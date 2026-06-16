import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/environment", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@/db/client", () => ({ query: vi.fn(), execute: vi.fn() }));

import { isTauri } from "@/lib/environment";
import { query, execute } from "@/db/client";
import { useSettingsStore } from "./settings.store";

const DEFAULTS = {
  units: "metric",
  locale: "en",
  dateFormat: "DD/MM/YYYY",
  theme: "system",
  cameraScan: false,
  ocrConsent: false,
} as const;

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(true);
  useSettingsStore.setState({ ...DEFAULTS, loaded: false });
});

describe("useSettingsStore.hydrate", () => {
  it("returns defaults in browser preview (isTauri false)", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    await useSettingsStore.getState().hydrate();
    const s = useSettingsStore.getState();
    expect(s.units).toBe(DEFAULTS.units);
    expect(s.locale).toBe(DEFAULTS.locale);
    expect(s.dateFormat).toBe(DEFAULTS.dateFormat);
    expect(s.theme).toBe(DEFAULTS.theme);
    expect(s.loaded).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it("maps settings rows (incl. date_format -> dateFormat)", async () => {
    vi.mocked(query).mockResolvedValue([
      { key: "units", value: "imperial" },
      { key: "locale", value: "fr" },
      { key: "date_format", value: "MM/DD/YYYY" },
      { key: "theme", value: "dark" },
    ]);
    await useSettingsStore.getState().hydrate();
    const s = useSettingsStore.getState();
    expect(s.units).toBe("imperial");
    expect(s.locale).toBe("fr");
    expect(s.dateFormat).toBe("MM/DD/YYYY");
    expect(s.theme).toBe("dark");
    expect(s.loaded).toBe(true);
  });

  it("falls back to defaults for keys absent from the rows", async () => {
    vi.mocked(query).mockResolvedValue([{ key: "theme", value: "dark" }]);
    await useSettingsStore.getState().hydrate();
    const s = useSettingsStore.getState();
    expect(s.units).toBe(DEFAULTS.units);
    expect(s.locale).toBe(DEFAULTS.locale);
    expect(s.dateFormat).toBe(DEFAULTS.dateFormat);
    expect(s.theme).toBe("dark");
    expect(s.loaded).toBe(true);
  });

  it("still marks loaded when the query throws", async () => {
    vi.mocked(query).mockRejectedValue(new Error("db down"));
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().loaded).toBe(true);
  });

  it("hydrates cameraScan from the camera_scan flag ('1' => true)", async () => {
    vi.mocked(query).mockResolvedValue([{ key: "camera_scan", value: "1" }]);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().cameraScan).toBe(true);
  });

  it("defaults cameraScan to false when the flag is absent", async () => {
    vi.mocked(query).mockResolvedValue([]);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().cameraScan).toBe(false);
  });
});

describe("useSettingsStore.setCameraScan", () => {
  it("updates state and upserts the camera_scan flag", async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
    await useSettingsStore.getState().setCameraScan(true);
    expect(useSettingsStore.getState().cameraScan).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.any(String), ["camera_scan", "1"]);
  });

  it("persists the off state and survives a write failure", async () => {
    vi.mocked(execute).mockRejectedValue(new Error("db down"));
    await useSettingsStore.getState().setCameraScan(false);
    expect(useSettingsStore.getState().cameraScan).toBe(false);
    expect(execute).toHaveBeenCalledWith(expect.any(String), ["camera_scan", "0"]);
  });
});

describe("useSettingsStore.setOcrConsent", () => {
  it("hydrates ocrConsent from the ocr_consent flag", async () => {
    vi.mocked(query).mockResolvedValue([{ key: "ocr_consent", value: "1" }]);
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().ocrConsent).toBe(true);
  });

  it("updates state and upserts the ocr_consent flag", async () => {
    vi.mocked(execute).mockResolvedValue({ rowsAffected: 1, lastInsertId: 0 });
    await useSettingsStore.getState().setOcrConsent(true);
    expect(useSettingsStore.getState().ocrConsent).toBe(true);
    expect(execute).toHaveBeenCalledWith(expect.any(String), ["ocr_consent", "1"]);
  });
});
