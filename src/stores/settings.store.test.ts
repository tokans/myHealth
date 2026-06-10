import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/environment", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@/db/client", () => ({ query: vi.fn() }));

import { isTauri } from "@/lib/environment";
import { query } from "@/db/client";
import { useSettingsStore } from "./settings.store";

const DEFAULTS = {
  units: "metric",
  locale: "en",
  dateFormat: "DD/MM/YYYY",
  theme: "system",
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
});
