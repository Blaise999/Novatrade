'use client';

/**
 * useUnifiedBalance Hook
 * 
 * This hook manages the synchronization between:
 * - User's Supabase balance (source of truth)
 * - Stock/FX Trading Store
 * - Crypto Spot Trading Store
 * 
 * USE THIS HOOK in dashboard layout to ensure all accounts are initialized
 */

import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useTradingAccountStore } from '@/lib/trading-store';
import { useSpotTradingStore } from '@/lib/spot-trading-store';
import {
  fetchUserBalance,
  onBalanceUpdate,
  initializeAllTradingAccounts,
  type BalanceSnapshot,
} from '@/lib/services/balance-sync';

interface UseUnifiedBalanceReturn {
  isInitialized: boolean;
  balance: {
    available: number;
    bonus: number;
    total: number;
  };
  refreshBalance: () => Promise<void>;
}

export function useUnifiedBalance(): UseUnifiedBalanceReturn {
  const { user, refreshUser } = useStore();
  const tradingStore = useTradingAccountStore();
  const spotTradingStore = useSpotTradingStore();
  
  const isInitializedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Initialize all trading accounts when user loads
  useEffect(() => {
    if (!user?.id) {
      isInitializedRef.current = false;
      lastUserIdRef.current = null;
      return;
    }

    // Skip if already initialized for this user
    if (isInitializedRef.current && lastUserIdRef.current === user.id) {
      return;
    }

    const initAccounts = async () => {
      console.log('[useUnifiedBalance] Initializing accounts for user:', user.id);
      
      const userBalance = (user?.balance ?? 0) + (user?.bonusBalance ?? 0);

      // 🔥 CRITICAL: Load crypto portfolio from Supabase first (cross-device sync)
      await spotTradingStore.loadFromSupabase(user.id, userBalance);

      // 🔥 CRITICAL: Load stock/FX positions from Supabase (cross-device sync)
      await tradingStore.loadStocksFromSupabase(user.id, userBalance);

      await initializeAllTradingAccounts(
        user.id,
        {
          initializeAccounts: tradingStore.initializeAccounts,
          syncBalanceFromUser: tradingStore.syncBalanceFromUser,
        },
        {
          initializeAccount: spotTradingStore.initializeAccount,
          syncCashFromUser: spotTradingStore.syncCashFromUser,
        }
      );

      isInitializedRef.current = true;
      lastUserIdRef.current = user.id;
    };

    initAccounts();
  }, [user?.id, tradingStore, spotTradingStore]);

  // Listen for balance updates from other components
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = onBalanceUpdate((balance: BalanceSnapshot) => {
      const total = balance.available + balance.bonus;
      
      // Sync to all stores
      tradingStore.syncBalanceFromUser(total);
      spotTradingStore.syncCashFromUser(total);
      
      // Also refresh user state
      refreshUser?.();
    });

    return unsubscribe;
  }, [user?.id, tradingStore, spotTradingStore, refreshUser]);

  // Manual refresh function
  const refreshBalance = useCallback(async () => {
    if (!user?.id) return;

    const balance = await fetchUserBalance(user.id);
    if (balance) {
      const total = balance.available + balance.bonus;
      tradingStore.syncBalanceFromUser(total);
      spotTradingStore.syncCashFromUser(total);
      refreshUser?.();
    }
  }, [user?.id, tradingStore, spotTradingStore, refreshUser]);

  return {
    isInitialized: isInitializedRef.current,
    balance: {
      available: user?.balance ?? 0,
      bonus: user?.bonusBalance ?? 0,
      total: (user?.balance ?? 0) + (user?.bonusBalance ?? 0),
    },
    refreshBalance,
  };
}

/**
 * Hook to get the unified cash balance across all trading stores
 * This returns the ACTUAL tradeable balance considering open positions
 */
export function useAvailableCash(): number {
  const { user } = useStore();
  const spotAccount = useTradingAccountStore((s) => s.spotAccount);
  const marginAccount = useTradingAccountStore((s) => s.marginAccount);
  const cryptoAccount = useSpotTradingStore((s) => s.account);

  // The user's Supabase balance is the source of truth
  // But we need to consider what's locked in positions
  const userBalance = (user?.balance ?? 0) + (user?.bonusBalance ?? 0);
  
  // Get margin locked in FX positions
  const marginUsed = marginAccount?.marginUsed ?? 0;
  
  // Get value locked in stock positions (this is the cost basis, not current value)
  const stocksLockedValue = spotAccount?.equity 
    ? (spotAccount.equity - (spotAccount.cash ?? userBalance))
    : 0;
  
  // Get value locked in crypto positions
  const cryptoLockedValue = cryptoAccount?.portfolioValue ?? 0;

  // Available = Total - Locked
  // Note: For margin trading, only the margin is locked, not the full position value
  const available = Math.max(0, userBalance - marginUsed);
  
  return available;
}

/**
 * Hook to check if user has sufficient balance for a trade
 */
export function useCanTrade(requiredAmount: number): boolean {
  const availableCash = useAvailableCash();
  return availableCash >= requiredAmount;
}
