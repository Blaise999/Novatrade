// app/dashboard/stocks/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Plus,
  Minus,
  Search,
  Star,
  StarOff,
  CheckCircle,
  AlertCircle,
  CandlestickChart,
  LineChart as LineChartIcon,
  X,
  Activity,
  Wallet,
} from 'lucide-react';

import { useStore } from '@/lib/supabase/store-supabase';
import { useTradingAccountStore } from '@/lib/trading-store';
import { marketAssets } from '@/lib/data';
import type { StockPosition } from '@/lib/trading-types';
import KYCGate from '@/components/KYCGate';
import { saveTradeToHistory, closeTradeInHistory } from '@/lib/services/trade-history';

// ✅ Alpaca (server-proxied)
import { fetchCandles, fetchQuotesBatch } from '@/lib/market/alpaca';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';
const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D'];

type MobileTab = 'chart' | 'trade' | 'portfolio';

type StockAsset = {
  symbol: string;
  name: string;
  price: number;
  changePercent24h: number;
  type: 'stock';
};

type LiveQuote = {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  changePercent24h: number;
  prevClose?: number;
  ts?: number;
};

type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };

// small catalog helpers
const stockInfo: Record<string, { emoji: string; sector: string }> = {
  AAPL: { emoji: '🍎', sector: 'Technology' },
  NVDA: { emoji: '🟢', sector: 'Technology' },
  TSLA: { emoji: '⚡', sector: 'Automotive' },
  MSFT: { emoji: '🪟', sector: 'Technology' },
  GOOGL: { emoji: '🔍', sector: 'Technology' },
  AMZN: { emoji: '📦', sector: 'Consumer' },
  META: { emoji: '👤', sector: 'Technology' },
  NFLX: { emoji: '🎬', sector: 'Entertainment' },
  AMD: { emoji: '🔴', sector: 'Semiconductors' },
  INTC: { emoji: '🔷', sector: 'Semiconductors' },
  COIN: { emoji: '🪙', sector: 'Fintech' },
  JPM: { emoji: '🏦', sector: 'Finance' },
  DIS: { emoji: '🏰', sector: 'Entertainment' },
  SPOT: { emoji: '🎵', sector: 'Entertainment' },
};

function n(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function clampInt(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, Math.floor(x)));
}

function fmtMoney(x: number) {
  if (!Number.isFinite(x)) return '$0';
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtPct(x: number) {
  const v = Number.isFinite(x) ? x : 0;
  const s = v >= 0 ? '+' : '';
  return `${s}${v.toFixed(2)}%`;
}

function normalizeStockAsset(a: any): StockAsset {
  return {
    symbol: String(a?.symbol || '').toUpperCase(),
    name: String(a?.name || a?.symbol || 'Stock'),
    price: n(a?.price, 0),
    changePercent24h: n(a?.changePercent24h ?? a?.change24h ?? a?.changePct24h, 0),
    type: 'stock',
  };
}

function deriveChangePercent(price: number, prevClose?: number) {
  if (!prevClose || !Number.isFinite(prevClose) || prevClose <= 0) return 0;
  return ((price - prevClose) / prevClose) * 100;
}

function tfToAlpacaTf(tf: Timeframe) {
  // your API route maps these
  switch (tf) {
    case '1m':
      return '1min';
    case '5m':
      return '5min';
    case '15m':
      return '15min';
    case '1h':
      return '1h';
    case '4h':
      return '4h';
    case '1D':
      return '1day';
    default:
      return '15min';
  }
}

function tfToMs(tf: Timeframe) {
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
      return 15 * 60_000;
  }
}

function tfPollMs(tf: Timeframe) {
  // smart-ish polling: slower for higher TF
  switch (tf) {
    case '1m':
      return 65_000;
    case '5m':
      return 305_000;
    case '15m':
      return 905_000;
    case '1h':
      return 3_605_000;
    case '4h':
      return 14_405_000;
    case '1D':
      return 86_405_000;
    default:
      return 905_000;
  }
}

function parseMarketTimeToMs(dt: string) {
  const s = String(dt || '').trim();
  if (!s) return Date.now();

  const hasTZ = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s);
  const isoLike = s.includes(' ') ? s.replace(' ', 'T') : s;

  const t1 = Date.parse(isoLike);
  if (Number.isFinite(t1)) return t1;

  if (!hasTZ) {
    const t2 = Date.parse(`${isoLike}Z`);
    if (Number.isFinite(t2)) return t2;
  }

  return Date.now();
}

// ===============================
// ✅ Session cache helpers
// ===============================
const SS_PREFIX = 'novatrade:stocks';
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
  } catch {
    // ignore
  }
}

// ===============================
// ✅ Always-chart fallback
// ===============================
type Tick = { t: number; p: number };

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

function buildCandlesFromTicks(ticks: Tick[], intervalMs: number, count: number): Candle[] {
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
      out.push({ t: b0, o: p, h: p, l: p, c: p, v: undefined });
      continue;
    }

    const o = bucket[0].p;
    const c = bucket[bucket.length - 1].p;
    let h = o,
      l = o;
    for (const x of bucket) {
      if (x.p > h) h = x.p;
      if (x.p < l) l = x.p;
    }

    lastClose = c;
    out.push({ t: b0, o, h, l, c, v: undefined });
  }

  return out.filter((x) => x.o > 0 && x.h > 0 && x.l > 0 && x.c > 0);
}

function generateSyntheticCandles(seedPrice: number, intervalMs: number, count: number, seedKey: string): Candle[] {
  const p0 = Number.isFinite(seedPrice) && seedPrice > 0 ? seedPrice : 100;
  const rng = mulberry32(hashStr(seedKey));

  const now = Date.now();
  const end = Math.floor(now / intervalMs) * intervalMs;
  const start = end - count * intervalMs;

  const baseVol = Math.max(0.02, p0 * 0.002);
  let last = p0;

  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * intervalMs;

    const drift = (rng() - 0.5) * baseVol;
    const o = last;
    const c = Math.max(0.01, o + drift);

    const wick = baseVol * (0.4 + rng());
    const h = Math.max(o, c) + wick * rng();
    const l = Math.max(0.01, Math.min(o, c) - wick * rng());

    out.push({ t, o, h, l, c, v: undefined });
    last = c;
  }

  return out;
}

const SEED_CANDLE_LIMIT = 220;
const TAIL_CANDLE_LIMIT = 3;
const RESEED_EVERY_MS = 10 * 60 * 1000;

function mergeCandles(prev: Candle[], incoming: Candle[], maxKeep = SEED_CANDLE_LIMIT): Candle[] {
  if (!incoming?.length) return prev;

  const map = new Map<number, Candle>();
  for (const c of prev) map.set(c.t, c);
  for (const c of incoming) map.set(c.t, c);

  const merged = Array.from(map.values()).sort((a, b) => a.t - b.t);
  return merged.length > maxKeep ? merged.slice(-maxKeep) : merged;
}

function jitter(ms = 1200) {
  return Math.floor(Math.random() * ms);
}

export default function StockTradingPage() {
  const { user, refreshUser } = useStore();

  const spotAccount = useTradingAccountStore((s) => (s as any).spotAccount);
  const stockPositions = useTradingAccountStore((s) => (s as any).stockPositions as StockPosition[]);
  const executeStockBuy = useTradingAccountStore((s) => (s as any).executeStockBuy);
  const executeStockSell = useTradingAccountStore((s) => (s as any).executeStockSell);
  const updateStockPositionPrice = useTradingAccountStore((s) => (s as any).updateStockPositionPrice);

  const stockAssets = useMemo(() => {
    const list = (marketAssets as any[])
      .filter((a) => a?.type === 'stock')
      .map(normalizeStockAsset)
      .filter((a) => a.symbol);

    return list.length
      ? list
      : ([{ symbol: 'AAPL', name: 'Apple', price: 190, changePercent24h: 0, type: 'stock' }] as StockAsset[]);
  }, []);

  const [selectedSymbol, setSelectedSymbol] = useState<string>(stockAssets[0]?.symbol ?? 'AAPL');
  const selectedAsset = useMemo(
    () => stockAssets.find((a) => a.symbol === selectedSymbol) ?? stockAssets[0],
    [stockAssets, selectedSymbol]
  );

  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['AAPL', 'NVDA', 'TSLA']);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>('15m');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');

  const [orderMode, setOrderMode] = useState<'shares' | 'dollars'>('shares');
  const [shareQty, setShareQty] = useState(1);
  const [dollarAmount, setDollarAmount] = useState(100);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const notifTimerRef = useRef<number | null>(null);
  const pushNotif = (nfy: { type: 'success' | 'error'; message: string }, ms = 3000) => {
    setNotification(nfy);
    if (notifTimerRef.current) window.clearTimeout(notifTimerRef.current);
    notifTimerRef.current = window.setTimeout(() => setNotification(null), ms);
  };
  useEffect(() => {
    return () => {
      if (notifTimerRef.current) window.clearTimeout(notifTimerRef.current);
    };
  }, []);

  // sell modal
  const [showSellModal, setShowSellModal] = useState(false);
  const [positionToSell, setPositionToSell] = useState<StockPosition | null>(null);
  const [sellQty, setSellQty] = useState(0);

  // ---- Live quotes (SSE primary + polling fallback)
  const [sseState, setSseState] = useState<'connecting' | 'live' | 'down'>('connecting');
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const prevCloseRef = useRef<Record<string, number>>({});
  const pauseUntilRef = useRef<number>(0);

  const toggleFavorite = (symbol: string) => {
    const s = String(symbol || '').toUpperCase();
    setFavorites((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stockAssets;
    return stockAssets.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [stockAssets, searchQuery]);

  const quoteSymbols = useMemo(() => {
    const set = new Set<string>();
    set.add(String(selectedSymbol || '').toUpperCase());
    for (const s of favorites) set.add(String(s || '').toUpperCase());
    for (const p of stockPositions || []) set.add(String((p as any)?.symbol || '').toUpperCase());
    return Array.from(set).filter(Boolean).slice(0, 12);
  }, [selectedSymbol, favorites, stockPositions]);

  const pollingKey = useMemo(() => quoteSymbols.join(','), [quoteSymbols]);

  // ✅ SSE stream
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!quoteSymbols.length) return;

    try {
      esRef.current?.close();
    } catch {}
    esRef.current = null;

    let alive = true;
    setSseState('connecting');

    const es = new EventSource(`/api/market/stocks/stream?symbols=${encodeURIComponent(quoteSymbols.join(','))}`);
    esRef.current = es;

    // seed once via snapshots
    (async () => {
      try {
        const resp: any = await fetchQuotesBatch(quoteSymbols);
        if (!alive) return;

        const dataMap: Record<string, any> =
          resp?.data && typeof resp.data === 'object' ? (resp.data as Record<string, any>) : (resp as Record<string, any>);

        setQuotes((prev) => {
          const next = { ...prev };
          for (const sym of quoteSymbols) {
            const key = String(sym || '').toUpperCase();
            const q: any = dataMap?.[key] || dataMap?.[sym] || null;
            if (!q) continue;

            const price = n(q?.price ?? q?.close ?? q?.last ?? q?.c, 0);
            if (!price) continue;

            const prevClose =
              n(q?.previous_close, 0) ||
              n(q?.prev_close, 0) ||
              n((q as any)?.prevClose, 0) ||
              prevCloseRef.current[key] ||
              next[key]?.prevClose ||
              undefined;

            if (prevClose && !prevCloseRef.current[key]) prevCloseRef.current[key] = prevClose;

            const pctRaw = q?.percent_change ?? q?.change_percent ?? q?.percentChange ?? q?.changePercent24h ?? q?.changePercent24h ?? undefined;
            const pct = Number.isFinite(n(pctRaw, NaN)) ? n(pctRaw, 0) : deriveChangePercent(price, prevClose);

            next[key] = {
              symbol: key,
              price,
              bid: n(q?.bid, 0) || price * 0.9999,
              ask: n(q?.ask, 0) || price * 1.0001,
              changePercent24h: pct,
              prevClose,
              ts: Date.now(),
            };

            try {
              updateStockPositionPrice?.(key, price);
            } catch {}

            // ticks cache for candle fallback
            try {
              const tickKey = `${SS_PREFIX}:ticks:${key}`;
              const prevTicks = ssGet<Tick[]>(tickKey) || [];
              ssSet(tickKey, [...prevTicks, { t: Date.now(), p: price }].slice(-900));
            } catch {}
          }
          return next;
        });
      } catch {
        // ignore seed failure
      }
    })();

    es.onmessage = (ev) => {
      if (!alive) return;

      let m: any = null;
      try {
        m = JSON.parse(ev.data || '{}');
      } catch {
        return;
      }

      if (m?.type === 'status') {
        setSseState(m?.state === 'live' ? 'live' : m?.state === 'connecting' ? 'connecting' : 'down');
        return;
      }

      const sym = String(m?.symbol || '').toUpperCase();
      if (!sym) return;

      setQuotes((prev) => {
        const cur = prev[sym] || { symbol: sym, price: 0, bid: 0, ask: 0, ts: 0, changePercent24h: 0 };

        let price = cur.price;
        let bid = cur.bid;
        let ask = cur.ask;

        if (m?.type === 'trade') price = n(m?.price, cur.price);
        if (m?.type === 'quote') {
          bid = n(m?.bid, cur.bid);
          ask = n(m?.ask, cur.ask);
        }

        if (!bid && price) bid = price * 0.9999;
        if (!ask && price) ask = price * 1.0001;

        const prevClose = cur.prevClose ?? prevCloseRef.current[sym] ?? undefined;
        const pct = deriveChangePercent(price, prevClose);

        const next = {
          ...cur,
          symbol: sym,
          price,
          bid,
          ask,
          changePercent24h: Number.isFinite(pct) ? pct : cur.changePercent24h,
          prevClose,
          ts: Date.now(),
        };

        try {
          updateStockPositionPrice?.(sym, next.price);
        } catch {}

        try {
          if (next.price > 0) {
            const tickKey = `${SS_PREFIX}:ticks:${sym}`;
            const prevTicks = ssGet<Tick[]>(tickKey) || [];
            ssSet(tickKey, [...prevTicks, { t: Date.now(), p: next.price }].slice(-900));
          }
        } catch {}

        return { ...prev, [sym]: next };
      });
    };

    es.onerror = () => {
      if (!alive) return;
      setSseState('down');
      try {
        es.close();
      } catch {}
    };

    return () => {
      alive = false;
      try {
        es.close();
      } catch {}
    };
  }, [pollingKey, quoteSymbols, updateStockPositionPrice]);

  // ✅ Polling fallback (only when SSE not live)
  useEffect(() => {
    if (!quoteSymbols.length) return;
    if (sseState === 'live') return;

    let alive = true;
    let timer: number | null = null;

    const pollMs = 22_000;

    const tick = async () => {
      try {
        if (!alive) return;
        if (Date.now() < pauseUntilRef.current) return;
        if (typeof document !== 'undefined' && document.hidden) return;

        const resp: any = await fetchQuotesBatch(quoteSymbols);
        const dataMap: Record<string, any> =
          resp?.data && typeof resp.data === 'object' ? (resp.data as Record<string, any>) : (resp as Record<string, any>);

        setQuotes((prev) => {
          const next: Record<string, LiveQuote> = { ...prev };

          for (const sym of quoteSymbols) {
            const key = String(sym || '').toUpperCase();
            const q: any = dataMap?.[key] || dataMap?.[sym] || null;
            if (!q) continue;

            const price = n(q?.price ?? q?.close ?? q?.last ?? q?.c, 0);
            if (!price || !Number.isFinite(price)) continue;

            const prevClose =
              n(q?.previous_close, 0) ||
              n(q?.prev_close, 0) ||
              prevCloseRef.current[key] ||
              next[key]?.prevClose ||
              undefined;

            if (prevClose && !prevCloseRef.current[key]) prevCloseRef.current[key] = prevClose;

            const pctRaw =
              q?.percent_change ?? q?.change_percent ?? q?.percentChange ?? q?.changePercent24h ?? q?.changePercent24h ?? undefined;
            const pct = Number.isFinite(n(pctRaw, NaN)) ? n(pctRaw, 0) : deriveChangePercent(price, prevClose);

            next[key] = {
              symbol: key,
              price,
              bid: n(q?.bid, 0) || price * 0.9999,
              ask: n(q?.ask, 0) || price * 1.0001,
              changePercent24h: pct,
              prevClose,
              ts: Date.now(),
            };

            try {
              updateStockPositionPrice?.(key, price);
            } catch {}
          }

          return next;
        });
      } catch {
        // ignore
      }
    };

    const loop = async () => {
      if (!alive) return;
      await tick();
      if (!alive) return;
      timer = window.setTimeout(loop, pollMs + jitter());
    };

    void loop();

    const onVis = () => {
      if (!alive) return;
      if (!document.hidden) void tick();
    };

    try {
      document.addEventListener('visibilitychange', onVis);
    } catch {}

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      try {
        document.removeEventListener('visibilitychange', onVis);
      } catch {}
    };
  }, [pollingKey, quoteSymbols, updateStockPositionPrice, sseState]);

  // ---- Candles: seed + tail + always-chart fallback
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [candlesUpdatedAt, setCandlesUpdatedAt] = useState<number>(0);
  const [candlesStale, setCandlesStale] = useState<boolean>(false);

  const live = quotes[selectedSymbol];

  const candleTimerRef = useRef<number | null>(null);
  const candleSeedKeyRef = useRef<string>('');
  const candleLastSeedAtRef = useRef<number>(0);
  const candleInFlightRef = useRef(false);
  const candleReqIdRef = useRef(0);

  useEffect(() => {
    let alive = true;

    const intervalStr = tfToAlpacaTf(chartTimeframe);
    const intervalMs = tfToMs(chartTimeframe);
    const pollMs = tfPollMs(chartTimeframe);

    const cacheKey = `${SS_PREFIX}:candles:${selectedSymbol}:${intervalStr}`;
    const seedKey = `${selectedSymbol}:${intervalStr}`;

    const clearTimer = () => {
      try {
        if (candleTimerRef.current) window.clearTimeout(candleTimerRef.current);
      } catch {}
      candleTimerRef.current = null;
    };

    // instant chart: cache -> ticks -> synthetic
    const cached = ssGet<{ ts: number; candles: Candle[] }>(cacheKey);
    if (cached?.candles?.length) {
      setCandles(cached.candles);
      setCandlesUpdatedAt(cached.ts || Date.now());
      setCandlesStale(true);
    } else {
      const ticks = ssGet<Tick[]>(`${SS_PREFIX}:ticks:${selectedSymbol}`) || [];
      const built = buildCandlesFromTicks(ticks, intervalMs, SEED_CANDLE_LIMIT);
      if (built.length) {
        setCandles(built);
        setCandlesUpdatedAt(Date.now());
        setCandlesStale(true);
      } else {
        const seedPrice = live?.price ?? selectedAsset?.price ?? 100;
        const synth = generateSyntheticCandles(seedPrice, intervalMs, SEED_CANDLE_LIMIT, seedKey);
        setCandles(synth);
        setCandlesUpdatedAt(Date.now());
        setCandlesStale(true);
      }
    }

    const loadCandles = async (opts?: { forceSeed?: boolean }) => {
      if (!alive) return;
      if (Date.now() < pauseUntilRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      if (candleInFlightRef.current) return;
      candleInFlightRef.current = true;

      const reqId = ++candleReqIdRef.current;

      try {
        const now = Date.now();
        const needsSeed =
          opts?.forceSeed === true ||
          candleSeedKeyRef.current !== seedKey ||
          now - candleLastSeedAtRef.current > RESEED_EVERY_MS;

        const limit = needsSeed ? SEED_CANDLE_LIMIT : TAIL_CANDLE_LIMIT;
        setLoadingChart(needsSeed);

        const raw: any = await fetchCandles(selectedSymbol, intervalStr, limit);

        if (!alive) return;
        if (reqId !== candleReqIdRef.current) return;

        const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.candles) ? raw.candles : [];

        const out: Candle[] = arr
          .map((c: any) => ({
            t: parseMarketTimeToMs(String(c?.time || c?.datetime || c?.date || c?.t || '')),
            o: n(c?.open ?? c?.o, 0),
            h: n(c?.high ?? c?.h, 0),
            l: n(c?.low ?? c?.l, 0),
            c: n(c?.close ?? c?.c, 0),
            v: c?.volume != null ? n(c?.volume, undefined as any) : undefined,
          }))
          .filter((x) => x.o > 0 && x.h > 0 && x.l > 0 && x.c > 0);

        if (!out.length) {
          setCandlesStale(true);
          return;
        }

        setCandles((prev) => (needsSeed ? out : mergeCandles(prev, out, SEED_CANDLE_LIMIT)));

        const ts = Date.now();
        const prevCache = ssGet<{ ts: number; candles: Candle[] }>(cacheKey)?.candles || [];
        const mergedForCache = needsSeed ? out : mergeCandles(prevCache, out, SEED_CANDLE_LIMIT);
        ssSet(cacheKey, { ts, candles: mergedForCache });

        setCandlesUpdatedAt(ts);
        setCandlesStale(false);

        if (needsSeed) {
          candleSeedKeyRef.current = seedKey;
          candleLastSeedAtRef.current = now;
        }
      } catch {
        setCandlesStale(true);
      } finally {
        candleInFlightRef.current = false;
        if (alive) setLoadingChart(false);
      }
    };

    const loop = async () => {
      if (!alive) return;
      await loadCandles();
      if (!alive) return;
      clearTimer();
      candleTimerRef.current = window.setTimeout(loop, pollMs + jitter());
    };

    void loadCandles({ forceSeed: true });
    clearTimer();
    candleTimerRef.current = window.setTimeout(loop, pollMs + jitter());

    const onVis = () => {
      if (!alive) return;
      if (!document.hidden) void loadCandles();
    };

    try {
      document.addEventListener('visibilitychange', onVis);
    } catch {}

    return () => {
      alive = false;
      clearTimer();
      try {
        document.removeEventListener('visibilitychange', onVis);
      } catch {}
    };
  }, [selectedSymbol, chartTimeframe, live?.price, selectedAsset?.price]);

  // ---- Chart sizing
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 320, height: 280 });

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setChartDimensions({
        width: Math.max(280, Math.floor(r.width || 320)),
        height: Math.max(240, Math.floor(r.height || 280)),
      });
    };

    update();
    const t1 = window.setTimeout(update, 50);
    const t2 = window.setTimeout(update, 200);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    }

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      ro?.disconnect();
    };
  }, [mobileTab]);

  // ---- Derived quote
  const price = live?.price ?? selectedAsset?.price ?? 0;
  const bidPrice = live?.bid ?? (price ? price * 0.9999 : 0);
  const askPrice = live?.ask ?? (price ? price * 1.0001 : 0);
  const changePercent24h = live?.changePercent24h ?? selectedAsset?.changePercent24h ?? 0;
  const up = changePercent24h >= 0;

  const safeAsk = Number.isFinite(askPrice) && askPrice > 0 ? askPrice : 0;

  const effectiveShares =
    orderMode === 'shares'
      ? clampInt(shareQty, 1, 1_000_000)
      : safeAsk > 0
        ? Math.floor(dollarAmount / safeAsk)
        : 0;

  const orderValue = effectiveShares * safeAsk;
  const commission = effectiveShares > 0 ? Math.max(0.99, orderValue * 0.001) : 0;
  const totalCost = orderValue + commission;

  const userBalance = Number((user as any)?.balance ?? 0);
  const cashBalance =
    Number((spotAccount as any)?.availableToTrade ?? (spotAccount as any)?.cash ?? (spotAccount as any)?.balance ?? userBalance) || 0;

  const portfolioValue = (stockPositions || []).reduce((sum, pos: any) => sum + Number(pos?.marketValue ?? 0), 0);
  const totalEquity = cashBalance + portfolioValue;
  const unrealizedPnL = (stockPositions || []).reduce((sum, pos: any) => sum + Number(pos?.unrealizedPnL ?? 0), 0);

  const canBuy = effectiveShares >= 1 && safeAsk > 0 && totalCost <= cashBalance;

  const info = stockInfo[selectedSymbol] || { emoji: '📈', sector: 'Other' };

  // ---- Chart geometry
  const chart = useMemo(() => {
    const w = chartDimensions.width;
    const h = chartDimensions.height;
    const pad = { l: 12, r: 62, t: 16, b: 18 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;

    if (!candles.length) {
      return { w, h, pad, items: [] as any[], min: 0, max: 0, linePath: '' };
    }

    const min = Math.min(...candles.map((c) => c.l));
    const max = Math.max(...candles.map((c) => c.h));
    const range = max - min || 1;

    const nC = candles.length;
    const gap = cw / nC;
    const bodyW = Math.max(3, gap * 0.55);

    const y = (p: number) => pad.t + ((max - p) / range) * ch;

    const items = candles.map((c, i) => {
      const x = pad.l + i * gap + gap / 2;
      return {
        x,
        oY: y(c.o),
        cY: y(c.c),
        hY: y(c.h),
        lY: y(c.l),
        isUp: c.c >= c.o,
        bodyW,
      };
    });

    const pts = candles.map((c, i) => ({
      x: pad.l + i * gap + gap / 2,
      y: y(c.c),
    }));

    const linePath =
      pts.length > 1 ? `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') : '';

    return { w, h, pad, items, min, max, linePath };
  }, [candles, chartDimensions]);

  const handleBuy = async () => {
    if (safeAsk <= 0) {
      pushNotif({ type: 'error', message: 'No live price yet. Try again.' }, 2500);
      return;
    }
    if (effectiveShares < 1) {
      pushNotif({ type: 'error', message: 'Amount too small — shares becomes 0.' }, 2500);
      return;
    }
    if (totalCost > cashBalance) {
      pushNotif({ type: 'error', message: 'Insufficient funds' }, 2500);
      return;
    }

    const result = executeStockBuy?.(
      selectedSymbol,
      selectedAsset?.name ?? selectedSymbol,
      effectiveShares,
      safeAsk,
      commission
    );

    if (result?.success) {
      await refreshUser?.();

      // history sync (best-effort)
      try {
        const uid = (user as any)?.id;
        if (uid) {
          const state = (useTradingAccountStore as any).getState?.() || {};
          const pos = (state.stockPositions || []).find((p: any) => p.symbol === selectedSymbol);
          if (pos) {
            saveTradeToHistory({
              id: pos.id,
              userId: uid,
              marketType: 'stocks',
              assetType: 'stock',
              pair: selectedSymbol,
              symbol: selectedSymbol,
              type: 'buy',
              side: 'buy',
              quantity: pos.qty,
              amount: pos.qty * safeAsk,
              entryPrice: pos.avgEntry ?? safeAsk,
              leverage: 1,
          
              openedAt: new Date().toISOString(),
              notes: JSON.stringify({ model: 'spot_hold', name: pos.name }),
            }).catch(() => {});
          }
        }
      } catch {}

      pushNotif({ type: 'success', message: `Bought ${effectiveShares} ${selectedSymbol} @ $${safeAsk.toFixed(2)}` });
    } else {
      pushNotif({ type: 'error', message: result?.error || 'Trade failed' });
    }
  };

  const openSell = (pos: StockPosition) => {
    const qty = clampInt(n((pos as any)?.qty, 0), 0, 1_000_000);
    setPositionToSell(pos);
    setSellQty(Math.max(1, Math.min(qty, qty)));
    setShowSellModal(true);
  };

  const handleSell = async () => {
    if (!positionToSell || sellQty <= 0) return;

    const safeBid = Number.isFinite(bidPrice) && bidPrice > 0 ? bidPrice : 0;
    if (!safeBid) {
      pushNotif({ type: 'error', message: 'No live bid yet. Try again.' }, 2500);
      return;
    }

    const sellCommission = Math.max(0.99, sellQty * safeBid * 0.001);
    const result = executeStockSell?.((positionToSell as any).id, sellQty, safeBid, sellCommission);

    if (result?.success) {
      const pnl = Number(result?.realizedPnL ?? 0);
      await refreshUser?.();

      // history sync (best-effort)
      try {
        const uid = (user as any)?.id;
        if (uid) {
          const after = ((useTradingAccountStore as any).getState?.() || {}).stockPositions || [];
          const still = after.find((p: any) => p.id === (positionToSell as any).id);

          if (still) {
            saveTradeToHistory({
              id: still.id,
              userId: uid,
              marketType: 'stocks',
              assetType: 'stock',
              pair: still.symbol,
              symbol: still.symbol,
              type: 'buy',
              side: 'buy',
              quantity: still.qty,
              entryPrice: still.avgEntry ?? 0,
      
              notes: JSON.stringify({ model: 'spot_hold', partial: true }),
            }).catch(() => {});
          } else {
            closeTradeInHistory({
              tradeId: (positionToSell as any).id,
              userId: uid,
              exitPrice: safeBid,
              pnl,
              status: 'closed',
              closedAt: new Date().toISOString(),
            }).catch(() => {});
          }
        }
      } catch {}

      pushNotif({
        type: 'success',
        message: `Sold ${sellQty} ${(positionToSell as any).symbol} for ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      });
    } else {
      pushNotif({ type: 'error', message: result?.error || 'Sell failed' });
    }

    setShowSellModal(false);
    setPositionToSell(null);
    setSellQty(0);
  };

  // ===== UI helpers
  const statusDot =
    sseState === 'live' ? 'bg-emerald-400' : sseState === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400';
  const statusText = sseState === 'live' ? 'Live' : sseState === 'connecting' ? 'Connecting' : 'Offline';

  const mobileTabs = (
    <div className="lg:hidden px-3 pb-2">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/5 p-1 border border-white/10">
        {(
          [
            { k: 'chart', label: 'Chart' },
            { k: 'trade', label: 'Trade' },
            { k: 'portfolio', label: 'Portfolio' },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setMobileTab(t.k)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              mobileTab === t.k ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <KYCGate action="trade stocks">
      <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] flex flex-col bg-void overflow-hidden">
        {/* top header */}
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg">
              {info.emoji}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <div className="text-white font-semibold text-lg">{selectedSymbol}</div>
                <div className="text-white/50 text-sm hidden sm:block">{selectedAsset?.name}</div>

                <div className="ml-2 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} />
                  <span className="text-xs text-white/60">{statusText}</span>
                  {candlesStale ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/60">
                      cached
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-0.5">
                <div className="text-white text-xl font-semibold">{fmtMoney(price)}</div>
                <div className={`text-sm ${up ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtPct(changePercent24h)}</div>
                <div className="text-xs text-white/50 hidden md:block">
                  Bid {fmtMoney(bidPrice)} • Ask {fmtMoney(askPrice)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(selectedSymbol)}
              className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
              title="Favorite"
            >
              {favorites.includes(selectedSymbol) ? <Star className="h-5 w-5 text-amber-300" /> : <StarOff className="h-5 w-5 text-white/70" />}
            </button>

            <button
              onClick={() => setShowAssetSelector((v) => !v)}
              className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-2"
            >
              <span className="text-sm text-white/90">Select</span>
              <ChevronDown className="h-4 w-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* asset selector */}
        <AnimatePresence>
          {showAssetSelector ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="px-4 lg:px-6 pb-4"
            >
              <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="p-3 border-b border-white/10 flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Search className="h-4 w-4 text-white/70" />
                  </div>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search symbol or name…"
                    className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-sm"
                  />
                  <button
                    onClick={() => setShowAssetSelector(false)}
                    className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-white/70" />
                  </button>
                </div>

                <div className="max-h-[360px] overflow-auto">
                  {filteredAssets.map((a) => {
                    const q = quotes[a.symbol];
                    const p = q?.price ?? a.price ?? 0;
                    const pct = q?.changePercent24h ?? a.changePercent24h ?? 0;
                    const isSel = a.symbol === selectedSymbol;
                    const fav = favorites.includes(a.symbol);
                    const up2 = pct >= 0;

                    return (
                      <button
                        key={a.symbol}
                        onClick={() => {
                          setSelectedSymbol(a.symbol);
                          setShowAssetSelector(false);
                          setSearchQuery('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/5 transition text-left ${
                          isSel ? 'bg-white/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-white font-semibold">{a.symbol}</div>
                          <div className="text-xs text-white/50">{a.name}</div>
                          {fav ? <Star className="h-4 w-4 text-amber-300" /> : null}
                        </div>

                        <div className="text-right">
                          <div className="text-sm text-white">{fmtMoney(p)}</div>
                          <div className={`text-xs ${up2 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtPct(pct)}</div>
                        </div>
                      </button>
                    );
                  })}

                  {!filteredAssets.length ? (
                    <div className="p-4 text-sm text-white/60">No results.</div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {mobileTabs}

        {/* content */}
        <div className="flex-1 px-4 lg:px-6 pb-5 overflow-hidden">
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 overflow-hidden">
            {/* CHART */}
            <div className={`lg:col-span-8 ${mobileTab !== 'chart' ? 'hidden lg:block' : ''} overflow-hidden`}>
              <div className="h-full rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-white/70" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-semibold">Price chart</div>
                      <div className="text-xs text-white/50">
                        {info.sector} • Updated{' '}
                        {candlesUpdatedAt ? new Date(candlesUpdatedAt).toLocaleTimeString() : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
                      {timeframes.map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setChartTimeframe(tf)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs transition ${
                            chartTimeframe === tf ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setChartType((x) => (x === 'candle' ? 'line' : 'candle'))}
                      className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-2"
                      title="Toggle chart"
                    >
                      {chartType === 'candle' ? (
                        <CandlestickChart className="h-4 w-4 text-white/70" />
                      ) : (
                        <LineChartIcon className="h-4 w-4 text-white/70" />
                      )}
                      <span className="text-xs text-white/70 hidden sm:block">
                        {chartType === 'candle' ? 'Candles' : 'Line'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* mobile TF row */}
                <div className="sm:hidden px-3 pt-3">
                  <div className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/10 p-1 overflow-auto">
                    {timeframes.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setChartTimeframe(tf)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs transition whitespace-nowrap ${
                          chartTimeframe === tf ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div ref={chartRef} className="flex-1 p-3">
                  <div className="h-full rounded-2xl bg-black/20 border border-white/5 overflow-hidden relative">
                    {loadingChart ? (
                      <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                        Loading…
                      </div>
                    ) : null}

                    <svg width={chart.w} height={chart.h} className="block">
                      {/* grid */}
                      <g opacity="0.12">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const y = 16 + ((chart.h - 34) / 4) * i;
                          return <line key={i} x1={8} y1={y} x2={chart.w - 8} y2={y} stroke="white" strokeWidth="1" />;
                        })}
                      </g>

                      {/* y labels */}
                      <g opacity="0.6">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const y = 16 + ((chart.h - 34) / 4) * i;
                          const v = chart.max - ((chart.max - chart.min) / 4) * i;
                          return (
                            <text
                              key={i}
                              x={chart.w - 8}
                              y={y + 4}
                              textAnchor="end"
                              fontSize="10"
                              fill="white"
                              opacity="0.55"
                            >
                              {v ? `$${v.toFixed(2)}` : ''}
                            </text>
                          );
                        })}
                      </g>

                      {/* line */}
                      {chartType === 'line' && chart.linePath ? (
                        <path d={chart.linePath} fill="none" stroke="white" strokeWidth="2" opacity="0.85" />
                      ) : null}

                      {/* candles */}
                      {chartType === 'candle'
                        ? chart.items.map((it: any, i: number) => {
                            const top = Math.min(it.oY, it.cY);
                            const bot = Math.max(it.oY, it.cY);
                            const bodyH = Math.max(2, bot - top);

                            return (
                              <g key={i} opacity="0.9">
                                <line
                                  x1={it.x}
                                  y1={it.hY}
                                  x2={it.x}
                                  y2={it.lY}
                                  stroke="white"
                                  strokeWidth="1"
                                  opacity="0.55"
                                />
                                <rect
                                  x={it.x - it.bodyW / 2}
                                  y={top}
                                  width={it.bodyW}
                                  height={bodyH}
                                  rx="2"
                                  fill="white"
                                  opacity={it.isUp ? 0.85 : 0.45}
                                />
                              </g>
                            );
                          })
                        : null}
                    </svg>

                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      <div className="text-xs text-white/60 px-2 py-1 rounded-lg border border-white/10 bg-white/5">
                        {selectedSymbol}
                      </div>
                      <div className="text-xs text-white/60 px-2 py-1 rounded-lg border border-white/10 bg-white/5">
                        {chartTimeframe}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className={`lg:col-span-4 ${mobileTab === 'chart' ? 'hidden lg:block' : ''} overflow-hidden`}>
              <div className="h-full grid grid-rows-2 gap-4 lg:gap-6 overflow-hidden">
                {/* TRADE */}
                <div className={`${mobileTab !== 'trade' ? 'hidden lg:block' : ''} overflow-hidden`}>
                  <div className="h-full rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <Wallet className="h-4 w-4 text-white/70" />
                        </div>
                        <div>
                          <div className="text-white text-sm font-semibold">Place order</div>
                          <div className="text-xs text-white/50">Spot stocks • Commission ~0.10%</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-white/50">Cash</div>
                        <div className="text-sm text-white font-semibold">{fmtMoney(cashBalance)}</div>
                      </div>
                    </div>

                    <div className="p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/5 border border-white/10 p-1">
                        <button
                          onClick={() => setOrderMode('shares')}
                          className={`rounded-lg px-3 py-2 text-sm transition ${
                            orderMode === 'shares' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Shares
                        </button>
                        <button
                          onClick={() => setOrderMode('dollars')}
                          className={`rounded-lg px-3 py-2 text-sm transition ${
                            orderMode === 'dollars' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
                          }`}
                        >
                          Dollars
                        </button>
                      </div>

                      {orderMode === 'shares' ? (
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-white/60">Quantity (shares)</div>
                            <div className="text-xs text-white/60">Max {Math.max(0, Math.floor(cashBalance / (safeAsk || 1)))}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShareQty((v) => Math.max(1, v - 1))}
                              className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
                            >
                              <Minus className="h-4 w-4 text-white/70" />
                            </button>

                            <input
                              value={shareQty}
                              onChange={(e) => setShareQty(clampInt(n(e.target.value, 1), 1, 1_000_000))}
                              className="flex-1 h-10 rounded-xl bg-black/20 border border-white/10 px-3 outline-none text-white"
                              inputMode="numeric"
                            />

                            <button
                              onClick={() => setShareQty((v) => Math.min(1_000_000, v + 1))}
                              className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
                            >
                              <Plus className="h-4 w-4 text-white/70" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-white/60">Amount (USD)</div>
                            <div className="text-xs text-white/60">Min $10</div>
                          </div>

                          <input
                            value={dollarAmount}
                            onChange={(e) => setDollarAmount(clampInt(n(e.target.value, 10), 10, 1_000_000_000))}
                            className="w-full h-10 rounded-xl bg-black/20 border border-white/10 px-3 outline-none text-white"
                            inputMode="numeric"
                          />

                          <div className="mt-2 grid grid-cols-4 gap-2">
                            {[50, 100, 250, 500].map((x) => (
                              <button
                                key={x}
                                onClick={() => setDollarAmount(x)}
                                className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition py-2 text-xs text-white/80"
                              >
                                ${x}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="rounded-2xl bg-white/5 border border-white/10 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Est. shares</span>
                          <span className="text-white/80 font-medium">{effectiveShares}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Order value</span>
                          <span className="text-white/80 font-medium">{fmtMoney(orderValue)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Commission</span>
                          <span className="text-white/80 font-medium">{fmtMoney(commission)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>Total</span>
                          <span className="text-white font-semibold">{fmtMoney(totalCost)}</span>
                        </div>
                      </div>

                      <button
                        onClick={handleBuy}
                        disabled={!canBuy}
                        className={`w-full h-11 rounded-xl font-semibold transition ${
                          canBuy
                            ? 'bg-white text-black hover:opacity-90 active:scale-[0.99]'
                            : 'bg-white/10 text-white/40 cursor-not-allowed'
                        }`}
                      >
                        Buy {selectedSymbol}
                      </button>

                      <div className="text-xs text-white/50">
                        Uses Alpaca data. If live stream is down, it falls back to cached/polling so the chart never goes blank.
                      </div>
                    </div>
                  </div>
                </div>

                {/* PORTFOLIO */}
                <div className={`${mobileTab !== 'portfolio' ? 'hidden lg:block' : ''} overflow-hidden`}>
                  <div className="h-full rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-semibold">Portfolio</div>
                        <div className="text-xs text-white/50">
                          Equity {fmtMoney(totalEquity)} • PnL{' '}
                          <span className={unrealizedPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                            {unrealizedPnL >= 0 ? '+' : ''}
                            {fmtMoney(unrealizedPnL)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-white/50">Holdings</div>
                        <div className="text-sm text-white font-semibold">{(stockPositions || []).length}</div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                      {(stockPositions || []).length ? (
                        (stockPositions || []).map((p: any) => {
                          const sym = String(p?.symbol || '').toUpperCase();
                          const q = quotes[sym];
                          const cur = n(q?.price ?? p?.currentPrice ?? p?.price, 0);
                          const qty = n(p?.qty, 0);
                          const avg = n(p?.avgEntry ?? p?.avgPrice, 0);
                          const mv = n(p?.marketValue, cur * qty);
                          const upl = n(p?.unrealizedPnL, (cur - avg) * qty);
                          const uplPct = avg > 0 ? ((cur - avg) / avg) * 100 : 0;

                          return (
                            <div
                              key={p?.id || sym}
                              className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-white font-semibold">{sym}</div>
                                  <div className="text-xs text-white/50 truncate">{p?.name || ''}</div>
                                </div>
                                <div className="text-xs text-white/50 mt-0.5">
                                  {qty} shares • Avg {fmtMoney(avg)} • Now {fmtMoney(cur)}
                                </div>
                              </div>

                              <div className="text-right flex items-center gap-3">
                                <div>
                                  <div className="text-sm text-white font-semibold">{fmtMoney(mv)}</div>
                                  <div className={`text-xs ${upl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    {upl >= 0 ? '+' : ''}
                                    {fmtMoney(upl)} ({fmtPct(uplPct)})
                                  </div>
                                </div>

                                <button
                                  onClick={() => openSell(p)}
                                  className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-sm text-white/85"
                                >
                                  Sell
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-6 text-sm text-white/60">
                          No stock positions yet. Buy a stock to see it here.
                        </div>
                      )}
                    </div>

                    <div className="p-3 border-t border-white/10 text-xs text-white/50">
                      Tip: add favorites so your quotes list stays hot.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TOAST */}
        <AnimatePresence>
          {notification ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4"
            >
              <div
                className={`max-w-[92vw] rounded-2xl px-4 py-3 border shadow-lg backdrop-blur-md ${
                  notification.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-400/20'
                    : 'bg-rose-500/10 border-rose-400/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  {notification.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-rose-300" />
                  )}
                  <div className="text-sm text-white/90">{notification.message}</div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* SELL MODAL */}
        <AnimatePresence>
          {showSellModal && positionToSell ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setShowSellModal(false);
                  setPositionToSell(null);
                  setSellQty(0);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8 }}
                className="w-full max-w-md rounded-2xl bg-[#0b0f14]/95 border border-white/10 overflow-hidden"
              >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold">Sell {(positionToSell as any).symbol}</div>
                    <div className="text-xs text-white/50">
                      Bid {fmtMoney(bidPrice)} • You hold {n((positionToSell as any).qty, 0)} shares
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowSellModal(false);
                      setPositionToSell(null);
                      setSellQty(0);
                    }}
                    className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-white/70" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-white/60">Quantity</div>
                      <button
                        onClick={() => setSellQty(clampInt(n((positionToSell as any).qty, 0), 1, 1_000_000))}
                        className="text-xs text-white/70 hover:text-white"
                      >
                        Sell max
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSellQty((v) => Math.max(1, v - 1))}
                        className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
                      >
                        <Minus className="h-4 w-4 text-white/70" />
                      </button>

                      <input
                        value={sellQty}
                        onChange={(e) => setSellQty(clampInt(n(e.target.value, 1), 1, clampInt(n((positionToSell as any).qty, 1), 1, 1_000_000)))}
                        className="flex-1 h-10 rounded-xl bg-black/20 border border-white/10 px-3 outline-none text-white"
                        inputMode="numeric"
                      />

                      <button
                        onClick={() =>
                          setSellQty((v) =>
                            Math.min(clampInt(n((positionToSell as any).qty, 1), 1, 1_000_000), v + 1)
                          )
                        }
                        className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center"
                      >
                        <Plus className="h-4 w-4 text-white/70" />
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-white/60 flex items-center justify-between">
                      <span>Est. proceeds</span>
                      <span className="text-white/85 font-medium">{fmtMoney(sellQty * (bidPrice || 0))}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSell}
                    className="w-full h-11 rounded-xl font-semibold bg-white text-black hover:opacity-90 active:scale-[0.99] transition"
                  >
                    Confirm sell
                  </button>

                  <div className="text-xs text-white/50">
                    This will reduce (or close) your position and sync trade history.
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </KYCGate>
  );
}
