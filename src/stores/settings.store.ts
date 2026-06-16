/** App settings (units, locale, theme), hydrated from SQLite; safe in browser. */
import { create } from "zustand";
import { isTauri } from "@/lib/environment";
import { query, execute } from "@/db/client";
import { T } from "@/db/tables";

export type Units = "metric" | "imperial";

export interface Settings {
  units: Units;
  locale: string;
  dateFormat: string;
  theme: string;
  /** Opt-in: show "Scan with camera" on mobile Documents (off by default). */
  cameraScan: boolean;
  /** One-time consent to download the ~10MB OCR language data (off until granted). */
  ocrConsent: boolean;
}

const DEFAULTS: Settings = {
  units: "metric",
  locale: "en",
  dateFormat: "DD/MM/YYYY",
  theme: "system",
  cameraScan: false,
  ocrConsent: false,
};

interface SettingsState extends Settings {
  loaded: boolean;
  hydrate: () => Promise<void>;
  setCameraScan: (enabled: boolean) => Promise<void>;
  setOcrConsent: (granted: boolean) => Promise<void>;
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
        cameraScan: map.camera_scan === "1",
        ocrConsent: map.ocr_consent === "1",
        loaded: true,
      });
    } catch (e) {
      console.error("Failed to hydrate settings:", e);
      set({ loaded: true });
    }
  },
  setCameraScan: async (enabled: boolean) => {
    set({ cameraScan: enabled });
    await persistFlag("camera_scan", enabled);
  },
  setOcrConsent: async (granted: boolean) => {
    set({ ocrConsent: granted });
    await persistFlag("ocr_consent", granted);
  },
}));

/** Upsert a boolean flag into the schemaless `settings` key/value table (no migration). */
async function persistFlag(key: string, value: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    await execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value ? "1" : "0"],
    );
  } catch (e) {
    console.error(`Failed to persist ${key}:`, e);
  }
}
