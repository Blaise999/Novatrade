/**
 * WALLET STORE — standalone file
 * Wallet connection state
 */
import { create } from 'zustand';

interface WalletStore {
  connected: boolean;
  isConnected: boolean;
  address: string | null;
  chainId: number | null;

  setWallet: (payload: {
    connected?: boolean;
    isConnected?: boolean;
    address?: string | null;
    chainId?: number | null;
  }) => void;

  disconnect: () => void;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  connected: false,
  isConnected: false,
  address: null,
  chainId: null,

  setWallet: (payload) => {
    const nextConnected = payload.connected ?? payload.isConnected ?? get().connected ?? false;
    set({
      connected: nextConnected,
      isConnected: nextConnected,
      address: payload.address ?? get().address ?? null,
      chainId: payload.chainId ?? get().chainId ?? null,
    });
  },

  disconnect: () => set({ connected: false, isConnected: false, address: null, chainId: null }),
}));
