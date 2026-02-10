// lib/services/trade-history.ts
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type MarketType = 'crypto' | 'fx' | 'stocks';
type AssetType = 'crypto' | 'forex' | 'stock' | 'commodity' | 'index';
type TradeType = 'binary' | 'spot' | 'margin' | 'cfd';
type Direction = 'up' | 'down' | 'buy' | 'sell' | 'long' | 'short';
type Status = 'pending' | 'active' | 'won' | 'lost' | 'closed' | 'cancelled' | 'expired';

export type SaveTradeInput = {
  userId: string;
  symbol: string;

  // flexible inputs (so other pages won’t break)
  marketType?: string;
  assetType?: string;
  tradeType?: string;
  direction?: string;

  // some pages might send these
  type?: string; // buy/sell
  side?: string; // long/short
  status?: string; // open/active/pending/etc

  amount: number;
  entryPrice: number;

  quantity?: number;
  leverage?: number;

  stopLoss?: number;
  takeProfit?: number;

  payoutPercent?: number;
  durationSeconds?: number;

  fee?: number;
  fees?: number; // tolerate your existing "fees" key
  commission?: number;
  swap?: number;

  sessionId?: string;
  idempotencyKey?: string;
};

const normalizeMarketType = (v?: string): MarketType => {
  const x = String(v ?? '').toLowerCase();
  if (x === 'fx' || x === 'forex') return 'fx';
  if (x === 'stocks' || x === 'stock') return 'stocks';
  return 'crypto';
};

const normalizeAssetType = (v?: string): AssetType => {
  const x = String(v ?? '').toLowerCase();
  if (x === 'forex' || x === 'fx') return 'forex';
  if (x === 'stock' || x === 'stocks') return 'stock';
  if (x === 'commodity') return 'commodity';
  if (x === 'index') return 'index';
  return 'crypto';
};

const normalizeTradeType = (v?: string, marketType?: MarketType): TradeType => {
  const x = String(v ?? '').toLowerCase();
  if (x === 'binary') return 'binary';
  if (x === 'spot') return 'spot';
  if (x === 'margin') return 'margin';
  if (x === 'cfd') return 'cfd';
  // sensible fallback: FX is usually margin
  if (marketType === 'fx') return 'margin';
  return 'spot';
};

const normalizeDirection = (direction?: string, type?: string, side?: string): Direction => {
  const d = String(direction ?? '').toLowerCase();
  if (['up', 'down', 'buy', 'sell', 'long', 'short'].includes(d)) return d as Direction;

  const t = String(type ?? '').toLowerCase();
  if (t === 'buy') return 'buy';
  if (t === 'sell') return 'sell';

  const s = String(side ?? '').toLowerCase();
  if (s === 'long') return 'long';
  if (s === 'short') return 'short';

  return 'buy';
};

const normalizeStatus = (v?: string): Status => {
  const x = String(v ?? '').toLowerCase();
  // map common app words → your CHECK constraint values
  if (x === 'open') return 'active';
  if (x === 'active') return 'active';
  if (x === 'pending') return 'pending';
  if (x === 'won') return 'won';
  if (x === 'lost') return 'lost';
  if (x === 'closed') return 'closed';
  if (x === 'cancelled') return 'cancelled';
  if (x === 'expired') return 'expired';
  return 'active';
};

export async function saveTradeToHistory(input: SaveTradeInput) {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  const market_type = normalizeMarketType(input.marketType);
  const asset_type = normalizeAssetType(input.assetType);
  const trade_type = normalizeTradeType(input.tradeType, market_type);
  const direction = normalizeDirection(input.direction, input.type, input.side);
  const status = normalizeStatus(input.status);

  const fee = Number(input.fee ?? input.fees ?? 0) || 0;

  const row = {
    user_id: input.userId,
    symbol: input.symbol,

    market_type,
    asset_type,
    trade_type,
    direction,

    amount: input.amount,
    quantity: input.quantity ?? null,
    leverage: input.leverage ?? 1,

    entry_price: input.entryPrice,
    exit_price: null,

    stop_loss: input.stopLoss ?? null,
    take_profit: input.takeProfit ?? null,

    payout_percent: input.payoutPercent ?? 85,
    duration_seconds: input.durationSeconds ?? null,

    status,
    profit_loss: 0,
    payout_amount: null,

    fee,
    commission: input.commission ?? 0,
    swap: input.swap ?? 0,

    session_id: input.sessionId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
  };

  const { data, error } = await supabase.from('trades').insert(row).select('id').single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id as string };
}

export type CloseTradeInput = {
  userId: string;
  symbol: string;
  exitPrice: number;
  pnl: number;
  status?: 'closed' | 'won' | 'lost';
  sessionId?: string; // best matching key
};

export async function closeTradeInHistory(input: CloseTradeInput) {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  let tradeId: string | null = null;

  // best: match by session_id (your margin position id)
  if (input.sessionId) {
    const { data, error } = await supabase
      .from('trades')
      .select('id')
      .eq('user_id', input.userId)
      .eq('symbol', input.symbol)
      .eq('session_id', input.sessionId)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    tradeId = data?.id ?? null;
  }

  // fallback: last active/pending trade for symbol
  if (!tradeId) {
    const { data, error } = await supabase
      .from('trades')
      .select('id')
      .eq('user_id', input.userId)
      .eq('symbol', input.symbol)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    tradeId = data?.id ?? null;
  }

  if (!tradeId) return { success: false, error: 'No active trade found to close' };

  const finalStatus =
    input.status ?? (input.pnl > 0 ? 'won' : input.pnl < 0 ? 'lost' : 'closed');

  const { error: updErr } = await supabase
    .from('trades')
    .update({
      exit_price: input.exitPrice,
      closed_at: new Date().toISOString(),
      profit_loss: input.pnl,
      status: finalStatus,
    })
    .eq('id', tradeId)
    .eq('user_id', input.userId);

  if (updErr) return { success: false, error: updErr.message };
  return { success: true, id: tradeId };
}
