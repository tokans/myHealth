import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { openExternal } = vi.hoisted(() => ({ openExternal: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/openExternal", () => ({ openExternal }));

// Drive the tier store: selectTier returns a fixed tier; refresh/loaded selectors.
vi.mock("@/stores/tier.store", () => {
  const tier = { key: "starter", label: "Starter" };
  const state = { refresh: vi.fn(() => Promise.resolve()), loaded: true, tier };
  const selectTier = (s: any) => s.tier;
  const useTierStore = vi.fn((selector: any) => selector(state));
  return { useTierStore, selectTier };
});

import { ReportIssueDialog } from "./ReportIssueDialog";

describe("ReportIssueDialog", () => {
  beforeEach(() => {
    openExternal.mockClear();
  });

  it("renders the dialog when open", async () => {
    render(<ReportIssueDialog open onOpenChange={() => {}} />);
    expect(
      await screen.findByRole("heading", { name: /report an issue/i }),
    ).toBeInTheDocument();
  });

  it("keeps submit disabled until title and description are filled", async () => {
    render(<ReportIssueDialog open onOpenChange={() => {}} />);
    const submit = await screen.findByRole("button", { name: /continue on github/i });
    expect(submit).toBeDisabled();
  });

  it("builds a github issue URL with the typed title and description and opens it", async () => {
    const onOpenChange = vi.fn();
    render(<ReportIssueDialog open onOpenChange={onOpenChange} />);

    const title = await screen.findByLabelText("Title");
    await userEvent.type(title, "App crashes on launch");

    const desc = screen.getByLabelText("Description");
    await userEvent.type(desc, "it explodes immediately");

    const submit = screen.getByRole("button", { name: /continue on github/i });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    await waitFor(() => expect(openExternal).toHaveBeenCalledTimes(1));
    const url = (openExternal as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(url).toContain("https://github.com/tokans/myHealth/issues/new");
    // URLSearchParams encodes spaces as "+"; decode those back for readable assertions.
    const decoded = decodeURIComponent(url).replace(/\+/g, " ");
    expect(decoded).toContain("App crashes on launch");
    expect(decoded).toContain("it explodes immediately");
    // The lead line prepends the tier label.
    expect(decoded).toContain("Starter user");
    // Dialog asked to close after a successful submit.
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not open anything when the form is incomplete", async () => {
    render(<ReportIssueDialog open onOpenChange={() => {}} />);
    const title = await screen.findByLabelText("Title");
    await userEvent.type(title, "only a title");
    const submit = screen.getByRole("button", { name: /continue on github/i });
    expect(submit).toBeDisabled();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
