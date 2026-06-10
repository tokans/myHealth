import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/stores/vault.store", () => ({ useVaultStore: vi.fn() }));

import { UnlockPanel } from "./UnlockPanel";
import { useVaultStore } from "@/stores/vault.store";

const check = vi.fn(() => Promise.resolve());

function setVault(state: Partial<{ exists: boolean; checked: boolean; unlock: any }>) {
  (useVaultStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    exists: true,
    checked: true,
    check,
    unlock: vi.fn(() => Promise.resolve()),
    ...state,
  });
}

describe("UnlockPanel", () => {
  beforeEach(() => {
    check.mockClear();
    (useVaultStore as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("renders the unlock prompt when a vault already exists", () => {
    setVault({ exists: true, checked: true });
    render(<UnlockPanel />);
    expect(screen.getByText("Unlock your vault")).toBeInTheDocument();
    // No confirm field in unlock mode.
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });

  it("renders the create prompt (with confirm) on first run", () => {
    setVault({ exists: false, checked: true });
    render(<UnlockPanel />);
    expect(screen.getByText("Set a master password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("calls check() on mount when not yet checked", async () => {
    setVault({ exists: false, checked: false });
    render(<UnlockPanel />);
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
  });

  it("calls unlock(password) on submit in unlock mode", async () => {
    const unlock = vi.fn(() => Promise.resolve());
    setVault({ exists: true, checked: true, unlock });
    render(<UnlockPanel />);

    await userEvent.type(screen.getByLabelText("Master password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(unlock).toHaveBeenCalledWith("hunter2");
  });

  it("blocks creation and shows an error when passwords don't match", async () => {
    const unlock = vi.fn(() => Promise.resolve());
    setVault({ exists: false, checked: true, unlock });
    render(<UnlockPanel />);

    await userEvent.type(screen.getByLabelText("Master password"), "secret1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "secret2");
    await userEvent.click(screen.getByRole("button", { name: "Create vault" }));

    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(unlock).not.toHaveBeenCalled();
  });

  it("rejects passwords shorter than 6 characters", async () => {
    const unlock = vi.fn(() => Promise.resolve());
    setVault({ exists: true, checked: true, unlock });
    render(<UnlockPanel />);

    await userEvent.type(screen.getByLabelText("Master password"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(screen.getByText("Use at least 6 characters.")).toBeInTheDocument();
    expect(unlock).not.toHaveBeenCalled();
  });

  it("surfaces a wrong-password error when unlock rejects", async () => {
    const unlock = vi.fn(() => Promise.reject(new Error("bad")));
    setVault({ exists: true, checked: true, unlock });
    render(<UnlockPanel />);

    await userEvent.type(screen.getByLabelText("Master password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByText("Wrong password.")).toBeInTheDocument();
  });
});
