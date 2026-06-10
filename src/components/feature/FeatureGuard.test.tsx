import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// The gating store is called with no selector in FeatureGuard; it returns the
// whole flags object, on which GATES[key].isUnlocked(flags) is evaluated.
vi.mock("@/stores/gating.store", () => ({ useGatingStore: vi.fn() }));

import { FeatureGuard, LockedFeature } from "./FeatureGuard";
import { useGatingStore } from "@/stores/gating.store";
import { GATES } from "@/lib/featureGate";

const ALL_LOCKED = {
  hasProfile: false,
  hasMetric: false,
  hasGoal: false,
  isTracker: false,
  isCaretaker: false,
  isChampion: false,
};

function setFlags(flags: Partial<typeof ALL_LOCKED>) {
  (useGatingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    ...ALL_LOCKED,
    ...flags,
  });
}

function renderInRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("FeatureGuard", () => {
  beforeEach(() => {
    (useGatingStore as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("renders children when the gate is unlocked", () => {
    setFlags({ isTracker: true }); // unlocks "goals"
    renderInRouter(
      <FeatureGuard gateKey="goals">
        <div>secret content</div>
      </FeatureGuard>,
    );
    expect(screen.getByText("secret content")).toBeInTheDocument();
    // Locked copy should not be present.
    expect(screen.queryByText(GATES.goals.lockedTitle)).not.toBeInTheDocument();
  });

  it("renders the locked CTA when the gate is locked", () => {
    setFlags({ isTracker: false }); // "goals" stays locked
    renderInRouter(
      <FeatureGuard gateKey="goals">
        <div>secret content</div>
      </FeatureGuard>,
    );
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
    expect(screen.getByText(GATES.goals.lockedTitle)).toBeInTheDocument();
    expect(screen.getByText(GATES.goals.unlockHint)).toBeInTheDocument();
  });

  it("evaluates a different gate's predicate independently", () => {
    // family gate unlocks on hasProfile, not on tier.
    setFlags({ hasProfile: true });
    renderInRouter(
      <FeatureGuard gateKey="family">
        <div>family page</div>
      </FeatureGuard>,
    );
    expect(screen.getByText("family page")).toBeInTheDocument();
  });
});

describe("LockedFeature", () => {
  it("shows the gate copy and a CTA link to ctaTo", () => {
    renderInRouter(<LockedFeature gateKey="import" />);
    const gate = GATES.import;
    expect(screen.getByText(gate.lockedTitle)).toBeInTheDocument();
    expect(screen.getByText(gate.unlockHint)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: gate.ctaLabel });
    expect(link).toHaveAttribute("href", gate.ctaTo);
  });
});
