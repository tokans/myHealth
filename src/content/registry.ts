/**
 * Content-type registry. The folder discovery (`import.meta.glob` over myHealth's
 * own `content/` directory) and the icon-name resolver are app-specific and stay
 * here; the merge mechanism (baked ⊕ remotely-registered, baked wins) comes from
 * the shared framework (`sharedcorelib/content`).
 *
 * Dropping a new `content/<type>/index.ts` folder adds a tab with no other wiring.
 */
import { useMemo } from "react";
import { collectBakedTypes, mergeTypes as coreMergeTypes, findContentType } from "sharedcorelib/content";
import { useContentStore } from "@/stores/content.store";
import { resolveIcon } from "@/content/icons";
import type { ContentType, ContentTypeMeta } from "@/content/model";

// Resolved from the Vite project root → matches `content/<type>/index.ts` (siblings of `src/`).
const modules = import.meta.glob<{ default: ContentType }>("/content/*/index.ts", { eager: true });

/** Types shipped in the build, sorted by `order` then `label`. */
export const BAKED_CONTENT_TYPES: ContentType[] = collectBakedTypes(modules);

export { findContentType };

/** Merge baked + remote types (baked wins a key collision), resolving icons. */
export function mergeTypes(baked: ContentType[], remote: ContentTypeMeta[]): ContentType[] {
  return coreMergeTypes(baked, remote, resolveIcon);
}

/** All content types right now (baked ⊕ remotely-registered). Non-reactive. */
export function allContentTypes(): ContentType[] {
  return mergeTypes(BAKED_CONTENT_TYPES, useContentStore.getState().remoteTypes);
}

/** Reactive merged content types (re-renders when the remote catalog changes). */
export function useContentTypes(): ContentType[] {
  const remote = useContentStore((s) => s.remoteTypes);
  // Recompute the merge only when the remote catalog actually changes — this hook feeds
  // AppShell's nav rebuild, so a fresh array every render would churn that hot path.
  return useMemo(() => mergeTypes(BAKED_CONTENT_TYPES, remote), [remote]);
}
