/**
 * UNIFIED SUPABASE STORE - COMPATIBILITY LAYER
 *
 * This file now re-exports from the new simplified auth store.
 * For new code, import directly from '@/lib/auth/store'.
 *
 * Usage:
 *   import { useStore } from '@/lib/supabase/store-supabase';
 *   const { user, balance, login, logout, ... } = useStore();
 */

// Re-export everything from the new auth store for backwards compatibility
export {
  useStore,
  useAdminStore,
  supabase,
  isSupabaseConfigured,
  getRegistrationRedirect,
  getRegistrationMessage,
  type User,
  type Deposit,
  type Trade,
  type PaymentMethod,
} from '@/lib/auth/store';

export type RegistrationStatus =
  | 'pending_verification'
  | 'pending_kyc'
  | 'pending_wallet'
  | 'complete';

// Legacy re-exports - keeping this file mostly for backwards compatibility
// The actual implementation is now in @/lib/auth/store.ts

/* 
==========================================================
LEGACY CODE BELOW - KEPT FOR REFERENCE ONLY
==========================================================
The code below is the original implementation and is no longer used.
It's kept here as documentation of the previous approach.

*/

