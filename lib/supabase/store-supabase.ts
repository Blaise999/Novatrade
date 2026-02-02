/**
 * UNIFIED SUPABASE STORE
 *
 * This replaces ALL localStorage-based stores.
 * Everything is now saved to Supabase database.
 *
 * Usage:
 *   import { useStore } from '@/lib/supabase/store-supabase';
 *   const { user, balance, login, logout, ... } = useStore();
 */

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from './supabase-client';

// ============================================
// TYPES
// ============================================

export type RegistrationStatus =
  | 'pending_verification' // Step 1: Email not yet verified
  | 'pending_kyc' // Step 2: Email verified, KYC not done
  | 'pending_wallet' // Step 3: KYC done, wallet not connected
  | 'complete'; // Step 4: Fully registered

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  role: 'user' | 'admin';
  tier: 'basic' | 'starter' | 'pro' | 'elite' | 'vip';
  balance: number;
  bonusBalance: number;
  totalDeposited: number;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  registrationStatus: RegistrationStatus;
  walletAddress?: string;
  isActive: boolean;
  createdAt: string;
}

// Helper to get redirect path based on registration status
export function getRegistrationRedirect(status: RegistrationStatus): string {
  switch (status) {
    case 'pending_verification':
      return '/auth/verify-otp';
    case 'pending_kyc':
      return '/kyc';
    case 'pending_wallet':
      return '/connect-wallet';
    case 'complete':
    default:
      return '/dashboard';
  }
}

// Helper to get friendly message for incomplete registration
export function getRegistrationMessage(status: RegistrationStatus): string {
  switch (status) {
    case 'pending_verification':
      return 'Please verify your email to continue registration.';
    case 'pending_kyc':
      return 'Welcome back! Please complete your identity verification.';
    case 'pending_wallet':
      return 'Almost there! Connect your wallet to finish setup.';
    case 'complete':
    default:
      return '';
  }
}

export interface Deposit {
  id: string;
  orderId: string;
  amount: number;
  method: 'crypto' | 'bank' | 'processor';
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
  accountName?: string;
  accountNumber?: string;
  icon?: string;
  minDeposit: number;
  fee?: string;
  enabled: boolean;
}

// ============================================
// STORE STATE
// ============================================

interface StoreState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Data
  deposits: Deposit[];
  trades: Trade[];
  paymentMethods: PaymentMethod[];

  // Auth Actions
  login: (email: string, password: string) => Promise<{ success: boolean; redirect?: string }>;
  signup: (email: string, password: string, firstName?: string, lastName?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  updateKycStatus: (status: User['kycStatus']) => Promise<boolean>;
  updateRegistrationStatus: (status: RegistrationStatus) => Promise<boolean>;

  // Balance Actions
  getBalance: () => Promise<{ available: number; bonus: number }>;

  // Deposit Actions
  loadDeposits: () => Promise<void>;
  submitDeposit: (deposit: {
    amount: number;
    method: 'crypto' | 'bank' | 'processor';
    methodName: string;
    transactionRef?: string;
    proofUrl?: string;
  }) => Promise<boolean>;

  // Trade Actions
  loadTrades: () => Promise<void>;
  openTrade: (trade: {
    pair: string;
    type: 'buy' | 'sell';
    side: 'long' | 'short';
    amount: number;
    entryPrice: number;
    leverage?: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => Promise<Trade | null>;
  closeTrade: (tradeId: string, exitPrice: number) => Promise<boolean>;

  // Payment Methods
  loadPaymentMethods: () => Promise<void>;

  // Utility
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

// ============================================
// HELPER: Convert DB row to User
// ============================================

function dbToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role || 'user',
    tier: row.tier || 'basic',
    balance: parseFloat(row.balance_available) || 0,
    bonusBalance: parseFloat(row.balance_bonus) || 0,
    totalDeposited: parseFloat(row.total_deposited) || 0,
    kycStatus: row.kyc_status || 'none',
    registrationStatus: row.registration_status || 'complete',
    walletAddress: row.wallet_address || undefined,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  };
}

// ============================================
// CREATE STORE
// ============================================

export const useStore = create<StoreState>((set, get) => ({
  // Initial State
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  deposits: [],
  trades: [],
  paymentMethods: [],

  // ==========================================
  // AUTH ACTIONS
  // ==========================================

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      // DEMO MODE
      if (!isSupabaseConfigured()) {
        console.log('📦 Demo mode: Using localStorage for login');

        const existingUsers = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        const found = existingUsers.find(
          (u: any) => u.email === email.toLowerCase() && u.password === password
        );

        if (!found) {
          set({ isLoading: false, error: 'Invalid email or password' });
          return { success: false };
        }

        const { password: _pw, ...userWithoutPassword } = found;
        localStorage.setItem('novatrade_current_user', JSON.stringify(userWithoutPassword));

        set({ user: userWithoutPassword, isAuthenticated: true, isLoading: false });

        const redirect = getRegistrationRedirect(userWithoutPassword.registrationStatus || 'complete');
        return { success: true, redirect };
      }

      // PRODUCTION MODE: Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        set({ isLoading: false, error: authError.message });
        return { success: false };
      }

      if (!authData.user) {
        set({ isLoading: false, error: 'Login failed' });
        return { success: false };
      }

      // ✅ Safe profile fetch (never throws on 0 rows)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      // ✅ If profile missing, create it and RETURN immediately (no fallthrough)
      if (!userData) {
        const metadata = authData.user.user_metadata || {};

        const { data: newUser, error: newUserError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: (authData.user.email || email).toLowerCase(),
            first_name: metadata.first_name || '',
            last_name: metadata.last_name || '',
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
          .single();

        if (newUserError || !newUser) {
          set({
            isLoading: false,
            error: newUserError?.message || userError?.message || 'Failed to create profile',
          });
          return { success: false };
        }

        const user = dbToUser(newUser);
        set({ user, isAuthenticated: true, isLoading: false });
        return { success: true, redirect: getRegistrationRedirect(user.registrationStatus) };
      }

      // Now it’s guaranteed userData exists
      if (!userData.is_active) {
        await supabase.auth.signOut();
        set({ isLoading: false, error: 'Account is disabled' });
        return { success: false };
      }

      const user = dbToUser(userData);
      set({ user, isAuthenticated: true, isLoading: false });
      return { success: true, redirect: getRegistrationRedirect(user.registrationStatus) };
    } catch (err: any) {
      set({ isLoading: false, error: err?.message || 'Login failed' });
      return { success: false };
    }
  },

  signup: async (email: string, password: string, firstName?: string, lastName?: string) => {
    set({ isLoading: true, error: null });

    try {
      // DEMO MODE
      if (!isSupabaseConfigured()) {
        console.log('📦 Demo mode: Using localStorage for signup');

        const existingUsers = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        if (existingUsers.find((u: any) => u.email === email.toLowerCase())) {
          set({ error: 'Email already registered. Please login.' });
          return false;
        }

        const newUser: User = {
          id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          email: email.toLowerCase(),
          firstName: firstName || '',
          lastName: lastName || '',
          role: 'user',
          tier: 'basic',
          balance: 0,
          bonusBalance: 0,
          totalDeposited: 0,
          kycStatus: 'none',
          registrationStatus: 'pending_kyc',
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        existingUsers.push({ ...newUser, password });
        localStorage.setItem('novatrade_users', JSON.stringify(existingUsers));
        localStorage.setItem('novatrade_current_user', JSON.stringify(newUser));

        set({ user: newUser, isAuthenticated: true });
        return true;
      }

      // PRODUCTION MODE
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName || '',
            last_name: lastName || '',
          },
        },
      });

      if (authError) {
        set({ error: authError.message });
        return false;
      }

      if (!authData.user) {
        set({ error: 'Signup failed' });
        return false;
      }

      // If session exists, we can create profile immediately
      if (authData.session) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
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
          })
          .select()
          .single();

        // If profile insert fails, don’t hang — just return true (auth user still created)
        if (userError || !userData) {
          console.error('Profile creation error:', userError);
          return true;
        }

        set({ user: dbToUser(userData), isAuthenticated: true });
        return true;
      }

      // No session = email confirmation required
      // Don’t hang. Just finish and let login() handle profile creation after confirmation.
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Signup failed' });
      return false;
    } finally {
      // ✅ GUARANTEE: never stays loading
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      if (!isSupabaseConfigured()) {
        localStorage.removeItem('novatrade_current_user');
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
        error: null,
      });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });

    try {
      if (!isSupabaseConfigured()) {
        const storedUser = localStorage.getItem('novatrade_current_user');
        if (storedUser) {
          set({ user: JSON.parse(storedUser), isAuthenticated: true, isLoading: false });
        } else {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
        return;
      }

      const { data: sessionRes } = await supabase.auth.getSession();
      const session = sessionRes.session;

      if (!session?.user) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // ✅ Safe fetch
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        set({ isAuthenticated: true, isLoading: false });
        return;
      }

      // If profile missing on refresh, create it safely (prevents weird “logged in but no profile”)
      if (!userData) {
        const metadata = session.user.user_metadata || {};

        const { data: newUser, error: newUserError } = await supabase
          .from('users')
          .insert({
            id: session.user.id,
            email: (session.user.email || '').toLowerCase(),
            first_name: metadata.first_name || '',
            last_name: metadata.last_name || '',
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
          .single();

        if (newUserError || !newUser) {
          set({ isAuthenticated: true, isLoading: false });
          return;
        }

        set({ user: dbToUser(newUser), isAuthenticated: true, isLoading: false });
        return;
      }

      set({ user: dbToUser(userData), isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) return false;

    try {
      if (!isSupabaseConfigured()) {
        const updatedUser = { ...user, ...updates };
        localStorage.setItem('novatrade_current_user', JSON.stringify(updatedUser));

        const existingUsers = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        const idx = existingUsers.findIndex((u: any) => u.id === user.id);
        if (idx >= 0) {
          existingUsers[idx] = { ...existingUsers[idx], ...updates };
          localStorage.setItem('novatrade_users', JSON.stringify(existingUsers));
        }

        set({ user: updatedUser });
        return true;
      }

      const { error } = await supabase
        .from('users')
        .update({
          first_name: updates.firstName,
          last_name: updates.lastName,
          phone: updates.phone,
          avatar_url: updates.avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) return false;

      await get().refreshUser();
      return true;
    } catch {
      return false;
    }
  },

  updateKycStatus: async (status: User['kycStatus']) => {
    const { user } = get();
    if (!user) return false;

    try {
      if (!isSupabaseConfigured()) {
        const updatedUser = { ...user, kycStatus: status };
        localStorage.setItem('novatrade_current_user', JSON.stringify(updatedUser));

        const existingUsers = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        const idx = existingUsers.findIndex((u: any) => u.id === user.id);
        if (idx >= 0) {
          existingUsers[idx].kycStatus = status;
          localStorage.setItem('novatrade_users', JSON.stringify(existingUsers));
        }

        set({ user: updatedUser });
        return true;
      }

      const { error } = await supabase
        .from('users')
        .update({ kyc_status: status, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) return false;

      await get().refreshUser();
      return true;
    } catch {
      return false;
    }
  },

  updateRegistrationStatus: async (status: RegistrationStatus) => {
    const { user } = get();
    if (!user) return false;

    try {
      if (!isSupabaseConfigured()) {
        const updatedUser = { ...user, registrationStatus: status };
        localStorage.setItem('novatrade_current_user', JSON.stringify(updatedUser));

        const existingUsers = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        const idx = existingUsers.findIndex((u: any) => u.id === user.id);
        if (idx >= 0) {
          existingUsers[idx].registrationStatus = status;
          localStorage.setItem('novatrade_users', JSON.stringify(existingUsers));
        }

        set({ user: updatedUser });
        return true;
      }

      const { error } = await supabase
        .from('users')
        .update({ registration_status: status, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) return false;

      await get().refreshUser();
      return true;
    } catch {
      return false;
    }
  },

  refreshUser: async () => {
    const { user } = get();
    if (!user) return;

    try {
      if (!isSupabaseConfigured()) {
        const storedUser = localStorage.getItem('novatrade_current_user');
        if (storedUser) set({ user: JSON.parse(storedUser) });
        return;
      }

      const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
      if (data) set({ user: dbToUser(data) });
    } catch {
      // ignore
    }
  },

  // ==========================================
  // BALANCE ACTIONS
  // ==========================================

  getBalance: async () => {
    const { user } = get();
    if (!user) return { available: 0, bonus: 0 };
    if (!isSupabaseConfigured()) return { available: user.balance || 0, bonus: user.bonusBalance || 0 };

    const { data, error } = await supabase
      .from('users')
      .select('balance_available, balance_bonus')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) return { available: 0, bonus: 0 };

    const balance = {
      available: parseFloat(data.balance_available) || 0,
      bonus: parseFloat(data.balance_bonus) || 0,
    };

    set((state) => ({
      user: state.user ? { ...state.user, balance: balance.available, bonusBalance: balance.bonus } : null,
    }));

    return balance;
  },

  // ==========================================
  // DEPOSIT ACTIONS
  // ==========================================

  loadDeposits: async () => {
    const { user } = get();
    if (!user) return;

    const { data } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const deposits: Deposit[] = data.map((d: any) => ({
        id: d.id,
        orderId: d.order_id,
        amount: parseFloat(d.amount),
        method: d.method,
        methodName: d.method_name,
        transactionRef: d.transaction_ref,
        proofUrl: d.proof_url,
        status: d.status,
        note: d.note,
        createdAt: d.created_at,
      }));
      set({ deposits });
    }
  },

  submitDeposit: async (deposit) => {
    const { user } = get();
    if (!user) return false;

    try {
      const { error } = await supabase.from('deposits').insert({
        user_id: user.id,
        order_id: `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        amount: deposit.amount,
        method: deposit.method,
        method_name: deposit.methodName,
        transaction_ref: deposit.transactionRef,
        proof_url: deposit.proofUrl,
        status: 'pending',
      });

      if (error) {
        set({ error: error.message });
        return false;
      }

      await get().loadDeposits();
      return true;
    } catch (err: any) {
      set({ error: err?.message || 'Deposit failed' });
      return false;
    }
  },

  // ==========================================
  // TRADE ACTIONS
  // ==========================================

  loadTrades: async () => {
    const { user } = get();
    if (!user) return;

    const { data } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      const trades: Trade[] = data.map((t: any) => ({
        id: t.id,
        pair: t.pair,
        type: t.type,
        side: t.side,
        amount: parseFloat(t.amount),
        entryPrice: parseFloat(t.entry_price),
        currentPrice: parseFloat(t.current_price) || parseFloat(t.entry_price),
        exitPrice: t.exit_price ? parseFloat(t.exit_price) : undefined,
        leverage: t.leverage || 1,
        marginUsed: parseFloat(t.margin_used) || parseFloat(t.amount),
        status: t.status,
        pnl: parseFloat(t.pnl) || 0,
        stopLoss: t.stop_loss ? parseFloat(t.stop_loss) : undefined,
        takeProfit: t.take_profit ? parseFloat(t.take_profit) : undefined,
        createdAt: t.created_at,
        closedAt: t.closed_at,
      }));
      set({ trades });
    }
  },

  openTrade: async (trade) => {
    const { user } = get();
    if (!user) return null;

    const leverage = trade.leverage || 1;
    const marginUsed = trade.amount / leverage;

    if (user.balance < marginUsed) {
      set({ error: 'Insufficient balance' });
      return null;
    }

    try {
      const { error: balanceError } = await supabase
        .from('users')
        .update({ balance_available: user.balance - marginUsed, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (balanceError) {
        set({ error: 'Failed to reserve margin' });
        return null;
      }

      const { data, error } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          pair: trade.pair,
          type: trade.type,
          side: trade.side,
          amount: trade.amount,
          entry_price: trade.entryPrice,
          current_price: trade.entryPrice,
          leverage,
          margin_used: marginUsed,
          stop_loss: trade.stopLoss,
          take_profit: trade.takeProfit,
          status: 'open',
          pnl: 0,
        })
        .select()
        .single();

      if (error || !data) {
        await supabase.from('users').update({ balance_available: user.balance }).eq('id', user.id);
        set({ error: error?.message || 'Trade failed' });
        return null;
      }

      await get().refreshUser();
      await get().loadTrades();

      return {
        id: data.id,
        pair: data.pair,
        type: data.type,
        side: data.side,
        amount: parseFloat(data.amount),
        entryPrice: parseFloat(data.entry_price),
        currentPrice: parseFloat(data.current_price),
        leverage: data.leverage,
        marginUsed: parseFloat(data.margin_used),
        status: data.status,
        pnl: 0,
        createdAt: data.created_at,
      };
    } catch (err: any) {
      set({ error: err?.message || 'Trade failed' });
      return null;
    }
  },

  closeTrade: async (tradeId: string, exitPrice: number) => {
    const { user, trades } = get();
    if (!user) return false;

    const trade = trades.find((t) => t.id === tradeId);
    if (!trade || trade.status !== 'open') return false;

    try {
      let pnl: number;
      if (trade.side === 'long') {
        pnl = ((exitPrice - trade.entryPrice) / trade.entryPrice) * trade.amount;
      } else {
        pnl = ((trade.entryPrice - exitPrice) / trade.entryPrice) * trade.amount;
      }

      const returnAmount = trade.marginUsed + pnl;
      const newBalance = Math.max(0, user.balance + returnAmount);

      await supabase
        .from('users')
        .update({ balance_available: newBalance, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      const { error } = await supabase
        .from('trades')
        .update({
          status: 'closed',
          exit_price: exitPrice,
          pnl,
          closed_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (error) return false;

      await get().refreshUser();
      await get().loadTrades();
      return true;
    } catch {
      return false;
    }
  },

  // ==========================================
  // PAYMENT METHODS
  // ==========================================

  loadPaymentMethods: async () => {
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('enabled', true)
      .order('type')
      .order('display_order');

    if (data) {
      const methods: PaymentMethod[] = data.map((p: any) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        symbol: p.symbol,
        network: p.network,
        address: p.address,
        accountName: p.account_name,
        accountNumber: p.account_number,
        icon: p.icon,
        minDeposit: parseFloat(p.min_deposit),
        fee: p.fee,
        enabled: p.enabled,
      }));
      set({ paymentMethods: methods });
    }
  },

  // ==========================================
  // UTILITY
  // ==========================================

  clearError: () => set({ error: null }),
}));

// ============================================
// AUTH STATE LISTENER (PATCHED: INITIAL_SESSION + NO HANG)
// ============================================

if (typeof window !== 'undefined') {
  const g = globalThis as any;
  if (!g.__novatrade_auth_listener__) {
    g.__novatrade_auth_listener__ = true;

    supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        // Always end loading if there's no session
        if (!session?.user) {
          useStore.setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            deposits: [],
            trades: [],
          });
          return;
        }

        // Load profile for any session event (including INITIAL_SESSION)
        useStore.setState({ isLoading: true });

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          // Don’t hang forever on errors
          useStore.setState({ isLoading: false });
          return;
        }

        if (data) {
          useStore.setState({
            user: dbToUser(data),
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }

        // If profile doesn't exist, just stop loading (login() & checkSession() can create it)
        useStore.setState({ isAuthenticated: true, isLoading: false });
      } catch {
        useStore.setState({ isLoading: false });
      }
    });
  }
}

// ============================================
// ADMIN STORE
// ============================================

interface AdminState {
  isAdmin: boolean;
  pendingDeposits: any[];
  allUsers: any[];

  checkAdminAccess: () => Promise<boolean>;
  loadPendingDeposits: () => Promise<void>;
  confirmDeposit: (depositId: string, note?: string) => Promise<boolean>;
  rejectDeposit: (depositId: string, note?: string) => Promise<boolean>;
  loadAllUsers: () => Promise<void>;
  updateUserBalance: (userId: string, amount: number, type: 'add' | 'subtract') => Promise<boolean>;
  updateUserTier: (userId: string, tier: string) => Promise<boolean>;
  disableUser: (userId: string) => Promise<boolean>;
  enableUser: (userId: string) => Promise<boolean>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  isAdmin: false,
  pendingDeposits: [],
  allUsers: [],

  checkAdminAccess: async () => {
    if (!isSupabaseConfigured()) {
      set({ isAdmin: false });
      return false;
    }

    const { data: sessionRes } = await supabase.auth.getSession();
    const session = sessionRes.session;

    if (!session?.user) {
      set({ isAdmin: false });
      return false;
    }

    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    const isAdmin = data?.role === 'admin';
    set({ isAdmin });
    return isAdmin;
  },

  loadPendingDeposits: async () => {
    const { data } = await supabase
      .from('deposits')
      .select('*, users(email, first_name, last_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    set({ pendingDeposits: data || [] });
  },

  confirmDeposit: async (depositId: string, note?: string) => {
    const { data: sessionRes } = await supabase.auth.getSession();
    const session = sessionRes.session;
    if (!session?.user) return false;

    const { data: deposit } = await supabase.from('deposits').select('*').eq('id', depositId).maybeSingle();
    if (!deposit) return false;

    const { error: depositError } = await supabase
      .from('deposits')
      .update({
        status: 'confirmed',
        processed_by: session.user.id,
        processed_at: new Date().toISOString(),
        note,
      })
      .eq('id', depositId);

    if (depositError) return false;

    const { data: userData } = await supabase
      .from('users')
      .select('balance_available, total_deposited')
      .eq('id', deposit.user_id)
      .maybeSingle();

    if (userData) {
      await supabase
        .from('users')
        .update({
          balance_available: parseFloat(userData.balance_available) + parseFloat(deposit.amount),
          total_deposited: parseFloat(userData.total_deposited) + parseFloat(deposit.amount),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deposit.user_id);
    }

    await get().loadPendingDeposits();
    return true;
  },

  rejectDeposit: async (depositId: string, note?: string) => {
    const { data: sessionRes } = await supabase.auth.getSession();
    const session = sessionRes.session;
    if (!session?.user) return false;

    const { error } = await supabase
      .from('deposits')
      .update({
        status: 'rejected',
        processed_by: session.user.id,
        processed_at: new Date().toISOString(),
        note,
      })
      .eq('id', depositId);

    if (!error) await get().loadPendingDeposits();
    return !error;
  },

  loadAllUsers: async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    set({ allUsers: data || [] });
  },

  updateUserBalance: async (userId: string, amount: number, type: 'add' | 'subtract') => {
    const { data: user } = await supabase.from('users').select('balance_available').eq('id', userId).maybeSingle();
    if (!user) return false;

    const currentBalance = parseFloat(user.balance_available);
    const newBalance = type === 'add' ? currentBalance + amount : Math.max(0, currentBalance - amount);

    const { error } = await supabase
      .from('users')
      .update({ balance_available: newBalance, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) await get().loadAllUsers();
    return !error;
  },

  updateUserTier: async (userId: string, tier: string) => {
    const { error } = await supabase.from('users').update({ tier, updated_at: new Date().toISOString() }).eq('id', userId);
    if (!error) await get().loadAllUsers();
    return !error;
  },

  disableUser: async (userId: string) => {
    const { error } = await supabase.from('users').update({ is_active: false }).eq('id', userId);
    if (!error) await get().loadAllUsers();
    return !error;
  },

  enableUser: async (userId: string) => {
    const { error } = await supabase.from('users').update({ is_active: true }).eq('id', userId);
    if (!error) await get().loadAllUsers();
    return !error;
  },
}));
