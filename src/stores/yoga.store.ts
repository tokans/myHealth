/**
 * Downloaded yoga bundles, shared app-wide and persisted to localStorage.
 *
 * Baked sample sequences live in code (`domain/yoga.ts`); this store holds the
 * EXTRA sequences pulled from separately-downloadable, signed OTA bundles (the
 * GitHub-release path in `src/masters/yoga.ts`). Bundle content is public,
 * non-sensitive reference data — no health PII — so localStorage is appropriate
 * and keeps the feature working without a new SQLite migration.
 *
 * Receive-only: the store is written solely by the verified OTA apply step; it
 * uploads nothing. `lastRevision` is the anti-downgrade floor the updater reads.
 */
import { create } from "zustand";
import type { YogaBundle, YogaSequence } from "@/domain/yoga";

const STORAGE_KEY = "myhealth.yogaBundles";
const REVISION_KEY = "myhealth.yogaRevision";

interface PersistShape {
  bundles: YogaBundle[];
  revision: number;
}

function readStored(): PersistShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const bundles = raw ? (JSON.parse(raw) as YogaBundle[]) : [];
    const rev = Number(localStorage.getItem(REVISION_KEY) ?? "0");
    return { bundles: Array.isArray(bundles) ? bundles : [], revision: Number.isFinite(rev) ? rev : 0 };
  } catch {
    return { bundles: [], revision: 0 };
  }
}

function writeStored(state: PersistShape): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bundles));
    localStorage.setItem(REVISION_KEY, String(state.revision));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

interface YogaState {
  bundles: YogaBundle[];
  /** Highest applied manifest revision (anti-downgrade floor). */
  revision: number;
  /** Insert/replace a bundle by id (latest version wins). */
  upsertBundle: (bundle: YogaBundle) => void;
  /** Remove a downloaded bundle by id. */
  removeBundle: (bundleId: string) => void;
  /** Record the manifest revision applied by the updater. */
  setRevision: (revision: number) => void;
  /** All downloaded sequences flattened (tagged source/bundleId for merge). */
  sequences: () => YogaSequence[];
}

export const useYogaStore = create<YogaState>((set, get) => {
  const initial = readStored();
  return {
    bundles: initial.bundles,
    revision: initial.revision,
    upsertBundle: (bundle) =>
      set((s) => {
        const bundles = [...s.bundles.filter((b) => b.bundleId !== bundle.bundleId), bundle];
        writeStored({ bundles, revision: s.revision });
        return { bundles };
      }),
    removeBundle: (bundleId) =>
      set((s) => {
        const bundles = s.bundles.filter((b) => b.bundleId !== bundleId);
        writeStored({ bundles, revision: s.revision });
        return { bundles };
      }),
    setRevision: (revision) =>
      set((s) => {
        writeStored({ bundles: s.bundles, revision });
        return { revision };
      }),
    sequences: () =>
      get()
        .bundles.flatMap((b) =>
          b.sequences.map((seq) => ({ ...seq, source: "bundle" as const, bundleId: b.bundleId })),
        ),
  };
});
