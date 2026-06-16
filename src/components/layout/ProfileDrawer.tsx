import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, User, UserPlus, Bug, Compass, Settings as SettingsIcon } from "lucide-react";
import { SupportedByTokans } from "sharedcorelib/ui";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { openExternal } from "@/lib/openExternal";
import { useProfileStore } from "@/stores/profile.store";

/**
 * Mobile profile drawer: switch the active person, jump to add a new one, and the
 * suite-standard secondary actions (report an issue + publisher attribution). On
 * mobile this replaces the profile tab and the in-page footer.
 */
export function ProfileDrawer({
  open,
  onOpenChange,
  onReport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReport: () => void;
}) {
  const navigate = useNavigate();
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const setActive = useProfileStore((s) => s.setActive);
  const refresh = useProfileStore((s) => s.refresh);
  const loaded = useProfileStore((s) => s.loaded);

  // Make sure the list is current whenever the drawer is opened.
  useEffect(() => {
    if (open && !loaded) void refresh();
  }, [open, loaded, refresh]);

  function select(id: number) {
    setActive(id);
    onOpenChange(false);
  }

  function goAdd() {
    onOpenChange(false);
    navigate("/profiles");
  }

  function goJourney() {
    onOpenChange(false);
    navigate("/journey");
  }

  function goSettings() {
    onOpenChange(false);
    navigate("/settings");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" title="Profiles" description="Switch who you're tracking.">
        <div className="flex-1 overflow-y-auto p-2">
          {profiles.length === 0 && (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              No profiles yet — add yourself to get started.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {profiles.map((p) => {
              const active = p.id === activeId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => select(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                      active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {p.name.trim().charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.is_self ? "You" : p.relationship || "Family member"}
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={goAdd}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed">
              <UserPlus className="h-4 w-4" />
            </span>
            Add a profile
          </button>
        </div>

        {/* Secondary actions: your journey + support + publisher attribution (shared core). */}
        <div className="mt-auto flex flex-col gap-1 border-t p-2">
          <button
            type="button"
            onClick={goJourney}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Compass className="h-4 w-4" />
            Your journey
          </button>
          <button
            type="button"
            onClick={goSettings}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <SettingsIcon className="h-4 w-4" />
            Settings
          </button>
          <SheetClose asChild>
            <button
              type="button"
              onClick={onReport}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Bug className="h-4 w-4" />
              Report an issue
            </button>
          </SheetClose>
          <SupportedByTokans
            onActivate={(href) => void openExternal(href)}
            className="flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
