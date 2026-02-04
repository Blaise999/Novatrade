/**
 * SIMPLIFIED SUPABASE AUTH STORE
 * 
 * A clean, easy-to-understand auth store that works with Supabase.
 * Handles login, signup, logout, and session management.
 */

import { create } from 'zustand';
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

// ============================================
// SUPABASE CLIENT
// ============================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isConfigured = 
  supabaseUrl.includes('supabase.co') && 
  supabaseAnonKey.length > 20 &&
  !supabaseUrl.includes('your-project');

export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const isSupabaseConfigured = () => isConfigured;

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
// HELPER: Convert database row to User type
// ============================================
function dbRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role || 'user',
    tier: row.tier || 'basic',
    balance: parseFloat(row.balance_available) || 0,
    bonusBalance: parseFloat(row.balance_bonus) || 0,
    totalDeposited: parseFloat(row.total_deposited) || 0,
    kycStatus: row.kyc_status || 'none',
    registrationStatus: row.registration_status || 'complete',
    walletAddress: row.wallet_address,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
  };
}

// ============================================
// REGISTRATION STATUS HELPERS
// ============================================
export function getRegistrationRedirect(status: User['registrationStatus']): string {
  switch (status) {
    case 'pending_verification': return '/auth/verify-otp';
    case 'pending_kyc': return '/kyc';
    case 'pending_wallet': return '/connect-wallet';
    default: return '/dashboard';
  }
}

export function getRegistrationMessage(status: User['registrationStatus']): string {
  switch (status) {
    case 'pending_verification': return 'Please verify your email to continue.';
    case 'pending_kyc': return 'Please complete identity verification.';
    case 'pending_wallet': return 'Connect your wallet to finish setup.';
    default: return '';
  }
}

// ============================================
// STORE INTERFACE
// ============================================
interface AuthStore {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  deposits: Deposit[];
  trades: Trade[];
  paymentMethods: PaymentMethod[];

  // Auth Actions
  login: (email: string, password: string) => Promise<{ success: boolean; redirect?: string; error?: string }>;
  signup: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  
  // Profile Actions
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  
  // Data Actions
  loadDeposits: () => Promise<void>;
  loadTrades: () => Promise<void>;
  loadPaymentMethods: () => Promise<void>;
  submitDeposit: (deposit: { amount: number; method: string; methodName: string; transactionRef?: string; proofUrl?: string }) => Promise<boolean>;
  
  // Utility
  clearError: () => void;
  getBalance: () => { available: number; bonus: number };
}

// ============================================
// CREATE STORE
// ============================================
export const useStore = create<AuthStore>((set, get) => ({
  // Initial State
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  deposits: [],
  trades: [],
  paymentMethods: [],

  // ==========================================
  // LOGIN
  // ==========================================
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    // Demo mode - use localStorage
    if (!isConfigured) {
      try {
        const users = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        const found = users.find((u: any) => u.email === email.toLowerCase() && u.password === password);
        
        if (!found) {
          set({ isLoading: false, error: 'Invalid email or password' });
          return { success: false, error: 'Invalid email or password' };
        }

        const { password: _, ...userWithoutPw } = found;
        localStorage.setItem('novatrade_session', JSON.stringify(userWithoutPw));
        set({ user: userWithoutPw, isAuthenticated: true, isLoading: false });
        return { success: true, redirect: '/dashboard' };
      } catch (err) {
        set({ isLoading: false, error: 'Login failed' });
        return { success: false, error: 'Login failed' };
      }
    }

    // Production mode - use Supabase
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const errorMsg = authError.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : authError.message;
        set({ isLoading: false, error: errorMsg });
        return { success: false, error: errorMsg };
      }

      if (!authData.user) {
        set({ isLoading: false, error: 'Login failed. Please try again.' });
        return { success: false, error: 'Login failed' };
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
      }

      // If no profile exists (edge case), create one
      if (!profile) {
        const { data: newProfile } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email?.toLowerCase() || email.toLowerCase(),
            first_name: authData.user.user_metadata?.first_name || '',
            last_name: authData.user.user_metadata?.last_name || '',
          })
          .select()
          .single();

        if (newProfile) {
          const user = dbRowToUser(newProfile);
          set({ user, isAuthenticated: true, isLoading: false });
          return { success: true, redirect: getRegistrationRedirect(user.registrationStatus) };
        }
      }

      // Check if account is disabled
      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        set({ isLoading: false, error: 'Your account has been disabled.' });
        return { success: false, error: 'Account disabled' };
      }

      const user = dbRowToUser(profile || { id: authData.user.id, email: authData.user.email });
      set({ user, isAuthenticated: true, isLoading: false });
      return { success: true, redirect: getRegistrationRedirect(user.registrationStatus) };

    } catch (err: any) {
      const errorMsg = err?.message || 'Login failed. Please try again.';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  // ==========================================
  // SIGNUP
  // ==========================================
  signup: async (email: string, password: string, firstName?: string, lastName?: string) => {
    set({ isLoading: true, error: null });

    // Demo mode
    if (!isConfigured) {
      try {
        const users = JSON.parse(localStorage.getItem('novatrade_users') || '[]');
        if (users.find((u: any) => u.email === email.toLowerCase())) {
          set({ isLoading: false, error: 'Email already registered' });
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
        set({ user: newUser, isAuthenticated: true, isLoading: false });
        return { success: true };
      } catch (err) {
        set({ isLoading: false, error: 'Signup failed' });
        return { success: false, error: 'Signup failed' };
      }
    }

    // Production mode
    try {
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
        set({ isLoading: false, error: authError.message });
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        set({ isLoading: false, error: 'Signup failed' });
        return { success: false, error: 'Signup failed' };
      }

      // If we have a session, we're logged in immediately (no email confirmation required)
      if (authData.session) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profile) {
          set({ user: dbRowToUser(profile), isAuthenticated: true, isLoading: false });
        } else {
          set({ isAuthenticated: true, isLoading: false });
        }
      }

      set({ isLoading: false });
      return { success: true };

    } catch (err: any) {
      const errorMsg = err?.message || 'Signup failed';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  // ==========================================
  // LOGOUT
  // ==========================================
  logout: async () => {
    if (!isConfigured) {
      localStorage.removeItem('novatrade_session');
    } else {
      await supabase.auth.signOut();
    }
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      deposits: [],
      trades: [],
      error: null,
    });
  },

  // ==========================================
  // CHECK SESSION
  // ==========================================
  checkSession: async () => {
    set({ isLoading: true });

    // Demo mode
    if (!isConfigured) {
      try {
        const session = localStorage.getItem('novatrade_session');
        if (session) {
          set({ user: JSON.parse(session), isAuthenticated: true, isLoading: false });
        } else {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      } catch {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
      return;
    }

    // Production mode
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        set({ user: dbRowToUser(profile), isAuthenticated: true, isLoading: false });
      } else {
        set({ isAuthenticated: true, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  // ==========================================
  // UPDATE PROFILE
  // ==========================================
  updateProfile: async (updates: Partial<User>) => {
    const { user } = get();
    if (!user) return false;

    if (!isConfigured) {
      const updatedUser = { ...user, ...updates };
      localStorage.setItem('novatrade_session', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return true;
    }

    try {
      const dbUpdates: any = {};
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
      if (updates.kycStatus !== undefined) dbUpdates.kyc_status = updates.kycStatus;
      if (updates.registrationStatus !== undefined) dbUpdates.registration_status = updates.registrationStatus;
      if (updates.walletAddress !== undefined) dbUpdates.wallet_address = updates.walletAddress;

      const { error } = await supabase
        .from('users')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) return false;

      set({ user: { ...user, ...updates } });
      return true;
    } catch {
      return false;
    }
  },

  // ==========================================
  // REFRESH USER
  // ==========================================
  refreshUser: async () => {
    const { user } = get();
    if (!user || !isConfigured) return;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      set({ user: dbRowToUser(profile) });
    }
  },

  // ==========================================
  // LOAD DEPOSITS
  // ==========================================
  loadDeposits: async () => {
    const { user } = get();
    if (!user || !isConfigured) return;

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

  // ==========================================
  // LOAD TRADES
  // ==========================================
  loadTrades: async () => {
    const { user } = get();
    if (!user || !isConfigured) return;

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
        marginUsed: parseFloat(t.margin_used) || 0,
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

  // ==========================================
  // LOAD PAYMENT METHODS
  // ==========================================
  loadPaymentMethods: async () => {
    if (!isConfigured) return;

    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('enabled', true)
      .order('display_order');

    if (data) {
      const methods: PaymentMethod[] = data.map((p: any) => ({
        id: p.id,
        type: p.type,
        name: p.name,
        symbol: p.symbol,
        network: p.network,
        address: p.address,
        icon: p.icon,
        minDeposit: parseFloat(p.min_deposit),
        fee: p.fee,
        enabled: p.enabled,
      }));
      set({ paymentMethods: methods });
    }
  },

  // ==========================================
  // SUBMIT DEPOSIT
  // ==========================================
  submitDeposit: async (deposit) => {
    const { user } = get();
    if (!user || !isConfigured) return false;

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

      if (error) return false;

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
    return {
      available: user?.balance || 0,
      bonus: user?.bonusBalance || 0,
    };
  },

  // ==========================================
  // CLEAR ERROR
  // ==========================================
  clearError: () => set({ error: null }),
}));

// ============================================
// AUTH STATE LISTENER (Supabase)
// ============================================
if (typeof window !== 'undefined' && isConfigured) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      useStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        deposits: [],
        trades: [],
      });
      return;
    }

    // Don't set loading on token refresh
    if (event === 'TOKEN_REFRESHED') return;

    // For sign in and initial session, load user data
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        useStore.setState({
          user: dbRowToUser(profile),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        useStore.setState({
          isAuthenticated: true,
          isLoading: false,
        });
      }
    }
  });
}

// ============================================
// ADMIN STORE (Simplified)
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
    if (!isConfigured) return false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

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
    if (!isConfigured) return;

    const { data } = await supabase
      .from('deposits')
      .select('*, users(email, first_name, last_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    set({ pendingDeposits: data || [] });
  },

  loadAllUsers: async () => {
    if (!isConfigured) return;

    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    set({ allUsers: data || [] });
  },

  confirmDeposit: async (depositId: string, note?: string) => {
    if (!isConfigured) return false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    // Get deposit details
    const { data: deposit } = await supabase
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .single();

    if (!deposit) return false;

    // Update deposit status
    await supabase
      .from('deposits')
      .update({
        status: 'confirmed',
        processed_by: session.user.id,
        processed_at: new Date().toISOString(),
        note,
      })
      .eq('id', depositId);

    // Update user balance
    const { data: user } = await supabase
      .from('users')
      .select('balance_available, total_deposited')
      .eq('id', deposit.user_id)
      .single();

    if (user) {
      await supabase
        .from('users')
        .update({
          balance_available: parseFloat(user.balance_available) + parseFloat(deposit.amount),
          total_deposited: parseFloat(user.total_deposited) + parseFloat(deposit.amount),
        })
        .eq('id', deposit.user_id);
    }

    await get().loadPendingDeposits();
    return true;
  },

  rejectDeposit: async (depositId: string, note?: string) => {
    if (!isConfigured) return false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    await supabase
      .from('deposits')
      .update({
        status: 'rejected',
        processed_by: session.user.id,
        processed_at: new Date().toISOString(),
        note,
      })
      .eq('id', depositId);

    await get().loadPendingDeposits();
    return true;
  },

  updateUserBalance: async (userId: string, amount: number, type: 'add' | 'subtract') => {
    if (!isConfigured) return false;

    const { data: user } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', userId)
      .single();

    if (!user) return false;

    const currentBalance = parseFloat(user.balance_available);
    const newBalance = type === 'add' 
      ? currentBalance + amount 
      : Math.max(0, currentBalance - amount);

    await supabase
      .from('users')
      .update({ balance_available: newBalance })
      .eq('id', userId);

    await get().loadAllUsers();
    return true;
  },
}));
