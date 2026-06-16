import { useEffect, useState } from "react";
import { ExternalLink, Check, Download, Heart, BadgeCheck, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { suiteCatalog } from "@/suite/catalog";
import type { AppCatalogEntry } from "sharedcorelib/suite";
import { cn } from "@/lib/utils";

/** Primary-button copy + icon per row action. `current` renders no button. */
const ACTION: Record<
  AppCatalogEntry["primaryAction"],
  { label: string; icon: typeof Download } | null
> = {
  open: { label: "Open", icon: ArrowUpRight },
  download: { label: "Download", icon: Download },
  enroll: { label: "Enroll", icon: Heart },
  current: null,
};

/**
 * App marketplace — every Tokans app, installed or not, sourced from the published-apps
 * registry (baked seed until a signed registry arrives over the air). Discover and install
 * siblings; access-gated paid apps show **Enroll** until you hold the matching grant. No
 * account, no egress — clicking just hands a marketing/download URL to your OS browser.
 */
export default function Apps() {
  const [rows, setRows] = useState<AppCatalogEntry[] | null>(null);

  const load = () => {
    suiteCatalog
      .list()
      .then(setRows)
      .catch((e) => {
        console.warn("marketplace unavailable:", e);
        setRows([]);
      });
  };

  useEffect(load, []);

  const onActivate = async (appId: string) => {
    await suiteCatalog.activate(appId);
    load(); // reflect any local-state change (e.g. launch/install bookkeeping)
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Apps</h1>
        <p className="text-muted-foreground">
          More from Tokans — private, local-first apps that share this one's secure foundation.
          Nothing about you is uploaded; links open in your browser.
        </p>
      </div>

      {rows === null ? (
        <p className="text-xs text-muted-foreground">Loading the catalog…</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((app) => {
            const action = ACTION[app.primaryAction];
            const gated = (app.access ?? "open") !== "open";
            return (
              <Card key={app.appId} className={cn(app.isCurrentApp && "border-primary/40")}>
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold">
                    {app.name.replace(/^my/i, "").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {app.name}
                      {app.isCurrentApp && (
                        <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">
                          <Check className="h-3 w-3" /> This app
                        </span>
                      )}
                      {!app.isCurrentApp && app.local.installed && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          installed
                        </span>
                      )}
                      {app.updateAvailable && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-normal text-amber-700 dark:text-amber-400">
                          update
                        </span>
                      )}
                      {gated && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-normal text-rose-600 dark:text-rose-400">
                          {app.access === "partner" ? (
                            <>
                              <BadgeCheck className="h-3 w-3" /> Pro
                            </>
                          ) : (
                            <>
                              <Heart className="h-3 w-3" /> Supporter
                            </>
                          )}
                        </span>
                      )}
                    </CardTitle>
                    {app.tagline && <CardDescription>{app.tagline}</CardDescription>}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                  {action && (
                    <Button
                      variant={app.primaryAction === "open" ? "default" : app.primaryAction === "enroll" ? "outline" : "default"}
                      className="gap-2"
                      onClick={() => void onActivate(app.appId)}
                    >
                      <action.icon className="h-4 w-4" />
                      {action.label}
                      {app.primaryAction !== "open" && <ExternalLink className="h-3.5 w-3.5 opacity-80" />}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => void suiteCatalog.openMarketing(app.appId)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Learn more
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
