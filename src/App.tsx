import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { isTauri } from "@/lib/environment";
import { recordLaunch } from "@/db/usage";
import { runHabitReminderSweep } from "@/lib/reminderSweep";
import { useTierStore } from "@/stores/tier.store";
import { useGatingStore } from "@/stores/gating.store";
import { useSettingsStore } from "@/stores/settings.store";

import Today from "@/pages/Today";
import Profiles from "@/pages/Profiles";
import Metrics from "@/pages/Metrics";
import Reminders from "@/pages/Reminders";
import Goals from "@/pages/Goals";
import Schedule from "@/pages/Schedule";
import Medications from "@/pages/Medications";
import Ice from "@/pages/Ice";
import Journey from "@/pages/Journey";
import { Placeholder } from "@/pages/Placeholder";

const queryClient = new QueryClient();

export default function App() {
  const refreshTier = useTierStore((s) => s.refresh);
  const refreshGating = useGatingStore((s) => s.refresh);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    (async () => {
      if (isTauri()) {
        try {
          await recordLaunch();
        } catch (e) {
          console.error("recordLaunch failed:", e);
        }
      }
      await Promise.all([hydrateSettings(), refreshTier(), refreshGating()]);

      // Raise habit reminders once the UI is idle so startup is never blocked.
      const sweep = () => void runHabitReminderSweep();
      if (isTauri()) {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
          .requestIdleCallback;
        if (ric) ric(sweep);
        else setTimeout(sweep, 2000);
      }
    })();
  }, [hydrateSettings, refreshTier, refreshGating]);

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/medications" element={<Medications />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </QueryClientProvider>
  );
}
