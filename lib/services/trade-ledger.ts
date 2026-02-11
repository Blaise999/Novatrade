import type { SupabaseClient } from '@supabase/supabase-js';

export type TradeMarketType = 'fx' | 'crypto' | 'stocks' | 'commodities' | 'indices' | 'other';
export type TradeStatus = 'active' | 'closed' | 'cancelled' | 'liquidated';
export type TradeDirection = 'buy' | 'sell' | 'long' | 'short';

export type OpenTradeInput = {
  userId: string;
  marketType: TradeMarketType;
  symbol: string;

  // FX: MUST be your positionId so close updates same row
  sessionId?: string;

  tradeType?: string; // 'spot'|'margin'|'futures'|'copy'
  direction?: TradeDirection;

  qty?: number;
  leverage?: number;

  entryPrice?: number;
  fees?: number;

  openedAt?: string; // ISO
  meta?: Record<string, any>;
};

export type CloseTradeInput = {
  userId: string;

  // prefer sessionId (FX). fallback to tradeId
  sessionId?: string;
  tradeId?: string;

  exitPrice?: number;
  pnl?: number;
  pnlPct?: number;
  fees?: number;

  closedAt?: string; // ISO
  status?: Extract<TradeStatus, 'closed' | 'cancelled' | 'liquidated'>;
  meta?: Record<string, any>;
};

function cleanSessionId(v?: string) {
  const s = (v ?? '').trim();
  return s.length ? s : undefined;
}

/**
 * Create a trade row (or return existing if session conflict).
 */
export async function ledgerOpenTrade(supabase: SupabaseClient, input: OpenTradeInput) {
  const payload = {
    user_id: input.userId,
    market_type: input.marketType,
    symbol: input.symbol,
    session_id: cleanSessionId(input.sessionId) ?? null,

    trade_type: input.tradeType ?? null,
    direction: input.direction ?? null,
    status: 'active',

    qty: input.qty ?? null,
    leverage: input.leverage ?? null,

    entry_price: input.entryPrice ?? null,
    fees: input.fees ?? null,

    opened_at: input.openedAt ?? new Date().toISOString(),
    closed_at: null,

    meta: input.meta ?? {},
  };

  const { data, error } = await supabase
    .from('trades')
    .insert(payload)
    .select('*')
    .single();

  // If session_id conflict (already inserted), just fetch and return it
  if (error && (error.code === '23505' || String(error.message).toLowerCase().includes('duplicate'))) {
    if (payload.session_id) {
      const existing = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', input.userId)
        .eq('session_id', payload.session_id)
        .maybeSingle();

      if (existing.error) throw existing.error;
      if (existing.data) return existing.data;
    }
  }

  if (error) throw error;
  return data;
}

/**
 * Close/update an existing row (FX: match by session_id).
 * If the row is missing (rare race condition), it will insert a closed row (so history never loses trades).
 */
export async function ledgerCloseTrade(supabase: SupabaseClient, input: CloseTradeInput) {
  const sessionId = cleanSessionId(input.sessionId);
  const status = input.status ?? 'closed';

  const updatePayload: any = {
    status,
    exit_price: input.exitPrice ?? null,
    pnl: input.pnl ?? null,
    pnl_pct: input.pnlPct ?? null,
    fees: input.fees ?? null,
    closed_at: input.closedAt ?? new Date().toISOString(),
  };

  // meta merge: fetch existing first if you want deep merge. We'll just overwrite safely.
  if (input.meta) updatePayload.meta = input.meta;

  // 1) try update by session_id (best for FX)
  if (sessionId) {
    const { data, error } = await supabase
      .from('trades')
      .update(updatePayload)
      .eq('user_id', input.userId)
      .eq('session_id', sessionId)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    // If found, done
    if (data) return data;

    // 2) if not found, insert a closed row (don’t lose trade)
    const inserted = await supabase
      .from('trades')
      .insert({
        user_id: input.userId,
        market_type: 'fx',
        symbol: 'UNKNOWN',
        session_id: sessionId,
        status,
        opened_at: new Date().toISOString(),
        closed_at: updatePayload.closed_at,
        exit_price: updatePayload.exit_price,
        pnl: updatePayload.pnl,
        pnl_pct: updatePayload.pnl_pct,
        fees: updatePayload.fees,
        meta: input.meta ?? { repaired: true, reason: 'close_without_open' },
      })
      .select('*')
      .single();

    if (inserted.error) throw inserted.error;
    return inserted.data;
  }

  // 3) fallback: update by tradeId
  if (!input.tradeId) throw new Error('ledgerCloseTrade requires sessionId or tradeId');

  const res = await supabase
    .from('trades')
    .update(updatePayload)
    .eq('user_id', input.userId)
    .eq('id', input.tradeId)
    .select('*')
    .single();

  if (res.error) throw res.error;
  return res.data;
}

export async function ledgerListTrades(
  supabase: SupabaseClient,
  userId: string,
  opts?: { marketType?: TradeMarketType | 'all'; status?: TradeStatus | 'all'; page?: number; pageSize?: number }
) {
  const page = opts?.page ?? 0;
  const pageSize = opts?.pageSize ?? 25;

  let q = supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (opts?.marketType && opts.marketType !== 'all') q = q.eq('market_type', opts.marketType);
  if (opts?.status && opts.status !== 'all') q = q.eq('status', opts.status);

  const res = await q;
  if (res.error) throw res.error;
  return res.data ?? [];
}
