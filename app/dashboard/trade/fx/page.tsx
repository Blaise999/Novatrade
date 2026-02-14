// app/dashboard/trade/fx/page.tsx
'use client';

/**
 * FX PAGE (OLYMP-STYLE)
 * --------------------
 * UI = TV screen
 * Server = Judge
 *
 * - Opens trades via POST /api/trades (atomic balance deduction)
 * - Loads trades via GET /api/trades
 * - Closes trades via PATCH /api/trades (atomic balance credit)
 *
 * IMPORTANT:
 * - No local balance mutations (only trust server newBalance)
 * - UI can compute floating PnL for display, but only server can settle
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Loader2,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

type DirectionLabel = 'buy' | 'sell';
type CloseReason = 'manual' | 'liquidated' | 'stopped_out' | 'take_profit';

type FxUiTrade = {
  id: string;
  asset: string; // e.g. "EUR/USD"
  assetType: 'forex';
  directionInt: 1 | -1;
  directionLabel: DirectionLabel;

  investment: number;
  multiplier: number;
  volume: number;

  entryPrice: number;
  liquidationPrice: number;

  stopLoss?: number | null;
  takeProfit?: number | null;

  spreadCost?: number;

  status: 'active' | 'closed' | 'liquidated' | 'stopped_out' | 'take_profit';

  currentPrice: number;
  floatingPnL: number;
  floatingPnLPercent: number;

  openedAt?: string;
  updatedAt?: string;
};

const DEFAULT_PAIRS: { symbol: string; name: string }[] = [
  { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
  { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
  { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc' },
  { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
  { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar' },
  { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar' },
  { symbol: 'EUR/GBP', name: 'Euro / British Pound' },
  { symbol: 'EUR/JPY', name: 'Euro / Japanese Yen' },
  { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen' },
];

function clampNum(n: any, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function parseDirectionLabel(input: any): DirectionLabel {
  const v = String(input || '').toLowerCase();
  return v === 'sell' || v === 'short' || v === 'down' ? 'sell' : 'buy';
}

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_authenticated');
  return { authorization: `Bearer ${token}` };
}

/**
 * price can be:
 * - number
 * - { bid, ask, mid }
 */
function getMidPrice(p: any): number | null {
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  if (!p) return null;
  const bid = Number(p.bid);
  const ask = Number(p.ask);
  const mid =
    p.mid != null ? Number(p.mid) : Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
  return Number.isFinite(mid) ? mid : null;
}

// P/L = D × I × M × ((P - entry) / entry)
function calcPnL(directionInt: 1 | -1, investment: number, multiplier: number, entry: number, price: number) {
  if (!entry || entry <= 0) return 0;
  const rel = (price - entry) / entry;
  let pnl = directionInt * investment * multiplier * rel;
  // cap loss at -investment
  if (pnl < -investment) pnl = -investment;
  return pnl;
}

function shouldLiquidate(floatingPnL: number, investment: number) {
  return floatingPnL <= -investment;
}
function shouldStopLoss(direction: 1 | -1, price: number, stopLoss?: number | null) {
  if (!stopLoss) return false;
  return direction === 1 ? price <= stopLoss : price >= stopLoss;
}
function shouldTakeProfit(direction: 1 | -1, price: number, takeProfit?: number | null) {
  if (!takeProfit) return false;
  return direction === 1 ? price >= takeProfit : price <= takeProfit;
}

/**
 * Convert DB row -> UI trade
 * Your GET /api/trades returns rows from `trades` table
 */
function dbRowToUi(r: any): FxUiTrade {
  const directionInt = (r.direction_int ??
    (String(r.direction || r.type).toLowerCase() === 'buy' ? 1 : -1)) as 1 | -1;
  const directionLabel: DirectionLabel = directionInt === 1 ? 'buy' : 'sell';

  const investment = clampNum(r.investment ?? r.amount ?? 0);
  const multiplier = clampNum(r.multiplier ?? r.leverage ?? 1, 1);
  const entryPrice = clampNum(r.entry_price ?? r.entryPrice ?? 0);
  const currentPrice = clampNum(r.current_price ?? entryPrice);

  const floatingPnL = calcPnL(directionInt, investment, multiplier, entryPrice, currentPrice);
  const floatingPnLPercent = investment > 0 ? (floatingPnL / investment) * 100 : 0;

  return {
    id: String(r.id),
    asset: String(r.asset ?? r.symbol ?? r.pair ?? ''),
    assetType: 'forex',
    directionInt,
    directionLabel,
    investment,
    multiplier,
    volume: clampNum(r.volume ?? investment * multiplier),
    entryPrice,
    liquidationPrice: clampNum(r.liquidation_price ?? 0),
    stopLoss: r.stop_loss ?? null,
    takeProfit: r.take_profit ?? null,
    spreadCost: clampNum(r.spread_cost ?? 0),
    status:
      r.status === 'open'
        ? 'active'
        : (String(r.status || 'active') as FxUiTrade['status']),
    currentPrice,
    floatingPnL,
    floatingPnLPercent,
    openedAt: r.opened_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Convert POST response trade -> UI trade
 * Your POST /api/trades returns `trade` object (not full DB row)
 */
function apiTradeToUi(t: any): FxUiTrade {
  const directionLabel = parseDirectionLabel(t.direction);
  const directionInt: 1 | -1 = directionLabel === 'buy' ? 1 : -1;

  const investment = clampNum(t.investment, 0);
  const multiplier = clampNum(t.multiplier, 1);
  const entryPrice = clampNum(t.entryPrice, 0);

  const spreadCost = clampNum(t.spreadCost ?? 0);

  return {
    id: String(t.id),
    asset: String(t.asset ?? t.symbol ?? ''),
    assetType: 'forex',
    directionInt,
    directionLabel,
    investment,
    multiplier,
    volume: clampNum(t.volume ?? investment * multiplier),
    entryPrice,
    liquidationPrice: clampNum(t.liquidationPrice ?? 0),
    stopLoss: t.stopLoss ?? null,
    takeProfit: t.takeProfit ?? null,
    spreadCost,
    status: 'active',
    currentPrice: entryPrice,
    floatingPnL: spreadCost ? -spreadCost : 0,
    floatingPnLPercent: investment > 0 ? ((spreadCost ? -spreadCost : 0) / investment) * 100 : 0,
    openedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * OPTIONAL: price fetcher (safe, won’t crash if endpoint doesn’t exist)
 * If you already have a live price system elsewhere, just replace this.
 */
async function fetchFxPrices(symbols: string[]): Promise<Record<string, any>> {
  if (!symbols.length) return {};
  const qs = encodeURIComponent(symbols.join(','));

  const candidates = [
    `/api/fx/prices?symbols=${qs}`,
    `/api/prices?market=fx&symbols=${qs}`,
    `/api/quotes?market=fx&symbols=${qs}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      // accept either {prices:{SYM:...}} or direct {SYM:...}
      const prices = (json?.prices && typeof json.prices === 'object') ? json.prices : json;
      if (prices && typeof prices === 'object') return prices;
    } catch {
      // ignore
    }
  }

  return {};
}

export default function FXPage() {
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const [balance, setBalance] = useState<number>(0);
  const [trades, setTrades] = useState<FxUiTrade[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});

  // trade form
  const [pair, setPair] = useState(DEFAULT_PAIRS[0]?.symbol || 'EUR/USD');
  const [direction, setDirection] = useState<DirectionLabel>('buy');
  const [investment, setInvestment] = useState<number>(50);
  const [multiplier, setMultiplier] = useState<number>(50);
  const [stopLoss, setStopLoss] = useState<string>(''); // keep raw for empty
  const [takeProfit, setTakeProfit] = useState<string>('');

  // ui state
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>('');

  // prevent double-close spam
  const closingRef = useRef<Set<string>>(new Set());

  const activeTrades = useMemo(
    () => trades.filter((t) => t.status === 'active'),
    [trades]
  );

  const symbolsForPrice = useMemo(() => {
    const s = new Set<string>();
    s.add(pair);
    for (const t of activeTrades) s.add(t.asset);
    return Array.from(s);
  }, [pair, activeTrades]);

  const currentMid = useMemo(() => getMidPrice(prices?.[pair]), [prices, pair]);

  async function loadTrades(mode: 'active' | 'history' = tab) {
    setError('');
    setLoading(true);
    try {
      const h = await getAuthHeader();
      const url =
        mode === 'active'
          ? `/api/trades?status=active&limit=200&offset=0`
          : `/api/trades?limit=200&offset=0`;

      const res = await fetch(url, { headers: { ...h }, cache: 'no-store' });
      const json = await res.json();

      if (!json?.success) throw new Error(json?.error || 'failed_load_trades');

      setBalance(clampNum(json.balance ?? 0));
      const rows = Array.isArray(json.trades) ? json.trades : [];
      const parsed = rows.map(dbRowToUi).filter((t) => t.assetType === 'forex' && t.asset);

      // if history tab, keep all statuses; if active tab, keep active only
      setTrades(mode === 'active' ? parsed.filter((t) => t.status === 'active') : parsed);
    } catch (e: any) {
      setError(e?.message || 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPricesOnce() {
    setRefreshing(true);
    try {
      const next = await fetchFxPrices(symbolsForPrice);
      if (next && typeof next === 'object') {
        setPrices((prev) => ({ ...prev, ...next }));
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function openTrade() {
    setError('');

    const mid = currentMid;
    if (!mid || mid <= 0) {
      setError('No market price available for this pair yet. Refresh prices or add your FX price endpoint.');
      return;
    }

    const inv = clampNum(investment, 0);
    const mult = clampNum(multiplier, 1);

    if (inv <= 0) return setError('Investment must be positive');
    if (mult < 1 || mult > 1000) return setError('Multiplier must be between 1 and 1000');

    setOpening(true);
    try {
      const h = await getAuthHeader();

      const idempotencyKey =
        typeof crypto !== 'undefined' && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          ...h,
          'content-type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          asset: pair,
          assetType: 'forex',
          direction, // 'buy'|'sell'
          investment: inv,
          multiplier: mult,
          marketPrice: mid, // mid price
          stopLoss: stopLoss.trim() ? Number(stopLoss) : undefined,
          takeProfit: takeProfit.trim() ? Number(takeProfit) : undefined,
          idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || 'trade_open_failed');

      setBalance(clampNum(json.newBalance ?? balance));
      const ui = apiTradeToUi(json.trade);
      setTrades((prev) => [ui, ...prev]);

      // after opening, keep you on active tab
      setTab('active');
    } catch (e: any) {
      setError(e?.message || 'Failed to open trade');
    } finally {
      setOpening(false);
    }
  }

  async function closeTrade(tradeId: string, exitPrice: number, closeReason: CloseReason = 'manual') {
    if (closingRef.current.has(tradeId)) return;
    closingRef.current.add(tradeId);

    try {
      const h = await getAuthHeader();

      const res = await fetch('/api/trades', {
        method: 'PATCH',
        headers: { ...h, 'content-type': 'application/json' },
        body: JSON.stringify({
          tradeId,
          action: 'close',
          exitPrice,
          closeReason,
        }),
      });

      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || 'trade_close_failed');

      setBalance(clampNum(json.newBalance ?? balance));

      // if viewing active: remove
      if (tab === 'active') {
        setTrades((prev) => prev.filter((t) => t.id !== tradeId));
      } else {
        // if viewing history: mark as closed status
        setTrades((prev) =>
          prev.map((t) =>
            t.id === tradeId
              ? {
                  ...t,
                  status:
                    closeReason === 'liquidated'
                      ? 'liquidated'
                      : closeReason === 'stopped_out'
                      ? 'stopped_out'
                      : closeReason === 'take_profit'
                      ? 'take_profit'
                      : 'closed',
                }
              : t
          )
        );
      }
    } finally {
      // release after a moment
      setTimeout(() => closingRef.current.delete(tradeId), 1200);
    }
  }

  // initial load
  useEffect(() => {
    loadTrades('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tab change -> reload
  useEffect(() => {
    loadTrades(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // poll prices (optional)
  useEffect(() => {
    let alive = true;

    (async () => {
      const next = await fetchFxPrices(symbolsForPrice);
      if (!alive) return;
      if (next && typeof next === 'object') setPrices((prev) => ({ ...prev, ...next }));
    })();

    const t = setInterval(async () => {
      const next = await fetchFxPrices(symbolsForPrice);
      if (!alive) return;
      if (next && typeof next === 'object') setPrices((prev) => ({ ...prev, ...next }));
    }, 1200);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [symbolsForPrice.join('|')]);

  // update floating pnl + auto-trigger closes (UI checks, server settles)
  useEffect(() => {
    const timer = setInterval(() => {
      setTrades((prev) =>
        prev.map((t) => {
          if (t.status !== 'active') return t;

          const mid = getMidPrice(prices?.[t.asset]);
          if (!mid || mid <= 0) return t;

          const pnl = calcPnL(t.directionInt, t.investment, t.multiplier, t.entryPrice, mid);
          const pnlPct = t.investment > 0 ? (pnl / t.investment) * 100 : 0;

          const liquidate = shouldLiquidate(pnl, t.investment);
          const sl = shouldStopLoss(t.directionInt, mid, t.stopLoss);
          const tp = shouldTakeProfit(t.directionInt, mid, t.takeProfit);

          const reason: CloseReason | null = liquidate
            ? 'liquidated'
            : sl
            ? 'stopped_out'
            : tp
            ? 'take_profit'
            : null;

          if (reason && !closingRef.current.has(t.id)) {
            // fire and forget, but guarded
            closeTrade(t.id, mid, reason).catch(() => {});
          }

          return {
            ...t,
            currentPrice: mid,
            floatingPnL: pnl,
            floatingPnLPercent: pnlPct,
            updatedAt: new Date().toISOString(),
          };
        })
      );
    }, 500);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

  return (
    <div className="min-h-screen bg-void text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">FX Trading</h1>
            <p className="text-white/60 text-sm mt-1">
              Olymp-style: server executes, UI displays. Balance is authoritative from server.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="text-xs text-white/60">Balance Available</div>
              <div className="text-lg font-semibold tabular-nums">${balance.toFixed(2)}</div>
            </div>

            <button
              onClick={async () => {
                setError('');
                await refreshPricesOnce();
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 transition"
              disabled={refreshing}
              title="Refresh market prices"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              <span className="text-sm">Refresh</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-300 mt-0.5" />
            <div className="text-sm text-red-100">{error}</div>
          </div>
        ) : null}

        {/* Tabs */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setTab('active')}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              tab === 'active' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              tab === 'history' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            History
          </button>
        </div>

        {/* Open Trade */}
        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Open Trade</div>
              <div className="text-xs text-white/60 mt-1">
                Entry uses server engine. This form only sends parameters to <code className="text-white/80">/api/trades</code>.
              </div>
            </div>

            <div className="text-sm text-white/70">
              Market price:{' '}
              <span className="font-semibold tabular-nums text-white">
                {currentMid ? currentMid.toFixed(pair.includes('JPY') ? 3 : 5) : '--'}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Pair */}
            <div className="md:col-span-4">
              <label className="text-xs text-white/60">Pair</label>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
              >
                {DEFAULT_PAIRS.map((p) => (
                  <option key={p.symbol} value={p.symbol}>
                    {p.symbol} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Direction */}
            <div className="md:col-span-3">
              <label className="text-xs text-white/60">Direction</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('buy')}
                  className={`rounded-xl px-3 py-2 text-sm border transition inline-flex items-center justify-center gap-2 ${
                    direction === 'buy'
                      ? 'bg-emerald-500/15 border-emerald-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" /> Buy
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('sell')}
                  className={`rounded-xl px-3 py-2 text-sm border transition inline-flex items-center justify-center gap-2 ${
                    direction === 'sell'
                      ? 'bg-rose-500/15 border-rose-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <ArrowDownRight className="h-4 w-4" /> Sell
                </button>
              </div>
            </div>

            {/* Investment */}
            <div className="md:col-span-2">
              <label className="text-xs text-white/60">Investment ($)</label>
              <input
                type="number"
                value={investment}
                onChange={(e) => setInvestment(Number(e.target.value))}
                min={1}
                step={1}
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
              />
            </div>

            {/* Multiplier */}
            <div className="md:col-span-3">
              <label className="text-xs text-white/60">Multiplier (x)</label>
              <select
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
              >
                {[10, 25, 50, 75, 100, 150, 200, 300, 500, 1000].map((m) => (
                  <option key={m} value={m}>
                    x{m}
                  </option>
                ))}
              </select>
            </div>

            {/* Stop Loss */}
            <div className="md:col-span-3">
              <label className="text-xs text-white/60">Stop Loss (optional)</label>
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                step="any"
                placeholder="e.g. 1.08210"
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
              />
            </div>

            {/* Take Profit */}
            <div className="md:col-span-3">
              <label className="text-xs text-white/60">Take Profit (optional)</label>
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                step="any"
                placeholder="e.g. 1.09150"
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
              />
            </div>

            {/* CTA */}
            <div className="md:col-span-6 flex items-end justify-end">
              <button
                onClick={openTrade}
                disabled={opening}
                className="w-full md:w-auto rounded-xl px-5 py-3 bg-white text-black font-semibold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Open Trade
              </button>
            </div>
          </div>
        </div>

        {/* Trades Table */}
        <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">{tab === 'active' ? 'Active Trades' : 'Trade History'}</div>
              <div className="text-xs text-white/60 mt-1">
                Trades are read from <code className="text-white/80">/api/trades</code>.
              </div>
            </div>

            <button
              onClick={() => loadTrades(tab)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              <span className="text-sm">Reload</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/25 text-white/70">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Pair</th>
                  <th className="text-left px-5 py-3 font-medium">Side</th>
                  <th className="text-right px-5 py-3 font-medium">Invest</th>
                  <th className="text-right px-5 py-3 font-medium">x</th>
                  <th className="text-right px-5 py-3 font-medium">Entry</th>
                  <th className="text-right px-5 py-3 font-medium">Price</th>
                  <th className="text-right px-5 py-3 font-medium">P/L</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-white/60">
                      <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                      Loading trades...
                    </td>
                  </tr>
                ) : trades.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-white/60">
                      No trades found.
                    </td>
                  </tr>
                ) : (
                  trades.map((t) => {
                    const isBuy = t.directionLabel === 'buy';
                    const pnl = t.floatingPnL;
                    const pnlColor = pnl > 0 ? 'text-emerald-300' : pnl < 0 ? 'text-rose-300' : 'text-white/80';

                    const decimals = t.asset.includes('JPY') ? 3 : 5;

                    return (
                      <tr key={t.id} className="border-t border-white/10">
                        <td className="px-5 py-4">
                          <div className="font-semibold">{t.asset}</div>
                          <div className="text-xs text-white/50">ID: {t.id.slice(0, 8)}…</div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${
                              isBuy
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                            }`}
                          >
                            {isBuy ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {isBuy ? 'BUY' : 'SELL'}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right tabular-nums">${t.investment.toFixed(2)}</td>
                        <td className="px-5 py-4 text-right tabular-nums">x{t.multiplier}</td>
                        <td className="px-5 py-4 text-right tabular-nums">{t.entryPrice ? t.entryPrice.toFixed(decimals) : '--'}</td>
                        <td className="px-5 py-4 text-right tabular-nums">{t.currentPrice ? t.currentPrice.toFixed(decimals) : '--'}</td>

                        <td className={`px-5 py-4 text-right tabular-nums font-semibold ${pnlColor}`}>
                          {pnl >= 0 ? '+' : ''}
                          {pnl.toFixed(2)}{' '}
                          <span className="text-xs font-normal text-white/60">
                            ({t.floatingPnLPercent >= 0 ? '+' : ''}
                            {t.floatingPnLPercent.toFixed(2)}%)
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-xs text-white/70">{t.status}</span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          {t.status === 'active' ? (
                            <button
                              onClick={() => closeTrade(t.id, t.currentPrice || t.entryPrice, 'manual')}
                              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition"
                            >
                              <XCircle className="h-4 w-4" />
                              Close
                            </button>
                          ) : (
                            <span className="text-xs text-white/50">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 text-xs text-white/50">
            Note: If trades open but don’t appear here, your RPC must insert <code className="text-white/70">status = 'active'</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
