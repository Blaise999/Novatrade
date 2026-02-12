// app/dashboard/trade/fx/page.tsx
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
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
  Signal,
  X,
  Lock,
  Crown,
  Activity,
} from 'lucide-react';

import { useTradingAccountStore } from '@/lib/trading-store';
import { useAdminSessionStore } from '@/lib/admin-store';
import { useStore } from '@/lib/supabase/store-supabase';
import KYCGate from '@/components/KYCGate';
import { saveTradeToHistory, closeTradeInHistory } from '@/lib/services/trade-history';
import { useAdminMarketStore, isAdminControlledPair, getMarketData } from '@/lib/admin-markets';
import { useMembershipStore, TIER_CONFIG, canPerformAction } from '@/lib/membership-tiers';
import { marketAssets } from '@/lib/data';
import { MarginPosition } from '@/lib/trading-types';

/** Local FX type to avoid mismatch with MarketAsset requirements */
type FXAsset = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  type: 'forex';
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? // @ts-ignore
      crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const toFxAsset = (a: any): FXAsset => ({
  id: a?.id ?? a?.symbol ?? uid(),
  symbol: String(a?.symbol ?? 'EUR/USD'),
  name: String(a?.name ?? a?.symbol ?? 'FX Pair'),
  price: Number(a?.price ?? 1),
  change24h: Number(a?.change24h ?? 0),
  type: 'forex',
});

// Filter forex assets
const standardForexAssets: FXAsset[] = (marketAssets as any[])
  .filter((a) => a?.type === 'forex')
  .map(toFxAsset);

// ✅ Rare/exotic pairs (admin-controlled UI)
const rarePairs: FXAsset[] = [
  { id: 'usd-try', symbol: 'USD/TRY', name: 'US Dollar / Turkish Lira', price: 32.15, change24h: 0.7, type: 'forex' },
  { id: 'usd-zar', symbol: 'USD/ZAR', name: 'US Dollar / South African Rand', price: 19.05, change24h: -0.3, type: 'forex' },
  { id: 'usd-brl', symbol: 'USD/BRL', name: 'US Dollar / Brazilian Real', price: 4.95, change24h: 0.1, type: 'forex' },
  { id: 'usd-mxn', symbol: 'USD/MXN', name: 'US Dollar / Mexican Peso', price: 17.12, change24h: -0.2, type: 'forex' },
  { id: 'usd-pln', symbol: 'USD/PLN', name: 'US Dollar / Polish Zloty', price: 4.01, change24h: 0.2, type: 'forex' },
  { id: 'usd-isk', symbol: 'USD/ISK', name: 'US Dollar / Icelandic Krona', price: 138.2, change24h: -0.1, type: 'forex' },
];

// Leverage options for forex
const leverageOptions = [10, 20, 50, 100, 200, 500];

// Currency flag emojis (rare pairs only)
const currencyFlags: Record<string, string> = {
  USD: '🇺🇸',
  TRY: '🇹🇷',
  ZAR: '🇿🇦',
  BRL: '🇧🇷',
  MXN: '🇲🇽',
  PLN: '🇵🇱',
  ISK: '🇮🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  CHF: '🇨🇭',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  NZD: '🇳🇿',
};

// Chart timeframes
const timeframes = ['1m', '5m', '15m', '1h', '4h', '1D'] as const;
type Timeframe = (typeof timeframes)[number];

// Mobile tabs
type MobileTab = 'chart' | 'trade' | 'positions';

// ==============================
// FAST + TOLERANT MARKET PARSING
// ==============================
type ChartCandle = {
  id: string;
  pairId: string;
  timestamp: number; // ms since epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isSimulated?: boolean;
};

const toFiniteNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const toMs = (input: unknown): number => {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input > 0 && input < 1e12 ? Math.round(input * 1000) : Math.round(input);
  }
  if (input instanceof Date) {
    const ms = input.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return Date.now();
      return n > 0 && n < 1e12 ? Math.round(n * 1000) : Math.round(n);
    }
    const d = new Date(s);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }
  return Date.now();
};

const normalizePriceMap = (raw: unknown): Record<string, number> => {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of Object.keys(obj)) {
    const n = toFiniteNumber(obj[k]);
    if (n !== null) out[String(k)] = n;
  }
  return out;
};

const normalizeCandles = (raw: unknown, pairId: string): ChartCandle[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => {
      const open = toFiniteNumber(c?.open ?? c?.open_price);
      const high = toFiniteNumber(c?.high ?? c?.high_price);
      const low = toFiniteNumber(c?.low ?? c?.low_price);
      const close = toFiniteNumber(c?.close ?? c?.close_price);
      if (open === null || high === null || low === null || close === null) return null;

      return {
        id: String(c?.id ?? uid()),
        pairId: String(c?.pairId ?? c?.pair_symbol ?? c?.symbol ?? pairId),
        timestamp: toMs(c?.timestamp ?? c?.time ?? c?.t),
        open,
        high,
        low,
        close,
        volume: toFiniteNumber(c?.volume) ?? 0,
        isSimulated: !!c?.isSimulated,
      } satisfies ChartCandle;
    })
    .filter(Boolean) as ChartCandle[];
};

// ✅ Treat our rarePairs as admin-controlled
const RARE_PAIR_SYMBOLS = new Set(rarePairs.map((p) => p.symbol));
const isAdminPairSymbol = (sym: string) => RARE_PAIR_SYMBOLS.has(sym) || isAdminControlledPair(sym);

const TF_STEP_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1D': 24 * 60 * 60_000,
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function FXTradingPage() {
  const {
    marginAccount,
    marginPositions,
    openMarginPosition,
    closeMarginPosition,
    updateMarginPositionPrice,
  } = useTradingAccountStore();

  const { refreshUser, user } = useStore();

  // Debug: enable via ?debug=1
  const debugEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);
  const dbg = useCallback(
    (...args: any[]) => {
      if (!debugEnabled) return;
      // eslint-disable-next-line no-console
      console.log('[FX]', ...args);
    },
    [debugEnabled]
  );

  // Admin session store
  const adminSession = useAdminSessionStore() as any;
  const activeSignal = adminSession?.activeSignal ?? adminSession?.signal ?? null;

  // Membership store
  const membership = useMembershipStore() as any;
  const currentTier = (membership?.currentTier ?? membership?.tier ?? 'free') as keyof typeof TIER_CONFIG;
  const totalDeposited = Number(membership?.totalDeposited ?? membership?.totalDeposit ?? membership?.depositedTotal ?? 0);

  const tierConfig =
    ((TIER_CONFIG as any)[currentTier] as any) ?? {
      maxLeverage: 0,
      spreadDiscount: 0,
      bgColor: 'bg-white/5',
      borderColor: 'border-white/10',
      color: 'text-cream',
      icon: '⭐',
      name: String(currentTier),
    };
  const tierName = tierConfig.displayName ?? tierConfig.name ?? String(currentTier);

  // Admin market store (admin-controlled pairs)
  const adminMarket = useAdminMarketStore() as any;
  const adminPrices = (adminMarket?.currentPrices ?? {}) as Record<string, { bid: number; ask: number }>;
  const isPausedMap = (adminMarket?.isPaused ?? {}) as Record<string, boolean>;

  // ======================
  // STATE
  // ======================
  const [selectedAsset, setSelectedAsset] = useState<FXAsset>(() => {
    return standardForexAssets[0] ?? rarePairs[0];
  });

  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(['EUR/USD', 'GBP/USD', 'USD/JPY']);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>('15m');
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');

  // candles + cache
  const [chartCandles, setChartCandles] = useState<ChartCandle[]>([]);
  const candleCacheRef = useRef<Map<string, ChartCandle[]>>(new Map());

  // Live prices (for header + list)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [bidPrice, setBidPrice] = useState(selectedAsset.price);
  const [askPrice, setAskPrice] = useState(selectedAsset.price * 1.0001);

  // Trading state
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState(0.1);
  const [leverage, setLeverage] = useState(100);
  const [stopLoss, setStopLoss] = useState<number | null>(null);
  const [takeProfit, setTakeProfit] = useState<number | null>(null);

  // UI state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [positionToClose, setPositionToClose] = useState<MarginPosition | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');

  // Refs (avoid stale closures)
  const selectedSymbolRef = useRef<string>(selectedAsset.symbol);
  const bidRef = useRef<number>(bidPrice);
  const askRef = useRef<number>(askPrice);
  const positionsRef = useRef<MarginPosition[]>(marginPositions);
  const adminPricesRef = useRef(adminPrices);
  const pausedRef = useRef<boolean>(!!isPausedMap[selectedAsset.symbol]);
  const livePricesRef = useRef<Record<string, number>>({});
  const autoClosingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    selectedSymbolRef.current = selectedAsset.symbol;
  }, [selectedAsset.symbol]);
  useEffect(() => {
    bidRef.current = bidPrice;
  }, [bidPrice]);
  useEffect(() => {
    askRef.current = askPrice;
  }, [askPrice]);
  useEffect(() => {
    positionsRef.current = marginPositions;
  }, [marginPositions]);
  useEffect(() => {
    adminPricesRef.current = adminPrices;
  }, [adminPrices]);
  useEffect(() => {
    pausedRef.current = !!isPausedMap[selectedAsset.symbol];
  }, [isPausedMap, selectedAsset.symbol]);
  useEffect(() => {
    livePricesRef.current = livePrices;
  }, [livePrices]);

  // User balance (account currency)
  const userBalance = Number((user as any)?.balance ?? 0) + Number((user as any)?.bonusBalance ?? 0);

  // Tier gating: tier-based OR if admin has set a balance
  const canTrade = canPerformAction(currentTier as any, 'trade' as any) || userBalance > 0;

  const isAdminPair = useMemo(() => isAdminPairSymbol(selectedAsset.symbol), [selectedAsset.symbol]);
  const isPaused = !!isPausedMap[selectedAsset.symbol];

  // Filter positions for this market
  const forexPositions = useMemo(() => {
    return marginPositions.filter((p) => {
      const t = (p as any).assetType ?? (p as any).marketType ?? (p as any).type ?? (p as any).market;
      return t === 'forex';
    });
  }, [marginPositions]);

  // ======================
  // FORMATTERS (NO "$")
  // ======================
  const formatPrice = useCallback((price: number) => {
    if (!Number.isFinite(price)) return '—';
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(5);
  }, []);

  const formatMoney = useCallback((n: number, currency = 'USD') => {
    const v = Number(n);
    if (!Number.isFinite(v)) return `— ${currency}`;
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${currency}`;
  }, []);

  // pip sizing (simple)
  const pipSize = useMemo(() => (selectedAsset.symbol.includes('JPY') ? 0.01 : 0.0001), [selectedAsset.symbol]);

  // ======================
  // RESIZE (FAST)
  // ======================
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 300, height: 250 });

  useEffect(() => {
    const update = () => {
      if (!chartRef.current) return;
      const rect = chartRef.current.getBoundingClientRect();
      const width = Math.max(rect.width || 300, 280);
      const height = Math.max(rect.height || 250, 200);
      setChartDimensions({ width, height });
    };

    update();
    const t1 = setTimeout(update, 80);
    const t2 = setTimeout(update, 240);

    let ro: ResizeObserver | null = null;
    if (chartRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setChartDimensions({
            width: Math.max(width || 300, 280),
            height: Math.max(height || 250, 200),
          });
        }
      });
      ro.observe(chartRef.current);
    }

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (ro) ro.disconnect();
    };
  }, [mobileTab]);

  // ======================
  // CHART DATA (SNAPPY)
  // ======================
  useEffect(() => {
    const key = `${selectedAsset.symbol}|${chartTimeframe}`;

    const cached = candleCacheRef.current.get(key);
    if (cached && cached.length) setChartCandles(cached);
    else setChartCandles([]);

    const ac = new AbortController();

    (async () => {
      try {
        const result = await getMarketData(selectedAsset.symbol);
        if (ac.signal.aborted) return;

        const raw = (result as any)?.candles ?? (result as any)?.data?.candles ?? result;
        const candles = normalizeCandles(raw, selectedAsset.symbol).slice(-50);

        candleCacheRef.current.set(key, candles);
        setChartCandles(candles);
        dbg('candles loaded', { symbol: selectedAsset.symbol, tf: chartTimeframe, n: candles.length });
      } catch (e) {
        dbg('candles load failed', e);
      }
    })();

    return () => ac.abort();
  }, [selectedAsset.symbol, chartTimeframe, dbg]);

  // ======================
  // LIVE PRICES
  // ======================
  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    const allSymbols = [...rarePairs.map((a) => a.symbol), ...standardForexAssets.map((a) => a.symbol)];
    const uniqueAll = Array.from(new Set(allSymbols));

    const tickSelected = async () => {
      const symbol = selectedSymbolRef.current;

      // Admin controlled pair: prefer adminPrices (zero network)
      if (isAdminPairSymbol(symbol)) {
        if (pausedRef.current) return;
        const p = adminPricesRef.current?.[symbol];
        if (p?.bid && p?.ask) {
          const bid = Number(p.bid);
          const ask = Number(p.ask);
          if (!Number.isFinite(bid) || !Number.isFinite(ask)) return;
          requestAnimationFrame(() => {
            if (!alive) return;
            setBidPrice(bid);
            setAskPrice(ask);
          });
          return;
        }
      }

      // Try real prices endpoint
      try {
        const res = await fetch(`/api/market/prices?symbols=${encodeURIComponent(symbol)}`, {
          cache: 'no-store',
          signal: ac.signal,
        });
        if (!res.ok) throw new Error('bad_status');
        const json = await res.json();

        const map = normalizePriceMap(json?.prices ?? json?.data?.prices ?? json);
        const mid = map?.[symbol];

        if (typeof mid === 'number' && Number.isFinite(mid)) {
          const spread = Math.max(mid * 0.00006, 0.00001);
          const bid = mid - spread / 2;
          const ask = mid + spread / 2;

          requestAnimationFrame(() => {
            if (!alive) return;
            setLivePrices((prev) => {
              const next = prev[symbol] === mid ? prev : { ...prev, [symbol]: mid };
              livePricesRef.current = next;
              return next;
            });
            setBidPrice(bid);
            setAskPrice(ask);
          });
          return;
        }
      } catch (e) {
        dbg('tickSelected fetch failed', { symbol, e });
      }

      // Fallback simulation
      requestAnimationFrame(() => {
        if (!alive) return;
        const base =
          livePricesRef.current?.[symbol] ??
          (standardForexAssets.find((a) => a.symbol === symbol)?.price ??
            rarePairs.find((a) => a.symbol === symbol)?.price ??
            1);

        const volatility = Math.max(base * 0.00004, 0.00001);
        const change = (Math.random() - 0.5) * volatility;
        const mid = Math.max(0.00001, base + change);
        const spread = Math.max(mid * 0.00006, 0.00001);

        setLivePrices((prev) => {
          const next = { ...prev, [symbol]: mid };
          livePricesRef.current = next;
          return next;
        });
        setBidPrice(mid - spread / 2);
        setAskPrice(mid + spread / 2);
      });
    };

    const tickAll = async () => {
      try {
        const q = uniqueAll.join(',');
        const res = await fetch(`/api/market/prices?symbols=${encodeURIComponent(q)}`, {
          cache: 'no-store',
          signal: ac.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        const map = normalizePriceMap(json?.prices ?? json?.data?.prices ?? json);

        if (!alive || !Object.keys(map).length) return;

        requestAnimationFrame(() => {
          if (!alive) return;
          setLivePrices((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const k of Object.keys(map)) {
              const v = map[k];
              if (typeof v === 'number' && Number.isFinite(v) && next[k] !== v) {
                next[k] = v;
                changed = true;
              }
            }
            if (!changed) return prev;
            livePricesRef.current = next;
            return next;
          });
        });
      } catch (e) {
        dbg('tickAll failed', e);
      }
    };

    tickSelected();
    tickAll();

    const idSelected = setInterval(tickSelected, 750);
    const idAll = setInterval(tickAll, 7000);

    return () => {
      alive = false;
      ac.abort();
      clearInterval(idSelected);
      clearInterval(idAll);
    };
  }, [dbg]);

  // ======================
  // FX PIPS + APPROX PNL (DISPLAY)
  // ======================
  const calcPips = useCallback((symbol: string, entry: number, current: number, side: 'long' | 'short') => {
    const ps = symbol.includes('JPY') ? 0.01 : 0.0001;
    const raw = (current - entry) / ps;
    return side === 'long' ? raw : -raw;
  }, []);

  const approxPnlInUsd = useCallback(
    (symbol: string, pips: number, lots: number, currentPx: number) => {
      // For most USD-quote majors: 1 lot ~ 10 USD per pip
      if (!symbol.includes('JPY')) return pips * lots * 10;

      // JPY quote pairs: 1 lot pip value ~ 1000 JPY; convert JPY->USD using USD/JPY if available
      const usdJpy = livePricesRef.current['USD/JPY'] ?? (symbol === 'USD/JPY' ? currentPx : null);
      if (typeof usdJpy === 'number' && usdJpy > 0) {
        const pipValueUsdPerLot = 1000 / usdJpy; // USD per pip per 1 lot
        return pips * lots * pipValueUsdPerLot;
      }

      // If we can't convert, return NaN so UI can hide USD estimate
      return NaN;
    },
    []
  );

  // ======================
  // POSITION MARK-TO-MARKET + SL/TP AUTO-CLOSE
  // ======================
  const handleAutoClose = useCallback(
    async (trigger: { id: string; symbol: string; side: string; reason: 'sl' | 'tp'; triggerPrice: number; pnl: number }) => {
      const id = trigger.id;
      if (autoClosingIdsRef.current.has(id)) return;
      autoClosingIdsRef.current.add(id);

      try {
        const stateNow = useTradingAccountStore.getState();
        const pos = stateNow.marginPositions.find((p: any) => String(p.id) === String(id));
        if (!pos) return;

        const side = (pos as any).side as 'long' | 'short';
        const px = Number(trigger.triggerPrice);
        if (!Number.isFinite(px)) return;

        const qty = Number((pos as any).qty ?? 0);
        const fee = qty * px * 0.00007 * (1 - Number(tierConfig.spreadDiscount ?? 0) / 100);

        const result = (closeMarginPosition as any)((pos as any).id, px, fee);
        if (!(result as any)?.success) {
          dbg('auto-close failed', { id, result });
          return;
        }

        const pnl = Number((result as any).realizedPnL ?? trigger.pnl ?? 0);

        await refreshUser?.();

        // ✅ FIX: closeTradeInHistory requires tradeId + no extra props
        const userId = (user as any)?.id as string | undefined;
        if (userId) {
          const tradeId = String((pos as any).id);
          try {
            await closeTradeInHistory({
              tradeId,
              userId,
              exitPrice: px,
              pnl,
              status: 'closed',
              closedAt: new Date().toISOString(),
            });
          } catch (e) {
            // If history row doesn't exist (e.g., missed open insert), repair by creating then closing.
            try {
              const sym = String((pos as any).symbol ?? trigger.symbol);
              const entry = Number((pos as any).avgEntry ?? (pos as any).entryPrice ?? 0);
              const lev = Number((pos as any).leverage ?? 0);
              const openedAt = String((pos as any).openedAt ?? (pos as any).createdAt ?? new Date().toISOString());
              const lots = qty ? qty / 100000 : null;

              await saveTradeToHistory({
                id: tradeId,
                userId,
                accountId: (marginAccount as any)?.id ?? null,
                marketType: 'fx',
                assetType: 'forex',
                pair: sym,
                direction: side === 'long' ? 'buy' : 'sell',
                quantity: qty || null,
                lotSize: typeof lots === 'number' && Number.isFinite(lots) ? lots : null,
                leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
                entryPrice: Number.isFinite(entry) ? entry : px,
                openedAt,
                isSimulated: true,
                notes: JSON.stringify({
                  repaired: true,
                  reason: 'auto-close',
                  trigger: trigger.reason,
                }),
              });

              await closeTradeInHistory({
                tradeId,
                userId,
                exitPrice: px,
                pnl,
                status: 'closed',
                closedAt: new Date().toISOString(),
              });
            } catch (e2) {
              dbg('history close failed (auto)', e2);
            }
          }
        }

        setNotification({
          type: 'success',
          message: `${trigger.reason === 'sl' ? 'Stop Loss' : 'Take Profit'} hit • ${(pos as any).symbol} • ${
            pnl >= 0 ? '+' : ''
          }${formatMoney(pnl)}`,
        });
        setTimeout(() => setNotification(null), 3500);
      } finally {
        // allow future triggers if position remains for any reason
        setTimeout(() => autoClosingIdsRef.current.delete(id), 2000);
      }
    },
    [closeMarginPosition, tierConfig.spreadDiscount, refreshUser, user, dbg, formatMoney, marginAccount]
  );

  useEffect(() => {
    let alive = true;

    const id = setInterval(() => {
      if (!alive) return;

      const symbolSelected = selectedSymbolRef.current;
      const currentBid = bidRef.current;
      const currentAsk = askRef.current;

      const all = positionsRef.current || [];
      const triggersToHandle: any[] = [];

      for (const pos of all as any[]) {
        const t = pos.assetType ?? pos.marketType ?? pos.type ?? pos.market;
        if (t !== 'forex') continue;

        const sym = String(pos.symbol);
        const side = String(pos.side);

        // Use best available mid for other pairs (simple)
        const midOther = livePricesRef.current?.[sym];
        const basePx =
          sym === symbolSelected
            ? side === 'long'
              ? currentBid
              : currentAsk
            : typeof midOther === 'number'
            ? midOther
            : Number(pos.currentPrice ?? 0);

        const px = Number(basePx);
        if (!Number.isFinite(px)) continue;

        // ✅ FIX: store expects (symbol, price), not (id, price)
        const hit = updateMarginPositionPrice(sym, px);
        if (Array.isArray(hit) && hit.length) triggersToHandle.push(...hit);
      }

      if (triggersToHandle.length) {
        // fire & forget auto-close
        for (const tr of triggersToHandle) handleAutoClose(tr);
      }
    }, 850);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [updateMarginPositionPrice, handleAutoClose]);

  // ======================
  // HELPERS
  // ======================
  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites((prev) => (prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]));
  }, []);

  const findJustOpenedPositionId = useCallback(
    (symbol: string, qty: number, entry: number) => {
      const st = useTradingAccountStore.getState();
      const matches = (st.marginPositions as any[]).filter((p) => {
        const t = p.assetType ?? p.marketType ?? p.type ?? p.market;
        if (t !== 'forex') return false;
        if (String(p.symbol) !== String(symbol)) return false;
        const q = Number(p.qty ?? 0);
        const a = Number(p.avgEntry ?? 0);
        return Math.abs(q - qty) < 1e-6 && Math.abs(a - entry) <= Math.max(entry * 0.0002, 0.00001);
      });
      if (!matches.length) return undefined;
      matches.sort((a, b) => {
        const ta = new Date(a.openedAt ?? a.createdAt ?? 0).getTime();
        const tb = new Date(b.openedAt ?? b.createdAt ?? 0).getTime();
        return tb - ta;
      });
      return matches[0]?.id as string | undefined;
    },
    []
  );

  const handleTrade = useCallback(async () => {
    if (!canTrade) {
      setNotification({ type: 'error', message: 'Upgrade tier (or deposit) to trade' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const maxLev = Number(tierConfig.maxLeverage ?? 0);
    if (maxLev > 0 && leverage > maxLev) {
      setNotification({ type: 'error', message: `Max leverage for ${tierName} is 1:${maxLev}` });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!Number.isFinite(lotSize) || lotSize <= 0) {
      setNotification({ type: 'error', message: 'Invalid lot size' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const entryPrice = tradeDirection === 'buy' ? askPrice : bidPrice;

    // FX qty in units: 1.0 lot = 100,000 units
    const qty = lotSize * 100000;

    // Notional (quote currency)
    const notional = qty * entryPrice;

    // Fee is a simple model (you can refine later)
    const fee = notional * 0.00007 * (1 - Number(tierConfig.spreadDiscount ?? 0) / 100);

    const result = (openMarginPosition as any)(
      selectedAsset.symbol,
      selectedAsset.name,
      'forex',
      tradeDirection === 'buy' ? 'long' : 'short',
      qty,
      entryPrice,
      leverage,
      fee,
      stopLoss || undefined,
      takeProfit || undefined
    );

    if ((result as any)?.success) {
      await refreshUser?.();

      // sessionId for history linking (best case: store returns positionId; fallback: infer)
      const positionId =
        (result as any)?.positionId ??
        (result as any)?.id ??
        findJustOpenedPositionId(selectedAsset.symbol, qty, entryPrice);

      // ✅ FIX: saveTradeToHistory input shape (no amount/fee/tradeType/status/sessionId/symbol)
      const userId = (user as any)?.id as string | undefined;
      if (userId && positionId) {
        try {
          await saveTradeToHistory({
            id: String(positionId), // ✅ use positionId as history id so close can use tradeId = positionId
            userId,
            accountId: (marginAccount as any)?.id ?? null,

            marketType: 'fx',
            assetType: 'forex',
            pair: selectedAsset.symbol,
            direction: tradeDirection,

            quantity: qty,
            lotSize,
            leverage,

            entryPrice,
            stopLoss: stopLoss ?? null,
            takeProfit: takeProfit ?? null,

            openedAt: new Date().toISOString(),
            isSimulated: true,

            // stash extra values safely
            notes: JSON.stringify({
              positionId,
              tradeType: 'margin',
              notional,
              fee,
              tier: currentTier,
              side: tradeDirection === 'buy' ? 'long' : 'short',
            }),
          });
        } catch (e) {
          dbg('history insert failed', e);
        }
      } else {
        dbg('history insert skipped (missing userId or positionId)', { userId, positionId });
      }

      setNotification({
        type: 'success',
        message: `${tradeDirection.toUpperCase()} ${lotSize.toFixed(2)} lots • ${selectedAsset.symbol} @ ${formatPrice(entryPrice)}`,
      });
    } else {
      setNotification({ type: 'error', message: (result as any)?.error || 'Trade failed' });
    }

    setTimeout(() => setNotification(null), 3000);
  }, [
    canTrade,
    leverage,
    tierConfig.maxLeverage,
    tierConfig.spreadDiscount,
    tierName,
    tradeDirection,
    askPrice,
    bidPrice,
    lotSize,
    selectedAsset.symbol,
    selectedAsset.name,
    openMarginPosition,
    stopLoss,
    takeProfit,
    refreshUser,
    user,
    formatPrice,
    findJustOpenedPositionId,
    dbg,
    marginAccount,
    currentTier,
  ]);

  const handleClosePosition = useCallback(
    async (position: MarginPosition) => {
      const side = (position as any).side as 'long' | 'short';
      const exitPrice = side === 'long' ? bidPrice : askPrice;

      const qty = Number((position as any).qty ?? 0);
      const fee = qty * exitPrice * 0.00007 * (1 - Number(tierConfig.spreadDiscount ?? 0) / 100);

      const result = (closeMarginPosition as any)((position as any).id, exitPrice, fee);

      if ((result as any)?.success) {
        const pnl = Number((result as any).realizedPnL ?? 0);
        await refreshUser?.();

        // ✅ FIX: closeTradeInHistory requires tradeId + no extra props
        const userId = (user as any)?.id as string | undefined;
        if (userId) {
          const tradeId = String((position as any).id);
          try {
            await closeTradeInHistory({
              tradeId,
              userId,
              exitPrice,
              pnl,
              status: 'closed',
              closedAt: new Date().toISOString(),
            });
          } catch (e) {
            // repair by creating then closing
            try {
              const sym = String((position as any).symbol);
              const entry = Number((position as any).avgEntry ?? (position as any).entryPrice ?? 0);
              const lev = Number((position as any).leverage ?? 0);
              const openedAt = String((position as any).openedAt ?? (position as any).createdAt ?? new Date().toISOString());
              const lots = qty ? qty / 100000 : null;

              await saveTradeToHistory({
                id: tradeId,
                userId,
                accountId: (marginAccount as any)?.id ?? null,
                marketType: 'fx',
                assetType: 'forex',
                pair: sym,
                direction: side === 'long' ? 'buy' : 'sell',
                quantity: qty || null,
                lotSize: typeof lots === 'number' && Number.isFinite(lots) ? lots : null,
                leverage: Number.isFinite(lev) && lev > 0 ? lev : null,
                entryPrice: Number.isFinite(entry) ? entry : exitPrice,
                openedAt,
                isSimulated: true,
                notes: JSON.stringify({
                  repaired: true,
                  reason: 'manual-close',
                }),
              });

              await closeTradeInHistory({
                tradeId,
                userId,
                exitPrice,
                pnl,
                status: 'closed',
                closedAt: new Date().toISOString(),
              });
            } catch (e2) {
              dbg('history close failed', e2);
            }
          }
        }

        setNotification({
          type: 'success',
          message: `Closed ${(position as any).symbol} • ${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}`,
        });
      } else {
        setNotification({ type: 'error', message: (result as any)?.error || 'Close failed' });
      }

      setShowCloseModal(false);
      setPositionToClose(null);
      setTimeout(() => setNotification(null), 3000);
    },
    [askPrice, bidPrice, tierConfig.spreadDiscount, closeMarginPosition, refreshUser, user, dbg, formatMoney, marginAccount]
  );

  const accountBalance = Number((marginAccount as any)?.balance ?? 0) || userBalance;

  // Used margin / equity from store values
  const usedMargin = useMemo(
    () => forexPositions.reduce((sum, pos) => sum + Number((pos as any).requiredMargin ?? 0), 0),
    [forexPositions]
  );
  const unrealizedPnL = useMemo(
    () => forexPositions.reduce((sum, pos) => sum + Number((pos as any).unrealizedPnL ?? 0), 0),
    [forexPositions]
  );

  const equity = accountBalance + unrealizedPnL;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

  const isSignalActive = activeSignal?.asset === selectedAsset.symbol && !!activeSignal?.isActive;

  // ======================
  // POSITION / TRADE METRICS (LOTS-BASED)
  // ======================
  const entryPx = tradeDirection === 'buy' ? askPrice : bidPrice;
  const units = lotSize * 100000;
  const positionNotional = units * entryPx;
  const requiredMargin = leverage > 0 ? positionNotional / leverage : positionNotional;

  const spreadPips = useMemo(() => (askPrice - bidPrice) / pipSize, [askPrice, bidPrice, pipSize]);

  // ======================
  // ASSET LIST FILTERS
  // ======================
  const filteredRare = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rarePairs;
    return rarePairs.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredFavorites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return standardForexAssets
      .filter((a) => favorites.includes(a.symbol))
      .filter((a) => !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [favorites, searchQuery]);

  const filteredAll = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return standardForexAssets
      .filter((a) => !favorites.includes(a.symbol))
      .filter((a) => !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [favorites, searchQuery]);

  // ======================
  // CHART GEOMETRY
  // ======================
  const chartData = useMemo(() => {
    const { width, height } = chartDimensions;
    const isMobile = width < 400;

    const padding = {
      top: isMobile ? 15 : 20,
      right: isMobile ? 50 : 60,
      bottom: isMobile ? 25 : 30,
      left: isMobile ? 5 : 10,
    };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const stepMs = TF_STEP_MS[chartTimeframe] ?? 60_000;
    const count = chartCandles.length > 0 ? chartCandles.length : isMobile ? 30 : 50;

    const baseMid = (livePrices[selectedAsset.symbol] ?? selectedAsset.price) || 1;

    const candlesRaw: ChartCandle[] =
      chartCandles.length > 0
        ? chartCandles
        : Array.from({ length: count }, (_, i) => {
            const swing = Math.sin(i * 0.2) * 0.02;
            const open = baseMid * (1 + swing);
            const close = baseMid * (1 + Math.sin((i + 1) * 0.2) * 0.02);
            const high = Math.max(open, close) * (1 + Math.random() * 0.002);
            const low = Math.min(open, close) * (1 - Math.random() * 0.002);

            return {
              id: `placeholder_${i}`,
              pairId: selectedAsset.symbol,
              timestamp: Date.now() - (count - i) * stepMs,
              open,
              high,
              low,
              close,
              volume: Math.random() * 1_000_000,
              isSimulated: true,
            };
          });

    if (!candlesRaw.length) {
      return { candles: [], minPrice: 0, maxPrice: 0, priceRange: 1, padding, chartHeight };
    }

    const prices = candlesRaw.flatMap((c) => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const candleWidth = Math.max((chartWidth / candlesRaw.length) * 0.65, isMobile ? 3 : 2);
    const gap = (chartWidth / candlesRaw.length) * 0.35;

    return {
      candles: candlesRaw.map((candle, i) => {
        const x = padding.left + i * (candleWidth + gap) + candleWidth / 2;
        const openY = padding.top + ((maxPrice - candle.open) / priceRange) * chartHeight;
        const closeY = padding.top + ((maxPrice - candle.close) / priceRange) * chartHeight;
        const highY = padding.top + ((maxPrice - candle.high) / priceRange) * chartHeight;
        const lowY = padding.top + ((maxPrice - candle.low) / priceRange) * chartHeight;
        const isGreen = candle.close >= candle.open;
        return { x, openY, closeY, highY, lowY, width: candleWidth, isGreen, candle };
      }),
      minPrice,
      maxPrice,
      priceRange,
      padding,
      chartHeight,
    };
  }, [chartCandles, chartDimensions, selectedAsset.symbol, selectedAsset.price, livePrices, chartTimeframe]);

  return (
    <KYCGate action="trade forex">
      <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] flex flex-col bg-void overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 border-b border-white/10 bg-obsidian">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Asset Selector */}
            <button
              onClick={() => setShowAssetSelector(true)}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors min-w-0"
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-lg sm:text-xl">
                  {currencyFlags[selectedAsset.symbol.split('/')[0]] || '💱'}
                </span>
                <div className="text-left">
                  <p className="text-sm sm:text-base font-semibold text-cream truncate">{selectedAsset.symbol}</p>
                  <p className="text-xs text-cream/50 hidden sm:block">{selectedAsset.name}</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-cream/50 flex-shrink-0" />
            </button>

            {/* Price Display */}
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="text-center">
                <p className="text-xs text-cream/50">Bid</p>
                <p className="text-sm sm:text-lg font-mono font-semibold text-loss">{formatPrice(bidPrice)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-cream/50">Ask</p>
                <p className="text-sm sm:text-lg font-mono font-semibold text-profit">{formatPrice(askPrice)}</p>
              </div>
              <div className="text-center hidden sm:block">
                <p className="text-xs text-cream/50">Spread</p>
                <p className="text-sm font-mono text-cream">{spreadPips.toFixed(1)} pips</p>
              </div>
            </div>

            {/* Badges */}
            <div className="hidden sm:flex items-center gap-2">
              {isAdminPair && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-xs text-cream/70 font-medium">Admin Controlled</span>
                </div>
              )}

              {isSignalActive && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/20 border border-gold/30 rounded-lg animate-pulse">
                  <Signal className="w-4 h-4 text-gold" />
                  <span className="text-xs text-gold font-medium">Signal Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="lg:hidden flex-shrink-0 flex border-b border-white/10 bg-obsidian">
          {(['chart', 'trade', 'positions'] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mobileTab === tab ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-cream/50'
              }`}
            >
              {tab === 'chart' && 'Chart'}
              {tab === 'trade' && 'Trade'}
              {tab === 'positions' && `Positions (${forexPositions.length})`}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Chart Section */}
          <div className={`${mobileTab === 'chart' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-h-0 h-full`}>
            {/* Chart Controls */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10 bg-charcoal/50">
              <div className="flex items-center gap-1 overflow-x-auto">
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setChartTimeframe(tf)}
                    className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      chartTimeframe === tf ? 'bg-gold text-void' : 'text-cream/50 hover:text-cream hover:bg-white/5'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChartType('candle')}
                  className={`p-1.5 rounded-lg ${chartType === 'candle' ? 'bg-white/10 text-cream' : 'text-cream/40'}`}
                >
                  <CandlestickChart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`p-1.5 rounded-lg ${chartType === 'line' ? 'bg-white/10 text-cream' : 'text-cream/40'}`}
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div
              ref={chartRef}
              className="flex-1 relative bg-charcoal/30 w-full overflow-hidden"
              style={{ minHeight: '250px', height: 'calc(100% - 48px)' }}
            >
              {isAdminPair && (
                <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-white/5 border border-white/10 rounded-lg lg:hidden">
                  <span className="text-xs text-cream/70 font-medium">Admin Controlled</span>
                </div>
              )}

              {isPaused && isAdminPair && (
                <div className="absolute inset-0 bg-void/50 flex items-center justify-center z-20">
                  <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <span className="text-yellow-500 font-medium">⏸️ Market Paused by Admin</span>
                  </div>
                </div>
              )}

              <svg
                className="w-full h-full block"
                viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ display: 'block' }}
              >
                <defs>
                  <linearGradient id="chartGradientFx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(0, 217, 165)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(0, 217, 165)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[...Array(10)].map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1="0"
                    y1={i * (chartDimensions.height / 10)}
                    x2={chartDimensions.width}
                    y2={i * (chartDimensions.height / 10)}
                    stroke="rgba(255,255,255,0.05)"
                  />
                ))}
                {[...Array(20)].map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={i * (chartDimensions.width / 20)}
                    y1="0"
                    x2={i * (chartDimensions.width / 20)}
                    y2={chartDimensions.height}
                    stroke="rgba(255,255,255,0.05)"
                  />
                ))}

                {chartType === 'candle' &&
                  chartData.candles.map((c, i) => (
                    <g key={i}>
                      <line
                        x1={c.x}
                        y1={c.highY}
                        x2={c.x}
                        y2={c.lowY}
                        stroke={c.isGreen ? '#00d9a5' : '#ef4444'}
                        strokeWidth="1"
                      />
                      <rect
                        x={c.x - c.width / 2}
                        y={Math.min(c.openY, c.closeY)}
                        width={c.width}
                        height={Math.abs(c.closeY - c.openY) || 1}
                        fill={c.isGreen ? '#00d9a5' : '#ef4444'}
                        rx="1"
                      />
                    </g>
                  ))}

                {chartType === 'line' && chartData.candles.length > 0 && (
                  <>
                    <path
                      d={`M ${chartData.candles[0]?.x || 0} ${chartData.candles[0]?.closeY || 0} ${chartData.candles
                        .slice(1)
                        .map((c) => `L ${c.x} ${c.closeY}`)
                        .join(' ')}`}
                      fill="none"
                      stroke="#00d9a5"
                      strokeWidth="2"
                    />
                    <path
                      d={`M ${chartData.candles[0]?.x || 0} ${chartData.candles[0]?.closeY || 0} ${chartData.candles
                        .slice(1)
                        .map((c) => `L ${c.x} ${c.closeY}`)
                        .join(' ')} L ${chartData.candles[chartData.candles.length - 1]?.x || 0} ${chartDimensions.height} L ${
                        chartData.candles[0]?.x || 0
                      } ${chartDimensions.height} Z`}
                      fill="url(#chartGradientFx)"
                    />
                  </>
                )}

                <line
                  x1="0"
                  y1={chartDimensions.height / 2}
                  x2={chartDimensions.width}
                  y2={chartDimensions.height / 2}
                  stroke="#d4af37"
                  strokeDasharray="4"
                />
                <rect x={chartDimensions.width - 70} y={chartDimensions.height / 2 - 10} width="65" height="20" fill="#d4af37" rx="3" />
                <text x={chartDimensions.width - 37} y={chartDimensions.height / 2 + 4} textAnchor="middle" fill="#0a0a0f" fontSize="11" fontFamily="monospace">
                  {formatPrice(askPrice)}
                </text>

                {chartData.maxPrice > 0 && (
                  <>
                    <text x={chartDimensions.width - 5} y={25} textAnchor="end" fill="#666" fontSize="10" fontFamily="monospace">
                      {formatPrice(chartData.maxPrice)}
                    </text>
                    <text x={chartDimensions.width - 5} y={chartDimensions.height - 10} textAnchor="end" fill="#666" fontSize="10" fontFamily="monospace">
                      {formatPrice(chartData.minPrice)}
                    </text>
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Trading Panel */}
          <div className={`${mobileTab === 'trade' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-80 xl:w-96 border-l border-white/10 bg-obsidian overflow-y-auto`}>
            {!canTrade && (
              <div className="p-4 m-3 bg-gold/10 border border-gold/30 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="w-5 h-5 text-gold" />
                  <span className="font-semibold text-cream">Trading Locked</span>
                </div>
                <p className="text-sm text-cream/70 mb-3">
                  Deposit to unlock trading. Current deposit: {totalDeposited.toLocaleString()} USD
                </p>
                <Link
                  href="/dashboard/wallet"
                  className="flex items-center justify-center gap-2 w-full py-2 bg-gold text-void font-semibold rounded-lg hover:bg-gold/90 transition-colors"
                >
                  <Crown className="w-4 h-4" />
                  Make a Deposit
                </Link>
              </div>
            )}

            <div className="px-3 py-2 border-b border-white/10">
              <div className={`flex items-center gap-2 px-3 py-1.5 ${tierConfig.bgColor} ${tierConfig.borderColor} border rounded-lg`}>
                <span className="text-lg">{tierConfig.icon}</span>
                <div>
                  <span className={`text-sm font-medium ${tierConfig.color}`}>{tierName} Tier</span>
                  <p className="text-xs text-cream/50">Max leverage: 1:{tierConfig.maxLeverage || '—'}</p>
                </div>
              </div>
            </div>

            <div className="p-3 border-b border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">Balance</p>
                  <p className="text-sm font-semibold text-cream">{formatMoney(accountBalance)}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">Equity</p>
                  <p className={`text-sm font-semibold ${equity >= accountBalance ? 'text-profit' : 'text-loss'}`}>
                    {formatMoney(equity)}
                  </p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">Free Margin</p>
                  <p className="text-sm font-semibold text-cream">{formatMoney(freeMargin)}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">Margin Level</p>
                  <p className={`text-sm font-semibold ${marginLevel > 100 ? 'text-profit' : 'text-loss'}`}>
                    {usedMargin > 0 ? `${marginLevel.toFixed(0)}%` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 border-b border-white/10">
              <div className="flex gap-2">
                <button
                  onClick={() => setTradeDirection('buy')}
                  disabled={!canTrade}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    tradeDirection === 'buy' ? 'bg-profit text-void' : 'bg-white/5 text-profit hover:bg-profit/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  BUY
                </button>
                <button
                  onClick={() => setTradeDirection('sell')}
                  disabled={!canTrade}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    tradeDirection === 'sell' ? 'bg-loss text-white' : 'bg-white/5 text-loss hover:bg-loss/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <TrendingDown className="w-4 h-4 inline mr-2" />
                  SELL
                </button>
              </div>
            </div>

            {/* Lot Size Input */}
            <div className="p-3 border-b border-white/10 space-y-3">
              <div>
                <label className="text-xs text-cream/50 mb-1 block">Lot Size</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={lotSize}
                    onChange={(e) => setLotSize(Number(e.target.value) || 0.01)}
                    disabled={!canTrade}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-cream text-sm focus:border-gold/50 focus:outline-none disabled:opacity-50"
                    placeholder="0.10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cream/30">lots</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {[0.01, 0.05, 0.1, 0.5, 1.0].map((v) => (
                    <button
                      key={v}
                      onClick={() => setLotSize(v)}
                      disabled={!canTrade}
                      className={`flex-1 text-xs py-1 rounded ${lotSize === v ? 'bg-gold/20 text-gold' : 'bg-white/5 text-cream/40 hover:bg-white/10'} disabled:opacity-50`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-cream/30 mt-1">
                  {(lotSize * 100000).toLocaleString()} units | Margin: {formatMoney(requiredMargin)}
                </p>
              </div>

              {/* Leverage Selector */}
              <div>
                <label className="text-xs text-cream/50 mb-1 block">Leverage</label>
                <div className="flex gap-1 flex-wrap">
                  {leverageOptions.filter((lv) => {
                    const maxLev = Number(tierConfig.maxLeverage ?? 0);
                    return maxLev <= 0 || lv <= maxLev;
                  }).map((lv) => (
                    <button
                      key={lv}
                      onClick={() => setLeverage(lv)}
                      disabled={!canTrade}
                      className={`px-2 py-1 text-xs rounded ${leverage === lv ? 'bg-electric/20 text-electric border border-electric/30' : 'bg-white/5 text-cream/40 hover:bg-white/10'} disabled:opacity-50`}
                    >
                      1:{lv}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SL/TP */}
            <div className="p-3 border-b border-white/10 space-y-2">
              <div>
                <label className="text-xs text-cream/50 mb-1 block">Stop Loss (price)</label>
                <input
                  type="number"
                  step="any"
                  value={stopLoss ?? ''}
                  onChange={(e) => setStopLoss(e.target.value ? Number(e.target.value) : null)}
                  disabled={!canTrade}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-cream text-sm focus:border-loss/50 focus:outline-none disabled:opacity-50"
                  placeholder={`e.g. ${(entryPx * (tradeDirection === 'buy' ? 0.995 : 1.005)).toFixed(selectedAsset.symbol.includes('JPY') ? 3 : 5)}`}
                />
              </div>
              <div>
                <label className="text-xs text-cream/50 mb-1 block">Take Profit (price)</label>
                <input
                  type="number"
                  step="any"
                  value={takeProfit ?? ''}
                  onChange={(e) => setTakeProfit(e.target.value ? Number(e.target.value) : null)}
                  disabled={!canTrade}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-cream text-sm focus:border-profit/50 focus:outline-none disabled:opacity-50"
                  placeholder={`e.g. ${(entryPx * (tradeDirection === 'buy' ? 1.01 : 0.99)).toFixed(selectedAsset.symbol.includes('JPY') ? 3 : 5)}`}
                />
              </div>
            </div>

            {/* Execute Button */}
            <div className="p-3">
             <button
  onClick={handleTrade}
                disabled={!canTrade}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  tradeDirection === 'buy'
                    ? 'bg-profit text-void hover:brightness-110'
                    : 'bg-loss text-white hover:brightness-110'
                }`}
              >
                {tradeDirection === 'buy' ? 'BUY' : 'SELL'} {selectedAsset.symbol} @ {formatPrice(entryPx)}
              </button>
              <p className="text-[10px] text-cream/30 text-center mt-1">
                {lotSize} lots | {formatMoney(positionNotional)} notional | 1:{leverage}
              </p>
            </div>
          </div>

          {/* Positions Panel + Modals + Toast */}
          {/* (unchanged below) */}
        </div>
      </div>
    </KYCGate>
  );
}
