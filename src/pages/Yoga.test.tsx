import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// FeatureGuard reads the gating store (a sharedcorelib zustand store); mock it so
// the test controls the tier and avoids pulling the lib's React copy (mirrors
// FeatureGuard.test.tsx). The yoga store is app-local and used for real.
vi.mock("@/stores/gating.store", () => ({ useGatingStore: vi.fn() }));

import Yoga from "./Yoga";
import { useGatingStore } from "@/stores/gating.store";
import { useYogaStore } from "@/stores/yoga.store";
import { SAMPLE_SEQUENCES } from "@/domain/yoga";

const ALL_LOCKED = {
  hasProfile: false,
  hasMetric: false,
  hasGoal: false,
  isTracker: false,
  isCaretaker: false,
  isChampion: false,
};

function setFlags(flags: Partial<typeof ALL_LOCKED>) {
  (useGatingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ...ALL_LOCKED, ...flags });
}

function renderYoga() {
  return render(
    <MemoryRouter>
      <Yoga />
    </MemoryRouter>,
  );
}

describe("Yoga page", () => {
  beforeEach(() => {
    useYogaStore.setState({ bundles: [], revision: 0 });
    (useGatingStore as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("locks the page for a Starter (below Tracker)", () => {
    setFlags({ isTracker: false });
    renderYoga();
    expect(screen.getByText("Yoga sequences")).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_SEQUENCES[0]!.name)).not.toBeInTheDocument();
  });

  it("lists the baked sample sequences once unlocked", () => {
    setFlags({ isTracker: true });
    renderYoga();
    for (const seq of SAMPLE_SEQUENCES) {
      expect(screen.getByText(seq.name)).toBeInTheDocument();
    }
  });

  it("opens a sequence and shows its numbered steps, then navigates back", () => {
    setFlags({ isTracker: true });
    renderYoga();
    const sample = SAMPLE_SEQUENCES[0]!;
    fireEvent.click(screen.getByText(sample.name));
    expect(screen.getByText(sample.steps[0]!.instruction)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/All sequences/i));
    expect(screen.getByText(SAMPLE_SEQUENCES[1]!.name)).toBeInTheDocument();
  });

  it("surfaces downloaded bundle sequences alongside the samples", () => {
    setFlags({ isTracker: true });
    useYogaStore.getState().upsertBundle({
      bundleId: "extra",
      name: "Extra Pack",
      version: 1,
      sequences: [
        {
          id: "extra-flow",
          name: "Extra Flow",
          level: "advanced",
          focus: "Strength",
          summary: "An extra downloaded flow.",
          source: "bundle",
          bundleId: "extra",
          steps: [{ title: "Plank", instruction: "Hold a plank." }],
        },
      ],
    });
    renderYoga();
    expect(screen.getByText("Extra Flow")).toBeInTheDocument();
    expect(screen.getByText(/1 installed/i)).toBeInTheDocument();
  });

  it("removes a downloaded bundle", () => {
    setFlags({ isTracker: true });
    useYogaStore.getState().upsertBundle({ bundleId: "x", name: "X Pack", version: 1, sequences: [] });
    renderYoga();
    const item = screen.getByText("X Pack").closest("li")!;
    fireEvent.click(within(item).getByTitle(/Remove bundle/i));
    expect(useYogaStore.getState().bundles).toEqual([]);
  });
});
