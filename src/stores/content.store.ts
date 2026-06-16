/**
 * Downloaded content state, shared app-wide and persisted to localStorage.
 *
 * Holds, per content type: the downloaded bundles + the anti-downgrade revision
 * floor. Plus the catalog of REMOTELY-registered types (so a new tab can appear
 * without an app update), the catalog revision, and the daily-sync timestamp.
 *
 * All of this is public, non-sensitive reference data — no health PII — so
 * localStorage is appropriate and avoids a new SQLite migration. Receive-only:
 * written solely by the verified OTA apply step (`content/updater.ts`); it
 * uploads nothing.
 */
import { create } from "zustand";
import type { ContentBundle, ContentTypeMeta } from "@/content/model";

const KEY = "myhealth.content.v1";

interface PersistShape {
  bundlesByType: Record<string, ContentBundle[]>;
  revisionByType: Record<string, number>;
  remoteTypes: ContentTypeMeta[];
  catalogRevision: number;
  lastCheckedAt: number;
}

const EMPTY: PersistShape = {
  bundlesByType: {},
  revisionByType: {},
  remoteTypes: [],
  catalogRevision: 0,
  lastCheckedAt: 0,
};

function read(): PersistShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<PersistShape>) };
  } catch {
    return { ...EMPTY };
  }
}

function persist(s: PersistShape): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

interface ContentState extends PersistShape {
  /** Insert/replace a bundle for a type (latest version wins). */
  upsertBundle: (typeKey: string, bundle: ContentBundle) => void;
  /** Remove a downloaded bundle from a type. */
  removeBundle: (typeKey: string, bundleId: string) => void;
  /** Record the applied bundle-manifest revision for a type. */
  setRevision: (typeKey: string, revision: number) => void;
  /** Register/replace a remotely-discovered content type (by key). */
  registerRemoteType: (meta: ContentTypeMeta) => void;
  /** Record the applied catalog revision. */
  setCatalogRevision: (revision: number) => void;
  /** Stamp the last daily-sync time (epoch ms). */
  markChecked: (at: number) => void;
}

function snapshot(s: ContentState): PersistShape {
  return {
    bundlesByType: s.bundlesByType,
    revisionByType: s.revisionByType,
    remoteTypes: s.remoteTypes,
    catalogRevision: s.catalogRevision,
    lastCheckedAt: s.lastCheckedAt,
  };
}

export const useContentStore = create<ContentState>((set, get) => ({
  ...read(),
  upsertBundle: (typeKey, bundle) =>
    set(() => {
      const existing = get().bundlesByType[typeKey] ?? [];
      const next = [...existing.filter((b) => b.bundleId !== bundle.bundleId), bundle];
      const bundlesByType = { ...get().bundlesByType, [typeKey]: next };
      persist({ ...snapshot(get()), bundlesByType });
      return { bundlesByType };
    }),
  removeBundle: (typeKey, bundleId) =>
    set(() => {
      const next = (get().bundlesByType[typeKey] ?? []).filter((b) => b.bundleId !== bundleId);
      const bundlesByType = { ...get().bundlesByType, [typeKey]: next };
      persist({ ...snapshot(get()), bundlesByType });
      return { bundlesByType };
    }),
  setRevision: (typeKey, revision) =>
    set(() => {
      const revisionByType = { ...get().revisionByType, [typeKey]: revision };
      persist({ ...snapshot(get()), revisionByType });
      return { revisionByType };
    }),
  registerRemoteType: (meta) =>
    set(() => {
      const remoteTypes = [...get().remoteTypes.filter((t) => t.key !== meta.key), meta];
      persist({ ...snapshot(get()), remoteTypes });
      return { remoteTypes };
    }),
  setCatalogRevision: (catalogRevision) =>
    set(() => {
      persist({ ...snapshot(get()), catalogRevision });
      return { catalogRevision };
    }),
  markChecked: (lastCheckedAt) =>
    set(() => {
      persist({ ...snapshot(get()), lastCheckedAt });
      return { lastCheckedAt };
    }),
}));
