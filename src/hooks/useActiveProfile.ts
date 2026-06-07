import { useEffect } from "react";
import { useProfileStore, selectActiveProfile } from "@/stores/profile.store";

/**
 * The profile the current view / habits are scoped to. Backed by the global
 * profile store (`profile.store.ts`) so switching the active person — e.g. from
 * the profile drawer — re-scopes every page. Resolves to the selected profile,
 * else self, else the first profile; null during onboarding / browser preview.
 */
export function useActiveProfile() {
  const refresh = useProfileStore((s) => s.refresh);
  const loaded = useProfileStore((s) => s.loaded);
  const loading = useProfileStore((s) => s.loading);
  const profile = useProfileStore(selectActiveProfile);

  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  return { profile, loading };
}
