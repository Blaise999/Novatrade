// app/dashboard/stocks/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
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
import { StockPosition } from '@/lib/trading-types';
import KYCGate from '@/components/KYCGate';
import { saveTradeToHistory, closeTradeInHistory } from '@/lib/services/trade-history';

// ✅ Twelve Data helpers we created
import { fetchCandles, fetchQuotesBatch } from '@/lib/market/twelve';

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

function fmtMoney(x: number) {
  if (!Number.isFinite(x)) return '$0';
  return `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function clampInt(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, Math.floor(x)));
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

function tfToTwelveInterval(tf: Timeframe) {
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

function parseTwelveDatetimeToMs(dt: string) {
  // Twelve often returns "YYYY-MM-DD HH:mm:ss"
  if (!dt) return Date.now();
  const isoLike = dt.includes(' ') ? dt.replace(' ', 'T') : dt;

  // Some Twelve feeds return local/UTC strings; try Z then fallback
  const withZ = isoLike.endsWith('Z') ? isoLike : `${isoLike}Z`;
  const t1 = Date.parse(withZ);
  if (Number.isFinite(t1)) return t1;

  const t2 = Date.parse(isoLike);
  if (Number.isFinite(t2)) return t2;

  return Date.now();
}

export default function StockTradingPage() {
  // ✅ HYDRATION FIX
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  const { user, refreshUser } = useStore();

  /**
   * ✅ IMPORTANT BALANCE FIX (stocks only):
   * DO NOT initialize accounts here.
   * You already have useUnifiedBalance (seen in logs) initializing accounts in the dashboard shell.
   * Initializing again inside this page causes repeated “reset” of cash after buy/sell -> looks like balance is increasing.
   */
  const spotAccount = useTradingAccountStore((s) => s.spotAccount);
  const stockPositions = useTradingAccountStore((s) => s.stockPositions);
  const executeStockBuy = useTradingAccountStore((s) => s.executeStockBuy);
  const executeStockSell = useTradingAccountStore((s) => s.executeStockSell);
  const updateStockPositionPrice = useTradingAccountStore((s) => s.updateStockPositionPrice);

  // ---- Assets
  const stockAssets = useMemo(() => {
    const list = (marketAssets as any[])
      .filter((a) => a?.type === 'stock')
      .map(normalizeStockAsset)
      .filter((a) => a.symbol);

    return list.length
      ? list
      : ([
          { symbol: 'AAPL', name: 'Apple', price: 190, changePercent24h: 0, type: 'stock' },
          { symbol: 'NVDA', name: 'NVIDIA', price: 650, changePercent24h: 0, type: 'stock' },
          { symbol: 'TSLA', name: 'Tesla', price: 200, changePercent24h: 0, type: 'stock' },
        ] as StockAsset[]);
  }, []);

  const [selectedSymbol, setSelectedSymbol] = useState<string>(stockAssets[0]?.symbol ?? 'AAPL');
  const selectedAsset = useMemo(
    () => stockAssets.find((a) => a.symbol === selectedSymbol) ?? stockAssets[0],
    [stockAssets, selectedSymbol]
  );

  // ---- UI state
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

  const [showSellModal, setShowSellModal] = useState(false);
  const [positionToSell, setPositionToSell] = useState<StockPosition | null>(null);
  const [sellQty, setSellQty] = useState(0);

  // ---- Live quotes (Twelve Data polling)
  const [sseState, setSseState] = useState<'connecting' | 'live' | 'down'>('connecting');
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const prevCloseRef = useRef<Record<string, number>>({});

  const subscribedSymbols = useMemo(() => {
    // poll all symbols so switching is instant
    return stockAssets.map((a) => a.symbol).slice(0, 50);
  }, [stockAssets]);

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) => (prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]));
  };

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stockAssets;
    return stockAssets.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [stockAssets, searchQuery]);

  const pollingKey = useMemo(() => subscribedSymbols.join(','), [subscribedSymbols]);

  useEffect(() => {
    if (!subscribedSymbols.length) return;

    let alive = true;
    let timer: number | null = null;

    const tick = async () => {
      try {
        if (!alive) return;
        setSseState((s) => (s === 'live' ? 'live' : 'connecting'));

        const data = await fetchQuotesBatch(subscribedSymbols);
        if (!alive) return;

        setQuotes((prev) => {
          const next: Record<string, LiveQuote> = { ...prev };

          for (const sym of subscribedSymbols) {
            const key = String(sym || '').toUpperCase();
            const q: any = (data as any)?.[key] || (data as any)?.[sym] || null;
            if (!q) continue;

            const price = n(q?.price ?? q?.close ?? q?.last, 0);
            if (!price || !Number.isFinite(price)) continue;

            const prevClose =
              n(q?.previous_close, 0) ||
              n(q?.prev_close, 0) ||
              n(q?.close, 0) ||
              prevCloseRef.current[key] ||
              next[key]?.prevClose ||
              undefined;

            if (prevClose && !prevCloseRef.current[key]) prevCloseRef.current[key] = prevClose;

            const pctRaw = q?.percent_change ?? q?.change_percent ?? q?.percentChange ?? undefined;
            const pct =
              Number.isFinite(n(pctRaw, NaN)) ? n(pctRaw, 0) : deriveChangePercent(price, prevClose);

            const bid = price * 0.9999;
            const ask = price * 1.0001;

            next[key] = {
              symbol: key,
              price,
              bid,
              ask,
              changePercent24h: pct,
              prevClose,
              ts: Date.now(),
            };

            // ✅ keep trading-store prices in sync for correct PnL
            try {
              updateStockPositionPrice(key, price);
            } catch {
              // ignore
            }
          }

          return next;
        });

        setSseState('live');
      } catch {
        if (!alive) return;
        setSseState('down');
      }
    };

    tick();
    timer = window.setInterval(tick, 6000);

    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [pollingKey, updateStockPositionPrice, subscribedSymbols]);

  // ---- History (candles) from Twelve Data
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingChart(true);

    const load = async () => {
      try {
        const interval = tfToTwelveInterval(chartTimeframe);
        const raw = await fetchCandles(selectedSymbol, interval, 220);

        if (!alive) return;

        const out: Candle[] = (raw || [])
          .map((c: any, i: number) => ({
            t: parseTwelveDatetimeToMs(String(c?.time || '')) || Date.now() + i,
            o: n(c?.open, 0),
            h: n(c?.high, 0),
            l: n(c?.low, 0),
            c: n(c?.close, 0),
            v: undefined,
          }))
          .filter((x) => x.h > 0 && x.l > 0 && x.c > 0);

        setCandles(out);
      } catch {
        if (!alive) return;
        setCandles([]);
      } finally {
        if (alive) setLoadingChart(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [selectedSymbol, chartTimeframe]);

  // ---- Chart sizing
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 320, height: 260 });

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setChartDimensions({
        width: Math.max(280, Math.floor(r.width || 320)),
        height: Math.max(220, Math.floor(r.height || 260)),
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

  // ---- Derived selected quote
  const live = quotes[selectedSymbol];
  const price = live?.price ?? selectedAsset?.price ?? 0;
  const bidPrice = live?.bid ?? price * 0.9999;
  const askPrice = live?.ask ?? price * 1.0001;
  const changePercent24h = live?.changePercent24h ?? selectedAsset?.changePercent24h ?? 0;
  const up = changePercent24h >= 0;

  // ---- Order calc (guard against missing quotes)
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

  // ✅ user.balance already includes bonus (per your system)
  const userBalance = Number(user?.balance ?? 0);
  const cashBalance =
    (spotAccount as any)?.availableToTrade ??
    (spotAccount as any)?.cash ??
    (spotAccount as any)?.balance ??
    userBalance;

  const portfolioValue = stockPositions.reduce((sum, pos) => sum + Number(pos.marketValue ?? 0), 0);
  const totalEquity = cashBalance + portfolioValue;
  const unrealizedPnL = stockPositions.reduce((sum, pos) => sum + Number(pos.unrealizedPnL ?? 0), 0);

  const canBuy = effectiveShares >= 1 && safeAsk > 0 && totalCost <= cashBalance;

  // ---- Buy/Sell (Spot HOLD)
  const handleBuy = async () => {
    if (safeAsk <= 0) {
      pushNotif({ type: 'error', message: 'No live price yet. Try again in a second.' }, 2500);
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

    const result = executeStockBuy(selectedSymbol, selectedAsset?.name ?? selectedSymbol, effectiveShares, safeAsk, commission);

    if ((result as any)?.success) {
      await refreshUser?.();

      // ✅ save to trades history (best-effort)
      try {
        if (user?.id) {
          const state = useTradingAccountStore.getState();
          const pos = state.stockPositions.find((p) => p.symbol === selectedSymbol);
          if (pos) {
            const payload: any = {
              id: pos.id,
              userId: user.id,
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
              status: 'active',
              openedAt: new Date().toISOString(),
              notes: JSON.stringify({ model: 'spot_hold', name: pos.name }),
            };
            saveTradeToHistory(payload).catch((e) => console.error('[Stocks] Trade history save failed:', e));
          }
        }
      } catch {
        // ignore
      }

      pushNotif({ type: 'success', message: `Bought ${effectiveShares} ${selectedSymbol} @ $${safeAsk.toFixed(2)}` });
    } else {
      pushNotif({ type: 'error', message: (result as any)?.error || 'Trade failed' });
    }
  };

  const handleSell = async () => {
    if (!positionToSell || sellQty <= 0) return;

    const safeBid = Number.isFinite(bidPrice) && bidPrice > 0 ? bidPrice : 0;
    if (!safeBid) {
      pushNotif({ type: 'error', message: 'No live bid yet. Try again in a second.' }, 2500);
      return;
    }

    const sellCommission = Math.max(0.99, sellQty * safeBid * 0.001);
    const result = executeStockSell(positionToSell.id, sellQty, safeBid, sellCommission);

    if ((result as any)?.success) {
      const pnl = Number((result as any)?.realizedPnL ?? 0);
      await refreshUser?.();

      // partial vs full close
      try {
        if (user?.id) {
          const after = useTradingAccountStore.getState().stockPositions;
          const still = after.find((p) => p.id === positionToSell.id);

          if (still) {
            const payload: any = {
              id: still.id,
              userId: user.id,
              marketType: 'stocks',
              assetType: 'stock',
              pair: still.symbol,
              symbol: still.symbol,
              type: 'buy',
              side: 'buy',
              quantity: still.qty,
              entryPrice: still.avgEntry ?? 0,
              status: 'active',
              updatedAt: new Date().toISOString(),
              notes: JSON.stringify({ model: 'spot_hold', partial: true }),
            };
            saveTradeToHistory(payload).catch((e) => console.error('[Stocks] Trade history upsert failed:', e));
          } else {
            const payload: any = {
              tradeId: positionToSell.id,
              userId: user.id,
              exitPrice: safeBid,
              pnl,
              status: 'closed',
              closedAt: new Date().toISOString(),
            };
            closeTradeInHistory(payload).catch((e) => console.error('[Stocks] Trade history close failed:', e));
          }
        }
      } catch {
        // ignore
      }

      pushNotif({
        type: 'success',
        message: `Sold ${sellQty} ${positionToSell.symbol} for ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
      });
    } else {
      pushNotif({ type: 'error', message: (result as any)?.error || 'Sell failed' });
    }

    setShowSellModal(false);
    setPositionToSell(null);
    setSellQty(0);
  };

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

  const info = stockInfo[selectedSymbol] || { emoji: '📈', sector: 'Other' };

  // ✅ HYDRATION FIX
  if (!hasMounted) {
    return (
      <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] flex items-center justify-center bg-void">
        <div className="animate-pulse text-slate-500 text-sm">Loading stocks trading…</div>
      </div>
    );
  }

  return (
    <KYCGate action="trade stocks">
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
                <span className="text-lg sm:text-xl">{info.emoji}</span>
                <div className="text-left">
                  <p className="text-sm sm:text-base font-semibold text-cream truncate">{selectedSymbol}</p>
                  <p className="text-xs text-cream/50 hidden sm:block">{selectedAsset?.name}</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-cream/50 flex-shrink-0" />
            </button>

            {/* Price */}
            <div className="flex items-center gap-3 sm:gap-6">
              <div className="text-center">
                <p className="text-lg sm:text-2xl font-mono font-bold text-cream">
                  ${Number.isFinite(price) ? price.toFixed(2) : '0.00'}
                </p>
                <p className={`text-xs ${up ? 'text-profit' : 'text-loss'}`}>
                  {up ? '+' : ''}
                  {Number.isFinite(changePercent24h) ? changePercent24h.toFixed(2) : '0.00'}%
                </p>
              </div>
            </div>

            {/* Live status */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                sseState === 'live' ? 'bg-profit/10' : 'bg-white/5'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sseState === 'live'
                    ? 'bg-profit animate-pulse'
                    : sseState === 'connecting'
                      ? 'bg-gold animate-pulse'
                      : 'bg-slate-500'
                }`}
              />
              <span className={`text-sm font-medium ${sseState === 'live' ? 'text-profit' : 'text-cream/70'}`}>
                {sseState === 'live' ? 'Live' : sseState === 'connecting' ? 'Connecting' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="lg:hidden flex-shrink-0 flex border-b border-white/10 bg-obsidian">
          {(['chart', 'trade', 'portfolio'] as MobileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mobileTab === tab ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-cream/50'
              }`}
            >
              {tab === 'chart' && 'Chart'}
              {tab === 'trade' && 'Trade'}
              {tab === 'portfolio' && `Portfolio (${stockPositions.length})`}
            </button>
          ))}
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Chart */}
          <div className={`${mobileTab === 'chart' ? 'flex' : 'hidden'} lg:flex flex-col flex-1 min-h-0 h-full`}>
            {/* Controls */}
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

            {/* Chart area */}
            <div
              ref={chartRef}
              className="flex-1 relative bg-charcoal/30 w-full overflow-hidden"
              style={{ minHeight: '250px', height: 'calc(100% - 48px)' }}
            >
              {loadingChart && (
                <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs text-cream/60">Loading…</span>
                </div>
              )}

              {!candles.length && !loadingChart && (
                <div className="absolute inset-0 flex items-center justify-center text-cream/50 text-sm">No chart data</div>
              )}

              <svg className="w-full h-full block" viewBox={`0 0 ${chart.w} ${chart.h}`} preserveAspectRatio="xMidYMid meet">
                {/* grid */}
                {[...Array(8)].map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1="0"
                    y1={i * (chart.h / 8)}
                    x2={chart.w}
                    y2={i * (chart.h / 8)}
                    stroke="rgba(255,255,255,0.05)"
                  />
                ))}
                {[...Array(16)].map((_, i) => (
                  <line
                    key={`v-${i}`}
                    x1={i * (chart.w / 16)}
                    y1="0"
                    x2={i * (chart.w / 16)}
                    y2={chart.h}
                    stroke="rgba(255,255,255,0.05)"
                  />
                ))}

                {/* candles */}
                {chartType === 'candle' &&
                  chart.items.map((c, i) => (
                    <g key={i}>
                      <line x1={c.x} y1={c.hY} x2={c.x} y2={c.lY} stroke={c.isUp ? '#00d9a5' : '#ef4444'} strokeWidth="1" />
                      <rect
                        x={c.x - c.bodyW / 2}
                        y={Math.min(c.oY, c.cY)}
                        width={c.bodyW}
                        height={Math.max(1, Math.abs(c.cY - c.oY))}
                        fill={c.isUp ? '#00d9a5' : '#ef4444'}
                        rx="1"
                      />
                    </g>
                  ))}

                {/* line */}
                {chartType === 'line' && chart.linePath && (
                  <>
                    <path d={chart.linePath} fill="none" stroke={up ? '#00d9a5' : '#ef4444'} strokeWidth="2" />
                    <path
                      d={`${chart.linePath} L ${chart.w - chart.pad.r} ${chart.h - chart.pad.b} L ${chart.pad.l} ${chart.h - chart.pad.b} Z`}
                      fill={up ? 'rgba(0,217,165,0.15)' : 'rgba(239,68,68,0.15)'}
                    />
                  </>
                )}

                {/* current price marker */}
                {chart.max > 0 &&
                  Number.isFinite(price) &&
                  (() => {
                    const range = chart.max - chart.min || 1;
                    const priceY = chart.pad.t + ((chart.max - price) / range) * (chart.h - chart.pad.t - chart.pad.b);
                    return (
                      <>
                        <line x1="0" y1={priceY} x2={chart.w} y2={priceY} stroke="#d4af37" strokeDasharray="4" />
                        <rect x={chart.w - 65} y={priceY - 10} width="60" height="20" fill="#d4af37" rx="3" />
                        <text x={chart.w - 35} y={priceY + 4} textAnchor="middle" fill="#0a0a0f" fontSize="10" fontFamily="monospace">
                          ${price.toFixed(2)}
                        </text>
                      </>
                    );
                  })()}

                {chart.max > 0 && (
                  <>
                    <text x={chart.w - 6} y={16} textAnchor="end" fill="#666" fontSize="10" fontFamily="monospace">
                      ${chart.max.toFixed(2)}
                    </text>
                    <text x={chart.w - 6} y={chart.h - 8} textAnchor="end" fill="#666" fontSize="10" fontFamily="monospace">
                      ${chart.min.toFixed(2)}
                    </text>
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Trade panel */}
          <div
            className={`${
              mobileTab === 'trade' ? 'flex' : 'hidden'
            } lg:flex flex-col w-full lg:w-80 xl:w-96 border-l border-white/10 bg-obsidian overflow-y-auto`}
          >
            {/* Summary */}
            <div className="p-3 border-b border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">Cash</p>
                  <p className="text-sm font-semibold text-cream">{fmtMoney(cashBalance)}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">Portfolio</p>
                  <p className="text-sm font-semibold text-profit">{fmtMoney(portfolioValue)}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">Total</p>
                  <p className="text-sm font-semibold text-cream">{fmtMoney(totalEquity)}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg">
                  <p className="text-xs text-cream/50">P&amp;L</p>
                  <p className={`text-sm font-semibold ${unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {unrealizedPnL >= 0 ? '+' : ''}${Math.abs(unrealizedPnL).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Mode */}
            <div className="p-3 border-b border-white/10">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setOrderMode('shares')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    orderMode === 'shares' ? 'bg-gold text-void' : 'bg-white/5 text-cream/50 hover:bg-white/10'
                  }`}
                >
                  Shares
                </button>
                <button
                  onClick={() => setOrderMode('dollars')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    orderMode === 'dollars' ? 'bg-gold text-void' : 'bg-white/5 text-cream/50 hover:bg-white/10'
                  }`}
                >
                  Dollars
                </button>
              </div>

              {orderMode === 'shares' ? (
                <div>
                  <label className="text-xs text-cream/50 mb-2 block">Number of Shares</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShareQty(Math.max(1, shareQty - 1))}
                      className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10"
                    >
                      <Minus className="w-4 h-4 text-cream" />
                    </button>
                    <input
                      type="number"
                      value={shareQty}
                      onChange={(e) => setShareQty(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      className="flex-1 h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-center text-cream font-mono focus:outline-none focus:border-gold"
                    />
                    <button
                      onClick={() => setShareQty(shareQty + 1)}
                      className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg hover:bg-white/10"
                    >
                      <Plus className="w-4 h-4 text-cream" />
                    </button>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {[1, 5, 10, 25, 50].map((qty) => (
                      <button
                        key={qty}
                        onClick={() => setShareQty(qty)}
                        className={`flex-1 py-1 text-xs rounded-lg ${
                          shareQty === qty ? 'bg-gold text-void' : 'bg-white/5 text-cream/50'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-cream/50 mb-2 block">Dollar Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/50">$</span>
                    <input
                      type="number"
                      value={dollarAmount}
                      onChange={(e) => setDollarAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                      min={1}
                      className="w-full h-10 pl-7 pr-3 bg-white/5 border border-white/10 rounded-lg text-cream font-mono focus:outline-none focus:border-gold"
                    />
                  </div>
                  <div className="flex gap-1 mt-2">
                    {[50, 100, 250, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setDollarAmount(amt)}
                        className={`flex-1 py-1 text-xs rounded-lg ${
                          dollarAmount === amt ? 'bg-gold text-void' : 'bg-white/5 text-cream/50'
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-cream/40 mt-2">
                    ≈ {effectiveShares} shares {safeAsk > 0 ? `@ $${safeAsk.toFixed(2)}` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Summary + Buy */}
            <div className="p-3 space-y-4">
              <div className="p-3 bg-white/5 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-cream/50">Shares</span>
                  <span className="text-cream">{effectiveShares}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-cream/50">Ask</span>
                  <span className="text-cream font-mono">${safeAsk > 0 ? safeAsk.toFixed(2) : '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-cream/50">Order Value</span>
                  <span className="text-cream">${orderValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-cream/50">Commission</span>
                  <span className="text-cream">${commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                  <span className="text-cream font-medium">Total</span>
                  <span className="text-gold font-bold">${totalCost.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleBuy}
                disabled={!canBuy}
                className="w-full py-4 rounded-xl font-bold text-lg bg-profit text-void hover:bg-profit/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buy {effectiveShares} {effectiveShares === 1 ? 'Share' : 'Shares'}
              </button>

              {!canBuy && (
                <div className="p-2 bg-loss/10 rounded-lg border border-loss/20">
                  {safeAsk <= 0 ? (
                    <p className="text-xs text-loss text-center">Waiting for live price…</p>
                  ) : effectiveShares < 1 ? (
                    <p className="text-xs text-loss text-center">Amount too small — shares becomes 0.</p>
                  ) : (
                    <>
                      <p className="text-xs text-loss text-center mb-1">
                        Insufficient funds. Need ${(totalCost - cashBalance).toFixed(2)} more.
                      </p>
                      <Link
                        href="/dashboard/wallet"
                        className="flex items-center justify-center gap-1 text-xs text-gold hover:text-gold/80 font-medium"
                      >
                        <Wallet className="w-3 h-3" />
                        Deposit Funds
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Portfolio panel (Mobile) */}
          <div className={`${mobileTab === 'portfolio' ? 'flex' : 'hidden'} lg:hidden flex-col flex-1 overflow-y-auto bg-obsidian`}>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-cream mb-3">Your Holdings ({stockPositions.length})</h3>

              {stockPositions.length === 0 ? (
                <div className="text-center py-8 text-cream/50">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No holdings yet</p>
                  <p className="text-xs mt-1">Buy stocks to start building your portfolio</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stockPositions.map((pos) => {
                    const pi = stockInfo[pos.symbol] || { emoji: '📈', sector: 'Other' };
                    return (
                      <div key={pos.id} className="p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{pi.emoji}</span>
                            <span className="font-semibold text-cream">{pos.symbol}</span>
                          </div>
                          <span className={`font-semibold ${pos.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {pos.unrealizedPnL >= 0 ? '+' : ''}${Number(pos.unrealizedPnL ?? 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                          <div>
                            <p className="text-cream/50">Shares</p>
                            <p className="text-cream">{pos.qty}</p>
                          </div>
                          <div>
                            <p className="text-cream/50">Avg Entry</p>
                            <p className="text-cream font-mono">${Number(pos.avgEntry ?? 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-cream/50">Value</p>
                            <p className="text-cream">${Number(pos.marketValue ?? 0).toFixed(2)}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setPositionToSell(pos);
                            setSellQty(pos.qty);
                            setShowSellModal(true);
                          }}
                          className="w-full py-2 bg-loss/20 text-loss text-sm font-medium rounded-lg hover:bg-loss/30 transition-colors"
                        >
                          Sell
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Portfolio */}
        <div className="hidden lg:block flex-shrink-0 h-48 border-t border-white/10 bg-obsidian overflow-y-auto">
          <div className="p-3">
            <h3 className="text-sm font-semibold text-cream mb-3">Holdings ({stockPositions.length})</h3>

            {stockPositions.length === 0 ? (
              <div className="text-center py-4 text-cream/50">
                <p className="text-sm">No holdings yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-cream/50 text-xs">
                      <th className="text-left pb-2">Symbol</th>
                      <th className="text-right pb-2">Shares</th>
                      <th className="text-right pb-2">Avg Entry</th>
                      <th className="text-right pb-2">Current</th>
                      <th className="text-right pb-2">Value</th>
                      <th className="text-right pb-2">P&amp;L</th>
                      <th className="text-right pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPositions.map((pos) => {
                      const cur = quotes[pos.symbol]?.price ?? (pos as any)?.currentPrice ?? 0;
                      return (
                        <tr key={pos.id} className="border-t border-white/5">
                          <td className="py-2 text-cream font-medium">{pos.symbol}</td>
                          <td className="py-2 text-right text-cream">{pos.qty}</td>
                          <td className="py-2 text-right font-mono text-cream">${Number(pos.avgEntry ?? 0).toFixed(2)}</td>
                          <td className="py-2 text-right font-mono text-cream">${Number(cur).toFixed(2)}</td>
                          <td className="py-2 text-right text-cream">${Number(pos.marketValue ?? 0).toFixed(2)}</td>
                          <td className={`py-2 text-right font-semibold ${pos.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {pos.unrealizedPnL >= 0 ? '+' : ''}${Number(pos.unrealizedPnL ?? 0).toFixed(2)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => {
                                setPositionToSell(pos);
                                setSellQty(pos.qty);
                                setShowSellModal(true);
                              }}
                              className="px-3 py-1 bg-loss/20 text-loss text-xs font-medium rounded hover:bg-loss/30"
                            >
                              Sell
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Asset Selector */}
        <AnimatePresence>
          {showAssetSelector && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAssetSelector(false)}
                className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md bg-obsidian rounded-2xl border border-white/10 z-50 flex flex-col max-h-[90vh]"
              >
                <div className="p-4 border-b border-white/10 flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-cream">Select Stock</h3>
                    <button onClick={() => setShowAssetSelector(false)}>
                      <X className="w-5 h-5 text-cream/50" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
                    <input
                      type="text"
                      placeholder="Search stocks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {favorites.length > 0 && (
                    <div className="mb-4">
                      <p className="px-2 py-1 text-xs text-gold font-medium">⭐ Watchlist</p>
                      {filteredAssets
                        .filter((a) => favorites.includes(a.symbol))
                        .map((asset) => {
                          const q = quotes[asset.symbol];
                          const p = q?.price ?? asset.price;
                          const dp = q?.changePercent24h ?? asset.changePercent24h;
                          const ai = stockInfo[asset.symbol] || { emoji: '📈', sector: 'Other' };
                          return (
                            <button
                              key={asset.symbol}
                              onClick={() => {
                                setSelectedSymbol(asset.symbol);
                                setShowAssetSelector(false);
                              }}
                              className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{ai.emoji}</span>
                                <div className="text-left">
                                  <p className="font-medium text-cream">{asset.symbol}</p>
                                  <p className="text-xs text-cream/50">{asset.name}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="font-mono text-cream">${Number.isFinite(p) ? p.toFixed(2) : '0.00'}</p>
                                  <p className={`text-xs ${dp >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    {dp >= 0 ? '+' : ''}
                                    {Number.isFinite(dp) ? dp.toFixed(2) : '0.00'}%
                                  </p>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(asset.symbol);
                                  }}
                                  className="p-1"
                                >
                                  <Star className="w-4 h-4 text-gold fill-gold" />
                                </button>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}

                  <p className="px-2 py-1 text-xs text-cream/50 font-medium">All Stocks</p>
                  {filteredAssets
                    .filter((a) => !favorites.includes(a.symbol))
                    .map((asset) => {
                      const q = quotes[asset.symbol];
                      const p = q?.price ?? asset.price;
                      const dp = q?.changePercent24h ?? asset.changePercent24h;
                      const ai = stockInfo[asset.symbol] || { emoji: '📈', sector: 'Other' };
                      return (
                        <button
                          key={asset.symbol}
                          onClick={() => {
                            setSelectedSymbol(asset.symbol);
                            setShowAssetSelector(false);
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{ai.emoji}</span>
                            <div className="text-left">
                              <p className="font-medium text-cream">{asset.symbol}</p>
                              <p className="text-xs text-cream/50">{asset.name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="font-mono text-cream">${Number.isFinite(p) ? p.toFixed(2) : '0.00'}</p>
                              <p className={`text-xs ${dp >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {dp >= 0 ? '+' : ''}
                                {Number.isFinite(dp) ? dp.toFixed(2) : '0.00'}%
                              </p>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(asset.symbol);
                              }}
                              className="p-1"
                            >
                              <StarOff className="w-4 h-4 text-cream/30 hover:text-gold" />
                            </button>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Sell Modal */}
        <AnimatePresence>
          {showSellModal && positionToSell && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSellModal(false)}
                className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm bg-obsidian rounded-2xl p-4 sm:p-6 border border-gold/20 z-50"
              >
                <h3 className="text-xl font-semibold text-cream mb-4">Sell {positionToSell.symbol}</h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm text-cream/50 mb-2 block">Shares to Sell</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSellQty(Math.max(1, sellQty - 1))}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg"
                      >
                        <Minus className="w-4 h-4 text-cream" />
                      </button>
                      <input
                        type="number"
                        value={sellQty}
                        onChange={(e) => setSellQty(Math.min(positionToSell.qty, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="flex-1 h-10 bg-white/5 border border-white/10 rounded-lg text-center text-cream font-mono focus:outline-none focus:border-gold"
                      />
                      <button
                        onClick={() => setSellQty(Math.min(positionToSell.qty, sellQty + 1))}
                        className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-lg"
                      >
                        <Plus className="w-4 h-4 text-cream" />
                      </button>
                    </div>
                    <button
                      onClick={() => setSellQty(positionToSell.qty)}
                      className="w-full mt-2 py-1 text-xs text-gold bg-gold/10 rounded-lg"
                    >
                      Sell All ({positionToSell.qty} shares)
                    </button>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-cream/50">Avg Entry</span>
                      <span className="text-cream font-mono">${Number(positionToSell.avgEntry ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cream/50">Bid</span>
                      <span className="text-cream font-mono">${Number.isFinite(bidPrice) ? bidPrice.toFixed(2) : '—'}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/10">
                      <span className="text-cream/50">Est. P&amp;L</span>
                      <span
                        className={`font-semibold ${
                          (bidPrice - Number(positionToSell.avgEntry ?? 0)) * sellQty >= 0 ? 'text-profit' : 'text-loss'
                        }`}
                      >
                        {(bidPrice - Number(positionToSell.avgEntry ?? 0)) * sellQty >= 0 ? '+' : ''}
                        ${((bidPrice - Number(positionToSell.avgEntry ?? 0)) * sellQty).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSellModal(false)}
                    className="flex-1 py-3 bg-white/5 text-cream rounded-xl hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSell}
                    className="flex-1 py-3 bg-loss text-white font-semibold rounded-xl hover:bg-loss/90"
                  >
                    Sell {sellQty} Shares
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 ${
                notification.type === 'success' ? 'bg-profit text-void' : 'bg-loss text-white'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="font-medium text-sm sm:text-base">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </KYCGate>
  );
}
