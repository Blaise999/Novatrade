/**
 * USE SERVER BALANCE HOOK
 * ========================
 * 
 * This hook fetches balance directly from the server API.
 * It does NOT use local state for balance calculations.
 * 
 * This is the correct way to handle balance - server is the source of truth.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface BalanceState {
  balance: number;
  bonus: number;
  totalDeposited: number;
  totalInvested: number;
  totalUnrealizedPnL: number;
  equity: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface UseServerBalanceOptions {
  userId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

const initialState: BalanceState = {
  balance: 0,
  bonus: 0,
  totalDeposited: 0,
  totalInvested: 0,
  totalUnrealizedPnL: 0,
  equity: 0,
  isLoading: true,
  error: null,
  lastUpdated: null,
};

export function useServerBalance(options: UseServerBalanceOptions = {}) {
  const { userId, autoRefresh = true, refreshInterval = 5000 } = options;
  
  const [state, setState] = useState<BalanceState>(initialState);
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const fetchBalance = useCallback(async (showLoading = false) => {
    if (!userId) {
      setState(prev => ({ ...prev, isLoading: false, error: 'No user ID' }));
      return;
    }
    
    if (showLoading) {
      setState(prev => ({ ...prev, isLoading: true }));
    }
    
    try {
      const response = await fetch('/api/balance', {
        headers: {
          'x-user-id': userId,
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch balance');
      }
      
      const data = await response.json();
      
      if (!mountedRef.current) return;
      
      if (data.success) {
        setState({
          balance: data.balance || 0,
          bonus: data.bonus || 0,
          totalDeposited: data.totalDeposited || 0,
          totalInvested: data.totalInvested || 0,
          totalUnrealizedPnL: data.totalUnrealizedPnL || 0,
          equity: data.equity || data.balance || 0,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        });
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Unknown error',
        }));
      }
    } catch (error: any) {
      if (!mountedRef.current) return;
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to fetch balance',
      }));
    }
  }, [userId]);
  
  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchBalance(true);
    
    return () => {
      mountedRef.current = false;
    };
  }, [fetchBalance]);
  
  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !userId) return;
    
    intervalRef.current = setInterval(() => {
      fetchBalance(false);
    }, refreshInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchBalance, userId]);
  
  const refresh = useCallback(() => {
    return fetchBalance(false);
  }, [fetchBalance]);
  
  return {
    ...state,
    refresh,
  };
}

/**
 * Simple balance display component
 */
export function BalanceDisplay({ 
  userId,
  showEquity = true,
  className = '',
}: {
  userId?: string;
  showEquity?: boolean;
  className?: string;
}) {
  const { balance, equity, isLoading, error } = useServerBalance({ userId });
  
  if (isLoading) {
    return <span className={className}>Loading...</span>;
  }
  
  if (error) {
    return <span className={`${className} text-red-500`}>Error</span>;
  }
  
  const formatMoney = (v: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(v);
  };
  
  return (
    <div className={className}>
      <div>Balance: {formatMoney(balance)}</div>
      {showEquity && equity !== balance && (
        <div className={equity >= balance ? 'text-green-500' : 'text-red-500'}>
          Equity: {formatMoney(equity)}
        </div>
      )}
    </div>
  );
}

export default useServerBalance;
