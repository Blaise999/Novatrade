'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type KYCStep = 1 | 2 | 3 | 4 | 5;

export type KYCData = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;

  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  idType?: 'passport' | 'drivers_license' | 'national_id';
  idNumber?: string;

  [key: string]: any;
};

type KYCStore = {
  currentStep: KYCStep;
  data: KYCData;
  isSubmitting: boolean;

  setStep: (step: number) => void;          // ✅ accepts number (fixes TS2345)
  updateData: (patch: Partial<KYCData>) => void;
  setSubmitting: (v: boolean) => void;

  reset: () => void;
};

type KYCPersisted = Pick<KYCStore, 'currentStep' | 'data'>;

const clampStep = (n: number): KYCStep => {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as KYCStep; // 2..4
};

// ✅ IMPORTANT: only define storage on the client.
// This avoids `PersistStorage<...> | undefined` being passed directly.
const clientStorage =
  typeof window !== 'undefined'
    ? createJSONStorage<KYCPersisted>(() => sessionStorage)
    : undefined;

export const useKYCStore = create<KYCStore>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      data: {},
      isSubmitting: false,

      setStep: (step) => set({ currentStep: clampStep(step) }),

      updateData: (patch) =>
        set({
          data: { ...get().data, ...patch },
        }),

      setSubmitting: (v) => set({ isSubmitting: v }),

      reset: () =>
        set({
          currentStep: 1,
          data: {},
          isSubmitting: false,
        }),
    }),
    {
      name: 'novatrade_kyc_store',
      version: 1,

      // ✅ persist only what you want stored (matches KYCPersisted)
      partialize: (state): KYCPersisted => ({
        currentStep: state.currentStep,
        data: state.data,
      }),

      // ✅ ONLY include storage if it exists (fixes TS2322)
      ...(clientStorage ? { storage: clientStorage } : {}),

      // ✅ safety: never keep submit spinner after refresh
      onRehydrateStorage: () => (state) => {
        if (state) state.setSubmitting(false);
      },
    }
  )
);
