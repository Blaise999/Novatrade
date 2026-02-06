/**
 * UNIFIED BALANCE SYNC SERVICE
 * 
 * This service handles all balance synchronization between:
 * - Supabase (source of truth for user balance)
 * - Trading Store (stocks & FX margin trading)
 * - Spot Trading Store (crypto trading with shield mode)
 * 
 * FLOW:
 * 1. User deposits → Admin confirms → Supabase balance increases
 * 2. On page load → Fetch Supabase balance → Initialize all trading accounts
 * 3. Trade executes → Local balance updates → Sync back to Supabase
 * 4. Trade closes with P&L → Update Supabase → Refresh user state
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

// ==========================================
// TYPES
// ==========================================

export interface BalanceSyncResult {
  success: boolean;
  newBalance?: number;
  error?: string;
}

export interface BalanceSnapshot {
  available: number;
  bonus: number;
  totalDeposited: number;
  timestamp: Date;
}

// ==========================================
// CORE SYNC FUNCTIONS
// ==========================================

/**
 * Fetch the current user balance from Supabase
 * This is the source of truth for all trading accounts
 */
export async function fetchUserBalance(userId: string): Promise<BalanceSnapshot | null> {
  if (!isSupabaseConfigured() || !userId) {
    console.warn('[BalanceSync] Supabase not configured or no userId');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('balance_available, balance_bonus, total_deposited')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[BalanceSync] Failed to fetch balance:', error);
      return null;
    }

    return {
      available: Number(data?.balance_available ?? 0),
      bonus: Number(data?.balance_bonus ?? 0),
      totalDeposited: Number(data?.total_deposited ?? 0),
      timestamp: new Date(),
    };
  } catch (err) {
    console.error('[BalanceSync] Fetch error:', err);
    return null;
  }
}

/**
 * Update user balance in Supabase after a trade
 * Returns the new balance on success
 */
export async function updateUserBalance(
  userId: string,
  newBalance: number,
  changeAmount: number,
  reason: string
): Promise<BalanceSyncResult> {
  if (!isSupabaseConfigured() || !userId) {
    console.warn('[BalanceSync] Supabase not configured, using local only');
    return { success: true, newBalance }; // Allow local trading without Supabase
  }

  try {
    const finalBalance = Math.max(0, newBalance);
    
    const { error } = await supabase
      .from('users')
      .update({
        balance_available: finalBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[BalanceSync] Update failed:', error);
      return { success: false, error: error.message };
    }

    const changeStr = changeAmount >= 0 ? `+$${changeAmount.toFixed(2)}` : `-$${Math.abs(changeAmount).toFixed(2)}`;
    console.log(`[BalanceSync] ✅ ${reason} | ${changeStr} | New: $${finalBalance.toFixed(2)}`);
    
    return { success: true, newBalance: finalBalance };
  } catch (err) {
    console.error('[BalanceSync] Sync error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Add a balance adjustment (used by admin or for bonuses)
 */
export async function adjustUserBalance(
  userId: string,
  amount: number,
  type: 'add' | 'subtract',
  reason: string
): Promise<BalanceSyncResult> {
  if (!isSupabaseConfigured() || !userId) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // First get current balance
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('balance_available')
      .eq('id', userId)
      .single();

    if (fetchError || !userData) {
      return { success: false, error: 'Failed to fetch current balance' };
    }

    const currentBalance = Number(userData.balance_available ?? 0);
    const newBalance = type === 'add' 
      ? currentBalance + amount 
      : Math.max(0, currentBalance - amount);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        balance_available: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    console.log(`[BalanceSync] ✅ Admin adjustment: ${type === 'add' ? '+' : '-'}$${amount.toFixed(2)} | ${reason}`);
    return { success: true, newBalance };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ==========================================
// TRADE-SPECIFIC SYNC FUNCTIONS
// ==========================================

/**
 * Sync balance after a stock trade (buy reduces, sell adds)
 */
export async function syncStockTrade(
  userId: string,
  currentBalance: number,
  tradeAmount: number,
  side: 'buy' | 'sell',
  symbol: string,
  qty: number,
  realizedPnL?: number
): Promise<BalanceSyncResult> {
  const reason = side === 'buy'
    ? `Stock Buy: ${qty} ${symbol}`
    : `Stock Sell: ${qty} ${symbol}${realizedPnL !== undefined ? ` (P&L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)})` : ''}`;
  
  const changeAmount = side === 'buy' ? -tradeAmount : tradeAmount;
  
  return updateUserBalance(userId, currentBalance, changeAmount, reason);
}

/**
 * Sync balance after an FX/margin trade
 * Only syncs on close (when P&L is realized)
 */
export async function syncFXTrade(
  userId: string,
  currentBalance: number,
  realizedPnL: number,
  fee: number,
  symbol: string,
  side: 'long' | 'short',
  action: 'open' | 'close'
): Promise<BalanceSyncResult> {
  if (action === 'open') {
    // Only deduct fee on open
    if (fee > 0) {
      return updateUserBalance(
        userId,
        currentBalance,
        -fee,
        `FX Open Fee: ${symbol} ${side.toUpperCase()}`
      );
    }
    return { success: true, newBalance: currentBalance };
  }
  
  // On close, sync the realized P&L
  const netPnL = realizedPnL - fee;
  return updateUserBalance(
    userId,
    currentBalance,
    netPnL,
    `FX Close: ${symbol} ${side.toUpperCase()} (P&L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)})`
  );
}

/**
 * Sync balance after a crypto trade
 */
export async function syncCryptoTrade(
  userId: string,
  currentBalance: number,
  tradeAmount: number,
  side: 'buy' | 'sell',
  symbol: string,
  qty: number,
  realizedPnL?: number
): Promise<BalanceSyncResult> {
  const reason = side === 'buy'
    ? `Crypto Buy: ${qty.toFixed(6)} ${symbol}`
    : `Crypto Sell: ${qty.toFixed(6)} ${symbol}${realizedPnL !== undefined ? ` (P&L: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)})` : ''}`;
  
  const changeAmount = side === 'buy' ? -tradeAmount : tradeAmount;
  
  return updateUserBalance(userId, currentBalance, changeAmount, reason);
}

// ==========================================
// BALANCE REFRESH EVENT
// ==========================================

type BalanceListener = (balance: BalanceSnapshot) => void;
const listeners: Set<BalanceListener> = new Set();

/**
 * Subscribe to balance updates
 */
export function onBalanceUpdate(callback: BalanceListener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Notify all listeners of a balance change
 */
export function notifyBalanceUpdate(balance: BalanceSnapshot): void {
  listeners.forEach(listener => {
    try {
      listener(balance);
    } catch (err) {
      console.error('[BalanceSync] Listener error:', err);
    }
  });
}

/**
 * Fetch and broadcast current balance to all listeners
 */
export async function refreshAndBroadcastBalance(userId: string): Promise<BalanceSnapshot | null> {
  const balance = await fetchUserBalance(userId);
  if (balance) {
    notifyBalanceUpdate(balance);
  }
  return balance;
}

// ==========================================
// INITIALIZATION HELPER
// ==========================================

/**
 * Initialize all trading accounts with the user's Supabase balance
 * Call this when the dashboard loads
 */
export async function initializeAllTradingAccounts(
  userId: string,
  tradingStore: {
    initializeAccounts: (userId: string, balance: number) => void;
    syncBalanceFromUser: (balance: number) => void;
  },
  spotTradingStore: {
    initializeAccount: (userId: string, balance: number) => void;
    syncCashFromUser: (balance: number) => void;
  }
): Promise<BalanceSnapshot | null> {
  const balance = await fetchUserBalance(userId);
  
  if (!balance) {
    console.warn('[BalanceSync] Could not fetch balance, using defaults');
    tradingStore.initializeAccounts(userId, 0);
    spotTradingStore.initializeAccount(userId, 0);
    return null;
  }

  const totalBalance = balance.available + balance.bonus;
  
  // Initialize or sync trading accounts
  tradingStore.initializeAccounts(userId, totalBalance);
  tradingStore.syncBalanceFromUser(totalBalance);
  
  // Initialize or sync crypto spot account
  spotTradingStore.initializeAccount(userId, totalBalance);
  spotTradingStore.syncCashFromUser(totalBalance);
  
  console.log(`[BalanceSync] ✅ All accounts initialized with $${totalBalance.toFixed(2)}`);
  
  return balance;
}
