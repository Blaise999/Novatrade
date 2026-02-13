// lib/admin-markets.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeSessionStorage } from '@/lib/zustandStorage';


export type TimestampInput = number | Date | string | null | undefined;

export function toTimestamp(input: TimestampInput): number {
  // Canonical: ms since epoch
  if (typeof input === 'number' && Number.isFinite(input)) {
    // If someone passed seconds (10 digits-ish), convert to ms
    if (input > 0 && input < 1e12) return Math.round(input * 1000);
    return Math.round(input);
  }

  if (input instanceof Date) {
    const ms = input.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();

    // numeric string
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      if (Number.isFinite(n)) {
        if (n > 0 && n < 1e12) return Math.round(n * 1000);
        return Math.round(n);
      }
    }

    // ISO / date string
    const d = new Date(trimmed);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : Date.now();
  }

  return Date.now();
}

export interface CustomPair {
  id: string;      // stable key used everywhere
  symbol: string;  // display symbol
  name: string;
  basePrice: number;
}

export interface OHLCCandle {
  id: string;
  timestamp: number; // ✅ ms since epoch (persist-safe)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Some pages import `Candle` for charts
export type Candle = OHLCCandle;

type PriceQuote = { bid: number; ask: number };

type CandleDraft = Omit<OHLCCandle, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: TimestampInput;
};

type CandlePatch = Partial<OHLCCandle> & {
  timestamp?: TimestampInput;
};

function clampNum(n: unknown, fallback = 0): number {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function newId(): string {
  // stable enough for UI keys
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeCandleDraft(draft: CandleDraft): OHLCCandle {
  const ts = toTimestamp(draft.timestamp);
  const o = clampNum(draft.open);
  const h = clampNum(draft.high);
  const l = clampNum(draft.low);
  const c = clampNum(draft.close);
  const v = clampNum(draft.volume);

  return {
    id: draft.id ?? newId(),
    timestamp: ts,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
  };
}

function sortByTimestampAsc(a: OHLCCandle, b: OHLCCandle) {
  return a.timestamp - b.timestamp;
}

interface AdminMarketStore {
  customPairs: CustomPair[];
  candles: Record<string, OHLCCandle[]>;
  currentPrices: Record<string, PriceQuote>;
  isPaused: Record<string, boolean>;

  setCurrentPrice: (pairId: string, bid: number, ask: number) => void;
  pauseTrading: (pairId: string) => void;
  resumeTrading: (pairId: string) => void;

  addCandle: (pairId: string, candle: CandleDraft) => void;
  editCandle: (pairId: string, candleId: string, patch: CandlePatch) => void;
  clearCandles: (pairId: string) => void;

  generateBullFlag: (pairId: string, basePrice: number) => void;
  generateHeadAndShoulders: (pairId: string, basePrice: number) => void;
  generateDoubleBottom: (pairId: string, basePrice: number) => void;
  generateBreakout: (pairId: string, basePrice: number, dir: 'up' | 'down') => void;
}

export const useAdminMarketStore = create<AdminMarketStore>()(
  persist(
    (set, get) => ({
      customPairs: [
        { id: 'DEMO/USD', symbol: 'DEMO/USD', name: 'Demo Pair', basePrice: 1 },
      ],

      candles: {},
      currentPrices: {},
      isPaused: {},

      setCurrentPrice: (pairId, bid, ask) => {
        const b = clampNum(bid);
        const a = clampNum(ask);
        set((s) => ({
          currentPrices: { ...s.currentPrices, [pairId]: { bid: b, ask: a } },
        }));
      },

      pauseTrading: (pairId) => {
        set((s) => ({ isPaused: { ...s.isPaused, [pairId]: true } }));
      },

      resumeTrading: (pairId) => {
        set((s) => ({ isPaused: { ...s.isPaused, [pairId]: false } }));
      },

      addCandle: (pairId, candleDraft) => {
        const candle = normalizeCandleDraft(candleDraft);

        set((s) => {
          const prev = s.candles[pairId] ?? [];
          const next = [...prev, candle].sort(sortByTimestampAsc);

          // keep it sane
          const trimmed = next.length > 600 ? next.slice(-600) : next;

          return { candles: { ...s.candles, [pairId]: trimmed } };
        });
      },

      editCandle: (pairId, candleId, patch) => {
        set((s) => {
          const prev = s.candles[pairId] ?? [];
          if (!prev.length) return s;

          const next = prev.map((c) => {
            if (c.id !== candleId) return c;

            const ts = patch.timestamp !== undefined ? toTimestamp(patch.timestamp) : c.timestamp;

            return {
              ...c,
              ...patch,
              timestamp: ts, // ✅ always number
              open: patch.open !== undefined ? clampNum(patch.open, c.open) : c.open,
              high: patch.high !== undefined ? clampNum(patch.high, c.high) : c.high,
              low: patch.low !== undefined ? clampNum(patch.low, c.low) : c.low,
              close: patch.close !== undefined ? clampNum(patch.close, c.close) : c.close,
              volume: patch.volume !== undefined ? clampNum(patch.volume, c.volume) : c.volume,
            };
          });

          next.sort(sortByTimestampAsc);

          return { candles: { ...s.candles, [pairId]: next } };
        });
      },

      clearCandles: (pairId) => {
        set((s) => ({ candles: { ...s.candles, [pairId]: [] } }));
      },

      generateBullFlag: (pairId, basePrice) => {
        const now = Date.now();
        const intervalMs = 5 * 60 * 1000;

        const start = basePrice;
        const up1 = start * 1.02;
        const up2 = start * 1.04;

        const candles: OHLCCandle[] = [];

        // pump up
        for (let i = 0; i < 12; i++) {
          const t = now - (30 - i) * intervalMs;
          const o = start + (up1 - start) * (i / 11);
          const c = o + (Math.random() * 0.0006);
          candles.push({
            id: newId(),
            timestamp: t,
            open: o,
            high: Math.max(o, c) + Math.random() * 0.0008,
            low: Math.min(o, c) - Math.random() * 0.0006,
            close: c,
            volume: 800 + Math.random() * 1200,
          });
        }

        // flag consolidation
        for (let i = 0; i < 10; i++) {
          const t = now - (18 - i) * intervalMs;
          const center = up1;
          const wiggle = (Math.random() - 0.5) * 0.002;
          const o = center + wiggle;
          const c = center + (Math.random() - 0.5) * 0.002;
          candles.push({
            id: newId(),
            timestamp: t,
            open: o,
            high: Math.max(o, c) + Math.random() * 0.001,
            low: Math.min(o, c) - Math.random() * 0.001,
            close: c,
            volume: 500 + Math.random() * 900,
          });
        }

        // breakout
        for (let i = 0; i < 8; i++) {
          const t = now - (8 - i) * intervalMs;
          const o = up1 + (up2 - up1) * (i / 7);
          const c = o + Math.random() * 0.0012;
          candles.push({
            id: newId(),
            timestamp: t,
            open: o,
            high: Math.max(o, c) + Math.random() * 0.0014,
            low: Math.min(o, c) - Math.random() * 0.0008,
            close: c,
            volume: 900 + Math.random() * 1400,
          });
        }

        candles.sort(sortByTimestampAsc);

        set((s) => ({
          candles: { ...s.candles, [pairId]: candles },
        }));
      },

      generateHeadAndShoulders: (pairId, basePrice) => {
        const now = Date.now();
        const intervalMs = 5 * 60 * 1000;

        const candles: OHLCCandle[] = [];
        const pts = [
          basePrice * 1.01,
          basePrice * 1.03, // left shoulder
          basePrice * 1.02,
          basePrice * 1.05, // head
          basePrice * 1.02,
          basePrice * 1.03, // right shoulder
          basePrice * 1.01,
          basePrice * 0.99, // break
        ];

        for (let i = 0; i < 40; i++) {
          const t = now - (40 - i) * intervalMs;
          const idx = Math.floor((i / 39) * (pts.length - 1));
          const nextIdx = Math.min(idx + 1, pts.length - 1);
          const a = pts[idx];
          const b = pts[nextIdx];
          const p = a + (b - a) * ((i % 5) / 5);

          const o = p + (Math.random() - 0.5) * 0.001;
          const c = p + (Math.random() - 0.5) * 0.001;

          candles.push({
            id: newId(),
            timestamp: t,
            open: o,
            high: Math.max(o, c) + Math.random() * 0.0012,
            low: Math.min(o, c) - Math.random() * 0.0012,
            close: c,
            volume: 600 + Math.random() * 1000,
          });
        }

        candles.sort(sortByTimestampAsc);
        set((s) => ({ candles: { ...s.candles, [pairId]: candles } }));
      },

      generateDoubleBottom: (pairId, basePrice) => {
        const now = Date.now();
        const intervalMs = 5 * 60 * 1000;

        const candles: OHLCCandle[] = [];
        const top = basePrice * 1.02;
        const bot = basePrice * 0.98;

        const path = [
          top,
          bot,
          basePrice * 1.005,
          bot,
          top,
          basePrice * 1.03,
        ];

        for (let i = 0; i < 45; i++) {
          const t = now - (45 - i) * intervalMs;
          const idx = Math.floor((i / 44) * (path.length - 1));
          const nextIdx = Math.min(idx + 1, path.length - 1);
          const a = path[idx];
          const b = path[nextIdx];
          const p = a + (b - a) * ((i % 6) / 6);

          const o = p + (Math.random() - 0.5) * 0.001;
          const c = p + (Math.random() - 0.5) * 0.001;

          candles.push({
            id: newId(),
            timestamp: t,
            open: o,
            high: Math.max(o, c) + Math.random() * 0.001,
            low: Math.min(o, c) - Math.random() * 0.001,
            close: c,
            volume: 650 + Math.random() * 1100,
          });
        }

        candles.sort(sortByTimestampAsc);
        set((s) => ({ candles: { ...s.candles, [pairId]: candles } }));
      },

      generateBreakout: (pairId, basePrice, dir) => {
        const now = Date.now();
        const intervalMs = 5 * 60 * 1000;

        const candles: OHLCCandle[] = [];

        // flat
        for (let i = 0; i < 28; i++) {
          const t = now - (36 - i) * intervalMs;
          const center = basePrice;
          const o = center + (Math.random() - 0.5) * 0.0015;
          const c = center + (Math.random() - 0.5) * 0.0015;

          candles.push({
            id: newId(),
            timestamp: t,
            open: o,
            high: Math.max(o, c) + Math.random() * 0.0012,
            low: Math.min(o, c) - Math.random() * 0.0012,
            close: c,
            volume: 500 + Math.random() * 800,
          });
        }

        // break
        for (let i = 0; i < 10; i++) {
          const t = now - (10 - i) * intervalMs;
          const move = (basePrice * 0.02) * (i / 9) * (dir === 'up' ? 1 : -1);
          const o = basePrice + move;
          const c = o + (Math.random() * 0.001) * (dir === 'up' ? 1 : -1);

          candles.push({
            id: newId(),
            timestamp: t,
            open: o,
            high: Math.max(o, c) + Math.random() * 0.0016,
            low: Math.min(o, c) - Math.random() * 0.0016,
            close: c,
            volume: 900 + Math.random() * 1500,
          });
        }

        candles.sort(sortByTimestampAsc);
        set((s) => ({ candles: { ...s.candles, [pairId]: candles } }));
      },
    }),
    {
      name: 'novatrade_admin_markets_v1',
storage: safeSessionStorage(),
      version: 1,
      partialize: (s) => ({
        customPairs: s.customPairs,
        candles: s.candles,
        currentPrices: s.currentPrices,
        isPaused: s.isPaused,
      }),
    }
  )
);

// Helpers some pages expect
export function isAdminControlledPair(pairId: string): boolean {
  const { customPairs } = useAdminMarketStore.getState();
  return (customPairs ?? []).some((p) => p.id === pairId || p.symbol === pairId);
}

export function getMarketData(pairId: string): {
  price: PriceQuote;
  candles: OHLCCandle[];
  paused: boolean;
} {
  const s = useAdminMarketStore.getState();
  const pair = (s.customPairs ?? []).find((p) => p.id === pairId || p.symbol === pairId);

  const base = pair?.basePrice ?? 1;
  const price = s.currentPrices[pairId] ?? { bid: base, ask: base + 0.0002 };
  const candles = s.candles[pairId] ?? [];
  const paused = !!s.isPaused[pairId];

  return { price, candles, paused };
}
