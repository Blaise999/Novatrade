'use client';

/**
 * ✅ NOVATRADE SINGLE STORE ENTRYPOINT (FULL BACK-COMPAT)
 *
 * This file MUST be at: /lib/store.ts
 * Your imports:
 *   import { useAuthStore, useUIStore, useWalletStore, useKYCStore, useNotificationStore } from "@/lib/store";
 *
 * This provides:
 * - useAuthStore (alias of useStore)
 * - useUIStore, useNotificationStore, useWalletStore, useKYCStore, useTradingStore, useAdminStore
 * - legacy fields: otpEmail/otpName/otpPassword/redirectUrl, unreadCount, mobileMenuOpen, isConnected, etc.
 */

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ============================================
// TIMEOUT HELPER (Accept PromiseLike so Postgrest builders work)
// ============================================
async function withTimeout<T>(p: PromiseLike<T>, ms = 8000): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout_${ms}ms`)), ms)),
  ]);
}

// ============================================
// TYPES (WIDENED FOR BACK-COMPAT)
// ============================================
export type RegistrationStatus =
  | 'pending_verification'
  | 'pending_kyc'
  | 'pending_wallet'
  | 'complete';

export type KycStatus =
  | 'none'
  | 'not_started'
  | 'pending'
  | 'in_review'
  | 'verified'
  | 'approved'
  | 'rejected'
  | 'declined'
  | string;

export type Balance = {
  available?: number;
  bonus?: number;
  total?: number;
  currency?: string;
  [key: string]: any;
};

export interface User {
  id: string;
  email: string;

  // legacy variants
  firstName?: string;
  lastName?: string;
  name?: string;

  emailVerified?: boolean;
  phoneVerified?: boolean;

  kycStatus?: KycStatus;
  kycLevel?: number;

  walletConnected?: boolean;
  walletAddress?: string;

  twoFactorEnabled?: boolean;
  currency?: string;

  role?: 'user' | 'admin' | string;
  tier?: 'basic' | 'starter' | 'pro' | 'elite' | 'vip' | string;

  // common profile fields some pages use
  phone?: string;
  avatarUrl?: string;

  /**
   * Some pages expect numeric user.balance,
   * others used an object. We store:
   * - user.balance as number (available)
   * - user.balanceDetails as object
   */
  balance?: any; // number or object accepted
  balanceDetails?: Balance;

  bonusBalance?: number;
  totalDeposited?: number;

  registrationStatus?: RegistrationStatus | string;
  isActive?: boolean;

  createdAt?: string | Date;

  // allow unknown props (prevents TS2353 in UI)
  [key: string]: any;
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
export function getRegistrationRedirect(status: RegistrationStatus): string {
  switch (status) {
    case 'pending_verification':
      return '/auth/verify-otp';
    case 'pending_kyc':
      return '/kyc';
    case 'pending_wallet':
      return '/dashboard/connect-wallet';
    default:
      return '/dashboard';
  }
}

export function getRegistrationMessage(status: RegistrationStatus): string {
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

function normalizeBalance(input: any): Balance {
  if (typeof input === 'number') return { available: input, bonus: 0 };

  if (input && typeof input === 'object') {
    return {
      available: Number(input.available ?? input.balance_available ?? 0) || 0,
      bonus: Number(input.bonus ?? input.bonusBalance ?? input.balance_bonus ?? 0) || 0,
      total: input.total != null ? Number(input.total) : undefined,
      currency: input.currency ?? undefined,
      ...input,
    };
  }

  return { available: 0, bonus: 0 };
}

function normalizeUser(input: any): User {
  const u = (input ?? {}) as any;

  const email = String(u.email ?? '').toLowerCase();
  const firstName = u.firstName ?? u.first_name ?? undefined;
  const lastName = u.lastName ?? u.last_name ?? undefined;

  const name =
    u.name ??
    (firstName || lastName ? `${firstName ?? ''} ${lastName ?? ''}`.trim() : undefined);

  const details = normalizeBalance(u.balanceDetails ?? u.balance ?? u.balance_available ?? 0);
  const availableNum = Number(details.available ?? 0) || 0;

  const bonusBalance =
    u.bonusBalance != null
      ? Number(u.bonusBalance) || 0
      : Number(details.bonus ?? u.balance_bonus ?? 0) || 0;

  return {
    // keep any unknown props first (legacy)
    ...u,

    id: String(u.id ?? ''),
    email,

    firstName,
    lastName,
    name,

    emailVerified: u.emailVerified ?? u.email_verified ?? false,
    phoneVerified: u.phoneVerified ?? u.phone_verified ?? false,

    kycStatus: u.kycStatus ?? u.kyc_status ?? 'not_started',
    kycLevel: u.kycLevel ?? u.kyc_level ?? 0,

    walletConnected:
      u.walletConnected ??
      u.wallet_connected ??
      Boolean(u.walletAddress ?? u.wallet_address),

    walletAddress: u.walletAddress ?? u.wallet_address ?? undefined,

    twoFactorEnabled: u.twoFactorEnabled ?? u.two_factor_enabled ?? false,
    currency: u.currency ?? details.currency ?? 'USD',

    role: u.role ?? 'user',
    tier: u.tier ?? 'basic',

    // ✅ stable numeric balance for app
    balance: availableNum,
    // ✅ keep object too
    balanceDetails: details,

    bonusBalance,
    totalDeposited: Number(u.totalDeposited ?? u.total_deposited ?? 0) || 0,

    registrationStatus: u.registrationStatus ?? u.registration_status ?? 'complete',
    isActive: u.isActive ?? u.is_active ?? true,

    createdAt: u.createdAt ?? u.created_at ?? new Date().toISOString(),
  };
}

function dbRowToUser(row: any): User {
  return normalizeUser({
    ...row,
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    role: row.role,
    tier: row.tier,
    balanceDetails: {
      available: Number(row.balance_available ?? 0) || 0,
      bonus: Number(row.balance_bonus ?? 0) || 0,
    },
    bonusBalance: Number(row.balance_bonus ?? 0) || 0,
    totalDeposited: Number(row.total_deposited ?? 0) || 0,
    kycStatus: row.kyc_status,
    registrationStatus: row.registration_status,
    walletAddress: row.wallet_address,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  });
}

// ============================================
// AUTH STORE INTERFACE
// ============================================
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // legacy OTP temp fields
  otpEmail: string;
  otpName: string;
  otpPassword: string;
  redirectUrl: string;

  setOtpEmail: (email: string | null) => void;
  setOtpName: (name: string | null) => void;
  setOtpPassword: (password: string | null) => void;
  setRedirectUrl: (url: string | null) => void;

  setUser: (user: any) => void;

  deposits: Deposit[];
  trades: Trade[];
  paymentMethods: PaymentMethod[];

  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; redirect?: string; error?: string }>;

  signup: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => Promise<{ success: boolean; error?: string }>;

  logout: () => Promise<void>;
  checkSession: () => Promise<void>;

  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  updateRegistrationStatus: (status: RegistrationStatus) => Promise<boolean>;
  updateKycStatus: (status: KycStatus) => Promise<boolean>;

  refreshUser: () => Promise<void>;

  loadDeposits: () => Promise<void>;
  loadTrades: () => Promise<void>;
  loadPaymentMethods: () => Promise<void>;

  submitDeposit: (deposit: {
    amount: number;
    method: string;
    methodName: string;
    transactionRef?: string;
    proofUrl?: string;
  }) => Promise<boolean>;

  clearError: () => void;
  getBalance: () => { available: number; bonus: number };
}

// ============================================
// AUTH STORE
// ============================================
export const useStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  otpEmail: '',
  otpName: '',
  otpPassword: '',
  redirectUrl: '',

  setOtpEmail: (email) => set({ otpEmail: email ?? '' }),
  setOtpName: (name) => set({ otpName: name ?? '' }),
  setOtpPassword: (password) => set({ otpPassword: password ?? '' }),
  setRedirectUrl: (url) => set({ redirectUrl: url ?? '' }),

  setUser: (user) =>
    set({
      user: user ? normalizeUser(user) : null,
      isAuthenticated: !!user,
    }),

  deposits: [],
  trades: [],
  paymentMethods: [],

  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        const users = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        const found = users.find(
          (u: any) => u.email === email.toLowerCase() && u.password === password
        );
        if (!found) return { success: false, error: 'Invalid email or password' };

        const { password: _pw, ...userWithoutPw } = found;
        localStorage.setItem('novatrade_session', JSON.stringify(userWithoutPw));

        set({ user: normalizeUser(userWithoutPw), isAuthenticated: true });
        return { success: true, redirect: '/dashboard' };
      }

      const authRes = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        8000
      );

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

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        set({ error: 'Your account has been disabled.' });
        return { success: false, error: 'Account disabled' };
      }

      const user = dbRowToUser(profile);
      set({ user, isAuthenticated: true });

      const status = (user.registrationStatus as RegistrationStatus) || 'complete';
      return { success: true, redirect: getRegistrationRedirect(status) };
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please try again.';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (email, password, firstName, lastName) => {
    set({ isLoading: true, error: null });

    try {
      if (!isSupabaseConfigured()) {
        const users = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        if (users.find((u: any) => u.email === email.toLowerCase())) {
          set({ error: 'Email already registered' });
          return { success: false, error: 'Email already registered' };
        }

        const newUser = normalizeUser({
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
        });

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

      return { success: true };
    } catch (err: any) {
      const msg = err?.message || 'Signup failed';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      if (!isSupabaseConfigured()) localStorage.removeItem('novatrade_session');
      else await supabase.auth.signOut();
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        deposits: [],
        trades: [],
        paymentMethods: [],
        error: null,
        otpEmail: '',
        otpName: '',
        otpPassword: '',
        redirectUrl: '',
      });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });

    try {
      if (!isSupabaseConfigured()) {
        const session = localStorage.getItem('novatrade_session');
        if (session) set({ user: normalizeUser(JSON.parse(session)), isAuthenticated: true });
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

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return false;

    try {
      if (!isSupabaseConfigured()) {
        const updated = normalizeUser({ ...user, ...updates });
        localStorage.setItem('novatrade_session', JSON.stringify(updated));
        set({ user: updated });
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
      const data = (res as any).data;

      if (error) {
        set({ error: error.message || 'Failed to update profile' });
        return false;
      }

      if (data) set({ user: dbRowToUser(data) });
      else set({ user: normalizeUser({ ...user, ...updates }) });

      return true;
    } catch {
      return false;
    }
  },

  updateRegistrationStatus: async (status) => {
    const { user } = get();
    if (!user) return false;

    try {
      if (!isSupabaseConfigured()) {
        const updated = normalizeUser({ ...user, registrationStatus: status });
        localStorage.setItem('novatrade_session', JSON.stringify(updated));
        set({ user: updated });
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
      else set({ user: normalizeUser({ ...user, registrationStatus: status }) });

      return true;
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update registration status' });
      return false;
    }
  },

  updateKycStatus: async (status) => {
    const { user } = get();
    if (!user) return false;

    try {
      const currentReg = (user.registrationStatus as RegistrationStatus) || 'complete';
      const nextRegistrationStatus: RegistrationStatus =
        (status === 'verified' || status === 'approved') && currentReg === 'pending_kyc'
          ? 'pending_wallet'
          : currentReg;

      if (!isSupabaseConfigured()) {
        const updated = normalizeUser({
          ...user,
          kycStatus: status,
          registrationStatus: nextRegistrationStatus,
        });
        localStorage.setItem('novatrade_session', JSON.stringify(updated));
        set({ user: updated });
        return true;
      }

      const res = await withTimeout(
        supabase
          .from('users')
          .update({
            kyc_status: status,
            registration_status: nextRegistrationStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select()
          .maybeSingle(),
        8000
      );

      const error = (res as any).error;
      const data = (res as any).data;

      if (error) {
        set({ error: error.message || 'Failed to update KYC status' });
        return false;
      }

      if (data) set({ user: dbRowToUser(data) });
      else {
        set({
          user: normalizeUser({
            ...user,
            kycStatus: status,
            registrationStatus: nextRegistrationStatus,
          }),
        });
      }

      return true;
    } catch (e: any) {
      set({ error: e?.message || 'Failed to update KYC status' });
      return false;
    }
  },

  refreshUser: async () => {
    const { user } = get();
    if (!user || !isSupabaseConfigured()) return;

    try {
      const res = await withTimeout(
        supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
        8000
      );
      const data = (res as any).data;
      if (data) set({ user: dbRowToUser(data) });
    } catch {}
  },

  loadDeposits: async () => {
    const { user } = get();
    if (!user || !isSupabaseConfigured()) return;

    const res = await withTimeout(
      supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
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

  loadTrades: async () => {
    const { user } = get();
    if (!user || !isSupabaseConfigured()) return;

    const res = await withTimeout(
      supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
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

      // keep trading legacy arrays in sync
      useTradingStore.setState({
        tradeHistory: trades,
        activeTrades: trades.filter((x) => x.status === 'open'),
      });
    }
  },

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

  getBalance: () => {
    const user = get().user;
    const details = normalizeBalance(user?.balanceDetails ?? user?.balance);
    return {
      available: Number(details.available ?? user?.balance ?? 0) || 0,
      bonus: Number(details.bonus ?? user?.bonusBalance ?? 0) || 0,
    };
  },

  clearError: () => set({ error: null }),
}));

// ============================================
// ADMIN STORE
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

  confirmDeposit: async (depositId, note) => {
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

  rejectDeposit: async (depositId, note) => {
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

  updateUserBalance: async (userId, amount, type) => {
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
// UI STORE
// ============================================
type ThemeMode = 'light' | 'dark' | 'system';

interface UIStore {
  sidebarOpen: boolean;

  mobileMenuOpen: boolean; // legacy
  toggleMobileMenu: () => void;

  mobileNavOpen: boolean;
  toggleMobileNav: () => void;

  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  setMobileMenuOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarOpen: true,

  mobileMenuOpen: false,
  mobileNavOpen: false,

  toggleMobileMenu: () => {
    const next = !get().mobileMenuOpen;
    set({ mobileMenuOpen: next, mobileNavOpen: next });
  },

  toggleMobileNav: () => {
    const next = !get().mobileNavOpen;
    set({ mobileNavOpen: next, mobileMenuOpen: next });
  },

  theme: 'system',
  setTheme: (theme) => set({ theme }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open, mobileNavOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open, mobileMenuOpen: open }),
}));

// ============================================
// NOTIFICATION STORE
// ============================================
export type AppNotificationType = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title?: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;

  addNotification: (
    n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & Partial<Pick<AppNotification, 'read'>>
  ) => string;

  markRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

function calcUnread(list: AppNotification[]) {
  return list.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) => {
    const id = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const next: AppNotification = {
      id,
      type: n.type,
      title: n.title,
      message: n.message,
      createdAt: new Date().toISOString(),
      read: n.read ?? false,
    };
    const list = [next, ...get().notifications];
    set({ notifications: list, unreadCount: calcUnread(list) });
    return id;
  },

  markRead: (id) => {
    const list = get().notifications.map((x) => (x.id === id ? { ...x, read: true } : x));
    set({ notifications: list, unreadCount: calcUnread(list) });
  },

  removeNotification: (id) => {
    const list = get().notifications.filter((x) => x.id !== id);
    set({ notifications: list, unreadCount: calcUnread(list) });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

// ============================================
// WALLET STORE
// ============================================
interface WalletStore {
  connected: boolean;
  isConnected: boolean; // legacy
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

// ============================================
// KYC STORE
// ============================================
export interface KycFormData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  country?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  documentType?: 'passport' | 'drivers_license' | 'national_id' | 'other';
  documentNumber?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
  selfieUrl?: string;
}

interface KYCStore {
  step: number;
  currentStep: number; // legacy
  data: KycFormData;

  submitting: boolean;
  isSubmitting: boolean; // legacy
  setSubmitting: (v: boolean) => void; // legacy

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
      const ok = await useStore.getState().updateKycStatus('pending');
      return ok;
    } finally {
      set({ submitting: false, isSubmitting: false });
    }
  },
}));

// ============================================
// TRADING STORE
// ============================================
type MarketType = 'fx' | 'crypto' | 'stocks';

export interface PortfolioPosition {
  id: string;
  symbol: string;
  market: MarketType;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
}

interface TradingStore {
  market: MarketType;
  selectedSymbol: string | null;

  positions: PortfolioPosition[];
  loading: boolean;

  tradeHistory: Trade[]; // legacy
  activeTrades: Trade[]; // legacy

  setMarket: (m: MarketType) => void;
  setSelectedSymbol: (s: string | null) => void;

  setTradeHistory: (t: Trade[]) => void;
  setActiveTrades: (t: Trade[]) => void;

  loadPositions: () => Promise<void>;
  clear: () => void;
}

export const useTradingStore = create<TradingStore>((set, get) => ({
  market: 'crypto',
  selectedSymbol: null,

  positions: [],
  loading: false,

  tradeHistory: [],
  activeTrades: [],

  setMarket: (m) => set({ market: m }),
  setSelectedSymbol: (s) => set({ selectedSymbol: s }),

  setTradeHistory: (t) => set({ tradeHistory: t }),
  setActiveTrades: (t) => set({ activeTrades: t }),

  loadPositions: async () => {
    const auth = useStore.getState().user;
    if (!auth || !isSupabaseConfigured()) return;

    set({ loading: true });
    try {
      const res = await withTimeout(
        supabase.from('positions' as any).select('*').eq('user_id', auth.id),
        8000
      );
      const data = (res as any).data;
      if (Array.isArray(data)) {
        const mapped: PortfolioPosition[] = data.map((p: any) => ({
          id: p.id,
          symbol: p.symbol,
          market: (p.market as MarketType) || 'crypto',
          quantity: Number(p.quantity ?? 0) || 0,
          avgPrice: Number(p.avg_price ?? 0) || 0,
          currentPrice: Number(p.current_price ?? p.avg_price ?? 0) || 0,
          pnl: Number(p.pnl ?? 0) || 0,
        }));
        set({ positions: mapped });
      }
    } catch {
      // ignore
    } finally {
      set({ loading: false });
    }
  },

  clear: () =>
    set({
      positions: [],
      selectedSymbol: null,
      loading: false,
      tradeHistory: [],
      activeTrades: [],
    }),
}));

// ============================================
// AUTH STATE LISTENER (only once)
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
          otpEmail: '',
          otpName: '',
          otpPassword: '',
          redirectUrl: '',
        });

        useWalletStore.setState({ connected: false, isConnected: false, address: null, chainId: null });
        useTradingStore.setState({
          market: 'crypto',
          selectedSymbol: null,
          positions: [],
          loading: false,
          tradeHistory: [],
          activeTrades: [],
        });
      }
    });
  }
}

// ============================================
// ✅ REQUIRED EXPORTS FOR YOUR APP IMPORTS
// ============================================

// main auth store alias
export const useAuthStore = useStore;

// also export supabase helpers (some files expect these from store)
export { supabase, isSupabaseConfigured };
