import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/environment", () => ({ isTauri: vi.fn(() => true) }));
vi.mock("@/vault/stronghold", () => ({
  vault: {
    isUnlocked: vi.fn(() => false),
    unlock: vi.fn(),
    lock: vi.fn(),
  },
  vaultExists: vi.fn(),
}));

import { isTauri } from "@/lib/environment";
import { vault, vaultExists } from "@/vault/stronghold";
import { useVaultStore } from "./vault.store";

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(vault.isUnlocked).mockReturnValue(false);
  vi.mocked(vault.unlock).mockResolvedValue(undefined as never);
  vi.mocked(vault.lock).mockResolvedValue(undefined as never);
  useVaultStore.setState({ unlocked: false, exists: false, checked: false });
});

describe("useVaultStore.check", () => {
  it("sets exists/checked and reflects vault.isUnlocked when in Tauri", async () => {
    vi.mocked(vaultExists).mockResolvedValue(true);
    vi.mocked(vault.isUnlocked).mockReturnValue(true);
    await useVaultStore.getState().check();
    const s = useVaultStore.getState();
    expect(s.exists).toBe(true);
    expect(s.checked).toBe(true);
    expect(s.unlocked).toBe(true);
  });

  it("never reports unlocked in browser preview (isTauri false)", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(vaultExists).mockResolvedValue(false);
    await useVaultStore.getState().check();
    const s = useVaultStore.getState();
    expect(s.exists).toBe(false);
    expect(s.checked).toBe(true);
    expect(s.unlocked).toBe(false);
    expect(vault.isUnlocked).not.toHaveBeenCalled();
  });
});

describe("useVaultStore.unlock", () => {
  it("calls vault.unlock and marks unlocked + exists", async () => {
    await useVaultStore.getState().unlock("hunter2");
    expect(vault.unlock).toHaveBeenCalledWith("hunter2");
    const s = useVaultStore.getState();
    expect(s.unlocked).toBe(true);
    expect(s.exists).toBe(true);
  });

  it("propagates a wrong-password error and leaves state locked", async () => {
    vi.mocked(vault.unlock).mockRejectedValue(new Error("bad password"));
    await expect(useVaultStore.getState().unlock("wrong")).rejects.toThrow("bad password");
    expect(useVaultStore.getState().unlocked).toBe(false);
  });
});

describe("useVaultStore.lock", () => {
  it("calls vault.lock and marks locked", async () => {
    useVaultStore.setState({ unlocked: true });
    await useVaultStore.getState().lock();
    expect(vault.lock).toHaveBeenCalled();
    expect(useVaultStore.getState().unlocked).toBe(false);
  });
});
