// lib/services/trade-activities.ts
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

export type TradeRow = Record<string, any>;

export type TradeActivity = {
  id: string;
  ts: number;
  action: 'opened' | 'closed' | 'buy' | 'sell';
  symbol: string;
  marketType?: string;
  amount?: number;
  quantity?: number;
  price?: number;
  pnl?: number;
  raw: TradeRow;
};

function toMs(v: any): number {
  if (v == null) return 0;

  // number ts
  if (typeof v === 'number' && Number.isFinite(v)) {
    // seconds -> ms
    return v < 1e12 ? Math.floor(v * 1000) : Math.floor(v);
  }

  // ISO string
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }

  return 0;
}

function bestEventMs(tr: TradeRow): number {
  // priority: executed_at (your canonical), then closed/opened, then created/updated
  return (
    toMs(tr.executed_at) ||
    toMs(tr.closed_at) ||
    toMs(tr.opened_at) ||
    toMs(tr.created_at) ||
    toMs(tr.updated_at) ||
    0
  );
}

// If a single row represents an opened position + later closed position,
// we can split into 2 activity cards (opened + closed) so it feels like “individual orders”.
function expandRow(tr: TradeRow): TradeActivity[] {
  const symbol = String(tr.symbol ?? tr.pair ?? '').split('/')[0].toUpperCase();
  const marketType = tr.market_type ?? tr.marketType;

  const openedAt = toMs(tr.opened_at);
  const closedAt = toMs(tr.closed_at);

  const type = String(tr.type ?? '').toLowerCase(); // buy/sell
  const status = String(tr.status ?? '').toLowerCase(); // open/closed

  const amount = typeof tr.amount === 'number' ? tr.amount : Number(tr.amount ?? 0);
  const quantity = typeof tr.quantity === 'number' ? tr.quantity : Number(tr.quantity ?? 0);

  const entry = typeof tr.entry_price === 'number' ? tr.entry_price : Number(tr.entry_price ?? 0);
  const exit = typeof tr.exit_price === 'number' ? tr.exit_price : Number(tr.exit_price ?? 0);
  const pnl = typeof tr.pnl === 'number' ? tr.pnl : Number(tr.pnl ?? 0);

  // Spot-style “order row” (already individual)
  if (status === 'closed' && (!openedAt || !closedAt || openedAt === closedAt)) {
    const ts = bestEventMs(tr);
    return [
      {
        id: `${tr.id ?? symbol}:${type || 'order'}:${ts}`,
        ts,
        action: (type === 'sell' ? 'sell' : 'buy') as 'buy' | 'sell',
        symbol,
        marketType,
        amount,
        quantity,
        price: type === 'sell' ? exit || entry : entry || exit,
        pnl: type === 'sell' ? pnl : undefined,
        raw: tr,
      },
    ];
  }

  // Position-style row: show OPEN and (if exists) CLOSE as separate activities
  const out: TradeActivity[] = [];

  const openTs = openedAt || toMs(tr.created_at) || bestEventMs(tr);
  out.push({
    id: `${tr.id ?? symbol}:opened:${openTs}`,
    ts: openTs,
    action: type === 'sell' ? 'sell' : 'opened',
    symbol,
    marketType,
    amount,
    quantity,
    price: entry || exit,
    raw: tr,
  });

  if (closedAt) {
    out.push({
      id: `${tr.id ?? symbol}:closed:${closedAt}`,
      ts: closedAt,
      action: type === 'buy' ? 'closed' : 'sell',
      symbol,
      marketType,
      amount,
      quantity,
      price: exit || entry,
      pnl,
      raw: tr,
    });
  }

  return out;
}

async function fetchTrades(userId: string, limit = 200): Promise<TradeRow[]> {
  if (!isSupabaseConfigured()) return [];

  // try user_id first
  let r = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!r.error) return r.data ?? [];

  // fallback userId
  r = await supabase
    .from('trades')
    .select('*')
    .eq('userId', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (r.error) {
    console.error('fetchTrades failed:', r.error);
    return [];
  }

  return r.data ?? [];
}

export async function fetchTradeActivities(userId: string, limit = 200): Promise<TradeActivity[]> {
  const rows = await fetchTrades(userId, limit);

  const activities = rows.flatMap(expandRow);

  // ✅ Sort newest → oldest
  activities.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return activities;
}
