// app/dashboard/trade/fx/page.tsx
'use client';

import Script from 'next/script';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  XCircle,
  History,
  ShieldAlert,
  CandlestickChart,
} from 'lucide-react';

declare global {
  interface Window {
    LightweightCharts?: any;
  }
}

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

  asset?: string;
  pair?: string;
  symbol?: string;

  asset_type?: string;
  market_type?: string;

  direction?: string;
  type?: string;
  direction_int?: number;

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

  pnl: number;
  pnlPercent: number;

  spreadCost: number;

  status: Exclude<TradeStatus, 'open'>;

  openedAt?: string;
  closedAt?: string;
  updatedAt?: string;
};

/** ---------- CHART TYPES ---------- */
type TF = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

type Candle = {
  time: number; // unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/** ---------- HELPERS ---------- */
function makeIdempotencyKey(): string {
  try {
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

function secondsPer(tf: TF) {
  switch (tf) {
    case '1m':
      return 60;
    case '5m':
      return 300;
    case '15m':
      return 900;
    case '1h':
      return 3600;
    case '4h':
      return 14400;
    case '1D':
      return 86400;
    default:
      return 900;
  }
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

/** Try to read Supabase access_token from storage (fixes “missing api token” when session isn’t hydrated yet). */
function readStoredAccessToken(): string | null {
  const pick = (store: Storage | null) => {
    if (!store) return null;
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;
        if (!k.startsWith('sb-') || !k.endsWith('-auth-token')) continue;

        const raw = store.getItem(k);
        if (!raw) continue;

        const parsed = JSON.parse(raw) as any;
        const token =
          parsed?.access_token ??
          parsed?.currentSession?.access_token ??
          parsed?.session?.access_token ??
          parsed?.data?.session?.access_token ??
          null;

        if (typeof token === 'string' && token.length > 10) return token;
      }
    } catch {
      // ignore
    }
    return null;
  };

  // ✅ TS5076-safe: no mixing ?? with ||
  const ss: Storage | null =
    typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  const ls: Storage | null =
    typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;

  const fromSession = pick(ss);
  if (fromSession) return fromSession;

  return pick(ls);
}

/** ---------- CHART DATA MAPPING ---------- */
function mapCandleRow(r: unknown): Candle | null {
  if (!r || typeof r !== 'object') return null;
  const row = r as Record<string, unknown>;

  const t =
    row.time ??
    row.t ??
    row.timestamp ??
    row.ts ??
    row.open_time ??
    row.openTime ??
    row.created_at ??
    row.createdAt ??
    null;

  let timeSec = 0;

  if (typeof t === 'number') {
    timeSec = t > 2_000_000_000 ? Math.floor(t / 1000) : Math.floor(t);
  } else if (typeof t === 'string') {
    const d = Date.parse(t);
    if (Number.isFinite(d)) timeSec = Math.floor(d / 1000);
  }

  const open = clampNum(row.open ?? row.o, NaN);
  const high = clampNum(row.high ?? row.h, NaN);
  const low = clampNum(row.low ?? row.l, NaN);
  const close = clampNum(row.close ?? row.c, NaN);
  const volume = row.volume ?? row.v;

  if (!Number.isFinite(timeSec) || timeSec <= 0) return null;
  if (![open, high, low, close].every((x) => Number.isFinite(x))) return null;

  return {
    time: timeSec,
    open,
    high,
    low,
    close,
    volume: volume != null ? clampNum(volume, 0) : undefined,
  };
}

function pairToOandaSymbol(displayPair: string) {
  const p = String(displayPair ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!p) return '';
  if (p.includes(':')) return p;
  return `OANDA:${p.replace('/', '_')}`;
}

/** candles fetch: try your endpoints (fx candle route first), then generic fallbacks */
async function tryFetchCandlesFromAnyEndpoint(displayPair: string, tf: TF, limit = 240): Promise<Candle[]> {
  const symbol = pairToOandaSymbol(displayPair);

  const endpoints = [
    // ✅ your Finnhub FX candle route (supports display=EUR/USD)
    `/api/market/fx/candles?display=${encodeURIComponent(displayPair)}&tf=${encodeURIComponent(tf)}&limit=${limit}`,

    // optional: if you also expose symbol-based candle endpoints
    `/api/market/candles?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&limit=${limit}`,
    `/api/markets/candles?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&limit=${limit}`,
    `/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&limit=${limit}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!res.ok) continue;

      const json: unknown = await res.json().catch(() => ({}));

      const rows: unknown[] =
        Array.isArray((json as any)?.candles)
          ? ((json as any).candles as unknown[])
          : Array.isArray((json as any)?.data)
            ? ((json as any).data as unknown[])
            : Array.isArray(json)
              ? (json as unknown[])
              : [];

      const mapped = rows
        .map((r: unknown) => mapCandleRow(r))
        .filter((x: Candle | null): x is Candle => x !== null)
        .sort((a: Candle, b: Candle) => a.time - b.time);

      if (mapped.length) return mapped;
    } catch {
      // try next
    }
  }

  return [];
}

function synthCandles(tf: TF, lastClose = 1.0, count = 180): Candle[] {
  const now = Math.floor(Date.now() / 1000);
  const step = secondsPer(tf);
  const start = now - step * count;

  let price = lastClose > 0 ? lastClose : 1.0;

  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.floor((start + i * step) / step) * step;
    // tiny deterministic wiggle
    const wiggle = Math.sin(i / 5) * 0.0005 + Math.cos(i / 7) * 0.0003;
    const open = price;
    const close = Math.max(0.0001, open + wiggle);
    const high = Math.max(open, close) + Math.abs(wiggle) * 0.6;
    const low = Math.min(open, close) - Math.abs(wiggle) * 0.6;
    price = close;
    out.push({ time: t, open, high, low, close });
  }
  return out;
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

const TIMEFRAMES: { label: string; value: TF }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1D', value: '1D' }, // ✅ matches your API route switch-case
];

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

  // Chart state
  const [tf, setTf] = useState<TF>('5m');
  const [chartNote, setChartNote] = useState<string | null>(null);
  const [lastClose, setLastClose] = useState<number | null>(null);
  const [liveState, setLiveState] = useState<'off' | 'live' | 'poll'>('off');
  const [lcReady, setLcReady] = useState(false);

  const firstLoadRef = useRef(false);

  // chart refs
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const candlesRef = useRef<Candle[]>([]);
  const streamRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);
  const backfillRef = useRef<number | null>(null);

  // ✅ avoids TS2774 no matter how isSupabaseConfigured is defined in your project
  const canUseSupabase =
    (typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : !!isSupabaseConfigured) && !!supabase;

  const headerAuthToken = async (): Promise<string | null> => {
    if (!canUseSupabase) return null;

    // 1) normal supabase session token
    try {
      const { data, error: sErr } = await supabase.auth.getSession();
      if (!sErr) {
        const token = data.session?.access_token ?? null;
        if (token) return token;
      }
    } catch {
      // ignore
    }

    // 2) try refresh session (best effort)
    try {
      const { data } = await supabase.auth.refreshSession();
      const token = data.session?.access_token ?? null;
      if (token) return token;
    } catch {
      // ignore
    }

    // 3) fallback storage read
    const stored = readStoredAccessToken();
    if (stored) return stored;

    return null;
  };

  const loadTrades = async (nextMode: Mode = mode) => {
    setError(null);
    setLoading(true);

    try {
      const token = await headerAuthToken();
      if (!token) throw new Error('Missing API token. Please sign in again (session token not found).');

      const res = await fetch(`/api/trades?limit=200`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const json: unknown = await res.json().catch(() => ({}));
      const ok = (json as any)?.success;

      if (!res.ok || !ok) {
        throw new Error((json as any)?.error || `Failed to load trades (${res.status})`);
      }

      setBalance(clampNum((json as any)?.balance ?? (json as any)?.newBalance ?? 0));

      const rows: TradeRow[] = Array.isArray((json as any)?.trades) ? ((json as any).trades as TradeRow[]) : [];

      const parsed = rows
        .map(dbRowToUi)
        .filter((t): t is FxUiTrade => t.assetType === 'forex' && !!t.asset);

      setTrades(nextMode === 'active' ? parsed.filter((t) => t.status === 'active') : parsed);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  function stopLive() {
    try {
      streamRef.current?.close();
    } catch {
      // ignore
    }
    streamRef.current = null;

    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (backfillRef.current != null) {
      window.clearInterval(backfillRef.current);
      backfillRef.current = null;
    }

    setLiveState('off');
  }

  function ensureChart() {
    const el = chartWrapRef.current;
    if (!el) return;

    const LC = window.LightweightCharts;
    if (!LC) return;

    if (!chartApiRef.current) {
      const chart = LC.createChart(el, {
        layout: { background: { color: 'transparent' }, textColor: 'rgba(255,255,255,0.85)' },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.06)' },
          horzLines: { color: 'rgba(255,255,255,0.06)' },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.12)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.12)', timeVisible: true, secondsVisible: false },
        crosshair: { mode: 0 }, // Normal
        autoSize: true,
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#f43f5e',
        borderUpColor: '#22c55e',
        borderDownColor: '#f43f5e',
        wickUpColor: '#22c55e',
        wickDownColor: '#f43f5e',
      });

      chartApiRef.current = chart;
      candleSeriesRef.current = candleSeries;

      const ro = new ResizeObserver(() => {
        try {
          chart.timeScale().fitContent();
        } catch {
          // ignore
        }
      });
      ro.observe(el);
      (chartApiRef.current as any).__ro = ro;
    }
  }

  function setSeriesData(candles: Candle[]) {
    candlesRef.current = candles;

    const series = candleSeriesRef.current;
    if (!series) return;

    series.setData(
      candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))
    );

    try {
      chartApiRef.current?.timeScale()?.fitContent?.();
    } catch {
      // ignore
    }
  }

  function applyTick(price: number, tsSec: number) {
    const tfSec = secondsPer(tf);
    const bucket = Math.floor(tsSec / tfSec) * tfSec;

    const prev = candlesRef.current;
    const last = prev.length ? prev[prev.length - 1] : null;

    let nextLast: Candle;

    if (!last) {
      nextLast = { time: bucket, open: price, high: price, low: price, close: price };
      candlesRef.current = [nextLast];
      candleSeriesRef.current?.setData?.([
        { time: nextLast.time, open: nextLast.open, high: nextLast.high, low: nextLast.low, close: nextLast.close },
      ]);
    } else if (last.time < bucket) {
      const open = last.close;
      nextLast = {
        time: bucket,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
      };
      const next = [...prev, nextLast].slice(-300);
      candlesRef.current = next;
      candleSeriesRef.current?.update?.({
        time: nextLast.time,
        open: nextLast.open,
        high: nextLast.high,
        low: nextLast.low,
        close: nextLast.close,
      });
    } else {
      nextLast = {
        ...last,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
        close: price,
      };
      const next = prev.slice();
      next[next.length - 1] = nextLast;
      candlesRef.current = next;
      candleSeriesRef.current?.update?.({
        time: nextLast.time,
        open: nextLast.open,
        high: nextLast.high,
        low: nextLast.low,
        close: nextLast.close,
      });
    }

    setLastClose(nextLast.close);
    setMarketPrice(nextLast.close.toFixed(5));
  }

  const loadChart = async () => {
    setChartNote(null);

    if (!chartWrapRef.current) return;

    // must have lightweight-charts global ready
    if (!lcReady || !window.LightweightCharts) {
      setChartNote('Chart engine loading…');
      return;
    }

    ensureChart();

    // fetch candles (endpoint first, then supabase `candles` table)
    let candles: Candle[] = await tryFetchCandlesFromAnyEndpoint(asset, tf, 260);

    if (!candles.length && canUseSupabase) {
      // fallback: supabase table `candles` (if you have it)
      try {
        const { data, error: sErr } = await supabase
          .from('candles')
          .select('*')
          .eq('symbol', asset)
          .eq('tf', tf)
          .order('time', { ascending: true })
          .limit(260);

        if (!sErr && Array.isArray(data)) {
          const rows = data as unknown[];
          candles = rows
            .map((r: unknown) => mapCandleRow(r))
            .filter((x: Candle | null): x is Candle => x !== null)
            .sort((a: Candle, b: Candle) => a.time - b.time);
        }
      } catch {
        // ignore
      }
    }

    // if still none, synth so chart isn't blank
    if (!candles.length) {
      const base = clampNum(lastClose, 1.0);
      candles = synthCandles(tf, base, 180);
      setChartNote('No candle source found — showing synthetic candles (wire /api/market/fx/candles).');
    }

    const lc = candles[candles.length - 1]?.close ?? null;
    setLastClose(lc);

    // keep marketPrice input in sync with last close (nice UX)
    if (lc != null && lc > 0) setMarketPrice(lc.toFixed(5));

    setSeriesData(candles);
  };

  function startLive() {
    stopLive();

    const symbol = pairToOandaSymbol(asset);
    if (!symbol) return;

    // 1) Try SSE stream (your ws->sse bridge)
    try {
      const es = new EventSource(`/api/market/stream?symbols=${encodeURIComponent(symbol)}`);
      streamRef.current = es;

      es.onopen = () => {
        setLiveState('live');
      };

      es.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);

          // finnHub payload usually:
          // { type: "trade", data: [{ p: 1.2345, t: 170..., s: "OANDA:EUR_USD", v: ...}] }
          const arr = (obj as any)?.data;
          if (!Array.isArray(arr) || !arr.length) return;

          const tick = arr[arr.length - 1];
          const price = clampNum(tick?.p, NaN);
          const t = clampNum(tick?.t, 0);

          if (!Number.isFinite(price)) return;

          const tsSec = t > 2_000_000_000 ? Math.floor(t / 1000) : Math.floor(t || Date.now() / 1000);
          applyTick(price, tsSec);
        } catch {
          // ignore bad frames
        }
      };

      es.onerror = () => {
        // fallback to polling
        try {
          es.close();
        } catch {
          // ignore
        }
        streamRef.current = null;

        setLiveState('poll');

        // poll last candle close from your FX candle route
        pollRef.current = window.setInterval(async () => {
          try {
            const r = await fetch(
              `/api/market/fx/candles?display=${encodeURIComponent(asset)}&tf=${encodeURIComponent(tf)}&limit=2`,
              { cache: 'no-store' }
            );
            if (!r.ok) return;
            const j: any = await r.json().catch(() => ({}));
            const rows: unknown[] = Array.isArray(j?.candles) ? j.candles : [];
            const mapped = rows
              .map((x) => mapCandleRow(x))
              .filter((x): x is Candle => !!x)
              .sort((a, b) => a.time - b.time);
            const last = mapped[mapped.length - 1];
            if (!last) return;
            applyTick(last.close, last.time);
          } catch {
            // ignore
          }
        }, 900) as unknown as number;
      };
    } catch {
      // if EventSource fails hard, do nothing (poll will be started by onerror anyway)
      setLiveState('poll');
    }

    // 2) Backfill candles periodically (keeps chart clean if ticks missed)
    const tfSec = secondsPer(tf);
    const backfillMs = tfSec <= 900 ? 15000 : tfSec <= 3600 ? 30000 : 60000;

    backfillRef.current = window.setInterval(async () => {
      const fresh = await tryFetchCandlesFromAnyEndpoint(asset, tf, 260);
      if (fresh.length) {
        setSeriesData(fresh);
        const lc = fresh[fresh.length - 1]?.close ?? null;
        if (lc != null && lc > 0) {
          setLastClose(lc);
          setMarketPrice(lc.toFixed(5));
        }
      }
    }, backfillMs) as unknown as number;
  }

  useEffect(() => {
    if (firstLoadRef.current) return;
    firstLoadRef.current = true;
    loadTrades('active');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chart effect
  useEffect(() => {
    loadChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, tf, lcReady]);

  // live stream effect
  useEffect(() => {
    if (!lcReady) return;
    startLive();
    return () => stopLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, tf, lcReady]);

  // cleanup chart
  useEffect(() => {
    return () => {
      stopLive();

      try {
        const ro = (chartApiRef.current as any)?.__ro as ResizeObserver | undefined;
        ro?.disconnect?.();
      } catch {
        // ignore
      }
      try {
        chartApiRef.current?.remove?.();
      } catch {
        // ignore
      }
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    await loadTrades(mode);
    await loadChart();
  };

  const openTrade = async () => {
    setError(null);
    setLoading(true);

    try {
      const token = await headerAuthToken();
      if (!token) throw new Error('Missing API token. Please sign in again.');

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
          direction,
          investment: inv,
          multiplier,
          marketPrice: mp,
          stopLoss: sl,
          takeProfit: tp,
          idempotencyKey,
        }),
      });

      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok || !(json as any)?.success) {
        throw new Error((json as any)?.error || `Trade open failed (${res.status})`);
      }

      if ((json as any)?.newBalance != null) setBalance(clampNum((json as any).newBalance, balance));
      await loadTrades(mode);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to open trade';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const closeTrade = async (t: FxUiTrade) => {
    setError(null);
    setActionLoadingId(t.id);

    try {
      const token = await headerAuthToken();
      if (!token) throw new Error('Missing API token. Please sign in again.');

      const draft = (exitDraft[t.id] ?? '').trim();
      const exit = draft ? clampNum(draft, 0) : clampNum(t.currentPrice, 0);
      if (exit <= 0) throw new Error('Exit price must be greater than 0');

      const res = await fetch('/api/trades', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: t.id,
          exitPrice: exit,
          closeReason: 'manual',
        }),
      });

      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok || !(json as any)?.success) {
        throw new Error((json as any)?.error || `Trade close failed (${res.status})`);
      }

      if ((json as any)?.newBalance != null) setBalance(clampNum((json as any).newBalance, balance));

      setExitDraft((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });

      await loadTrades(mode);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to close trade';
      setError(msg);
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
      {/* ✅ No npm dependency needed: loads lightweight-charts from CDN */}
      <Script
        src="https://unpkg.com/lightweight-charts@4.2.1/dist/lightweight-charts.standalone.production.js"
        strategy="afterInteractive"
        onLoad={() => setLcReady(true)}
      />

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

        {/* Chart Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <CandlestickChart className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  Market Chart
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full border ${
                      liveState === 'live'
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                        : liveState === 'poll'
                          ? 'border-yellow-500/40 bg-yellow-500/15 text-yellow-100'
                          : 'border-white/15 bg-white/10 text-white/70'
                    }`}
                  >
                    {liveState === 'live' ? 'LIVE' : liveState === 'poll' ? 'DELAYED' : 'OFF'}
                  </span>
                </div>
                <div className="text-xs text-white/60">
                  {asset} · {TIMEFRAMES.find((x) => x.value === tf)?.label}
                  {lastClose != null ? ` · Last ${lastClose.toFixed(5)}` : ''}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none text-sm"
              >
                {FX_PAIRS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTf(t.value)}
                    className={`px-3 py-2 rounded-xl border text-sm transition ${
                      tf === t.value ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chartNote ? (
            <div className="mt-3 text-xs text-yellow-200/80 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              {chartNote}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
            <div ref={chartWrapRef} className="h-[320px] w-full" />
          </div>

          <div className="mt-3 text-xs text-white/60">
            Uses your <code className="text-white/80">/api/market/stream</code> (SSE) if available, otherwise polls{' '}
            <code className="text-white/80">/api/market/fx/candles</code>.
          </div>
        </div>

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
            <div className="text-xs text-white/60">Tip: market price is the “TV quote”. Server computes entry with spread.</div>

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
                          <span className={`inline-flex px-2 py-1 rounded-lg border text-xs ${statusBadge}`}>{t.status}</span>
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
          Note: P/L shown is display-only. Final credit/debit is applied by the server via{' '}
          <code className="text-white/70">close_trade_atomic</code>.
        </div>
      </div>
    </div>
  );
}
