/**
 * Content-type registry. Each top-level `content/<type>/index.ts` default-exports
 * a {@link ContentType}; this module auto-discovers every one of them via a Vite
 * glob — so dropping a new folder under `content/` adds a tab with no wiring.
 *
 * On top of the baked (shipped-in-build) types, the daily content sync can
 * REGISTER additional types from the signed remote catalog (`updater.ts` →
 * `useContentStore`). The merged set drives the nav tabs, routes, and the
 * generic content page. Baked wins a key collision (its icon/samples are real).
 */
import { useContentStore } from "@/stores/content.store";
import { resolveIcon } from "@/content/icons";
import type { ContentType, ContentTypeMeta } from "@/content/model";

// Eagerly import every content type's index module. The glob is resolved from the
// Vite project root, so it matches `content/<type>/index.ts` (siblings of `src/`).
const modules = import.meta.glob<{ default: ContentType }>("/content/*/index.ts", { eager: true });

/** Types shipped in the build, sorted by `order` then `label`. */
export const BAKED_CONTENT_TYPES: ContentType[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

/** Resolve a remote catalog entry into a runtime type (no baked samples). */
function fromMeta(meta: ContentTypeMeta): ContentType {
  return {
    key: meta.key,
    label: meta.label,
    icon: resolveIcon(meta.iconName),
    tier: meta.tier,
    releaseTag: meta.releaseTag,
    description: meta.description,
    entryNoun: meta.entryNoun || "routine",
    order: meta.order ?? 100,
    samples: [],
    source: "remote",
  };
}

/** Merge baked + remote types (baked wins on key), sorted for display. */
export function mergeTypes(baked: ContentType[], remote: ContentTypeMeta[]): ContentType[] {
  const byKey = new Map<string, ContentType>();
  for (const t of baked) byKey.set(t.key, t);
  for (const m of remote) if (!byKey.has(m.key)) byKey.set(m.key, fromMeta(m));
  return [...byKey.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/** All content types right now (baked ⊕ remotely-registered). Non-reactive. */
export function allContentTypes(): ContentType[] {
  return mergeTypes(BAKED_CONTENT_TYPES, useContentStore.getState().remoteTypes);
}

/** Look up a type by key from a resolved list. */
export function findContentType(types: ContentType[], key: string | undefined): ContentType | undefined {
  return types.find((t) => t.key === key);
}

/** Reactive merged content types (re-renders when the remote catalog changes). */
export function useContentTypes(): ContentType[] {
  const remote = useContentStore((s) => s.remoteTypes);
  return mergeTypes(BAKED_CONTENT_TYPES, remote);
}
