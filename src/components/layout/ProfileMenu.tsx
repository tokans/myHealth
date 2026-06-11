import { useState } from "react";
import { User } from "lucide-react";
import { ProfileDrawer } from "@/components/layout/ProfileDrawer";
import { useProfileStore, selectActiveProfile } from "@/stores/profile.store";

/**
 * The top-right profile affordance passed into `SuiteShell`'s injected `profile` slot:
 * an avatar button (active person's initial) that opens the family-{@link ProfileDrawer}.
 * This is myHealth's LOCAL, login-less multi-person switcher — distinct from any
 * subscription/account concept (which the shell renders separately, gated to tier ≥ 2).
 */
export function ProfileMenu({ onReport }: { onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const activeProfile = useProfileStore(selectActiveProfile);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Profiles"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
      >
        {activeProfile ? (
          <span className="text-sm font-semibold">
            {activeProfile.name.trim().charAt(0).toUpperCase() || <User className="h-4 w-4" />}
          </span>
        ) : (
          <User className="h-4 w-4" />
        )}
      </button>
      <ProfileDrawer open={open} onOpenChange={setOpen} onReport={onReport} />
    </>
  );
}
