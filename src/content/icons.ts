/**
 * Icon-name → Lucide component map for content tabs. Baked types import a real
 * icon directly; remotely-registered types (from the signed catalog) carry an
 * icon NAME string, resolved here to a component with a safe fallback so an
 * unknown/typo'd name never crashes a tab.
 */
import {
  Flower2,
  Dumbbell,
  HeartPulse,
  Activity,
  Brain,
  Footprints,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Flower2,
  Dumbbell,
  HeartPulse,
  Activity,
  Brain,
  Footprints,
  Sparkles,
};

/** Resolve a Lucide icon name to a component (defaults to Sparkles). */
export function resolveIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Sparkles;
}
