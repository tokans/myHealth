import { useEffect, useState } from "react";
import { isTauri } from "@/lib/environment";
import { getSelfProfile, listProfiles, type Profile } from "@/db/profiles";

/**
 * The profile the Today view / habits are scoped to: the "self" profile, else the
 * first profile. Null when none exists yet (onboarding). No-ops in browser preview.
 */
export function useActiveProfile(refreshKey = 0) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTauri()) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const self = (await getSelfProfile()) ?? (await listProfiles())[0] ?? null;
        if (!cancelled) setProfile(self);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { profile, loading };
}
