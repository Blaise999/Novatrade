/**
 * COMPATIBILITY LAYER
 * 
 * This file re-exports from the new auth store for backwards compatibility.
 * New code should import directly from '@/lib/auth/store'.
 */

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
