/**
 * SUPABASE SERVICES INDEX
 * 
 * Import everything from this file:
 * 
 *   import { useStore, useAdminStore, supabase } from '@/lib/supabase';
 * 
 * Or import specific services:
 * 
 *   import { depositService, tradeService } from '@/lib/supabase';
 */

// Core client
export { supabase, isSupabaseConfigured, createServerSupabaseClient } from './supabase-client';

// Main stores (use these in components)
export { useStore, useAdminStore } from './store-supabase';

// Individual services (for advanced use)
export { 
  balanceService,
  depositService,
  withdrawalService,
  tradeService,
  paymentMethodService,
  userService,
  settingsService,
} from './supabase-db';

// Auth service
export { authService, adminAuthService } from './supabase-auth';

// Admin market control
export {
  customPairsService,
  priceOverrideService,
  tradingSessionService,
  tradeOutcomeService,
  marketPatternService,
  adminLogService,
  marketSubscriptions,
} from './admin-markets-supabase';

// Types
export type { User, Deposit, Trade, PaymentMethod } from './store-supabase';
