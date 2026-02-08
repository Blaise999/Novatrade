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
  type RegistrationStatus,  // ✅ re-export
  type KycStatus,           // ✅ re-export
} from '@/lib/auth/store';



