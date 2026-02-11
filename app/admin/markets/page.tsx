// app/admin/markets/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  CandlestickChart,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Wifi,
  WifiOff,
  Sliders,
  BarChart3,
  History,
  Send,
  Trash2,
} from 'lucide-react';

import { useAdminMarketStore, type CustomPair } from '@/lib/admin-markets';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type TimestampInput = number | Date | string | null | undefined;

interface LiveCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  startTime: Date; // live-only
}

type CandleLike = {
  id?: string;
  timestamp: number | string | Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const patternOptions = [
  { id: 'bull-flag', name: 'Bull Flag', description: 'Strong move up, consolidation, breakout', icon: '📈' },
  { id: 'head-shoulders', name: 'Head & Shoulders', description: 'Reversal pattern with breakdown', icon: '🏔️' },
  { id: 'double-bottom', name: 'Double Bottom', description: 'Support test and rally', icon: '📉' },
  { id: 'breakout-up', name: 'Bullish Breakout', description: 'Consolidation then upward break', icon: '🚀' },
  { id: 'breakout-down', name: 'Bearish Breakout', description: 'Consolidation then downward break', icon: '💥' },
];

// ✅ robust timestamp normalizer (UI boundary can be Date/string/number)
function toMs(input: TimestampInput): number {
  if (typeof input === 'number' && Number.isFinite(input)) {
    if (input > 0 && input < 1e12) return Math.round(input * 1000); // seconds -> ms
    return Math.round(input);
  }
  if (input instanceof Date) {
    const ms = input.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) {
        if (n > 0 && n < 1e12) return Math.round(n * 1000);
        return Math.round(n);
      }
    }
    const d = new Date(s);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }
  return Date.now();
}

function msToIso(ms: number): string {
  const safe = Number.isFinite(ms) ? ms : Date.now();
  return new Date(safe).toISOString();
}

function msToDate(ms: unknown): Date {
  if (typeof ms === 'number' && Number.isFinite(ms)) return new Date(ms);
  if (ms instanceof Date) return ms;
  if (typeof ms === 'string') {
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : new Date();
  }
  return new Date();
}

export default function AdminMarketsPage() {
  const {
    customPairs,
    candles,
    currentPrices,
    isPaused,
    setCurrentPrice,
    pauseTrading,
    resumeTrading,
    addCandle,
    clearCandles,
    generateBullFlag,
    generateHeadAndShoulders,
    generateDoubleBottom,
    generateBreakout,
  } = useAdminMarketStore();

  const isPausedMap: Record<string, boolean> = (isPaused ?? {}) as Record<string, boolean>;

  const fallbackPair: CustomPair =
    customPairs?.[0] ??
    ({
      id: 'DEMO/USD',
      symbol: 'DEMO/USD',
      name: 'Demo Pair',
      basePrice: 1,
    } as unknown as CustomPair);

  const [selectedPair, setSelectedPair] = useState<CustomPair>(fallbackPair);

  useEffect(() => {
    if (!customPairs?.length) return;
    const stillExists = customPairs.some((p) => p.id === selectedPair.id);
    if (!stillExists) setSelectedPair(customPairs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPairs]);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'slider' | 'candles' | 'history'>('slider');

  const [sliderValue, setSliderValue] = useState(0);
  const [targetPrice, setTargetPrice] = useState('');

  const [liveCandle, setLiveCandle] = useState<LiveCandle | null>(null);
  const [candleInterval, setCandleInterval] = useState(5);
  const [autoCandleEnabled, setAutoCandleEnabled] = useState(true);

  const candleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCandleCloseRef = useRef<Date>(new Date());

  const [seedEnabled, setSeedEnabled] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState(patternOptions[0].id);
  const [patternBasePrice, setPatternBasePrice] = useState('');

  const [candleOpen, setCandleOpen] = useState('');
  const [candleHigh, setCandleHigh] = useState('');
  const [candleLow, setCandleLow] = useState('');
  const [candleClose, setCandleClose] = useState('');

  const pairKey = selectedPair.id;
  const pairSymbol = selectedPair.symbol;

  const currentPrice = currentPrices[pairKey];
  const isTradingPaused = !!isPausedMap[pairKey];

  // ✅ FIX: define pairCandles (and keep it typed)
  const candlesByPair = (candles ?? {}) as Record<string, CandleLike[]>;
  const pairCandles: CandleLike[] = candlesByPair[pairKey] ?? [];

  const effectiveSpread =
    currentPrice && typeof currentPrice.ask === 'number' && typeof currentPrice.bid === 'number'
      ? Math.max(currentPrice.ask - currentPrice.bid, 0)
      : 0.0002;

  useEffect(() => {
    if (isSupabaseConfigured()) setSupabaseConnected(true);
  }, []);

  const pushPriceToSupabase = useCallback(async (symbol: string, bid: number, ask: number) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase.from('custom_pairs').upsert(
        {
          symbol,
          current_price: bid,
          spread: ask - bid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'symbol' }
      );
    } catch (err) {
      console.error('Push price error:', err);
    }
  }, []);

  const pushCandleToSupabase = useCallback(
    async (
      symbol: string,
      candle: {
        timestamp: TimestampInput;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }
    ) => {
      if (!isSupabaseConfigured()) return;
      try {
        await supabase.from('custom_candles').insert({
          pair_symbol: symbol,
          timestamp: msToIso(toMs(candle.timestamp)),
          open_price: candle.open,
          high_price: candle.high,
          low_price: candle.low,
          close_price: candle.close,
          volume: candle.volume,
          timeframe: `${candleInterval}m`,
        });
      } catch (err) {
        console.error('Push candle error:', err);
      }
    },
    [candleInterval]
  );

  // Update live candle when price changes
  useEffect(() => {
    if (!autoCandleEnabled || !currentPrice) return;

    if (!liveCandle) {
      const now = new Date();
      setLiveCandle({
        open: currentPrice.bid,
        high: currentPrice.bid,
        low: currentPrice.bid,
        close: currentPrice.bid,
        volume: 1000,
        startTime: now,
      });
      lastCandleCloseRef.current = now;
      return;
    }

    setLiveCandle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        high: Math.max(prev.high, currentPrice.bid),
        low: Math.min(prev.low, currentPrice.bid),
        close: currentPrice.bid,
        volume: prev.volume + Math.random() * 500,
      };
    });
  }, [currentPrice?.bid, autoCandleEnabled, liveCandle, currentPrice]);

  // Timer to close candles at interval
  useEffect(() => {
    if (!autoCandleEnabled) {
      if (candleTimerRef.current) clearInterval(candleTimerRef.current);
      return;
    }

    candleTimerRef.current = setInterval(() => {
      const now = new Date();
      const elapsed = (now.getTime() - lastCandleCloseRef.current.getTime()) / 60000;

      if (elapsed >= candleInterval && liveCandle) {
        const candleDraft = {
          timestamp: liveCandle.startTime, // Date ok (we normalize on push)
          open: liveCandle.open,
          high: liveCandle.high,
          low: liveCandle.low,
          close: liveCandle.close,
          volume: liveCandle.volume,
        };

        addCandle(pairKey, candleDraft as any);
        pushCandleToSupabase(pairSymbol, candleDraft);

        const newStart = new Date();
        lastCandleCloseRef.current = newStart;

        setLiveCandle({
          open: liveCandle.close,
          high: liveCandle.close,
          low: liveCandle.close,
          close: liveCandle.close,
          volume: 0,
          startTime: newStart,
        });
      }
    }, 5000);

    return () => {
      if (candleTimerRef.current) clearInterval(candleTimerRef.current);
    };
  }, [autoCandleEnabled, candleInterval, liveCandle, pairKey, pairSymbol, addCandle, pushCandleToSupabase, pushCandleToSupabase]);

  useEffect(() => {
    setLiveCandle(null);
    lastCandleCloseRef.current = new Date();
  }, [pairKey]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSetTargetPrice = () => {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      showNotification('error', 'Invalid target price');
      return;
    }
    const spread = effectiveSpread;
    setCurrentPrice(pairKey, price, price + spread);
    pushPriceToSupabase(pairSymbol, price, price + spread);
    showNotification('success', `Price set to $${price.toFixed(5)}`);
    setTargetPrice('');
  };

  const handleSliderMove = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSliderValue(val);
    const basePrice = currentPrice?.bid || selectedPair.basePrice;
    const newPrice = basePrice * (1 + val / 100);
    const spread = effectiveSpread;
    setCurrentPrice(pairKey, newPrice, newPrice + spread);
    pushPriceToSupabase(pairSymbol, newPrice, newPrice + spread);
  };

  const quickPriceAdjust = (direction: 'up' | 'down', pips: number) => {
    const current = currentPrice?.bid || selectedPair.basePrice;
    const change = direction === 'up' ? pips * 0.0001 : -(pips * 0.0001);
    const newPrice = current + change;
    setCurrentPrice(pairKey, newPrice, newPrice + effectiveSpread);
    pushPriceToSupabase(pairSymbol, newPrice, newPrice + effectiveSpread);
    showNotification('success', `${direction === 'up' ? '+' : '-'}${pips} pips`);
  };

  const bigPriceMove = (direction: 'up' | 'down', percent: number) => {
    const current = currentPrice?.bid || selectedPair.basePrice;
    const change = direction === 'up' ? current * (percent / 100) : -(current * (percent / 100));
    const newPrice = current + change;
    setCurrentPrice(pairKey, newPrice, newPrice + effectiveSpread);
    pushPriceToSupabase(pairSymbol, newPrice, newPrice + effectiveSpread);
    showNotification('success', `${direction === 'up' ? '+' : '-'}${percent}% move applied`);
  };

  const toggleTrading = () => {
    if (isTradingPaused) {
      resumeTrading(pairKey);
      showNotification('success', `Trading resumed for ${selectedPair.symbol}`);
    } else {
      pauseTrading(pairKey);
      showNotification('success', `Trading paused for ${selectedPair.symbol}`);
    }
  };

  const handleSeedHistory = () => {
    if (!seedEnabled) {
      showNotification('error', 'Enable history seeding first');
      return;
    }
    const basePrice = parseFloat(patternBasePrice) || currentPrice?.bid || selectedPair.basePrice;

    switch (selectedPattern) {
      case 'bull-flag':
        generateBullFlag(pairKey, basePrice);
        break;
      case 'head-shoulders':
        generateHeadAndShoulders(pairKey, basePrice);
        break;
      case 'double-bottom':
        generateDoubleBottom(pairKey, basePrice);
        break;
      case 'breakout-up':
        generateBreakout(pairKey, basePrice, 'up');
        break;
      case 'breakout-down':
        generateBreakout(pairKey, basePrice, 'down');
        break;
    }

    showNotification('success', `Seeded ${patternOptions.find((p) => p.id === selectedPattern)?.name} pattern`);
  };

  const handleClearHistory = () => {
    clearCandles(pairKey);
    showNotification('success', `Cleared candle history for ${selectedPair.symbol}`);
  };

  const handleAddCandle = () => {
    const o = parseFloat(candleOpen);
    const h = parseFloat(candleHigh);
    const l = parseFloat(candleLow);
    const c = parseFloat(candleClose);

    if ([o, h, l, c].some(isNaN) || [o, h, l, c].some((v) => v <= 0)) {
      showNotification('error', 'Invalid values');
      return;
    }

    const draft = {
      timestamp: new Date(), // UI Date ok
      open: o,
      high: h,
      low: l,
      close: c,
      volume: 1000 + Math.random() * 5000,
    };

    addCandle(pairKey, draft as any);
    pushCandleToSupabase(pairSymbol, draft);

    setCurrentPrice(pairKey, c, c + effectiveSpread);
    pushPriceToSupabase(pairSymbol, c, c + effectiveSpread);

    showNotification('success', 'Candle added');
    setCandleOpen('');
    setCandleHigh('');
    setCandleLow('');
    setCandleClose('');
  };

  const [timeRemaining, setTimeRemaining] = useState('--:--');
  useEffect(() => {
    if (!autoCandleEnabled || !liveCandle) return;

    const timer = setInterval(() => {
      const elapsed = (Date.now() - liveCandle.startTime.getTime()) / 1000;
      const remaining = Math.max(0, candleInterval * 60 - elapsed);
      const mins = Math.floor(remaining / 60);
      const secs = Math.floor(remaining % 60);
      setTimeRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [autoCandleEnabled, liveCandle, candleInterval]);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-cream">Market Control Panel</h1>
          <p className="text-slate-400 mt-1">Full admin control — prices, candles, history</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
              supabaseConnected ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
            }`}
          >
            {supabaseConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {supabaseConnected ? 'Supabase Live' : 'Local Only'}
          </div>

          {autoCandleEnabled && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 text-gold rounded-lg text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              Next candle: {timeRemaining}
            </div>
          )}
        </div>
      </div>

      {/* Pair Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(customPairs?.length ? customPairs : [fallbackPair]).map((pair) => {
          const price = currentPrices[pair.id];
          const paused = !!isPausedMap[pair.id];
          const spread = price ? Math.max(price.ask - price.bid, 0) : 0.0002;

          return (
            <button
              key={pair.id}
              onClick={() => {
                setSelectedPair(pair);
                setSliderValue(0);
              }}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedPair.id === pair.id
                  ? 'bg-gold/10 border-gold/40 ring-1 ring-gold/20'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📈</span>
                  <span className="font-bold text-cream">{pair.symbol}</span>
                </div>
                {paused && <span className="px-2 py-0.5 bg-loss/20 text-loss text-xs rounded">PAUSED</span>}
              </div>

              <p className="text-xs text-cream/50">{pair.name}</p>

              {price && (
                <div className="mt-2">
                  <p className="text-xl font-mono text-cream font-bold">${price.bid.toFixed(5)}</p>
                  <p className="text-xs text-cream/40">
                    Ask: ${price.ask.toFixed(5)} • Spread: {(spread * 10000).toFixed(1)} pips
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {([
          { id: 'slider', label: 'Price Stick', icon: Sliders },
          { id: 'candles', label: 'Candle Builder', icon: CandlestickChart },
          { id: 'history', label: 'Seed History', icon: History },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id ? 'border-gold text-gold' : 'border-transparent text-slate-400 hover:text-cream'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* SLIDER TAB */}
      {activeTab === 'slider' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-2xl border border-white/10 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gold/20 rounded-xl flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-cream">Price Stick</h2>
                  <p className="text-xs text-cream/50">Drag to move price in real-time</p>
                </div>
              </div>

              <button
                onClick={toggleTrading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
                  isTradingPaused ? 'bg-profit text-void' : 'bg-loss text-white'
                }`}
              >
                {isTradingPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isTradingPaused ? 'Resume' : 'Pause'}
              </button>
            </div>

            <div className="p-5 bg-charcoal rounded-xl">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xs text-cream/50 mb-1">Bid</p>
                  <p className="text-3xl font-mono text-loss font-bold">{currentPrice?.bid.toFixed(5) || '—'}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-cream/50 mb-1">Ask</p>
                  <p className="text-3xl font-mono text-profit font-bold">{currentPrice?.ask.toFixed(5) || '—'}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10 text-center">
                <p className="text-xs text-cream/50">Spread: {(effectiveSpread * 10000).toFixed(1)} pips</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-cream/60">Adjustment Slider</p>
                <p className="text-sm text-gold font-mono">
                  {sliderValue > 0 ? '+' : ''}
                  {sliderValue.toFixed(2)}%
                </p>
              </div>

              <input
                type="range"
                min="-5"
                max="5"
                step="0.01"
                value={sliderValue}
                onChange={handleSliderMove}
                onMouseUp={() => setSliderValue(0)}
                onTouchEnd={() => setSliderValue(0)}
                className="w-full h-3 appearance-none bg-gradient-to-r from-loss via-white/20 to-profit rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-gold [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/50"
              />

              <div className="flex justify-between text-xs text-cream/30">
                <span>-5%</span>
                <span>0</span>
                <span>+5%</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-cream/60 mb-2">Target Price (exact)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.00001"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder={currentPrice?.bid.toFixed(5) || '1.00000'}
                  className="flex-1 px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-gold"
                />
                <button
                  onClick={handleSetTargetPrice}
                  className="px-6 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-cream/50 mb-2">Quick Pips</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 5, 10, 25, 50, 100, 250, 500].map((pips) => (
                  <div key={pips} className="flex gap-1">
                    <button
                      onClick={() => quickPriceAdjust('down', pips)}
                      className="flex-1 py-2 bg-loss/20 text-loss text-xs font-bold rounded-lg hover:bg-loss/30"
                    >
                      -{pips}
                    </button>
                    <button
                      onClick={() => quickPriceAdjust('up', pips)}
                      className="flex-1 py-2 bg-profit/20 text-profit text-xs font-bold rounded-lg hover:bg-profit/30"
                    >
                      +{pips}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-cream/50 mb-2">Big Moves (%)</p>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 5, 10, 15, 25].map((pct) => (
                  <div key={pct} className="flex gap-1">
                    <button
                      onClick={() => bigPriceMove('down', pct)}
                      className="flex-1 py-2 bg-loss/10 text-loss text-xs font-bold rounded-lg hover:bg-loss/20"
                    >
                      -{pct}%
                    </button>
                    <button
                      onClick={() => bigPriceMove('up', pct)}
                      className="flex-1 py-2 bg-profit/10 text-profit text-xs font-bold rounded-lg hover:bg-profit/20"
                    >
                      +{pct}%
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-electric/20 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-electric" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-cream">Auto Candle Builder</h2>
                  <p className="text-xs text-cream/50">Saves OHLC every {candleInterval}m from your moves</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-charcoal rounded-xl mb-4">
                <div>
                  <p className="text-sm text-cream font-medium">Auto-save candles</p>
                  <p className="text-xs text-cream/50">Records price movements as candles</p>
                </div>
                <button
                  onClick={() => setAutoCandleEnabled(!autoCandleEnabled)}
                  className={`w-14 h-7 rounded-full transition-colors relative ${autoCandleEnabled ? 'bg-profit' : 'bg-white/20'}`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${autoCandleEnabled ? 'left-8' : 'left-1'}`}
                  />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-xs text-cream/50 mb-2">Candle Interval</p>
                <div className="flex gap-2">
                  {[1, 3, 5, 15, 30].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setCandleInterval(mins)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                        candleInterval === mins ? 'bg-gold text-void' : 'bg-white/5 text-cream/60 hover:text-cream'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {liveCandle && autoCandleEnabled && (
                <div className="p-4 bg-void/50 rounded-xl border border-electric/20">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-electric font-medium flex items-center gap-1">
                      <span className="w-2 h-2 bg-electric rounded-full animate-pulse" />
                      Building Candle...
                    </p>
                    <p className="text-xs text-cream/50">{timeRemaining} left</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] text-cream/40">O</p>
                      <p className="text-sm font-mono text-cream">{liveCandle.open.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-profit">H</p>
                      <p className="text-sm font-mono text-profit">{liveCandle.high.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-loss">L</p>
                      <p className="text-sm font-mono text-loss">{liveCandle.low.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-cream/40">C</p>
                      <p className="text-sm font-mono text-cream">{liveCandle.close.toFixed(4)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-cream">Saved Candles ({pairCandles.length})</h3>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-loss hover:text-loss/80 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>

              {pairCandles.length === 0 ? (
                <div className="text-center py-6 text-cream/30">
                  <CandlestickChart className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-xs">No candles yet</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {pairCandles
                    .slice(-8)
                    .reverse()
                    .map((candle: CandleLike) => {
                      const isGreen = candle.close >= candle.open;
                      const d = msToDate(candle.timestamp);
                      return (
                        <div
                          key={candle.id ?? `${d.toISOString()}-${candle.open}-${candle.close}`}
                          className="flex items-center justify-between text-xs py-1.5 border-b border-white/5"
                        >
                          <span className="text-cream/50 w-16">{d.toLocaleTimeString()}</span>
                          <span className="font-mono text-cream">O:{candle.open.toFixed(4)}</span>
                          <span className="font-mono text-profit">H:{candle.high.toFixed(4)}</span>
                          <span className="font-mono text-loss">L:{candle.low.toFixed(4)}</span>
                          <span className="font-mono text-cream">C:{candle.close.toFixed(4)}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              isGreen ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                            }`}
                          >
                            {isGreen ? '▲' : '▼'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANDLES TAB */}
      {activeTab === 'candles' && (
        <div className="max-w-2xl mx-auto bg-white/5 rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <CandlestickChart className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-cream">Manual Candle Builder</h2>
              <p className="text-sm text-cream/50">Add individual candles for precise control</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: 'Open', value: candleOpen, setter: setCandleOpen, color: 'focus:border-cream' },
              { label: 'High', value: candleHigh, setter: setCandleHigh, color: 'focus:border-profit' },
              { label: 'Low', value: candleLow, setter: setCandleLow, color: 'focus:border-loss' },
              { label: 'Close', value: candleClose, setter: setCandleClose, color: 'focus:border-gold' },
            ].map(({ label, value, setter, color }) => (
              <div key={label}>
                <label className="block text-sm text-cream/50 mb-2">{label}</label>
                <input
                  type="number"
                  step="0.00001"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={currentPrice?.bid.toFixed(5) || '1.00000'}
                  className={`w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream font-mono focus:outline-none ${color}`}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (!candleOpen) {
                const mid = currentPrice ? (currentPrice.bid + currentPrice.ask) / 2 : 1;
                setCandleOpen(mid.toFixed(5));
                setCandleHigh((mid + 0.001).toFixed(5));
                setCandleLow((mid - 0.001).toFixed(5));
                setCandleClose(mid.toFixed(5));
              }
            }}
            className="w-full py-2.5 mb-3 bg-white/5 text-cream/60 text-sm rounded-xl hover:bg-white/10"
          >
            Fill with current price
          </button>

          <button onClick={handleAddCandle} className="w-full py-3 bg-profit text-void font-semibold rounded-xl hover:bg-profit/90">
            Add Candle to Chart
          </button>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-cream font-medium">History Seeding</p>
                  <p className="text-xs text-yellow-500/80">
                    Adds 30-50 candles to create chart patterns. Only seed if you want history.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSeedEnabled(!seedEnabled)}
                className={`w-14 h-7 rounded-full transition-colors relative ${seedEnabled ? 'bg-yellow-500' : 'bg-white/20'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${seedEnabled ? 'left-8' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {seedEnabled ? (
            <>
              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-cream mb-4">Select Pattern</h3>
                <div className="space-y-3">
                  {patternOptions.map((pattern) => (
                    <button
                      key={pattern.id}
                      onClick={() => setSelectedPattern(pattern.id)}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        selectedPattern === pattern.id ? 'bg-gold/10 border-gold/40' : 'bg-charcoal border-white/10 hover:border-gold/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{pattern.icon}</span>
                          <div>
                            <p className="font-medium text-cream">{pattern.name}</p>
                            <p className="text-sm text-cream/50">{pattern.description}</p>
                          </div>
                        </div>
                        {selectedPattern === pattern.id && <CheckCircle className="w-5 h-5 text-gold" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
                <div className="mb-4">
                  <label className="block text-sm text-cream/50 mb-2">Base Price</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={patternBasePrice}
                    onChange={(e) => setPatternBasePrice(e.target.value)}
                    placeholder={(currentPrice?.bid || selectedPair.basePrice).toFixed(4)}
                    className="w-full px-4 py-3 bg-void/50 border border-white/10 rounded-xl text-cream font-mono focus:outline-none focus:border-gold"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleClearHistory}
                    className="flex-1 py-3 bg-loss/20 text-loss font-semibold rounded-xl hover:bg-loss/30 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Clear History
                  </button>
                  <button
                    onClick={handleSeedHistory}
                    className="flex-1 py-3 bg-gold text-void font-semibold rounded-xl hover:bg-gold/90 flex items-center justify-center gap-2"
                  >
                    <Database className="w-4 h-4" /> Seed Pattern
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-cream/30">
              <History className="w-12 h-12 mx-auto mb-3" />
              <p>Enable seeding above to create chart patterns</p>
              <p className="text-sm mt-1">History is optional — only seed if needed</p>
            </div>
          )}
        </div>
      )}

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 ${
              notification.type === 'success' ? 'bg-profit text-void' : 'bg-loss text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
