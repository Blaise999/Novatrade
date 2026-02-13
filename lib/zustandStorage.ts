// lib/zustandStorage.ts
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

// SSR-safe fallback (so importing this file on the server won't crash)
const noopStorage: StateStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
};

export function safeSessionStorage() {
  const storage: StateStorage =
    typeof window !== 'undefined' ? window.sessionStorage : noopStorage;

  return createJSONStorage(() => storage);
}

// (Optional) if you still need localStorage anywhere
export function safeLocalStorage() {
  const storage: StateStorage =
    typeof window !== 'undefined' ? window.localStorage : noopStorage;

  return createJSONStorage(() => storage);
}
