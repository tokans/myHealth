/** App settings (units, locale, theme), hydrated from SQLite; safe in browser. */
import { create } from "zustand";
import { isTauri } from "@/lib/environment";
import { query } from "@/db/client";
import { T } from "@/db/tables";

export type Units = "metric" | "imperial";

export interface Settings {
  units: Units;
  locale: string;
  dateFormat: string;
  theme: string;
}

const DEFAULTS: Settings = {
  units: "metric",
  locale: "en",
  dateFormat: "DD/MM/YYYY",
  theme: "system",
};

interface SettingsState extends Settings {
  loaded: boolean;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULTS,
  loaded: false,
  hydrate: async () => {
    if (!isTauri()) {
      set({ ...DEFAULTS, loaded: true });
      return;
    }
    try {
      const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM ${T.settings}`);
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      set({
        units: (map.units as Units) ?? DEFAULTS.units,
        locale: map.locale ?? DEFAULTS.locale,
        dateFormat: map.date_format ?? DEFAULTS.dateFormat,
        theme: map.theme ?? DEFAULTS.theme,
        loaded: true,
      });
    } catch (e) {
      console.error("Failed to hydrate settings:", e);
      set({ loaded: true });
    }
  },
}));
