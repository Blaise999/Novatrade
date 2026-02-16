// app/dashboard/trade/fx/page.tsx
'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useStore } from '@/lib/supabase/store-supabase';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  History,
  CandlestickChart,
  AlertTriangle,
} from 'lucide-react';

type Mode = 'active' | 'history';
type TF = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

type TradeRow = {
  id: string;
  user_id?: string;

  asset?: string | null;
  pair?: string | null;
  symbol?: string | null;

  asset_type?: string | null;
  market_type?: string | null;

  trade_type?: string | null;
  direction?: string | null;
  type?: string | null;
  direction_int?: number | null;

  investment?: number | string | null;
  margin_used?: number | string | null;
  amount?: number | string | null;

  multiplier?: number | string | null;
  leverage?: number | string | null;

  entry_price?: number | string | null;
  current_price?: number | string | null;
  exit_price?: number | string | null;

  liquidation_price?: number | string | null;
  stop_loss?: number | string | null;
  take_profit?: number | string | null;

  floating_pnl?: number | string | null;
  pnl?: number | string | null;
  profit_loss?: number | string | null;
  final_pnl?: number | string | null;

  pnl_percentage?: number | string | null;

  spread_cost?: number | string | null;
  status?: string | null;

  opened_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
};

type FxUiTrade = {
  id: string;
  asset: string;

  direction: 'buy' | 'sell';
  directionInt: 1 | -1;

  investment: number; // margin/stake
  multiplier: number; // leverage

  notional: number; // exposure
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
  volume?: number;
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
  { label: '1m', value: '1m', pollMs: 12000 },
  { label: '5m', value: '5m', pollMs: 15000 },
  { label: '15m', value: '15m', pollMs: 25000 },
  { label: '1h', value: '1h', pollMs: 35000 },
  { label: '4h', value: '4h', pollMs: 50000 },
  { label: '1D', value: '1D', pollMs: 65000 },
];

// ===============================
// helpers
// ===============================
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

  const notional = isFxMargin
    ? notionalFromDb > 0
      ? notionalFromDb
      : stake * leverage
    : clampNum(row.investment, 0) * clampNum(row.multiplier, 1);

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
    openedAt: row.opened_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function makeIdempotencyKey(): string {
  try {
    const key = globalThis.crypto?.randomUUID?.();
    if (key) return key;
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ===============================
// JWT decode (token caching)
// ===============================
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

// ===============================
// FX "always chart" cache (client)
// ===============================
const SS_PREFIX = 'novatrade:fx';
type Tick = { t: number; p: number }; // ms

function ssGet<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function ssSet(key: string, value: any) {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function tfToMs(tf: TF) {
  switch (tf) {
    case '1m':
      return 60_000;
    case '5m':
      return 5 * 60_000;
    case '15m':
      return 15 * 60_000;
    case '1h':
      return 60 * 60_000;
    case '4h':
      return 4 * 60 * 60_000;
    case '1D':
      return 24 * 60 * 60_000;
    default:
      return 5 * 60_000;
  }
}

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCandlesFromTicksFx(ticks: Tick[], intervalMs: number, count: number): Candle[] {
  if (!ticks?.length) return [];

  const now = Date.now();
  const end = Math.floor(now / intervalMs) * intervalMs;
  const start = end - count * intervalMs;

  const sliced = ticks
    .filter((x) => x.t >= start - intervalMs && x.t <= end + intervalMs)
    .sort((a, b) => a.t - b.t);

  if (!sliced.length) return [];

  let idx = 0;
  let lastClose = sliced[0].p;

  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const b0 = start + i * intervalMs;
    const b1 = b0 + intervalMs;

    const bucket: Tick[] = [];
    while (idx < sliced.length && sliced[idx].t < b0) {
      lastClose = sliced[idx].p;
      idx++;
    }
    while (idx < sliced.length && sliced[idx].t >= b0 && sliced[idx].t < b1) {
      bucket.push(sliced[idx]);
      idx++;
    }

    if (!bucket.length) {
      const p = lastClose;
      out.push({ time: Math.floor(b0 / 1000), open: p, high: p, low: p, close: p });
      continue;
    }

    const o = bucket[0].p;
    const c = bucket[bucket.length - 1].p;
    let h = o;
    let l = o;
    for (const x of bucket) {
      if (x.p > h) h = x.p;
      if (x.p < l) l = x.p;
    }

    lastClose = c;
    out.push({ time: Math.floor(b0 / 1000), open: o, high: h, low: l, close: c });
  }

  return out.filter((x) => x.open > 0 && x.high > 0 && x.low > 0 && x.close > 0);
}

function generateSyntheticCandlesFx(
  seedPrice: number,
  intervalMs: number,
  count: number,
  seedKey: string
): Candle[] {
  const p0 = Number.isFinite(seedPrice) && seedPrice > 0 ? seedPrice : 1;
  const rng = mulberry32(hashStr(seedKey));

  const now = Date.now();
  const end = Math.floor(now / intervalMs) * intervalMs;
  const start = end - count * intervalMs;

  const baseVol = Math.max(0.00001, p0 * 0.0015);
  let last = p0;

  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * intervalMs;

    const drift = (rng() - 0.5) * baseVol;
    const o = last;
    const c = Math.max(0.00001, o + drift);

    const wick = baseVol * (0.4 + rng());
    const h = Math.max(o, c) + wick * rng();
    const l = Math.max(0.00001, Math.min(o, c) - wick * rng());

    out.push({ time: Math.floor(t / 1000), open: o, high: h, low: l, close: c });
    last = c;
  }

  return out;
}

function pushFxTick(pair: string, price: number) {
  try {
    if (!pair || !Number.isFinite(price) || price <= 0) return;
    const key = `${SS_PREFIX}:ticks:${pair}`;
    const prev = ssGet<Tick[]>(key) || [];
    const next = [...prev, { t: Date.now(), p: price }].slice(-2400);
    ssSet(key, next);
  } catch {}
}

// ===============================
// OANDA candles endpoint (cache/budget aware)
// ===============================
class CandlesError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = 'CandlesError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

type CandlesFetchResult = {
  candles: Candle[];
  cache: string | null; // HIT|MISS|STALE|DEDUPED etc
  stale?: boolean;
};

async function fetchFxCandles(
  display: string,
  tf: TF,
  limit = 260,
  signal?: AbortSignal,
  fresh?: boolean
): Promise<CandlesFetchResult> {
  const url =
    `/api/market/fx/candles?display=${encodeURIComponent(display)}` +
    `&tf=${encodeURIComponent(tf)}&limit=${limit}` +
    (fresh ? `&fresh=1` : ``);

  const res = await fetch(url, { method: 'GET', cache: 'no-store', signal });

  const cacheHeader = res.headers.get('x-cache'); // HIT | MISS | STALE | DEDUPED
  const text = await res.text();

  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (res.ok && json && json.ok === false) {
    throw new CandlesError(json?.code || json?.error || 'Candles failed (ok:false)', 502);
  }

  if (res.status === 429) {
    const raHeader = res.headers.get('retry-after');
    const raSecFromHeader = raHeader ? clampNum(raHeader, 0) : 0;
    const raSecFromBody = json?.retryAfterSec != null ? clampNum(json.retryAfterSec, 0) : 0;
    const raSec = Math.max(raSecFromHeader, raSecFromBody, 5);
    throw new CandlesError(
      json?.code || 'Rate limited (candles).',
      429,
      Math.max(1000, raSec * 1000)
    );
  }

  if (!res.ok) {
    throw new CandlesError(
      json?.code || json?.error || json?.message || `Candles failed (${res.status})`,
      res.status
    );
  }

  const rows: any[] = Array.isArray(json?.candles) ? json.candles : [];

  const mapped: (Candle | null)[] = rows.map((r) => {
    if (!r || typeof r !== 'object') return null;

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
    const volRaw = r.volume ?? r.v;
    const vol = volRaw != null ? clampNum(volRaw, 0) : undefined;

    if (!Number.isFinite(timeSec) || timeSec <= 0) return null;
    if (![open, high, low, close].every((x) => Number.isFinite(x))) return null;

    const base: Candle = { time: timeSec, open, high, low, close };
    return vol != null ? { ...base, volume: vol } : base;
  });

  return {
    candles: mapped.filter((x): x is Candle => x !== null).sort((a, b) => a.time - b.time),
    cache: cacheHeader,
    stale: !!json?.stale,
  };
}

// ===============================
// market-gateway WS (OANDA ticks)
// ===============================
function displayToOandaInstrument(display: string): string {
  const d = String(display || '').trim().toUpperCase();
  if (!d) return '';
  const clean = d.startsWith('OANDA:') ? d.slice(6) : d;
  return clean.replace(/\s+/g, '').split('/').join('_').split('-').join('_');
}

function normalizeWsUrl(raw: string) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('https://')) return 'wss://' + s.slice('https://'.length);
  if (s.startsWith('http://')) return 'ws://' + s.slice('http://'.length);
  return s;
}

// ✅ HARD default (your Render gateway). Env vars can override it.
const DEFAULT_GATEWAY_WS = 'wss://web-socket-lc3r.onrender.com';

function getGatewayUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_MARKET_WS_URL ||
    process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL ||
    DEFAULT_GATEWAY_WS;

  return normalizeWsUrl(raw);
}

type GatewayMsg =
  | { type: 'hello' }
  | { type: 'fx_tick'; instrument: string; bid?: number; ask?: number; mid?: number; ts?: number }
  | { type: 'subscribed'; stocks?: string[]; fx?: string[] }
  | Record<string, any>;

// ===============================
// Component
// ===============================
export default function FXTradePage() {
  const { refreshUser } = useStore();

  const [mode, setMode] = useState<Mode>('active');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);

  const [trades, setTrades] = useState<FxUiTrade[]>([]);
  const tradesRef = useRef<FxUiTrade[]>([]);
  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  const [exitDraft, setExitDraft] = useState<Record<string, string>>({});

  // ticket
  const [asset, setAsset] = useState<string>('EUR/USD');
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [investment, setInvestment] = useState<string>('50');
  const [multiplier, setMultiplier] = useState<number>(100);
  const [marketPrice, setMarketPrice] = useState<string>('1.00000');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');

  // chart
  const [tf, setTf] = useState<TF>('5m');
  const [chartNote, setChartNote] = useState<string | null>(null);
  const [lastClose, setLastClose] = useState<number | null>(null);
  const [candlesCacheLabel, setCandlesCacheLabel] = useState<string>('—');

  // WS
  const [wsOn, setWsOn] = useState(false);
  const [wsNote, setWsNote] = useState<string | null>(null);

  // HOT refs
  const assetRef = useRef(asset);
  const tfRef = useRef(tf);
  const marketEditingRef = useRef(false);

  useEffect(() => {
    assetRef.current = asset;
  }, [asset]);
  useEffect(() => {
    tfRef.current = tf;
  }, [tf]);

  // chart refs
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const chartApiRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const chartAbortRef = useRef<AbortController | null>(null);
  const chartInFlightRef = useRef(false);

  // last candle for live update
  const lastCandleRef = useRef<Candle | null>(null);

  // polling
  const pollTimeoutRef = useRef<number | null>(null);
  const retryAfterMsRef = useRef<number>(0);
  const unmountedRef = useRef(false);

  // mark_price throttle
  const lastPushAtRef = useRef<number>(0);
  const lastPushedPriceRef = useRef<number | null>(null);

  // token cache
  const tokenCacheRef = useRef<{ token: string | null; expMs: number }>({ token: null, expMs: 0 });

  const canUseSupabase =
    (typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : !!isSupabaseConfigured) && !!supabase;

  const headerAuthToken = async (): Promise<string | null> => {
    if (!canUseSupabase) return null;

    const cached = tokenCacheRef.current;
    if (cached.token && Date.now() < cached.expMs - 60_000) return cached.token;

    const setCache = (tok: string) => {
      const payload = decodeJwtPayload(tok);
      const expSec = clampNum(payload?.exp, 0);
      const expMs = expSec > 0 ? expSec * 1000 : Date.now() + 10 * 60_000;
      tokenCacheRef.current = { token: tok, expMs };
    };

    try {
      const { data, error: sErr } = await supabase.auth.getSession();
      if (!sErr) {
        const token = data.session?.access_token ?? null;
        if (token) {
          setCache(token);
          return token;
        }
      }
    } catch {}

    try {
      const { data } = await supabase.auth.refreshSession();
      const token = data.session?.access_token ?? null;
      if (token) {
        setCache(token);
        return token;
      }
    } catch {}

    const raw = readStoredAccessToken();
    if (raw) {
      setCache(raw);
      return raw;
    }

    return null;
  };

  const pushPriceToServer = async (pair: string, px: number) => {
    try {
      const hasActive = tradesRef.current.some((t) => t.status === 'active' && t.asset === pair);
      if (!hasActive) return;

      const now = Date.now();
      const minPushMs = 8000;
      if (now - lastPushAtRef.current < minPushMs) return;

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

      const res = await fetch(`/api/trades?limit=200&mode=all`, {
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

      setBalance(clampNum(json?.balance ?? json?.balance_available ?? 0));

      const rows: TradeRow[] = Array.isArray(json?.trades) ? (json.trades as TradeRow[]) : [];
      const fxRows = rows.filter((r) => String(r.market_type ?? '').toLowerCase() === 'fx');
      const parsed = fxRows.map(dbRowToUi).filter((t) => !!t.asset);

      startTransition(() => {
        setTrades(nextMode === 'active' ? parsed.filter((t) => t.status === 'active') : parsed);
      });

      try {
        await refreshUser();
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // Chart init
  // ===============================
  const initChartIfNeeded = async () => {
    const el = chartWrapRef.current;
    if (!el) return;
    if (chartApiRef.current && candleSeriesRef.current) return;

    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) throw new Error(`Chart container has no size (w=${w}, h=${h}).`);

    const mod: any = await import('lightweight-charts');
    const createChart = mod?.createChart ?? mod?.default?.createChart;
    const CandlestickSeries = mod?.CandlestickSeries ?? mod?.default?.CandlestickSeries;
    const CrosshairMode = mod?.CrosshairMode ?? mod?.default?.CrosshairMode;

    if (!createChart) throw new Error('lightweight-charts: createChart export not found.');

    try {
      el.innerHTML = '';
    } catch {}

    const chart = createChart(el, {
      width: w,
      height: h,
      layout: { background: { color: 'transparent' }, textColor: 'rgba(255,255,255,0.88)' },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.14)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.14)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode?.Normal ?? 0 },
    });

    let series: any = null;

    if (typeof chart.addCandlestickSeries === 'function') {
      series = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#f43f5e',
        borderUpColor: '#22c55e',
        borderDownColor: '#f43f5e',
        wickUpColor: '#22c55e',
        wickDownColor: '#f43f5e',
      });
    } else if (typeof chart.addSeries === 'function' && CandlestickSeries) {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#f43f5e',
        borderUpColor: '#22c55e',
        borderDownColor: '#f43f5e',
        wickUpColor: '#22c55e',
        wickDownColor: '#f43f5e',
      });
    } else {
      throw new Error(
        'lightweight-charts: candlestick series API not found (v5 expects addSeries + CandlestickSeries).'
      );
    }

    chartApiRef.current = chart;
    candleSeriesRef.current = series;

    try {
      const ro = new ResizeObserver(() => {
        const ww = el.clientWidth;
        const hh = el.clientHeight;
        if (!ww || !hh) return;
        try {
          chart.applyOptions({ width: ww, height: hh });
          chart.timeScale().fitContent();
        } catch {}
      });
      ro.observe(el);
      resizeObsRef.current = ro;
    } catch {}

    try {
      chart.timeScale().fitContent();
    } catch {}
  };

  const setChartData = (candles: Candle[]) => {
    if (!candleSeriesRef.current) {
      setError('Chart series not ready (candlestick series is null).');
      return;
    }

    const data = candles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    try {
      candleSeriesRef.current.setData(data);
      chartApiRef.current?.timeScale?.()?.fitContent?.();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[fx-chart] setData failed:', e);
      setError(e?.message || 'Failed to draw candles');
    }

    lastCandleRef.current = candles.length ? candles[candles.length - 1] : null;
  };

  const applyLiveTickToChart = (price: number, nowMs: number) => {
    const series = candleSeriesRef.current;
    if (!series || !Number.isFinite(price) || price <= 0) return;

    const intervalMs = tfToMs(tfRef.current);
    const bucketStartMs = Math.floor(nowMs / intervalMs) * intervalMs;
    const bucketTimeSec = Math.floor(bucketStartMs / 1000);

    const prev = lastCandleRef.current;
    if (!prev || prev.time <= 0) return;

    if (prev.time === bucketTimeSec) {
      const next: Candle = {
        time: prev.time,
        open: prev.open,
        high: Math.max(prev.high, price),
        low: Math.min(prev.low, price),
        close: price,
      };
      lastCandleRef.current = next;
      try {
        series.update?.({
          time: next.time as any,
          open: next.open,
          high: next.high,
          low: next.low,
          close: next.close,
        });
      } catch {}
      return;
    }

    if (bucketTimeSec > prev.time) {
      const next: Candle = {
        time: bucketTimeSec,
        open: prev.close,
        high: Math.max(prev.close, price),
        low: Math.min(prev.close, price),
        close: price,
      };
      lastCandleRef.current = next;
      try {
        series.update?.({
          time: next.time as any,
          open: next.open,
          high: next.high,
          low: next.low,
          close: next.close,
        });
      } catch {}
    }
  };

  const setLivePriceFast = (pair: string, px: number) => {
    startTransition(() => {
      setLastClose(px);
      if (!marketEditingRef.current) setMarketPrice(px.toFixed(5));

      const hasActive = tradesRef.current.some((t) => t.status === 'active' && t.asset === pair);
      if (!hasActive) return;

      setTrades((prev) =>
        prev.map((t) => (t.status === 'active' && t.asset === pair ? { ...t, currentPrice: px } : t))
      );
    });
  };

  const loadChart = async (opts?: { fresh?: boolean }) => {
    if (unmountedRef.current) return;

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

    const intervalMs = tfToMs(tfRef.current);
    const count = 260;

    const curAsset = assetRef.current;
    const curTf = tfRef.current;

    const cacheKey = `${SS_PREFIX}:candles:${curAsset}:${curTf}`;
    const ticksKey = `${SS_PREFIX}:ticks:${curAsset}`;

    try {
      await initChartIfNeeded();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[fx-chart] init failed:', e);
      setError(e?.message || 'Chart init failed');
      chartInFlightRef.current = false;
      return;
    }

    // instant fallback
    try {
      const cached = ssGet<{ ts: number; candles: Candle[] }>(cacheKey);
      const now = Date.now();

      if (cached?.candles?.length) {
        setCandlesCacheLabel('CACHE');
        setChartData(cached.candles);
        setChartNote('Showing cached candles.');

        const lc = cached.candles[cached.candles.length - 1]?.close ?? null;
        if (lc && lc > 0) {
          setLivePriceFast(curAsset, lc);
          pushFxTick(curAsset, lc);
          void pushPriceToServer(curAsset, lc);
        }
      } else {
        const ticks = ssGet<Tick[]>(ticksKey) || [];
        const built = buildCandlesFromTicksFx(ticks, intervalMs, Math.min(220, count));
        if (built.length) {
          setCandlesCacheLabel('LOCAL');
          setChartData(built);
          setChartNote('Built candles from live ticks.');

          const lc = built[built.length - 1]?.close ?? null;
          if (lc && lc > 0) {
            setLivePriceFast(curAsset, lc);
            void pushPriceToServer(curAsset, lc);
          }
        } else {
          setCandlesCacheLabel('SIM');
          const seed = clampNum(lastClose ?? marketPrice, 1.0);
          const synth = generateSyntheticCandlesFx(seed, intervalMs, Math.min(220, count), `${curAsset}:${curTf}`);
          setChartData(synth);
          setChartNote('Market data unavailable — showing simulated chart.');

          const lc = synth[synth.length - 1]?.close ?? null;
          if (lc && lc > 0 && !marketEditingRef.current) setMarketPrice(lc.toFixed(5));
        }
      }

      const cached2 = ssGet<{ ts: number; candles: Candle[] }>(cacheKey);
      const baseMs = TIMEFRAMES.find((x) => x.value === curTf)?.pollMs ?? 15000;
      const freshMs = Math.max(20_000, Math.min(5 * 60_000, baseMs * 2));
      const isFresh = !!cached2?.ts && now - cached2.ts < freshMs;

      if (isFresh && !opts?.fresh) {
        chartInFlightRef.current = false;
        return;
      }
    } catch {}

    try {
      const result = await fetchFxCandles(curAsset, curTf, 260, ac.signal, !!opts?.fresh);
      if (ac.signal.aborted || unmountedRef.current) return;

      retryAfterMsRef.current = 0;
      setCandlesCacheLabel(result.cache || 'LIVE');

      const candles = result.candles;
      if (!candles.length) {
        setChartNote('No candles returned.');
        return;
      }

      ssSet(cacheKey, { ts: Date.now(), candles });
      setChartData(candles);

      const lc = candles[candles.length - 1]?.close ?? null;
      if (lc != null && lc > 0) {
        setLivePriceFast(curAsset, lc);
        pushFxTick(curAsset, lc);
        void pushPriceToServer(curAsset, lc);
      }
    } catch (e: any) {
      if (e?.name === 'CandlesError' && typeof e?.retryAfterMs === 'number' && e.retryAfterMs > 0) {
        retryAfterMsRef.current = e.retryAfterMs;
        setChartNote(`Rate limited. Retrying in ${Math.ceil(e.retryAfterMs / 1000)}s…`);
      } else {
        setChartNote(e?.message || 'Failed to load chart');
      }
    } finally {
      chartInFlightRef.current = false;
    }
  };

  // ===============================
  // market-gateway live ticks (WS)
  // ===============================
  const wsRef = useRef<WebSocket | null>(null);
  const wsWantedInstrumentRef = useRef<string>('');
  const wsConnectedRef = useRef(false);
  const wsRetryTimerRef = useRef<number | null>(null);
  const wsBackoffRef = useRef<number>(450);

  const liveUiRafRef = useRef<number | null>(null);
  const liveLastUiMsRef = useRef<number>(0);
  const liveLastPxRef = useRef<number | null>(null);

  const clearWsRetry = () => {
    try {
      if (wsRetryTimerRef.current) window.clearTimeout(wsRetryTimerRef.current);
    } catch {}
    wsRetryTimerRef.current = null;
  };

  const closeWs = () => {
    clearWsRetry();
    try {
      wsRef.current?.close(1000, 'client_close');
    } catch {}
    wsRef.current = null;
    wsConnectedRef.current = false;
    setWsOn(false);
  };

  const wsSend = (obj: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(obj));
    } catch {}
  };

  const scheduleWsReconnect = (why?: string) => {
    if (unmountedRef.current) return;
    clearWsRetry();

    const delay = Math.min(8000, wsBackoffRef.current + Math.floor(Math.random() * 350));
    wsBackoffRef.current = Math.min(8000, Math.floor(wsBackoffRef.current * 1.35));

    if (why) setWsNote(why);

    wsRetryTimerRef.current = window.setTimeout(() => {
      void connectWs();
    }, delay);
  };

  const subscribeInstrument = (instrument: string) => {
    if (!instrument) return;

    const prev = wsWantedInstrumentRef.current;
    wsWantedInstrumentRef.current = instrument;

    if (wsConnectedRef.current) {
      if (prev && prev !== instrument) wsSend({ action: 'unsubscribe', fx: [prev] });
      wsSend({ action: 'subscribe', fx: [instrument] });
    }
  };

  const connectWs = async () => {
    if (unmountedRef.current) return;

    const url = getGatewayUrl();
    if (!url) {
      setWsOn(false);
      setWsNote('Missing gateway WS URL.');
      return;
    }

    const existing = wsRef.current;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;

    try {
      setWsNote(`Connecting…`);
      // eslint-disable-next-line no-console
      console.log('[market-gw] connecting →', url);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        wsConnectedRef.current = true;
        wsBackoffRef.current = 450;
        setWsOn(true);
        setWsNote(null);
        // eslint-disable-next-line no-console
        console.log('[market-gw] OPEN ✅');

        const inst = wsWantedInstrumentRef.current;
        if (inst) wsSend({ action: 'subscribe', fx: [inst] });
      };

      ws.onmessage = (ev) => {
        let msg: GatewayMsg | null = null;
        try {
          msg = JSON.parse(String(ev.data || ''));
        } catch {
          msg = null;
        }
        if (!msg) return;

        if ((msg as any)?.type === 'hello') {
          // eslint-disable-next-line no-console
          console.log('[market-gw] HELLO', msg);
        }

        if ((msg as any)?.type === 'fx_tick') {
          const m = msg as any;
          const inst = String(m.instrument || '').toUpperCase();
          const px = Number(m.mid);
          if (!inst || !Number.isFinite(px) || px <= 0) return;

          const wanted = wsWantedInstrumentRef.current;
          if (wanted && inst !== wanted) return;

          const pair = assetRef.current;
          const nowMs = Date.now();

          pushFxTick(pair, px);
          applyLiveTickToChart(px, nowMs);

          liveLastPxRef.current = px;

          const doUi = () => {
            liveUiRafRef.current = null;

            const p = liveLastPxRef.current;
            if (p == null) return;

            const now = Date.now();
            if (now - liveLastUiMsRef.current < 140) return;
            liveLastUiMsRef.current = now;

            setLivePriceFast(pair, p);
            void pushPriceToServer(pair, p);
          };

          if (liveUiRafRef.current == null) {
            liveUiRafRef.current = window.requestAnimationFrame(doUi);
          }
        }
      };

      ws.onerror = (e) => {
        // eslint-disable-next-line no-console
        console.log('[market-gw] ERROR ❌', e);
        setWsOn(false);
        setWsNote('WS error (likely cold start / network). Retrying…');
        scheduleWsReconnect('WS error. Retrying…');
      };

      ws.onclose = (e) => {
        // eslint-disable-next-line no-console
        console.log('[market-gw] CLOSE', e.code, e.reason);
        wsConnectedRef.current = false;
        wsRef.current = null;
        setWsOn(false);

        const msg = `WS closed (${e.code}${e.reason ? `: ${e.reason}` : ''}). Retrying…`;
        setWsNote(msg);
        scheduleWsReconnect(msg);
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[market-gw] CONNECT FAIL', err);
      setWsOn(false);
      setWsNote('WS connect failed. Retrying…');
      scheduleWsReconnect('WS connect failed. Retrying…');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const inst = displayToOandaInstrument(asset);
    subscribeInstrument(inst);
    void connectWs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  // mount/unmount
  useEffect(() => {
    unmountedRef.current = false;

    void loadTrades('active');
    void refreshUser().catch(() => {});
    void connectWs();

    return () => {
      unmountedRef.current = true;

      try {
        if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
      } catch {}
      pollTimeoutRef.current = null;

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

      try {
        if (liveUiRafRef.current != null) window.cancelAnimationFrame(liveUiRafRef.current);
      } catch {}
      liveUiRafRef.current = null;

      closeWs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // adaptive chart polling loop
  useEffect(() => {
    const baseMs = TIMEFRAMES.find((x) => x.value === tf)?.pollMs ?? 15000;

    const clear = () => {
      try {
        if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
      } catch {}
      pollTimeoutRef.current = null;
    };

    let cancelled = false;
    const jitter = () => Math.floor(Math.random() * 700);

    const tick = async () => {
      if (cancelled || unmountedRef.current) return;

      if (typeof document !== 'undefined' && document.hidden) {
        clear();
        pollTimeoutRef.current = window.setTimeout(tick, Math.max(25000, baseMs));
        return;
      }

      await loadChart();

      const retryMs = retryAfterMsRef.current;
      const next = (retryMs > 0 ? retryMs : baseMs) + jitter();

      clear();
      pollTimeoutRef.current = window.setTimeout(tick, next);
    };

    const onVis = () => {
      if (cancelled || unmountedRef.current) return;

      if (!document.hidden) {
        retryAfterMsRef.current = 0;
        void loadChart();
        clear();
        pollTimeoutRef.current = window.setTimeout(tick, baseMs + jitter());
      } else {
        clear();
      }
    };

    void loadChart();
    clear();
    pollTimeoutRef.current = window.setTimeout(tick, baseMs + jitter());

    try {
      document.addEventListener('visibilitychange', onVis);
    } catch {}

    return () => {
      cancelled = true;
      clear();
      try {
        document.removeEventListener('visibilitychange', onVis);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, tf]);

  const onRefresh = async () => {
    await loadTrades(mode);
    await loadChart({ fresh: true });
    try {
      await refreshUser();
    } catch {}
    void connectWs();
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

      setBalance(clampNum(json?.balance ?? json?.balance_available ?? balance));
      await loadTrades(mode);

      const lc = liveLastPxRef.current ?? lastClose;
      if (lc != null && lc > 0) {
        pushFxTick(asset, lc);
        void pushPriceToServer(asset, lc);
      }

      try {
        await refreshUser();
      } catch {}
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

      setBalance(clampNum(json?.balance ?? json?.balance_available ?? balance));

      setExitDraft((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });

      await loadTrades(mode);

      try {
        await refreshUser();
      } catch {}
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
  const tfLabel = TIMEFRAMES.find((x) => x.value === tf)?.label ?? tf;

  return (
    <div className="min-h-screen bg-[#07070b] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <CandlestickChart className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xl font-semibold">FX Trading</div>
              <div className="text-xs text-white/60">Live ticks (market-gateway) + OANDA candles</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>

              <div className="flex items-baseline gap-2">
                <div className="text-[11px] tracking-wide uppercase text-white/60">Live</div>
                <div className="text-sm font-semibold tabular-nums">
                  {asset}
                  {lastClose != null ? ` · ${lastClose.toFixed(5)}` : ''}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-white/60">
                <span className="px-2 py-1 rounded-full bg-black/30 border border-white/10">{tfLabel}</span>
                <span className="px-2 py-1 rounded-full bg-black/30 border border-white/10">
                  Notional ${fmt(notionalPreview, 0)}
                </span>
                <span className="px-2 py-1 rounded-full bg-black/30 border border-white/10 tabular-nums">
                  Wallet ${fmt(balance, 2)}
                </span>
              </div>
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

        {/* Error */}
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-200 mt-0.5" />
            <div className="text-sm text-red-100">{error}</div>
          </div>
        ) : null}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Chart card */}
          <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="font-semibold">{asset}</div>
                <div className="text-xs text-white/60">
                  {tfLabel}
                  {lastClose != null ? ` · ${lastClose.toFixed(5)}` : ''}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-white/60 px-2 py-1 rounded-full bg-black/30 border border-white/10">
                  WS: {wsOn ? 'on' : 'off'}
                </div>
                <div className="text-xs text-white/60 px-2 py-1 rounded-full bg-black/30 border border-white/10">
                  Candles: {candlesCacheLabel}
                </div>

                {wsNote ? (
                  <div className="text-xs text-amber-200 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 max-w-[360px] truncate">
                    {wsNote}
                  </div>
                ) : null}

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
                        tf === t.value
                          ? 'bg-white/10 border-white/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="relative rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                <div ref={chartWrapRef} className="w-full h-[420px] sm:h-[520px] lg:h-[640px]" />

                {/* note overlay */}
                {chartNote ? (
                  <div className="absolute left-4 bottom-4 text-[11px] text-white/70 px-3 py-2 rounded-xl bg-black/50 border border-white/10">
                    {chartNote}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Trade ticket */}
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
                  onFocus={() => {
                    marketEditingRef.current = true;
                  }}
                  onBlur={() => {
                    marketEditingRef.current = false;
                  }}
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

        {/* Tabs */}
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

        {/* Trades */}
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
                            {t.direction === 'buy' ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
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
