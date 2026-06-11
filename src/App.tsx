import { useEffect, lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { isTauri } from "@/lib/environment";
import { recordLaunch } from "@/db/usage";
import { initSharedDb } from "@/db/sharedDb";
import { runHabitReminderSweep } from "@/lib/reminderSweep";
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
const Journey = lazy(() => import("@/pages/Journey"));
const Settings = lazy(() => import("@/pages/Settings"));
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
      }
      await Promise.all([hydrateSettings(), refreshTier(), refreshGating(), refreshProfiles()]);

      // Raise habit reminders once the UI is idle so startup is never blocked.
      const sweep = () => void runHabitReminderSweep();
      if (isTauri()) {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
          .requestIdleCallback;
        if (ric) ric(sweep);
        else setTimeout(sweep, 2000);
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
            <Route
              path="/trends"
              element={
                <Placeholder
                  gateKey="trends"
                  title="Trends"
                  description="See any metric or lab value charted across time with reference-range bands."
                />
              }
            />
            <Route
              path="/import"
              element={
                <Placeholder
                  gateKey="import"
                  title="Import documents"
                  description="Import prescriptions and lab reports with a confidence-tiered, human-in-the-loop review."
                />
              }
            />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </AppShell>
      </HashRouter>
    </QueryClientProvider>
  );
}
