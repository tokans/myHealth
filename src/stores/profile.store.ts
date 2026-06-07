/**
 * The active profile, shared app-wide. Previously this was just a hook that always
 * resolved to the "self" profile; promoting it to a store lets the user *switch*
 * the active person (e.g. from the profile drawer) and have every page re-scope.
 *
 * The selected id is persisted to localStorage so a switch survives a reload. The
 * resolved active profile is `profiles.find(activeId)`, falling back to self/first
 * when the stored id no longer exists (deleted) or none was stored yet.
 */
import { create } from "zustand";
import { isTauri } from "@/lib/environment";
import { listProfiles, type Profile } from "@/db/profiles";

const STORAGE_KEY = "myhealth.activeProfileId";

function readStored(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeStored(id: number | null): void {
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

interface ProfileState {
  profiles: Profile[];
  activeId: number | null;
  loading: boolean;
  loaded: boolean;
  /** Re-read profiles from the DB and re-resolve the active id. */
  refresh: () => Promise<void>;
  /** Switch the active profile and persist the choice. */
  setActive: (id: number) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  activeId: readStored(),
  loading: true,
  loaded: false,
  refresh: async () => {
    if (!isTauri()) {
      set({ profiles: [], activeId: null, loading: false, loaded: true });
      return;
    }
    try {
      const profiles = await listProfiles();
      const stored = get().activeId ?? readStored();
      const storedExists = stored != null && profiles.some((p) => p.id === stored);
      const fallback = profiles.find((p) => p.is_self) ?? profiles[0] ?? null;
      const activeId = storedExists ? stored : (fallback?.id ?? null);
      if (activeId !== stored) writeStored(activeId);
      set({ profiles, activeId, loading: false, loaded: true });
    } catch (e) {
      console.error("Failed to load profiles:", e);
      set({ loading: false, loaded: true });
    }
  },
  setActive: (id) => {
    writeStored(id);
    set({ activeId: id });
  },
}));

/** The resolved active profile object (null during onboarding / browser preview). */
export const selectActiveProfile = (s: ProfileState): Profile | null =>
  s.profiles.find((p) => p.id === s.activeId) ?? null;
