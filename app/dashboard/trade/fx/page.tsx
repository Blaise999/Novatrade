'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { RefreshCw, TrendingUp, TrendingDown, XCircle, History, ShieldAlert } from 'lucide-react';




type Mode = 'active' | 'history';

type TradeStatus =
  | 'active'
  | 'closed'
  | 'liquidated'
  | 'stopped_out'
  | 'take_profit'
  | 'open'; // sometimes DB uses "open"

type TradeRow = {
  id: string;
  user_id?: string;

  // asset fields (varies)
  asset?: string; // some systems
  pair?: string; // fx engine wrote pair
  symbol?: string;

  asset_type?: string; // "forex"
  market_type?: string; // "fx"

  // direction fields (varies)
  direction?: string; // "buy"/"sell"
  type?: string; // also "buy"/"sell"
  direction_int?: number; // 1 / -1

  // money
  investment?: number;
  amount?: number;

  multiplier?: number;
  leverage?: number;
  volume?: number;

  entry_price?: number;
  current_price?: number;
  exit_price?: number;

  liquidation_price?: number;
  stop_loss?: number | null;
  take_profit?: number | null;

  // pnl
  floating_pnl?: number;
  pnl?: number;
  profit_loss?: number;

  spread_cost?: number;

  status?: string;

  opened_at?: string;
  closed_at?: string | null;
  updated_at?: string;
};

type FxUiTrade = {
  id: string;
  asset: string;
  assetType: 'forex';
  direction: 'buy' | 'sell';
  directionInt: 1 | -1;

  investment: number;
  multiplier: number;
  volume: number;

  entryPrice: number;
  currentPrice: number;
  exitPrice?: number;

  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;

  pnl: number; // floating if active, final if closed
  pnlPercent: number;

  spreadCost: number;

  status: Exclude<TradeStatus, 'open'>;

  openedAt?: string;
  closedAt?: string;
  updatedAt?: string;
};

function makeIdempotencyKey(): string {
  try {
    // optional chaining avoids the “always true” function check
    const key = globalThis.crypto?.randomUUID?.();
    if (key) return key;
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toDirInt(row: TradeRow): 1 | -1 {
  const di = clampNum(row.direction_int, 0);
  if (di === 1 || di === -1) return di as 1 | -1;

  const s = String(row.direction ?? row.type ?? '').toLowerCase();
  return s === 'buy' || s === 'long' || s === 'up' ? 1 : -1;
}

function toDirLabel(di: 1 | -1): 'buy' | 'sell' {
  return di === 1 ? 'buy' : 'sell';
}

function normStatus(s: unknown): FxUiTrade['status'] {
  const v = String(s ?? '').toLowerCase();
  if (v === 'open') return 'active';
  if (v === 'active') return 'active';
  if (v === 'closed') return 'closed';
  if (v === 'liquidated') return 'liquidated';
  if (v === 'stopped_out') return 'stopped_out';
  if (v === 'take_profit') return 'take_profit';
  // default: treat unknown as history-safe
  return 'closed';
}

function dbRowToUi(row: TradeRow): FxUiTrade {
  const asset = String(row.asset ?? row.symbol ?? row.pair ?? '').trim();
  const assetType = 'forex' as const;

  const directionInt = toDirInt(row);
  const direction = toDirLabel(directionInt);

  const investment = clampNum(row.investment ?? row.amount, 0);
  const multiplier = clampNum(row.multiplier ?? row.leverage, 1);
  const volume = clampNum(row.volume, investment * multiplier);

  const entryPrice = clampNum(row.entry_price, 0);
  const currentPrice = clampNum(row.current_price ?? row.entry_price, entryPrice);
  const exitPrice = row.exit_price != null ? clampNum(row.exit_price, 0) : undefined;

  const liquidationPrice = clampNum(row.liquidation_price, 0);
  const stopLoss = row.stop_loss != null ? clampNum(row.stop_loss, 0) : undefined;
  const takeProfit = row.take_profit != null ? clampNum(row.take_profit, 0) : undefined;

  const status = normStatus(row.status);

  // Prefer DB-provided pnl fields; otherwise compute from prices (display only).
  const pnlFromDb =
    row.floating_pnl != null
      ? clampNum(row.floating_pnl, 0)
      : row.pnl != null
        ? clampNum(row.pnl, 0)
        : row.profit_loss != null
          ? clampNum(row.profit_loss, 0)
          : 0;

  const pnl =
    pnlFromDb !== 0
      ? pnlFromDb
      : entryPrice > 0
        ? directionInt * investment * multiplier * ((currentPrice - entryPrice) / entryPrice)
        : 0;

  const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;

  const spreadCost = clampNum(row.spread_cost, 0);

  return {
    id: row.id,
    asset,
    assetType,
    direction,
    directionInt,
    investment,
    multiplier,
    volume,
    entryPrice,
    currentPrice,
    exitPrice,
    liquidationPrice,
    stopLoss,
    takeProfit,
    pnl,
    pnlPercent,
    spreadCost,
    status,
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

function fmt(n: number, dp = 2) {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(dp);
}

const FX_PAIRS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'AUD/USD',
  'USD/CAD',
  'NZD/USD',
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
  'EUR/CHF',
  'CHF/JPY',
  'AUD/JPY',
  'CAD/JPY',
] as const;

const MULTIPLIERS = [10, 25, 50, 100, 200, 500, 1000] as const;

export default function FXTradePage() {
  const [mode, setMode] = useState<Mode>('active');

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [trades, setTrades] = useState<FxUiTrade[]>([]);
  const [exitDraft, setExitDraft] = useState<Record<string, string>>({});

  // Open form (TV screen only — server is judge)
  const [asset, setAsset] = useState<string>('EUR/USD');
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [investment, setInvestment] = useState<string>('50');
  const [multiplier, setMultiplier] = useState<number>(100);
  const [marketPrice, setMarketPrice] = useState<string>('1.00000');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');

  const firstLoadRef = useRef(false);

  const canUseSupabase = isSupabaseConfigured && !!supabase;

  const headerAuthToken = async (): Promise<string | null> => {
    if (!canUseSupabase) return null;
    const { data, error: sErr } = await supabase.auth.getSession();
    if (sErr) return null;
    const token = data.session?.access_token ?? null;
    return token;
  };

  const loadTrades = async (nextMode: Mode = mode) => {
    setError(null);
    setLoading(true);

    try {
      const token = await headerAuthToken();
      if (!token) throw new Error('Not signed in (missing access token)');

      const res = await fetch(`/api/trades?limit=200`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to load trades (${res.status})`);
      }

      setBalance(clampNum(json.balance ?? json.newBalance ?? 0));

      const rows: TradeRow[] = Array.isArray(json.trades) ? (json.trades as TradeRow[]) : [];

      // ✅ typed map + type-guard filter (no implicit any)
      const parsed = rows
        .map(dbRowToUi)
        .filter((t): t is FxUiTrade => t.assetType === 'forex' && !!t.asset);

      // active tab => only active; history => everything
      setTrades(nextMode === 'active' ? parsed.filter((t) => t.status === 'active') : parsed);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    loadTrades('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    await loadTrades(mode);
  };

  const openTrade = async () => {
    setError(null);
    setLoading(true);

    try {
      const token = await headerAuthToken();
      if (!token) throw new Error('Not signed in (missing access token)');

      const inv = clampNum(investment, 0);
      const mp = clampNum(marketPrice, 0);
      const sl = stopLoss.trim() ? clampNum(stopLoss, 0) : undefined;
      const tp = takeProfit.trim() ? clampNum(takeProfit, 0) : undefined;

      if (!asset) throw new Error('Select an FX pair');
      if (inv <= 0) throw new Error('Investment must be greater than 0');
      if (mp <= 0) throw new Error('Market price must be greater than 0');
      if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 1000) {
        throw new Error('Multiplier must be between 1 and 1000');
      }

   const idempotencyKey = makeIdempotencyKey();


      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          asset,
          assetType: 'forex',
          direction, // 'buy' | 'sell'
          investment: inv,
          multiplier,
          marketPrice: mp,
          stopLoss: sl,
          takeProfit: tp,
          idempotencyKey,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Trade open failed (${res.status})`);
      }

      // server is judge: trust server balance
      if (json?.newBalance != null) setBalance(clampNum(json.newBalance, balance));

      // reload list from server
      await loadTrades(mode);
    } catch (e: any) {
      setError(e?.message || 'Failed to open trade');
    } finally {
      setLoading(false);
    }
  };

  const closeTrade = async (t: FxUiTrade) => {
    setError(null);
    setActionLoadingId(t.id);

    try {
      const token = await headerAuthToken();
      if (!token) throw new Error('Not signed in (missing access token)');

      const draft = (exitDraft[t.id] ?? '').trim();
      const exit = draft ? clampNum(draft, 0) : clampNum(t.currentPrice, 0);
      if (exit <= 0) throw new Error('Exit price must be greater than 0');

      const res = await fetch('/api/trades', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradeId: t.id,
          exitPrice: exit,
          closeReason: 'manual',
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Trade close failed (${res.status})`);
      }

      if (json?.newBalance != null) setBalance(clampNum(json.newBalance, balance));

      setExitDraft((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });

      await loadTrades(mode);
    } catch (e: any) {
      setError(e?.message || 'Failed to close trade');
    } finally {
      setActionLoadingId(null);
    }
  };

  const headerIcon = mode === 'active' ? <TrendingUp className="h-4 w-4" /> : <History className="h-4 w-4" />;

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const at = Date.parse(a.openedAt || a.updatedAt || '') || 0;
      const bt = Date.parse(b.openedAt || b.updatedAt || '') || 0;
      return bt - at;
    });
  }, [trades]);

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              {headerIcon}
            </div>
            <div>
              <div className="text-lg font-semibold">FX Trading</div>
              <div className="text-xs text-white/60">Olymp-style: server decides, UI only displays.</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[11px] text-white/60">Available Balance</div>
              <div className="text-sm font-semibold">${fmt(balance, 2)}</div>
            </div>

            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
              disabled={loading}
              type="button"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-red-200 mt-0.5" />
            <div className="text-sm text-red-100">{error}</div>
          </div>
        ) : null}

        {/* Open trade card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="font-semibold">Open Trade</div>
              <div className="text-xs text-white/60">Deduction happens atomically on the server.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs text-white/60">Pair</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
              >
                {FX_PAIRS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60">Direction</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('buy')}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    direction === 'buy'
                      ? 'bg-emerald-500/20 border-emerald-500/40'
                      : 'bg-black/30 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Buy
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('sell')}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    direction === 'sell'
                      ? 'bg-rose-500/20 border-rose-500/40'
                      : 'bg-black/30 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Sell
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Investment ($)</label>
              <input
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                placeholder="50"
              />
            </div>

            <div>
              <label className="text-xs text-white/60">Multiplier</label>
              <select
                value={multiplier}
                onChange={(e) => setMultiplier(Number(e.target.value))}
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
              >
                {MULTIPLIERS.map((m) => (
                  <option key={m} value={m}>
                    x{m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/60">Market Price</label>
              <input
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                placeholder="1.00000"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-white/60">Stop Loss (optional)</label>
              <input
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                placeholder="e.g. 0.99500"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-white/60">Take Profit (optional)</label>
              <input
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                placeholder="e.g. 1.01000"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-white/60">
              Tip: set <span className="text-white/80">Market Price</span> to your live quote source if you have one.
            </div>

            <button
              onClick={openTrade}
              disabled={loading || !canUseSupabase}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-semibold hover:opacity-90 transition disabled:opacity-50"
              type="button"
            >
              Open Trade
            </button>
          </div>

          {!canUseSupabase ? (
            <div className="mt-3 text-xs text-yellow-200/80 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Supabase client not configured — cannot fetch session token to call /api/trades.
            </div>
          ) : null}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('active');
              loadTrades('active');
            }}
            className={`px-3 py-2 rounded-xl border text-sm transition ${
              mode === 'active' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('history');
              loadTrades('history');
            }}
            className={`px-3 py-2 rounded-xl border text-sm transition ${
              mode === 'history' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            History
          </button>
        </div>

        {/* Trades table */}
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">{mode === 'active' ? 'Open Positions' : 'Trade History'}</div>
            <div className="text-xs text-white/60">{sortedTrades.length} trade(s)</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-white/60">
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3">Pair</th>
                  <th className="text-left px-4 py-3">Side</th>
                  <th className="text-right px-4 py-3">Invest</th>
                  <th className="text-right px-4 py-3">x</th>
                  <th className="text-right px-4 py-3">Entry</th>
                  <th className="text-right px-4 py-3">Current</th>
                  <th className="text-right px-4 py-3">P/L</th>
                  <th className="text-right px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrades.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-white/60" colSpan={9}>
                      {loading ? 'Loading…' : 'No trades yet.'}
                    </td>
                  </tr>
                ) : (
                  sortedTrades.map((t) => {
                    const pnlPos = t.pnl >= 0;
                    const pnlColor = pnlPos ? 'text-emerald-200' : 'text-rose-200';

                    const statusBadge =
                      t.status === 'active'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100'
                        : t.status === 'liquidated'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-100'
                          : 'bg-white/10 border-white/15 text-white/80';

                    return (
                      <tr key={t.id} className="border-b border-white/10">
                        <td className="px-4 py-3 font-medium">{t.asset}</td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${
                              t.direction === 'buy'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-100'
                                : 'bg-rose-500/15 border-rose-500/30 text-rose-100'
                            }`}
                          >
                            {t.direction === 'buy' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {t.direction.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">${fmt(t.investment, 2)}</td>
                        <td className="px-4 py-3 text-right">x{fmt(t.multiplier, 0)}</td>
                        <td className="px-4 py-3 text-right">{t.entryPrice ? fmt(t.entryPrice, 5) : '-'}</td>
                        <td className="px-4 py-3 text-right">{t.currentPrice ? fmt(t.currentPrice, 5) : '-'}</td>

                        <td className={`px-4 py-3 text-right font-semibold ${pnlColor}`}>
                          {t.pnl >= 0 ? '+' : ''}
                          ${fmt(t.pnl, 2)}
                          <div className="text-[11px] font-normal text-white/50">
                            {t.pnlPercent >= 0 ? '+' : ''}
                            {fmt(t.pnlPercent, 2)}%
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex px-2 py-1 rounded-lg border text-xs ${statusBadge}`}>
                            {t.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          {t.status === 'active' ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                value={exitDraft[t.id] ?? ''}
                                onChange={(e) => setExitDraft((p) => ({ ...p, [t.id]: e.target.value }))}
                                inputMode="decimal"
                                className="w-28 rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-xs"
                                placeholder={fmt(t.currentPrice || 0, 5)}
                                title="Exit price (optional). If empty, uses current."
                              />
                              <button
                                type="button"
                                onClick={() => closeTrade(t)}
                                disabled={actionLoadingId === t.id}
                                className="px-3 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:opacity-90 transition disabled:opacity-50"
                              >
                                {actionLoadingId === t.id ? 'Closing…' : 'Close'}
                              </button>
                            </div>
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
        </div>

        <div className="text-xs text-white/50">
          Note: P/L shown is display-only. Final credit/debit is applied by the server via <code className="text-white/70">close_trade_atomic</code>.
        </div>
      </div>
    </div>
  );
}
