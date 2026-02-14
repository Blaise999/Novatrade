/**
 * USE SERVER BALANCE HOOK
 * ========================
 *
 * Fetches balance directly from the server API.
 * Server is the source of truth (no local calculations).
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchBalance = useCallback(
    async (showLoading = false) => {
      if (!userId) {
        setState((prev) => ({ ...prev, isLoading: false, error: 'No user ID' }));
        return;
      }

      if (showLoading) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch('/api/balance', {
          method: 'GET',
          headers: {
            'x-user-id': userId,
            'Cache-Control': 'no-cache',
          },
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch balance (${response.status})`);
        }

        const data = await response.json();

        if (!mountedRef.current) return;

        if (data?.success) {
          setState({
            balance: Number(data.balance) || 0,
            bonus: Number(data.bonus) || 0,
            totalDeposited: Number(data.totalDeposited) || 0,
            totalInvested: Number(data.totalInvested) || 0,
            totalUnrealizedPnL: Number(data.totalUnrealizedPnL) || 0,
            equity: Number(data.equity) || Number(data.balance) || 0,
            isLoading: false,
            error: null,
            lastUpdated: new Date(),
          });
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: data?.error || 'Unknown error',
          }));
        }
      } catch (err: unknown) {
        if (!mountedRef.current) return;

        // Ignore abort errors (happens during refresh/unmount)
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const message =
          err instanceof Error ? err.message : 'Failed to fetch balance';

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
      }
    },
    [userId]
  );

  // Initial fetch + cleanup
  useEffect(() => {
    mountedRef.current = true;
    fetchBalance(true);

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchBalance]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !userId) return;

    intervalRef.current = setInterval(() => {
      fetchBalance(false);
    }, refreshInterval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [autoRefresh, refreshInterval, fetchBalance, userId]);

  const refresh = useCallback(() => fetchBalance(false), [fetchBalance]);

  return {
    ...state,
    refresh,
  };
}

/**
 * Simple balance display component
 * NOTE: This is why the file MUST be .tsx
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

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(v);

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
