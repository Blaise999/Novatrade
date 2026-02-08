'use client';

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export type TradeMarketType = 'crypto' | 'forex' | 'stocks';

interface SaveTradeParams {
  userId: string;
  symbol: string;
  marketType: TradeMarketType;
  type: 'buy' | 'sell';
  side: 'long' | 'short';
  amount: number;
  quantity: number;
  entryPrice: number;
  leverage?: number;
  fees?: number;
  stopLoss?: number;
  takeProfit?: number;
  status?: 'open' | 'closed';
  /** For closed trades */
  exitPrice?: number;
  pnl?: number;
}

/**
 * Saves a trade to the `trades` table so it shows in History.
 * Used by all trading pages: crypto, forex, stocks.
 */
export async function saveTradeToHistory(params: SaveTradeParams): Promise<string | null> {
  if (!isSupabaseConfigured() || !params.userId) return null;

  try {
    const { data, error } = await supabase.from('trades').insert({
      user_id: params.userId,
      pair: params.symbol.includes('/') ? params.symbol : `${params.symbol}/USD`,
      symbol: params.symbol.replace('/USD', '').replace('/JPY', '').replace('/GBP', ''),
      market_type: params.marketType,
      type: params.type,
      side: params.side,
      amount: params.amount,
      quantity: params.quantity,
      entry_price: params.entryPrice,
      current_price: params.entryPrice,
      exit_price: params.exitPrice ?? null,
      leverage: params.leverage ?? 1,
      margin_used: params.amount,
      pnl: params.pnl ?? 0,
      pnl_percentage: 0,
      fees: params.fees ?? 0,
      status: params.status ?? 'open',
      stop_loss: params.stopLoss ?? null,
      take_profit: params.takeProfit ?? null,
      source: 'live',
      opened_at: new Date().toISOString(),
      closed_at: params.status === 'closed' ? new Date().toISOString() : null,
    }).select('id').maybeSingle();

    if (error) {
      console.warn('[TradeHistory] Save failed:', error.message);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.warn('[TradeHistory] Save error:', err);
    return null;
  }
}

/**
 * Updates an existing trade (e.g. when closing a position).
 */
export async function closeTradeInHistory(params: {
  tradeId?: string;
  userId: string;
  symbol: string;
  exitPrice: number;
  pnl: number;
  status?: 'closed' | 'liquidated';
}): Promise<boolean> {
  if (!isSupabaseConfigured() || !params.userId) return false;

  try {
    // If we have a trade ID, update it directly
    if (params.tradeId) {
      const { error } = await supabase.from('trades').update({
        exit_price: params.exitPrice,
        current_price: params.exitPrice,
        pnl: params.pnl,
        pnl_percentage: params.pnl !== 0 ? ((params.pnl / Math.abs(params.pnl)) * 100) : 0,
        status: params.status ?? 'closed',
        closed_at: new Date().toISOString(),
      }).eq('id', params.tradeId);

      return !error;
    }

    // Otherwise, find the most recent open trade for this symbol/user and close it
    const normalizedSymbol = params.symbol.replace('/USD', '').replace('/JPY', '').replace('/GBP', '');
    const { data } = await supabase.from('trades')
      .select('id')
      .eq('user_id', params.userId)
      .eq('status', 'open')
      .or(`symbol.eq.${normalizedSymbol},pair.ilike.%${normalizedSymbol}%`)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      const { error } = await supabase.from('trades').update({
        exit_price: params.exitPrice,
        current_price: params.exitPrice,
        pnl: params.pnl,
        status: params.status ?? 'closed',
        closed_at: new Date().toISOString(),
      }).eq('id', data.id);

      return !error;
    }

    return false;
  } catch (err) {
    console.warn('[TradeHistory] Close error:', err);
    return false;
  }
}
