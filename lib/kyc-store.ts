/**
 * KYC STORE — standalone file
 * KYC form state and submission
 */
import { create } from 'zustand';

export interface KycFormData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;

  country?: string;
  nationality?: string;

  city?: string;
  state?: string;

  address?: string;
  addressLine1?: string;
  addressLine2?: string;

  postalCode?: string;

  idType?: 'passport' | 'drivers_license' | 'national_id' | 'other';
  idNumber?: string;

  documentType?: 'passport' | 'drivers_license' | 'national_id' | 'other';
  documentNumber?: string;

  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;

  [key: string]: any;
}

interface KYCStore {
  step: number;
  currentStep: number;
  data: KycFormData;

  submitting: boolean;
  isSubmitting: boolean;
  setSubmitting: (v: boolean) => void;

  setStep: (step: number) => void;
  updateData: (patch: Partial<KycFormData>) => void;
  reset: () => void;

  submitKyc: () => Promise<boolean>;
}

export const useKYCStore = create<KYCStore>((set, get) => ({
  step: 1,
  currentStep: 1,
  data: {},

  submitting: false,
  isSubmitting: false,

  setSubmitting: (v) => set({ submitting: v, isSubmitting: v }),

  setStep: (step) => set({ step, currentStep: step }),
  updateData: (patch) => set({ data: { ...get().data, ...patch } }),
  reset: () =>
    set({
      step: 1,
      currentStep: 1,
      data: {},
      submitting: false,
      isSubmitting: false,
    }),

  submitKyc: async () => {
    set({ submitting: true, isSubmitting: true });
    try {
      // Lazy import to avoid circular dependency with main store
      const { useStore } = await import('@/lib/store');
      const ok = await useStore.getState().updateKycStatus('pending');
      return ok;
    } finally {
      set({ submitting: false, isSubmitting: false });
    }
  },
}));
