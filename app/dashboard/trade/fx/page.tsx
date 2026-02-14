// app/dashboard/trade/fx/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  History,
  CandlestickChart,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

type Mode = 'active' | 'history';
type TF = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

type TradeRow = {
  id: string;
  user_id?: string;

  asset?: string;
  pair?: string;
  symbol?: string;

  asset_type?: string;
  market_type?: string;

  trade_type?: string;
  direction?: string;
  type?: string;
  direction_int?: number;

  investment?: number;
  margin_used?: number;
  amount?: number;

  multiplier?: number;
  leverage?: number;

  entry_price?: number;
  current_price?: number;
  exit_price?: number;

  liquidation_price?: number;
  stop_loss?: number | null;
  take_profit?: number | null;

  floating_pnl?: number;
  pnl?: number;
  profit_loss?: number;
  final_pnl?: number;

  spread_cost?: number;
  status?: string;

  opened_at?: string;
  closed_at?: string | null;
  updated_at?: string;
};

type FxUiTrade = {
  id: string;
  asset: string;

  direction: 'buy' | 'sell';
  directionInt: 1 | -1;

  investment: number;
  multiplier: number;

  notional: number;
  entryPrice: number;
  currentPrice: number;

  liquidationPrice: number;
  stopLoss?: number;
  takeProfit?: number;

  pnl: number;
  pnlPercent: number;

  status: 'active' | 'closed' | 'liquidated' | 'stopped_out' | 'take_profit';

  openedAt?: string;
  closedAt?: string;
  updatedAt?: string;
};

type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number; // IMPORTANT: omit if unknown (exactOptionalPropertyTypes)
};

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

const TIMEFRAMES: { label: string; value: TF; pollMs: number }[] = [
  { label: '1m', value: '1m', pollMs: 7000 },
  { label: '5m', value: '5m', pollMs: 12000 },
  { label: '15m', value: '15m', pollMs: 20000 },
  { label: '1h', value: '1h', pollMs: 30000 },
  { label: '4h', value: '4h', pollMs: 45000 },
  { label: '1D', value: '1D', pollMs: 60000 },
];

function clampNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(n: number, dp = 2) {
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(dp);
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
  const asset = String(row.asset ?? row.pair ?? row.symbol ?? '').trim();

  const directionInt = toDirInt(row);
  const direction = toDirLabel(directionInt);

  const marketType = String(row.market_type ?? '').toLowerCase();
  const tradeType = String(row.trade_type ?? row.type ?? '').toLowerCase();
  const isFxMargin = marketType === 'fx' && tradeType === 'margin';

  const entryPrice = clampNum(row.entry_price, 0);
  const currentPrice = clampNum(row.current_price ?? row.entry_price, entryPrice);

  const leverage = clampNum(row.leverage ?? row.multiplier, 1);
  const notionalFromDb = clampNum(row.amount, 0);

  let stake =
    clampNum(row.margin_used, 0) > 0 ? clampNum(row.margin_used, 0) : clampNum(row.investment, 0);

  if (!(stake > 0) && isFxMargin && notionalFromDb > 0 && leverage > 0) {
    stake = notionalFromDb / leverage;
  }

  const notional = isFxMargin ? (notionalFromDb > 0 ? notionalFromDb : stake * leverage) : clampNum(row.investment, 0) * clampNum(row.multiplier, 1);

  const status = normStatus(row.status);

  const pnlFromDb =
    row.final_pnl != null
      ? clampNum(row.final_pnl, 0)
      : row.floating_pnl != null
        ? clampNum(row.floating_pnl, 0)
        : row.pnl != null
          ? clampNum(row.pnl, 0)
          : row.profit_loss != null
            ? clampNum(row.profit_loss, 0)
            : 0;

  const exposure = isFxMargin ? notional : stake * clampNum(row.multiplier, 1);

  const calc =
    entryPrice > 0 ? directionInt * exposure * ((currentPrice - entryPrice) / entryPrice) : 0;

  const pnl = pnlFromDb !== 0 ? pnlFromDb : calc;
  const pnlPercent = stake > 0 ? (pnl / stake) * 100 : 0;

  return {
    id: row.id,
    asset,
    direction,
    directionInt,
    investment: stake,
    multiplier: isFxMargin ? leverage : clampNum(row.multiplier, 1),
    notional,
    entryPrice,
    currentPrice,
    liquidationPrice: clampNum(row.liquidation_price, 0),
    stopLoss: row.stop_loss != null ? clampNum(row.stop_loss, 0) : undefined,
    takeProfit: row.take_profit != null ? clampNum(row.take_profit, 0) : undefined,
    pnl,
    pnlPercent,
    status,
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

function makeIdempotencyKey(): string {
  try {
    const key = globalThis.crypto?.randomUUID?.();
    if (key) return key;
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getProjectRefFromEnv(): string | null {
  try {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!u) return null;
    const host = new URL(u).hostname;
    const ref = host.split('.')[0];
    return ref || null;
  } catch {
    return null;
  }
}

function extractAccessTokenFromStoredJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as any;
    const token =
      parsed?.access_token ??
      parsed?.currentSession?.access_token ??
      parsed?.session?.access_token ??
      parsed?.data?.session?.access_token ??
      parsed?.value?.access_token ??
      null;
    return typeof token === 'string' && token.length > 20 ? token : null;
  } catch {
    return null;
  }
}

function readStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  const projectRef = getProjectRefFromEnv();
  const expectedSbKey = projectRef ? `sb-${projectRef}-auth-token` : null;

  const customKey = 'novatrade-sb-auth';

  const pick = (store: Storage | null) => {
    if (!store) return null;

    const rawCustom = store.getItem(customKey);
    if (rawCustom) {
      const t = extractAccessTokenFromStoredJson(rawCustom);
      if (t) return t;
    }

    if (expectedSbKey) {
      const raw = store.getItem(expectedSbKey);
      if (raw) {
        const t = extractAccessTokenFromStoredJson(raw);
        if (t) return t;
      }
    }

    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;

        if (k === customKey || (k.startsWith('sb-') && k.endsWith('-auth-token'))) {
          const raw = store.getItem(k);
          if (!raw) continue;

          const token = extractAccessTokenFromStoredJson(raw);
          if (!token) continue;

          if (projectRef) {
            const payload = decodeJwtPayload(token);
            const iss = typeof payload?.iss === 'string' ? payload.iss : '';
            if (iss && !iss.includes(projectRef)) continue;
          }

          return token;
        }
      }
    } catch {}

    return null;
  };

  return pick(window.sessionStorage) || pick(window.localStorage);
}

async function fetchFxCandles(
  display: string,
  tf: TF,
  limit = 260,
  signal?: AbortSignal
): Promise<Candle[]> {
  const url =
    `/api/market/fx/candles?display=${encodeURIComponent(display)}` +
    `&tf=${encodeURIComponent(tf)}&limit=${limit}`;

  const res = await fetch(url, { method: 'GET', cache: 'no-store', signal });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (res.status === 403) throw new Error(json?.message || 'FX candles access denied');
  if (!res.ok) throw new Error(json?.error || `Candles failed (${res.status})`);

  const rows: any[] = Array.isArray(json?.candles) ? json.candles : [];

  const out: Candle[] = [];

  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;

    const t = (r.time ?? r.t ?? r.timestamp ?? r.ts ?? r.open_time ?? r.openTime) as any;
    let timeSec = 0;

    if (typeof t === 'number') timeSec = t > 2_000_000_000 ? Math.floor(t / 1000) : Math.floor(t);
    if (typeof t === 'string') {
      const d = Date.parse(t);
      if (Number.isFinite(d)) timeSec = Math.floor(d / 1000);
    }

    const open = clampNum((r.open ?? r.o) as any, NaN);
    const high = clampNum((r.high ?? r.h) as any, NaN);
    const low = clampNum((r.low ?? r.l) as any, NaN);
    const close = clampNum((r.close ?? r.c) as any, NaN);

    if (!Number.isFinite(timeSec) || timeSec <= 0) continue;
    if (![open, high, low, close].every((x) => Number.isFinite(x))) continue;

    const candle: Candle = { time: timeSec, open, high, low, close };

    const volRaw = (r.volume ?? r.v) as any;
    if (volRaw != null) {
      const v = clampNum(volRaw, NaN);
      if (Number.isFinite(v)) candle.volume = v;
    }

    out.push(candle);
  }

  out.sort((a, b) => a.time - b.time);
  return out;
}

export default function FXTradePage() {
  const [mode, setMode] = useState<Mode>('active');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [trades, setTrades] = useState<FxUiTrade[]>([]);
  const [exitDraft, setExitDraft] = useState<Record<string, string>>({});

  const [asset, setAsset] = useState<string>('EUR/USD');
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [investment, setInvestment] = useState<string>('50');
  const [multiplier, setMultiplier] = useState<number>(100);
  const [marketPrice, setMarketPrice] = useState<string>('1.00000');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');

  const [tf, setTf] = useState<TF>('5m');
  const [chartNote, setChartNote] = useState<string | null>(null);
  const [lastClose, setLastClose] = useState<number | null>(null);

  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const chartAbortRef = useRef<AbortController | null>(null);
  const chartInFlightRef = useRef(false);

  const lastPushAtRef = useRef<number>(0);
  const lastPushedPriceRef = useRef<number | null>(null);

  const canUseSupabase =
    (typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : !!isSupabaseConfigured) && !!supabase;

  const headerAuthToken = async (): Promise<string | null> => {
    if (!canUseSupabase) return null;

    try {
      const { data, error: sErr } = await supabase.auth.getSession();
      if (!sErr) {
        const token = data.session?.access_token ?? null;
        if (token) return token;
      }
    } catch {}

    try {
      const { data } = await supabase.auth.refreshSession();
      const token = data.session?.access_token ?? null;
      if (token) return token;
    } catch {}

    return readStoredAccessToken();
  };

  const pushPriceToServer = async (pair: string, px: number) => {
    try {
      const now = Date.now();

      if (now - lastPushAtRef.current < 5000) return;

      const last = lastPushedPriceRef.current;
      if (last != null && Math.abs(px - last) < 0.00001) return;

      const token = await headerAuthToken();
      if (!token) return;

      lastPushAtRef.current = now;
      lastPushedPriceRef.current = px;

      await fetch('/api/trades', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_price', asset: pair, price: px }),
        cache: 'no-store',
      });
    } catch {}
  };

  const loadTrades = async (nextMode: Mode = mode) => {
    setError(null);
    setLoading(true);

    try {
      const token = await headerAuthToken();
      if (!token) throw new Error('Missing API token. Please sign in again.');

      const res = await fetch(`/api/trades?limit=200`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Failed to load trades (${res.status})`);
      }

      setBalance(clampNum(json?.balance ?? json?.newBalance ?? 0));

      const rows: TradeRow[] = Array.isArray(json?.trades) ? (json.trades as TradeRow[]) : [];
      const fxRows = rows.filter((r) => String(r.market_type ?? '').toLowerCase() === 'fx');

      const parsed = fxRows.map(dbRowToUi).filter((t) => !!t.asset);

      setTrades(nextMode === 'active' ? parsed.filter((t) => t.status === 'active') : parsed);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const initChartIfNeeded = async () => {
    const el = chartWrapRef.current;
    if (!el) return;
    if (chartApiRef.current && candleSeriesRef.current) return;

    try {
      el.innerHTML = '';
    } catch {}

    const lwc: any = await import('lightweight-charts');

    const chart = lwc.createChart(el, {
      layout: { background: { color: 'transparent' }, textColor: 'rgba(255,255,255,0.88)' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.14)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.14)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: lwc?.CrosshairMode?.Normal ?? 0 },
    });

    let candleSeries: any = null;
    if (typeof chart.addCandlestickSeries === 'function') {
      candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#f43f5e',
        borderUpColor: '#22c55e',
        borderDownColor: '#f43f5e',
        wickUpColor: '#22c55e',
        wickDownColor: '#f43f5e',
      });
    } else if (typeof chart.addSeries === 'function' && lwc.CandlestickSeries) {
      candleSeries = chart.addSeries(lwc.CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#f43f5e',
        borderUpColor: '#22c55e',
        borderDownColor: '#f43f5e',
        wickUpColor: '#22c55e',
        wickDownColor: '#f43f5e',
      });
    } else {
      throw new Error('lightweight-charts: candlestick series API not found');
    }

    chartApiRef.current = chart;
    candleSeriesRef.current = candleSeries;

    try {
      const ro = new ResizeObserver(() => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        try {
          chart.applyOptions({ width: w, height: h });
          chart.timeScale().fitContent();
        } catch {}
      });
      ro.observe(el);
      resizeObsRef.current = ro;

      try {
        chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
        chart.timeScale().fitContent();
      } catch {}
    } catch {}
  };

  const loadChart = async () => {
    setChartNote(null);

    const el = chartWrapRef.current;
    if (!el) return;

    if (chartInFlightRef.current) return;
    chartInFlightRef.current = true;

    try {
      chartAbortRef.current?.abort();
    } catch {}
    const ac = new AbortController();
    chartAbortRef.current = ac;

    try {
      await initChartIfNeeded();

      const candles = await fetchFxCandles(asset, tf, 360, ac.signal);
      if (ac.signal.aborted) return;

      if (!candles.length) {
        setChartNote('No candles returned.');
        setLastClose(null);
        return;
      }

      const lc = candles[candles.length - 1]?.close ?? null;
      setLastClose(lc);

      if (lc != null && lc > 0) {
        setMarketPrice(lc.toFixed(5));

        setTrades((prev) =>
          prev.map((t) => (t.status === 'active' && t.asset === asset ? { ...t, currentPrice: lc } : t))
        );

        void pushPriceToServer(asset, lc);
      }

      const data = candles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      try {
        candleSeriesRef.current?.setData?.(data);
        chartApiRef.current?.timeScale?.()?.fitContent?.();
      } catch {}
    } catch (e: any) {
      setChartNote(e?.message || 'Failed to load chart');
    } finally {
      chartInFlightRef.current = false;
    }
  };

  useEffect(() => {
    void loadTrades('active');
    void loadChart();

    return () => {
      try {
        chartAbortRef.current?.abort();
      } catch {}

      try {
        resizeObsRef.current?.disconnect?.();
      } catch {}

      try {
        chartApiRef.current?.remove?.();
      } catch {}
      chartApiRef.current = null;
      candleSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, tf]);

  useEffect(() => {
    const pollMs = TIMEFRAMES.find((x) => x.value === tf)?.pollMs ?? 12000;
    const id = window.setInterval(() => void loadChart(), pollMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, tf]);

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
        throw new Error('Leverage must be between 1 and 1000');
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

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok || !json?.success) throw new Error(json?.error || `Trade open failed (${res.status})`);

      if (json?.newBalance != null) setBalance(clampNum(json.newBalance, balance));

      await loadTrades(mode);

      if (lastClose != null && lastClose > 0) void pushPriceToServer(asset, lastClose);
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
      if (!token) throw new Error('Missing API token. Please sign in again.');

      const draft = (exitDraft[t.id] ?? '').trim();
      const exit = draft ? clampNum(draft, 0) : clampNum(t.currentPrice, 0);
      if (exit <= 0) throw new Error('Exit price must be greater than 0');

      const res = await fetch('/api/trades', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          tradeId: t.id,
          exitPrice: exit,
          closeReason: 'manual',
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }

      if (!res.ok || !json?.success) throw new Error(json?.error || `Trade close failed (${res.status})`);

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

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const at = Date.parse(a.openedAt || a.updatedAt || '') || 0;
      const bt = Date.parse(b.openedAt || b.updatedAt || '') || 0;
      return bt - at;
    });
  }, [trades]);

  const invNum = clampNum(investment, 0);
  const notionalPreview = invNum > 0 && multiplier > 0 ? invNum * multiplier : 0;

  return (
    <div className="min-h-screen bg-[#07070b] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <CandlestickChart className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-semibold">FX Trading</div>
              <div className="text-xs text-white/60">Live chart + margin trades</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2">
              <div className="text-[11px] text-white/60">Available</div>
              <div className="text-sm font-semibold">${fmt(balance, 2)}</div>
            </div>

            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-sm transition disabled:opacity-50"
              type="button"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-200 mt-0.5" />
            <div className="text-sm text-red-100">{error}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{asset}</div>
                <div className="text-xs text-white/60">
                  {TIMEFRAMES.find((x) => x.value === tf)?.label}
                  {lastClose != null ? ` · ${lastClose.toFixed(5)}` : ''}
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

                <div className="flex flex-wrap items-center gap-1">
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
              <div className="px-4 pt-3 text-xs text-yellow-200/80 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                {chartNote}
              </div>
            ) : null}

            <div className="p-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                <div ref={chartWrapRef} className="w-full h-[460px] sm:h-[560px] lg:h-[700px]" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="font-semibold">New Order</div>
              <div className="text-xs text-white/60">Margin + leverage</div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('buy')}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    direction === 'buy'
                      ? 'bg-emerald-500/15 border-emerald-500/30'
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
                      ? 'bg-rose-500/15 border-rose-500/30'
                      : 'bg-black/30 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Sell
                  </span>
                </button>
              </div>

              <div>
                <label className="text-xs text-white/60">Investment (margin)</label>
                <input
                  value={investment}
                  onChange={(e) => setInvestment(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                  placeholder="50"
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Leverage</label>
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
                <label className="text-xs text-white/60">Market price</label>
                <input
                  value={marketPrice}
                  onChange={(e) => setMarketPrice(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                  placeholder="1.00000"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/60">Stop loss</label>
                  <input
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">Take profit</label>
                  <input
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 outline-none"
                    placeholder="optional"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Notional</span>
                  <span className="font-semibold text-white">${fmt(notionalPreview, 2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-white/70">
                  <span>Pair</span>
                  <span className="text-white/90">{asset}</span>
                </div>
              </div>

              <button
                onClick={openTrade}
                disabled={loading || !canUseSupabase}
                className="w-full rounded-xl bg-white text-black font-semibold px-4 py-2 hover:opacity-90 transition disabled:opacity-50"
                type="button"
              >
                Open Trade
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('active');
              void loadTrades('active');
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
              void loadTrades('history');
            }}
            className={`px-3 py-2 rounded-xl border text-sm transition ${
              mode === 'history' ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <History className="h-4 w-4" /> History
            </span>
          </button>
        </div>

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
                  <th className="text-right px-4 py-3">Margin</th>
                  <th className="text-right px-4 py-3">Lev</th>
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
                          {t.pnl >= 0 ? '+' : ''}${fmt(t.pnl, 2)}
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
      </div>
    </div>
  );
}
