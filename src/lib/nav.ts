import {
  Home,
  Users,
  Activity,
  Bell,
  Target,
  CalendarDays,
  LineChart,
  Pill,
  HeartPulse,
  FolderLock,
  Stethoscope,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { GateKey, EarnedTier } from "@/lib/featureGate";
import type { ContentType } from "@/content/model";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Gate controlling visibility; omit for always-open Starter surfaces. */
  gate?: GateKey;
  /**
   * Earned tier this item unlocks at — used by dynamic CONTENT tabs (Yoga,
   * Exercises, …) which aren't static `GateKey`s. Visibility follows the same
   * one-tier-ahead rule via `tierVisibility`. Mutually exclusive with `gate`.
   */
  tier?: EarnedTier;
  /** Content-type key for content tabs (drives the lock hint copy). */
  contentKey?: string;
  /**
   * Show as its own tab in the compact mobile bottom bar (alongside the profile
   * drawer + "More" sheet). Everything else lives under "More". Desktop shows the
   * full list regardless. Profiles is reached via the top-right profile drawer.
   */
  primary?: boolean;
  /**
   * Group under the mobile center button — the raised heart FAB that opens a bottom
   * sheet listing these destinations (Reminders / Goals / Schedule + content tabs).
   * Gated items only appear here once unlocked; while locked they stay in "More" as
   * a nudge. Desktop shows them inline in the sidebar regardless.
   */
  central?: boolean;
}

/** A nav item for a content tab — central (mobile FAB) and tier-gated. */
export function contentNavItem(type: ContentType): NavItem {
  return {
    to: `/content/${type.key}`,
    label: type.label,
    icon: type.icon,
    tier: type.tier,
    contentKey: type.key,
    central: true,
  };
}

/**
 * Full nav = the static items with the dynamic content tabs spliced in right
 * after Trends (so content sits with the other Tracker surfaces). Content tabs
 * are mobile-FAB (`central`) destinations, not "More" entries.
 */
export function buildNav(contentTypes: ContentType[]): NavItem[] {
  const out = [...NAV];
  const at = out.findIndex((n) => n.to === "/trends");
  const insertAt = at >= 0 ? at + 1 : out.length;
  out.splice(insertAt, 0, ...contentTypes.map(contentNavItem));
  return out;
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
  { to: "/medications", label: "Medications", icon: Pill, gate: "medications" },
  { to: "/documents", label: "Documents", icon: FolderLock, gate: "documents" },
  { to: "/ice", label: "Medical card", icon: HeartPulse, gate: "ice" },
  { to: "/directory", label: "Find a Pro", icon: Stethoscope, gate: "directory" },
  { to: "/sync", label: "Sync devices", icon: RefreshCw, gate: "sync" },
];
