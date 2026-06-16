import { useEffect, lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { isTauri } from "@/lib/environment";
import { recordLaunch } from "@/db/usage";
import { initSharedDb } from "@/db/sharedDb";
import { runHabitReminderSweep } from "@/lib/reminderSweep";
import { runContentSync } from "@/content/updater";
import { maybeSeedDev } from "@/dev/seed";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";
import { useSettingsStore } from "@/stores/settings.store";
import { useProfileStore } from "@/stores/profile.store";

// Routes are lazy-loaded so each page becomes its own chunk, keeping the entry
// bundle small (only the shell + Today's first paint path load up front).
const Today = lazy(() => import("@/pages/Today"));
const Profiles = lazy(() => import("@/pages/Profiles"));
const Metrics = lazy(() => import("@/pages/Metrics"));
const Reminders = lazy(() => import("@/pages/Reminders"));
const Goals = lazy(() => import("@/pages/Goals"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Medications = lazy(() => import("@/pages/Medications"));
const Documents = lazy(() => import("@/pages/Documents"));
const Ice = lazy(() => import("@/pages/Ice"));
const Trends = lazy(() => import("@/pages/Trends"));
const Content = lazy(() => import("@/pages/Content"));
const Journey = lazy(() => import("@/pages/Journey"));
const Settings = lazy(() => import("@/pages/Settings"));
const Sync = lazy(() => import("@/pages/Sync"));
const Placeholder = lazy(() =>
  import("@/pages/Placeholder").then((m) => ({ default: m.Placeholder })),
);

const queryClient = new QueryClient();

export default function App() {
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);
  const refreshProfiles = useProfileStore((s) => s.refresh);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    (async () => {
      if (isTauri()) {
        try {
          await recordLaunch();
        } catch (e) {
          console.error("recordLaunch failed:", e);
        }
        // Register schemas + ensure the shared common ICE card table (best-effort).
        void initSharedDb();
        // Dev/QA only: populate dummy data when ?seed=… / VITE_SEED is set (no-op otherwise).
        try {
          await maybeSeedDev();
        } catch (e) {
          console.error("maybeSeedDev failed:", e);
        }
      }
      await Promise.all([hydrateSettings(), refreshTier(), refreshGating(), refreshProfiles()]);

      // Once the UI is idle (so startup is never blocked): raise habit reminders and
      // run the daily content sync (self-throttled to once/day — refreshes the remote
      // content catalog + per-type bundles from the GitHub release, receive-only).
      const onIdle = () => {
        void runHabitReminderSweep();
        void runContentSync();
      };
      if (isTauri()) {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
          .requestIdleCallback;
        if (ric) ric(onIdle);
        else setTimeout(onIdle, 2000);
      }
    })();
  }, [hydrateSettings, refreshTier, refreshGating, refreshProfiles]);

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppShell>
          <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/medications" element={<Medications />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/ice" element={<Ice />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/content/:type" element={<Content />} />
            {/* Old direct link kept working. */}
            <Route path="/yoga" element={<Navigate to="/content/yoga" replace />} />
            {/* Import is now part of Documents (scan & extract on add) — redirect old links. */}
            <Route path="/import" element={<Navigate to="/documents" replace />} />
            <Route
              path="/directory"
              element={
                <Placeholder
                  gateKey="directory"
                  title="Find a professional"
                  description="A curated directory of doctors, nutritionists, therapists and more — once published."
                />
              }
            />
            <Route path="/journey" element={<Journey />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sync" element={<Sync />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </AppShell>
      </HashRouter>
    </QueryClientProvider>
  );
}
