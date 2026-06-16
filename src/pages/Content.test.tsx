import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// FeatureGuard logic in the page reads the gating store (a sharedcorelib zustand
// store); mock it so the test controls the tier without pulling the lib's React copy.
vi.mock("@/stores/gating.store", () => ({ useGatingStore: vi.fn() }));

import Content from "./Content";
import { useGatingStore } from "@/stores/gating.store";
import { useContentStore } from "@/stores/content.store";
import { BAKED_CONTENT_TYPES } from "@/content/registry";

const ALL_LOCKED = {
  hasProfile: false,
  hasMetric: false,
  hasGoal: false,
  isTracker: false,
  isCaretaker: false,
  isChampion: false,
};
const setFlags = (over: Partial<typeof ALL_LOCKED>) =>
  (useGatingStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ ...ALL_LOCKED, ...over });

const yoga = BAKED_CONTENT_TYPES.find((t) => t.key === "yoga")!;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/content/:type" element={<Content />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("generic Content page", () => {
  beforeEach(() => {
    useContentStore.setState({ bundlesByType: {}, revisionByType: {}, remoteTypes: [], catalogRevision: 0, lastCheckedAt: 0 });
    (useGatingStore as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("locks a content tab for a Starter (below its tier)", () => {
    setFlags({ isTracker: false });
    renderAt("/content/yoga");
    expect(screen.getByText(/Reach the Tracker tier to unlock Yoga/i)).toBeInTheDocument();
    expect(screen.queryByText(yoga.samples[0]!.name)).not.toBeInTheDocument();
  });

  it("lists a type's baked samples once unlocked", () => {
    setFlags({ isTracker: true });
    renderAt("/content/yoga");
    for (const s of yoga.samples) expect(screen.getByText(s.name)).toBeInTheDocument();
  });

  it("renders the second baked type (exercises) from its own folder", () => {
    setFlags({ isTracker: true });
    renderAt("/content/exercises");
    expect(screen.getByRole("heading", { name: "Exercises" })).toBeInTheDocument();
  });

  it("redirects an unknown type to home", () => {
    setFlags({ isTracker: true });
    renderAt("/content/nope");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("opens an entry and shows its steps, then navigates back", () => {
    setFlags({ isTracker: true });
    renderAt("/content/yoga");
    const sample = yoga.samples[0]!;
    fireEvent.click(screen.getByText(sample.name));
    expect(screen.getByText(sample.steps[0]!.instruction)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/All sequences/i));
    expect(screen.getByText(yoga.samples[1]!.name)).toBeInTheDocument();
  });

  it("surfaces a downloaded bundle's entries and lets it be removed", () => {
    setFlags({ isTracker: true });
    useContentStore.getState().upsertBundle("yoga", {
      bundleId: "extra",
      name: "Extra Pack",
      version: 1,
      entries: [
        { id: "extra-flow", name: "Extra Flow", level: "advanced", focus: "Strength", summary: "s", source: "bundle", bundleId: "extra", steps: [{ title: "Plank", instruction: "Hold." }] },
      ],
    });
    renderAt("/content/yoga");
    expect(screen.getByText("Extra Flow")).toBeInTheDocument();
    expect(screen.getByText(/1 installed/i)).toBeInTheDocument();
    const item = screen.getByText("Extra Pack").closest("li")!;
    fireEvent.click(within(item).getByTitle(/Remove bundle/i));
    expect(useContentStore.getState().bundlesByType.yoga).toEqual([]);
  });
});
