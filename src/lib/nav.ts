import {
  Home,
  Users,
  Activity,
  Bell,
  Target,
  CalendarDays,
  LineChart,
  Flower2,
  Pill,
  HeartPulse,
  FolderLock,
  Stethoscope,
  Compass,
  type LucideIcon,
} from "lucide-react";
import type { GateKey } from "@/lib/featureGate";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Gate controlling visibility; omit for always-open Starter surfaces. */
  gate?: GateKey;
  /**
   * Show as its own tab in the compact mobile bottom bar (alongside the profile
   * drawer + "More" sheet). Everything else lives under "More". Desktop shows the
   * full list regardless. Profiles is reached via the top-right profile drawer.
   */
  primary?: boolean;
  /**
   * Group under the mobile center button — the raised heart FAB that opens a bottom
   * sheet listing these destinations (Reminders / Goals / Schedule). Gated items only
   * appear here once unlocked; while locked they stay in "More" as a nudge. Desktop
   * shows them inline in the sidebar regardless.
   */
  central?: boolean;
}

/**
 * Nav order = the user's journey. Starter items first (always open), then the
 * progressively-revealed ones. A locked "hide"-gate item is omitted entirely; a
 * "nudge"-gate item still shows (with a lock hint) to point at the next action.
 */
export const NAV: NavItem[] = [
  { to: "/", label: "Today", icon: Home, primary: true },
  { to: "/profiles", label: "Profiles", icon: Users },
  { to: "/metrics", label: "Vitals", icon: Activity },
  { to: "/reminders", label: "Reminders", icon: Bell, central: true },
  { to: "/goals", label: "Goals", icon: Target, gate: "goals", central: true },
  { to: "/schedule", label: "Schedule", icon: CalendarDays, gate: "schedule", central: true },
  { to: "/trends", label: "Trends", icon: LineChart, gate: "trends" },
  { to: "/yoga", label: "Yoga", icon: Flower2, gate: "yoga" },
  { to: "/medications", label: "Medications", icon: Pill, gate: "medications" },
  { to: "/documents", label: "Documents", icon: FolderLock, gate: "documents" },
  { to: "/ice", label: "Medical card", icon: HeartPulse, gate: "ice" },
  { to: "/directory", label: "Find a Pro", icon: Stethoscope, gate: "directory" },
  { to: "/journey", label: "Your journey", icon: Compass },
];
