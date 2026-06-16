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
import { nodeAt, nodeEntries } from "@/content/model";

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
const morning = nodeEntries(nodeAt(yoga.tree!, ["morning"])!)[0]!;

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
    expect(screen.queryByText(morning.name)).not.toBeInTheDocument();
  });

  it("shows the subtype breadcrumb dropdown and prompts to pick a section", () => {
    setFlags({ isTracker: true });
    renderAt("/content/yoga");
    const select = screen.getByRole("combobox");
    // Subtypes are offered as next-node options.
    expect(within(select).getByRole("option", { name: "Morning" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Relax" })).toBeInTheDocument();
    expect(screen.getByText(/Choose a section above to see sequences/i)).toBeInTheDocument();
    // Entries are not shown until a subtype is chosen.
    expect(screen.queryByText(morning.name)).not.toBeInTheDocument();
  });

  it("lists a chosen subtype's entries", () => {
    setFlags({ isTracker: true });
    renderAt("/content/yoga");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "morning" } });
    expect(screen.getByText(morning.name)).toBeInTheDocument();
  });

  it("opens an entry from a subtype and shows its steps, then navigates back", () => {
    setFlags({ isTracker: true });
    renderAt("/content/yoga");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "morning" } });
    fireEvent.click(screen.getByText(morning.name));
    expect(screen.getByText(morning.steps[0]!.instruction)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/All sequences/i));
    // Back on the list for the still-selected subtype.
    expect(screen.getByText(morning.name)).toBeInTheDocument();
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

  it("lists an available bundle and installs it on click (Add)", () => {
    setFlags({ isTracker: true });
    useContentStore.getState().setAvailable("yoga", [
      {
        bundleId: "restorative",
        name: "Restorative",
        version: 1,
        entries: [
          { id: "r1", name: "Calm Flow", summary: "s", source: "bundle", bundleId: "restorative", steps: [{ title: "t", instruction: "i" }] },
        ],
      },
    ]);
    renderAt("/content/yoga");
    // Available but not installed: shown in the bundle manager, entry NOT in the content list yet.
    expect(screen.getByText("Restorative")).toBeInTheDocument();
    expect(screen.queryByText("Calm Flow")).not.toBeInTheDocument();
    // Click "Add" → installed → entry surfaces at the root.
    const row = screen.getByText("Restorative").closest("li")!;
    fireEvent.click(within(row).getByTitle(/Add bundle/i));
    expect(useContentStore.getState().bundlesByType.yoga!.map((b) => b.bundleId)).toEqual(["restorative"]);
    expect(screen.getByText("Calm Flow")).toBeInTheDocument();
  });

  it("surfaces a downloaded bundle's entries at the root and lets it be removed", () => {
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
