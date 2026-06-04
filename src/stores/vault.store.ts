/** Unlock state for the encrypted document vault (Stronghold). */
import { create } from "zustand";
import { isTauri } from "@/lib/environment";
import { vault, vaultExists } from "@/vault/stronghold";

interface VaultState {
  unlocked: boolean;
  exists: boolean;
  checked: boolean;
  /** Refresh whether a vault snapshot already exists on disk. */
  check: () => Promise<void>;
  /** Unlock (creating on first use). Throws on a wrong password. */
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
}

export const useVaultStore = create<VaultState>((set) => ({
  unlocked: false,
  exists: false,
  checked: false,
  check: async () => {
    set({ exists: await vaultExists(), checked: true, unlocked: isTauri() ? vault.isUnlocked() : false });
  },
  unlock: async (password) => {
    await vault.unlock(password);
    set({ unlocked: true, exists: true });
  },
  lock: async () => {
    await vault.lock();
    set({ unlocked: false });
  },
}));
