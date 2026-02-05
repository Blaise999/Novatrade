'use client';

/**
 * useTradingSync Hook
 * 
 * This hook synchronizes the trading store with the user's Supabase balance.
 * It ensures:
 * 1. Trading accounts are initialized with the correct balance
 * 2. Balance stays in sync between trading operations and Supabase
 * 3. Proper initialization on page load
 */

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/supabase/store-supabase';
import { useTradingAccountStore } from '@/lib/trading-store';

export function useTradingSync() {
  const { user, refreshUser } = useStore();
  const { 
    spotAccount, 
    marginAccount, 
    initializeAccounts, 
    syncBalanceFromUser 
  } = useTradingAccountStore();
  
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | null>(null);
  const lastBalance = useRef<number | null>(null);
  
  useEffect(() => {
    if (!user?.id) {
      hasInitialized.current = false;
      lastUserId.current = null;
      return;
    }
    
    const userBalance = user.balance || 0;
    
    // Initialize accounts if:
    // 1. Never initialized before
    // 2. Different user logged in
    // 3. Accounts don't exist
    if (
      !hasInitialized.current || 
      lastUserId.current !== user.id ||
      !spotAccount ||
      !marginAccount
    ) {
      console.log(`[TradingSync] Initializing accounts for user ${user.id} with balance $${userBalance}`);
      initializeAccounts(user.id, userBalance);
      hasInitialized.current = true;
      lastUserId.current = user.id;
      lastBalance.current = userBalance;
      return;
    }
    
    // Sync if user balance changed (e.g., deposit confirmed)
    if (lastBalance.current !== userBalance) {
      console.log(`[TradingSync] User balance changed: $${lastBalance.current} → $${userBalance}`);
      syncBalanceFromUser(userBalance);
      lastBalance.current = userBalance;
    }
  }, [user?.id, user?.balance, spotAccount, marginAccount, initializeAccounts, syncBalanceFromUser]);
  
  // Refresh user data periodically to catch balance updates
  useEffect(() => {
    if (!user?.id) return;
    
    // Refresh user data every 30 seconds to catch admin balance updates
    const interval = setInterval(() => {
      refreshUser?.();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user?.id, refreshUser]);
  
  return {
    isReady: !!spotAccount && !!marginAccount,
    spotAccount,
    marginAccount,
    userBalance: user?.balance || 0,
  };
}

/**
 * Hook specifically for FX/Margin trading pages
 */
export function useFXTrading() {
  const sync = useTradingSync();
  const { 
    marginPositions, 
    openMarginPosition, 
    closeMarginPosition, 
    updateMarginPositionPrice 
  } = useTradingAccountStore();
  
  return {
    ...sync,
    marginPositions,
    openMarginPosition,
    closeMarginPosition,
    updateMarginPositionPrice,
    // Computed values
    totalUnrealizedPnL: marginPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0),
    totalMarginUsed: marginPositions.reduce((sum, p) => sum + p.requiredMargin, 0),
    freeMargin: sync.marginAccount?.freeMargin || 0,
    equity: sync.marginAccount?.equity || 0,
    marginLevel: sync.marginAccount?.marginLevel,
  };
}

/**
 * Hook specifically for Stock trading pages
 */
export function useStockTrading() {
  const sync = useTradingSync();
  const { 
    stockPositions, 
    executeStockBuy, 
    executeStockSell, 
    updateStockPositionPrice 
  } = useTradingAccountStore();
  
  const portfolioValue = stockPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalUnrealizedPnL = stockPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  
  return {
    ...sync,
    stockPositions,
    executeStockBuy,
    executeStockSell,
    updateStockPositionPrice,
    // Computed values
    portfolioValue,
    totalUnrealizedPnL,
    cashBalance: sync.spotAccount?.cash || 0,
    totalEquity: (sync.spotAccount?.cash || 0) + portfolioValue,
  };
}

export default useTradingSync;
