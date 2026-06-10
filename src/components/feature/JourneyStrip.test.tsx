import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sprout } from "lucide-react";

// JourneyStrip calls useTierStore(selectTier) then useTierStore(selectNextTier).
// We mock the store module and drive both via a fake state object the selectors
// read from.
vi.mock("@/stores/tier.store", () => {
  const selectTier = vi.fn((s: any) => s.tier);
  const selectNextTier = vi.fn((s: any) => s.next);
  const useTierStore = vi.fn((selector: any) => selector((useTierStore as any).__state));
  return { useTierStore, selectTier, selectNextTier };
});

import { JourneyStrip } from "./JourneyStrip";
import { useTierStore } from "@/stores/tier.store";

function setState(state: any) {
  (useTierStore as any).__state = state;
}

const starter = {
  key: "starter",
  label: "Starter",
  icon: Sprout,
  className: "text-emerald-600",
  criteria: "Just getting started.",
};

const tracker = {
  key: "tracker",
  label: "Tracker",
  icon: Sprout,
  className: "text-blue-600",
  criteria: "Log on 5 days.",
};

describe("JourneyStrip", () => {
  beforeEach(() => {
    (useTierStore as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it("shows the current tier label", () => {
    setState({ tier: starter, next: tracker });
    render(<JourneyStrip />);
    expect(screen.getByText("You're a Starter")).toBeInTheDocument();
  });

  it("shows the next-tier hint with its criteria", () => {
    setState({ tier: starter, next: tracker });
    render(<JourneyStrip />);
    expect(
      screen.getByText(`Next: ${tracker.label} — ${tracker.criteria}`),
    ).toBeInTheDocument();
  });

  it("shows the 'unlocked everything' message at the top tier", () => {
    setState({ tier: tracker, next: null });
    render(<JourneyStrip />);
    expect(screen.getByText(/unlocked everything/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument();
  });
});
