/**
 * AUTH STORE
 *
 * Handles authentication state and user data.
 * Uses the singleton Supabase client from @/lib/supabase/client
 */

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ============================================
// TIMEOUT HELPER (FIXES TS + "SPINNER KEEPS ROLLING")
// Accept PromiseLike so Postgrest builders work.
// ============================================
async function withTimeout<T>(p: PromiseLike<T>, ms = 8000): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout_${ms}ms`)), ms)),
  ]);
}

// ============================================
// TYPES
// ============================================
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  tier: 'basic' | 'starter' | 'pro' | 'elite' | 'vip';
  balance: number;
  bonusBalance: number;
  totalDeposited: number;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  registrationStatus: 'pending_verification' | 'pending_kyc' | 'pending_wallet' | 'complete';
  walletAddress?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Deposit {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  methodName: string;
  transactionRef?: string;
  proofUrl?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  note?: string;
  createdAt: string;
}

export interface Trade {
  id: string;
  pair: string;
  type: 'buy' | 'sell';
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  exitPrice?: number;
  leverage: number;
  marginUsed: number;
  status: 'open' | 'closed' | 'liquidated';
  pnl: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
  closedAt?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'crypto' | 'bank' | 'processor';
  name: string;
  symbol?: string;
  network?: string;
  address?: string;
  icon?: string;
  minDeposit: number;
  fee?: string;
  enabled: boolean;
}

// ============================================
// HELPERS
// ============================================
function dbRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    phone: row.phone || undefined,
    avatarUrl: row.avatar_url || undefined,
    role: row.role || 'user',
    tier: row.tier || 'basic',
    balance: Number(row.balance_available ?? 0) || 0,
    bonusBalance: Number(row.balance_bonus ?? 0) || 0,
    totalDeposited: Number(row.total_deposited ?? 0) || 0,
    kycStatus: row.kyc_status || 'none',
    registrationStatus: row.registration_status || 'complete',
    walletAddress: row.wallet_address || undefined,
    isActive: row.is_active !== false,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function getRegistrationRedirect(status: User['registrationStatus']): string {
  switch (status) {
    case 'pending_verification':
      return '/auth/verify-otp';
    case 'pending_kyc':
      return '/kyc';
    case 'pending_wallet':
      return '/connect-wallet';
    default:
      return '/dashboard';
  }
}

export function getRegistrationMessage(status: User['registrationStatus']): string {
  switch (status) {
    case 'pending_verification':
      return 'Please verify your email to continue.';
    case 'pending_kyc':
      return 'Please complete identity verification.';
    case 'pending_wallet':
      return 'Connect your wallet to finish setup.';
    default:
      return '';
  }
}

// ============================================
// STORE INTERFACE
// ============================================
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  deposits: Deposit[];
  trades: Trade[];
  paymentMethods: PaymentMethod[];

  login: (email: string, password: string) => Promise<{ success: boolean; redirect?: string; error?: string }>;
  signup: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;

  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  updateRegistrationStatus: (status: User['registrationStatus']) => Promise<boolean>;
  refreshUser: () => Promise<void>;

  loadDeposits: () => Promise<void>;
  loadTrades: () => Promise<void>;
  loadPaymentMethods: () => Promise<void>;
  submitDeposit: (deposit: { amount: number; method: string; methodName: string; transactionRef?: string; proofUrl?: string }) => Promise<boolean>;

  clearError: () => void;
  getBalance: () => { available: number; bonus: number };
}

// ============================================
// CREATE STORE
// ============================================
export const useStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  deposits: [],
  trades: [],
  paymentMethods: [],

  // ==========================================
  // LOGIN
  // ==========================================
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      // Demo mode
      if (!isSupabaseConfigured()) {
        const users = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        const found = users.find((u: any) => u.email === email.toLowerCase() && u.password === password);

        if (!found) return { success: false, error: 'Invalid email or password' };

        const { password: _pw, ...userWithoutPw } = found;
        localStorage.setItem('novatrade_session', JSON.stringify(userWithoutPw));

        set({ user: userWithoutPw, isAuthenticated: true });
        return { success: true, redirect: '/dashboard' };
      }

      // Production mode (timeout so it never hangs)
      const authRes = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 8000);
      const authError = (authRes as any).error;
      const authData = (authRes as any).data;

      if (authError) {
        const msg =
          authError.message === 'Invalid login credentials'
            ? 'Invalid email or password. Please try again.'
            : authError.message;
        set({ error: msg });
        return { success: false, error: msg };
      }

      if (!authData?.user) {
        set({ error: 'Login failed. Please try again.' });
        return { success: false, error: 'Login failed' };
      }

      // Fetch profile (timeout)
      const profileRes = await withTimeout(
        supabase.from('users').select('*').eq('id', authData.user.id).maybeSingle(),
        8000
      );

      const profileError = (profileRes as any).error;
      let profile = (profileRes as any).data;

      if (profileError) {
        const msg = profileError.message || 'Failed to load profile (check RLS policies).';
        set({ error: msg });
        return { success: false, error: msg };
      }

      // If profile missing, create it
      if (!profile) {
        const insertRes = await withTimeout(
          supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: (authData.user.email || email).toLowerCase(),
              first_name: authData.user.user_metadata?.first_name || '',
              last_name: authData.user.user_metadata?.last_name || '',
              role: 'user',
              tier: 'basic',
              balance_available: 0,
              balance_bonus: 0,
              total_deposited: 0,
              kyc_status: 'none',
              registration_status: 'pending_kyc',
              is_active: true,
            })
            .select()
            .single(),
          8000
        );

        const insertError = (insertRes as any).error;
        const newProfile = (insertRes as any).data;

        if (insertError || !newProfile) {
          const msg = insertError?.message || 'Failed to create profile (check RLS policies).';
          set({ error: msg });
          return { success: false, error: msg };
        }

        profile = newProfile;
      }

      // Disabled account
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        set({ error: 'Your account has been disabled.' });
        return { success: false, error: 'Account disabled' };
      }

      const user = dbRowToUser(profile);
      set({ user, isAuthenticated: true });
      return { success: true, redirect: getRegistrationRedirect(user.registrationStatus) };
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please try again.';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  // ==========================================
  // SIGNUP
  // ==========================================
  signup: async (email: string, password: string, firstName?: string, lastName?: string) => {
    set({ isLoading: true, error: null });

    try {
      // Demo mode
      if (!isSupabaseConfigured()) {
        const users = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        if (users.find((u: any) => u.email === email.toLowerCase())) {
          set({ error: 'Email already registered' });
          return { success: false, error: 'Email already registered' };
        }

        const newUser: User = {
          id: `demo_${Date.now()}`,
          email: email.toLowerCase(),
          firstName: firstName || '',
          lastName: lastName || '',
          role: 'user',
          tier: 'basic',
          balance: 0,
          bonusBalance: 0,
          totalDeposited: 0,
          kycStatus: 'none',
          registrationStatus: 'complete',
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        users.push({ ...newUser, password });
        localStorage.setItem('novatrade_users', JSON.stringify(users));
        localStorage.setItem('novatrade_session', JSON.stringify(newUser));

        set({ user: newUser, isAuthenticated: true });
        return { success: true };
      }

      const res = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName || '', last_name: lastName || '' } },
        }),
        8000
      );

      const authError = (res as any).error;
      const authData = (res as any).data;

      if (authError) {
        set({ error: authError.message });
        return { success: false, error: authError.message };
      }

      if (!authData?.user) {
        set({ error: 'Signup failed' });
        return { success: false, error: 'Signup failed' };
      }

      // If session exists, try create profile (don’t block if RLS)
      if (authData.session) {
        await withTimeout(
          supabase.from('users').insert({
            id: authData.user.id,
            email: (authData.user.email || email).toLowerCase(),
            first_name: firstName || '',
            last_name: lastName || '',
            role: 'user',
            tier: 'basic',
            balance_available: 0,
            balance_bonus: 0,
            total_deposited: 0,
            kyc_status: 'none',
            registration_status: 'pending_kyc',
            is_active: true,
          }),
          8000
        ).catch(() => {});
      }

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Signup failed';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  // ==========================================
  // LOGOUT
  // ==========================================
  logout: async () => {
    try {
      if (!isSupabaseConfigured()) {
        localStorage.removeItem('novatrade_session');
      } else {
        await supabase.auth.signOut();
      }
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        deposits: [],
        trades: [],
        paymentMethods: [],
        error: null,
      });
    }
  },

  // ==========================================
  // CHECK SESSION
  // ==========================================
  checkSession: async () => {
    set({ isLoading: true });

    try {
      if (!isSupabaseConfigured()) {
        const session = localStorage.getItem('novatrade_session');
        if (session) set({ user: JSON.parse(session), isAuthenticated: true });
        else set({ user: null, isAuthenticated: false });
        return;
      }

      const sessRes = await withTimeout(supabase.auth.getSession(), 8000);
      const session = (sessRes as any).data?.session;

      if (!session?.user) {
        set({ user: null, isAuthenticated: false });
        return;
      }

      const profileRes = await withTimeout(
        supabase.from('users').select('*').eq('id', session.user.id).maybeSingle(),
        8000
      );

      const error = (profileRes as any).error;
      const profile = (profileRes as any).data;

      if (error) {
        set({ isAuthenticated: true });
        return;
      }

      if (profile) set({ user: dbRowToUser(profile), isAuthenticated: true });
      else set({ isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  // ==========================================
  // UPDATE PROFILE
  // ==========================================
  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) return false;

    try {
      if (!isSupabaseConfigured()) {
        const updatedUser = { ...user, ...updates };
        localStorage.setItem('novatrade_session', JSON.stringify(updatedUser));
        set({ user: updatedUser });
        return true;
      }

      const dbUpdates: any = {};
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
      if (updates.walletAddress !== undefined) dbUpdates.wallet_address = updates.walletAddress;

      const res = await withTimeout(
        supabase.from('users').update(dbUpdates).eq('id', user.id).select().maybeSingle(),
        8000
      );

      const error = (res as any).error;
      if (error) {
        set({ error: error.message || 'Failed to update profile' });
        return false;
      }

      set({ user: { ...user, ...updates } });
      return true;
    } catch {
      return false;
    }
  },

  // ==========================================
  // UPDATE REGISTRATION STATUS
  // ==========================================
  updateRegistrationStatus: async (status) => {
    const { user } = get();
    if (!user) return false;

    try {
      if (!isSupabaseConfigured()) {
        const updatedUser = { ...user, registrationStatus: status };
        localStorage.setItem('novatrade_session', JSON.stringify(updatedUser));
        set({ user: updatedUser });
        return true;
      }

      const res = await withTimeout(
        supabase
          .from('users')
          .update({ registration_status: status, updated_at: new Date().toISOString() })
          .eq('id', user.id)
          .select()
          .maybeSingle(),
        8000
      );

      const error = (res as any).error;
      const data = (res as any).data;

      if (error) {
        set({ error: error.message || 'Failed to update registration status' });
        return false;
      }

      if (data) set({ user: dbRowToUser(data) });
      else set({ user: { ...user, registrationStatus: status } });

      return true;
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update registration status' });
      return false;
    }
  },

  // ==========================================
  // REFRESH USER
  // ==========================================
  refreshUser: async () => {
    const { user } = get();
    if (!user || !isSupabaseConfigured()) return;

    try {
      const res = await withTimeout(supabase.from('users').select('*').eq('id', user.id).maybeSingle(), 8000);
      const data = (res as any).data;
      if (data) set({ user: dbRowToUser(data) });
    } catch {}
  },

  // ==========================================
  // LOAD DEPOSITS
  // ==========================================
  loadDeposits: async () => {
    const { user } = get();
    if (!user || !isSupabaseConfigured()) return;

    const res = await withTimeout(
      supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      8000
    );

    const data = (res as any).data;
    if (data) {
      const deposits: Deposit[] = data.map((d: any) => ({
        id: d.id,
        orderId: d.order_id,
        amount: Number(d.amount) || 0,
        method: d.method,
        methodName: d.method_name,
        transactionRef: d.transaction_ref || undefined,
        proofUrl: d.proof_url || undefined,
        status: d.status,
        note: d.note || undefined,
        createdAt: d.created_at,
      }));
      set({ deposits });
    }
  },

  // ==========================================
  // LOAD TRADES
  // ==========================================
  loadTrades: async () => {
    const { user } = get();
    if (!user || !isSupabaseConfigured()) return;

    const res = await withTimeout(
      supabase.from('trades').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      8000
    );

    const data = (res as any).data;
    if (data) {
      const trades: Trade[] = data.map((t: any) => ({
        id: t.id,
        pair: t.pair,
        type: t.type,
        side: t.side,
        amount: Number(t.amount) || 0,
        entryPrice: Number(t.entry_price) || 0,
        currentPrice: Number(t.current_price ?? t.entry_price) || 0,
        exitPrice: t.exit_price ? Number(t.exit_price) : undefined,
        leverage: t.leverage || 1,
        marginUsed: Number(t.margin_used) || 0,
        status: t.status,
        pnl: Number(t.pnl) || 0,
        stopLoss: t.stop_loss ? Number(t.stop_loss) : undefined,
        takeProfit: t.take_profit ? Number(t.take_profit) : undefined,
        createdAt: t.created_at,
        closedAt: t.closed_at || undefined,
      }));
      set({ trades });
    }
  },

  // ==========================================
  // LOAD PAYMENT METHODS
  // ==========================================
  loadPaymentMethods: async () => {
    if (!isSupabaseConfigured()) return;

    const res = await withTimeout(
      supabase.from('payment_methods').select('*').eq('enabled', true).order('display_order'),
      8000
    );

    const data = (res as any).data;
    if (data) {
      const methods: PaymentMethod[] = data.map((p: any) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        symbol: p.symbol || undefined,
        network: p.network || undefined,
        address: p.address || undefined,
        icon: p.icon || undefined,
        minDeposit: Number(p.min_deposit) || 0,
        fee: p.fee || undefined,
        enabled: !!p.enabled,
      }));
      set({ paymentMethods: methods });
    }
  },

  // ==========================================
  // SUBMIT DEPOSIT
  // ==========================================
  submitDeposit: async (deposit) => {
    const { user } = get();
    if (!user || !isSupabaseConfigured()) return false;

    try {
      const res = await withTimeout(
        supabase.from('deposits').insert({
          user_id: user.id,
          order_id: `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          amount: deposit.amount,
          method: deposit.method,
          method_name: deposit.methodName,
          transaction_ref: deposit.transactionRef,
          proof_url: deposit.proofUrl,
          status: 'pending',
        }),
        8000
      );

      const error = (res as any).error;
      if (error) {
        set({ error: error.message || 'Deposit failed' });
        return false;
      }

      await get().loadDeposits();
      return true;
    } catch {
      return false;
    }
  },

  // ==========================================
  // GET BALANCE
  // ==========================================
  getBalance: () => {
    const { user } = get();
    return { available: user?.balance || 0, bonus: user?.bonusBalance || 0 };
  },

  // ==========================================
  // CLEAR ERROR
  // ==========================================
  clearError: () => set({ error: null }),
}));

// ============================================
// ✅ ADMIN STORE (THIS IS WHAT YOU’RE MISSING)
// ============================================
interface AdminStore {
  isAdmin: boolean;
  pendingDeposits: any[];
  allUsers: any[];
  checkAdminAccess: () => Promise<boolean>;
  loadPendingDeposits: () => Promise<void>;
  loadAllUsers: () => Promise<void>;
  confirmDeposit: (depositId: string, note?: string) => Promise<boolean>;
  rejectDeposit: (depositId: string, note?: string) => Promise<boolean>;
  updateUserBalance: (userId: string, amount: number, type: 'add' | 'subtract') => Promise<boolean>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  isAdmin: false,
  pendingDeposits: [],
  allUsers: [],

  checkAdminAccess: async () => {
    if (!isSupabaseConfigured()) return false;

    const sessRes = await withTimeout(supabase.auth.getSession(), 8000);
    const session = (sessRes as any).data?.session;
    if (!session?.user) return false;

    const res = await withTimeout(
      supabase.from('users').select('role').eq('id', session.user.id).maybeSingle(),
      8000
    );

    const data = (res as any).data;
    const isAdmin = data?.role === 'admin';
    set({ isAdmin });
    return isAdmin;
  },

  loadPendingDeposits: async () => {
    if (!isSupabaseConfigured()) return;

    const res = await withTimeout(
      supabase
        .from('deposits')
        .select('*, users(email, first_name, last_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      8000
    );

    set({ pendingDeposits: (res as any).data || [] });
  },

  loadAllUsers: async () => {
    if (!isSupabaseConfigured()) return;

    const res = await withTimeout(
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      8000
    );

    set({ allUsers: (res as any).data || [] });
  },

  confirmDeposit: async (depositId: string, note?: string) => {
    if (!isSupabaseConfigured()) return false;

    const sessRes = await withTimeout(supabase.auth.getSession(), 8000);
    const session = (sessRes as any).data?.session;
    if (!session?.user) return false;

    const depRes = await withTimeout(
      supabase.from('deposits').select('*').eq('id', depositId).maybeSingle(),
      8000
    );

    const deposit = (depRes as any).data;
    if (!deposit) return false;

    await withTimeout(
      supabase
        .from('deposits')
        .update({
          status: 'confirmed',
          processed_by: session.user.id,
          processed_at: new Date().toISOString(),
          note,
        })
        .eq('id', depositId),
      8000
    );

    const userRes = await withTimeout(
      supabase
        .from('users')
        .select('balance_available, total_deposited')
        .eq('id', deposit.user_id)
        .maybeSingle(),
      8000
    );

    const u = (userRes as any).data;
    if (u) {
      const currentBal = Number(u.balance_available ?? 0);
      const currentDep = Number(u.total_deposited ?? 0);
      const amt = Number(deposit.amount ?? 0);

      await withTimeout(
        supabase
          .from('users')
          .update({
            balance_available: currentBal + amt,
            total_deposited: currentDep + amt,
          })
          .eq('id', deposit.user_id),
        8000
      );
    }

    await get().loadPendingDeposits();
    return true;
  },

  rejectDeposit: async (depositId: string, note?: string) => {
    if (!isSupabaseConfigured()) return false;

    const sessRes = await withTimeout(supabase.auth.getSession(), 8000);
    const session = (sessRes as any).data?.session;
    if (!session?.user) return false;

    await withTimeout(
      supabase
        .from('deposits')
        .update({
          status: 'rejected',
          processed_by: session.user.id,
          processed_at: new Date().toISOString(),
          note,
        })
        .eq('id', depositId),
      8000
    );

    await get().loadPendingDeposits();
    return true;
  },

  updateUserBalance: async (userId: string, amount: number, type: 'add' | 'subtract') => {
    if (!isSupabaseConfigured()) return false;

    const res = await withTimeout(
      supabase.from('users').select('balance_available').eq('id', userId).maybeSingle(),
      8000
    );

    const u = (res as any).data;
    if (!u) return false;

    const current = Number(u.balance_available ?? 0);
    const next = type === 'add' ? current + amount : Math.max(0, current - amount);

    await withTimeout(
      supabase.from('users').update({ balance_available: next }).eq('id', userId),
      8000
    );

    await get().loadAllUsers();
    return true;
  },
}));

// ============================================
// AUTH STATE LISTENER (set up once globally)
// ============================================
if (typeof window !== 'undefined' && isSupabaseConfigured()) {
  const g = globalThis as any;
  if (!g.__novatrade_auth_listener__) {
    g.__novatrade_auth_listener__ = true;

    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        useStore.setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          deposits: [],
          trades: [],
          paymentMethods: [],
          error: null,
        });
      }
    });
  }
}

// Re-export supabase client and helper for backwards compatibility
export { supabase, isSupabaseConfigured };
