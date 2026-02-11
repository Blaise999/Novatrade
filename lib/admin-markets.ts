// lib/admin-markets.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ============================================
// HYBRID MARKET ARCHITECTURE
// ============================================
// - Standard pairs: Real market data (simulated here)
// - Admin-controlled pairs: Rare/exotic FX (local store)
// ============================================

// ✅ admin-controlled rare pairs (NO NGN)
export const ADMIN_CONTROLLED_PAIRS = [
  'USD/TRY',
  'USD/ZAR',
  'USD/BRL',
  'USD/MXN',
  'USD/PLN',
  'USD/ISK',
] as const;

export type AdminControlledPair = (typeof ADMIN_CONTROLLED_PAIRS)[number];

// ✅ type guard (better than boolean include)
export function isAdminControlledPair(symbol: string): symbol is AdminControlledPair {
  return (ADMIN_CONTROLLED_PAIRS as readonly string[]).includes(symbol);
}

// ✅ Candle format used across the app (serializable + FX page friendly)
export interface OHLCCandle {
  id: string;
  pairId: string;
  timestamp: number; // ms since epoch (NOT Date) => safe for persist + no TS instanceof drama
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isSimulated?: boolean;
}

// Alias for backward compatibility
export type Candle = OHLCCandle;

// Pair configuration
export interface CustomPair {
  id: string; // should equal symbol (e.g., "USD/TRY")
  symbol: string;
  name: string;
  description: string;
  basePrice: number;
  pipSize: number;
  leverageMax: number;
  spreadPips: number;
  isActive: boolean;
}

// Price data (serializable)
export interface PriceData {
  bid: number;
  ask: number;
  timestamp: number; // ms since epoch
}

// ✅ Initial rare pairs (admin-controlled)
const initialCustomPairs: CustomPair[] = [
  {
    id: 'USD/TRY',
    symbol: 'USD/TRY',
    name: 'US Dollar / Turkish Lira',
    description: 'Exotic FX pair (high volatility / wider spreads)',
    basePrice: 32.15,
    pipSize: 0.0001,
    leverageMax: 50,
    spreadPips: 25,
    isActive: true,
  },
  {
    id: 'USD/ZAR',
    symbol: 'USD/ZAR',
    name: 'US Dollar / South African Rand',
    description: 'Exotic FX pair (EM volatility / commodity sensitivity)',
    basePrice: 19.05,
    pipSize: 0.0001,
    leverageMax: 50,
    spreadPips: 18,
    isActive: true,
  },
  {
    id: 'USD/BRL',
    symbol: 'USD/BRL',
    name: 'US Dollar / Brazilian Real',
    description: 'Exotic FX pair (bigger intraday ranges)',
    basePrice: 4.95,
    pipSize: 0.0001,
    leverageMax: 50,
    spreadPips: 12,
    isActive: true,
  },
  {
    id: 'USD/MXN',
    symbol: 'USD/MXN',
    name: 'US Dollar / Mexican Peso',
    description: 'Exotic FX pair (often liquid, still volatile)',
    basePrice: 17.12,
    pipSize: 0.0001,
    leverageMax: 75,
    spreadPips: 10,
    isActive: true,
  },
  {
    id: 'USD/PLN',
    symbol: 'USD/PLN',
    name: 'US Dollar / Polish Zloty',
    description: 'Less common Europe pair (risk-on/risk-off swings)',
    basePrice: 4.01,
    pipSize: 0.0001,
    leverageMax: 75,
    spreadPips: 8,
    isActive: true,
  },
  {
    id: 'USD/ISK',
    symbol: 'USD/ISK',
    name: 'US Dollar / Icelandic Krona',
    description: 'Very rare pair (low liquidity; larger spreads)',
    basePrice: 138.2,
    pipSize: 0.01, // ISK-style quoting
    leverageMax: 25,
    spreadPips: 30,
    isActive: true,
  },
];

// ---------- small utils ----------
const generateId = () => `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const toNum = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const toTimestamp = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') {
    const asNum = Number(v);
    if (Number.isFinite(asNum)) return asNum;
    const d = new Date(v);
    const t = d.getTime();
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
};

export type CandleInput = Omit<OHLCCandle, 'id' | 'pairId' | 'timestamp'> & {
  timestamp: number | Date | string;
  isSimulated?: boolean;
};

// Admin market store state
interface AdminMarketState {
  customPairs: CustomPair[];

  // Price data for admin-controlled pairs
  currentPrices: Record<string, PriceData>;

  // Historical candles for admin-controlled pairs
  candles: Record<string, OHLCCandle[]>;

  // ✅ Per-pair pause map
  isPaused: Record<string, boolean>;

  // Actions
  setCurrentPrice: (pairId: string, bid: number, ask: number) => void;
  pauseTrading: (pairId: string) => void;
  resumeTrading: (pairId: string) => void;

  addCandle: (pairId: string, candle: CandleInput) => void;
  editCandle: (pairId: string, candleId: string, updates: Partial<OHLCCandle>) => void;
  deleteCandle: (pairId: string, candleId: string) => void;
  clearCandles: (pairId: string) => void;

  // Pattern generators
  generateBullFlag: (pairId: string, basePrice: number, opts?: { clearFirst?: boolean }) => void;
  generateHeadAndShoulders: (pairId: string, basePrice: number, opts?: { clearFirst?: boolean }) => void;
  generateDoubleBottom: (pairId: string, basePrice: number, opts?: { clearFirst?: boolean }) => void;
  generateBreakout: (
    pairId: string,
    basePrice: number,
    direction: 'up' | 'down',
    opts?: { clearFirst?: boolean }
  ) => void;
}

// Generate initial prices
const generateInitialPrices = (): Record<string, PriceData> => {
  const prices: Record<string, PriceData> = {};
  for (const pair of initialCustomPairs) {
    const spread = pair.spreadPips * pair.pipSize;
    prices[pair.id] = {
      bid: pair.basePrice,
      ask: pair.basePrice + spread,
      timestamp: Date.now(),
    };
  }
  return prices;
};

// Generate initial pause state
const generateInitialPauseState = (): Record<string, boolean> => {
  const state: Record<string, boolean> = {};
  for (const pair of initialCustomPairs) state[pair.id] = false;
  return state;
};

// Generate initial empty candles
const generateInitialCandles = (): Record<string, OHLCCandle[]> => {
  const out: Record<string, OHLCCandle[]> = {};
  for (const pair of initialCustomPairs) out[pair.id] = [];
  return out;
};

// ✅ safe storage (won’t crash on server)
const safeSessionStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(name);
  },
};

const ALLOWED_ADMIN_KEYS = new Set<string>(initialCustomPairs.map((p) => p.id));

export const useAdminMarketStore = create<AdminMarketState>()(
  persist(
    (set, get) => ({
      customPairs: initialCustomPairs,
      currentPrices: generateInitialPrices(),
      candles: generateInitialCandles(),
      isPaused: generateInitialPauseState(),

      setCurrentPrice: (pairId, bid, ask) => {
        const b = toNum(bid);
        const a = toNum(ask);
        if (!Number.isFinite(b) || !Number.isFinite(a)) return;

        set((state) => ({
          currentPrices: {
            ...state.currentPrices,
            [pairId]: { bid: b, ask: a, timestamp: Date.now() },
          },
        }));
      },

      pauseTrading: (pairId) => {
        set((state) => ({
          isPaused: { ...state.isPaused, [pairId]: true },
        }));
      },

      resumeTrading: (pairId) => {
        set((state) => ({
          isPaused: { ...state.isPaused, [pairId]: false },
        }));
      },

      addCandle: (pairId, candle) => {
        const newCandle: OHLCCandle = {
          id: generateId(),
          pairId,
          timestamp: toTimestamp(candle.timestamp),
          open: toNum(candle.open),
          high: toNum(candle.high),
          low: toNum(candle.low),
          close: toNum(candle.close),
          volume: toNum(candle.volume, 0),
          isSimulated: !!candle.isSimulated,
        };

        // basic sanity
        if (
          !Number.isFinite(newCandle.open) ||
          !Number.isFinite(newCandle.high) ||
          !Number.isFinite(newCandle.low) ||
          !Number.isFinite(newCandle.close)
        ) {
          return;
        }

        set((state) => ({
          candles: {
            ...state.candles,
            [pairId]: [...(state.candles[pairId] || []), newCandle].slice(-500),
          },
        }));
      },

      editCandle: (pairId, candleId, updates) => {
        set((state) => ({
          candles: {
            ...state.candles,
            [pairId]: (state.candles[pairId] || []).map((c) => {
              if (c.id !== candleId) return c;

              const next: OHLCCandle = {
                ...c,
                ...updates,
                timestamp: updates.timestamp ? toTimestamp(updates.timestamp) : c.timestamp,
                open: updates.open !== undefined ? toNum(updates.open) : c.open,
                high: updates.high !== undefined ? toNum(updates.high) : c.high,
                low: updates.low !== undefined ? toNum(updates.low) : c.low,
                close: updates.close !== undefined ? toNum(updates.close) : c.close,
                volume: updates.volume !== undefined ? toNum(updates.volume) : c.volume,
              };

              return next;
            }),
          },
        }));
      },

      deleteCandle: (pairId, candleId) => {
        set((state) => ({
          candles: {
            ...state.candles,
            [pairId]: (state.candles[pairId] || []).filter((c) => c.id !== candleId),
          },
        }));
      },

      clearCandles: (pairId) => {
        set((state) => ({
          candles: {
            ...state.candles,
            [pairId]: [],
          },
        }));
      },

      // ---------------------------
      // PATTERN GENERATORS
      // ---------------------------
      generateBullFlag: (pairId, basePrice, opts) => {
        const { addCandle, setCurrentPrice, clearCandles } = get();
        if (opts?.clearFirst) clearCandles(pairId);

        const candles: CandleInput[] = [];
        let t = Date.now() - 20 * 60_000;
        let price = basePrice;

        // Phase 1: Strong upward move (5)
        for (let i = 0; i < 5; i++) {
          const change = basePrice * 0.003 * (1 + Math.random() * 0.5);
          const open = price;
          const close = price + change;
          const high = close + basePrice * 0.001 * Math.random();
          const low = open - basePrice * 0.0005 * Math.random();

          candles.push({ timestamp: t, open, high, low, close, volume: 50_000 + Math.random() * 50_000 });
          price = close;
          t += 60_000;
        }

        // Phase 2: Consolidation/Flag (8)
        const flagTop = price;
        const flagBottom = price - basePrice * 0.008;

        for (let i = 0; i < 8; i++) {
          const open = price;
          const direction = i % 2 === 0 ? -1 : 1;
          const change = basePrice * 0.002 * direction * (0.5 + Math.random() * 0.5);
          let close = price + change;
          close = Math.max(flagBottom, Math.min(flagTop, close));
          const high = Math.max(open, close) + basePrice * 0.001 * Math.random();
          const low = Math.min(open, close) - basePrice * 0.001 * Math.random();

          candles.push({ timestamp: t, open, high, low, close, volume: 20_000 + Math.random() * 30_000 });
          price = close;
          t += 60_000;
        }

        // Phase 3: Breakout (5)
        for (let i = 0; i < 5; i++) {
          const change = basePrice * 0.004 * (1 + Math.random() * 0.5);
          const open = price;
          const close = price + change;
          const high = close + basePrice * 0.002 * Math.random();
          const low = open - basePrice * 0.001 * Math.random();

          candles.push({ timestamp: t, open, high, low, close, volume: 60_000 + Math.random() * 40_000 });
          price = close;
          t += 60_000;
        }

        candles.forEach((c) => addCandle(pairId, { ...c, isSimulated: true }));
        const last = candles[candles.length - 1];
        setCurrentPrice(pairId, last.close, last.close + basePrice * 0.0002);
      },

      generateHeadAndShoulders: (pairId, basePrice, opts) => {
        const { addCandle, setCurrentPrice, clearCandles } = get();
        if (opts?.clearFirst) clearCandles(pairId);

        const candles: CandleInput[] = [];
        let t = Date.now() - 25 * 60_000;
        let price = basePrice;

        const push = (open: number, close: number, volBase: number) => {
          const high = Math.max(open, close) + basePrice * 0.001 * Math.random();
          const low = Math.min(open, close) - basePrice * 0.001 * Math.random();
          candles.push({ timestamp: t, open, high, low, close, volume: volBase + Math.random() * volBase });
          price = close;
          t += 60_000;
        };

        // Left shoulder (5 up, 3 down)
        for (let i = 0; i < 5; i++) push(price, price + basePrice * 0.002 * (1 + Math.random() * 0.3), 40_000);
        for (let i = 0; i < 3; i++) push(price, price - basePrice * 0.002 * (1 + Math.random() * 0.3), 30_000);

        // Head (6 up, 4 down)
        for (let i = 0; i < 6; i++) push(price, price + basePrice * 0.003 * (1 + Math.random() * 0.3), 50_000);
        for (let i = 0; i < 4; i++) push(price, price - basePrice * 0.003 * (1 + Math.random() * 0.3), 35_000);

        // Right shoulder (4 up, 5 breakdown)
        for (let i = 0; i < 4; i++) push(price, price + basePrice * 0.0015 * (1 + Math.random() * 0.3), 25_000);
        for (let i = 0; i < 5; i++) push(price, price - basePrice * 0.004 * (1 + Math.random() * 0.5), 55_000);

        candles.forEach((c) => addCandle(pairId, { ...c, isSimulated: true }));
        const last = candles[candles.length - 1];
        setCurrentPrice(pairId, last.close, last.close + basePrice * 0.0002);
      },

      generateDoubleBottom: (pairId, basePrice, opts) => {
        const { addCandle, setCurrentPrice, clearCandles } = get();
        if (opts?.clearFirst) clearCandles(pairId);

        const candles: CandleInput[] = [];
        let t = Date.now() - 22 * 60_000;
        let price = basePrice;

        const push = (open: number, close: number, volBase: number) => {
          const high = Math.max(open, close) + basePrice * 0.001 * Math.random();
          const low = Math.min(open, close) - basePrice * 0.001 * Math.random();
          candles.push({ timestamp: t, open, high, low, close, volume: volBase + Math.random() * volBase });
          price = close;
          t += 60_000;
        };

        // Drop (5)
        for (let i = 0; i < 5; i++) push(price, price - basePrice * 0.003 * (1 + Math.random() * 0.3), 40_000);
        const bottom = price;

        // Bounce (4)
        for (let i = 0; i < 4; i++) push(price, price + basePrice * 0.002 * (1 + Math.random() * 0.3), 30_000);

        // Retest (4)
        for (let i = 0; i < 4; i++) {
          let close = price - basePrice * 0.002 * (1 + Math.random() * 0.3);
          if (i === 3) close = bottom + basePrice * 0.001;
          push(price, close, 35_000);
        }

        // Rally (6)
        for (let i = 0; i < 6; i++) push(price, price + basePrice * 0.004 * (1 + Math.random() * 0.5), 55_000);

        candles.forEach((c) => addCandle(pairId, { ...c, isSimulated: true }));
        const last = candles[candles.length - 1];
        setCurrentPrice(pairId, last.close, last.close + basePrice * 0.0002);
      },

      generateBreakout: (pairId, basePrice, direction, opts) => {
        const { addCandle, setCurrentPrice, clearCandles } = get();
        if (opts?.clearFirst) clearCandles(pairId);

        const candles: CandleInput[] = [];
        let t = Date.now() - 18 * 60_000;
        let price = basePrice;
        const top = basePrice * 1.005;
        const bot = basePrice * 0.995;

        // Consolidation (12)
        for (let i = 0; i < 12; i++) {
          const open = price;
          const dir = Math.random() > 0.5 ? 1 : -1;
          let close = price + dir * basePrice * 0.002 * Math.random();
          close = Math.max(bot, Math.min(top, close));
          const high = Math.max(open, close) + basePrice * 0.001 * Math.random();
          const low = Math.min(open, close) - basePrice * 0.001 * Math.random();

          candles.push({ timestamp: t, open, high, low, close, volume: 20_000 + Math.random() * 25_000 });
          price = close;
          t += 60_000;
        }

        // Breakout (6)
        for (let i = 0; i < 6; i++) {
          const change = basePrice * 0.005 * (1 + Math.random() * 0.5);
          const open = price;
          const close = direction === 'up' ? price + change : price - change;
          const high =
            direction === 'up'
              ? close + basePrice * 0.002 * Math.random()
              : open + basePrice * 0.001 * Math.random();
          const low =
            direction === 'up'
              ? open - basePrice * 0.001 * Math.random()
              : close - basePrice * 0.002 * Math.random();

          candles.push({ timestamp: t, open, high, low, close, volume: 60_000 + Math.random() * 50_000 });
          price = close;
          t += 60_000;
        }

        candles.forEach((c) => addCandle(pairId, { ...c, isSimulated: true }));
        const last = candles[candles.length - 1];
        setCurrentPrice(pairId, last.close, last.close + basePrice * 0.0002);
      },
    }),
    {
      name: 'admin-markets-storage',
      version: 3, // ✅ bump to force fresh migrate away from NOVA/DEMO/TRD
      storage: createJSONStorage(() => safeSessionStorage),
      partialize: (state) => ({
        customPairs: state.customPairs,
        candles: state.candles,
        currentPrices: state.currentPrices,
        isPaused: state.isPaused,
      }),
      migrate: (persisted: any) => {
        // ✅ prune old stored pairs + normalize timestamps
        const next = persisted ?? {};

        // candles
        const rawCandles = (next.candles ?? {}) as Record<string, any[]>;
        const fixedCandles: Record<string, OHLCCandle[]> = {};
        for (const pair of initialCustomPairs) fixedCandles[pair.id] = [];

        for (const k of Object.keys(rawCandles)) {
          if (!ALLOWED_ADMIN_KEYS.has(k)) continue;
          const arr = Array.isArray(rawCandles[k]) ? rawCandles[k] : [];
          fixedCandles[k] = arr
            .map((c) => ({
              id: String(c?.id ?? generateId()),
              pairId: String(c?.pairId ?? k),
              timestamp: toTimestamp(c?.timestamp),
              open: toNum(c?.open),
              high: toNum(c?.high),
              low: toNum(c?.low),
              close: toNum(c?.close),
              volume: toNum(c?.volume, 0),
              isSimulated: !!c?.isSimulated,
            }))
            .filter(
              (c) =>
                Number.isFinite(c.open) &&
                Number.isFinite(c.high) &&
                Number.isFinite(c.low) &&
                Number.isFinite(c.close)
            )
            .slice(-500);
        }

        // prices
        const rawPrices = (next.currentPrices ?? {}) as Record<string, any>;
        const fixedPrices: Record<string, PriceData> = generateInitialPrices();
        for (const k of Object.keys(rawPrices)) {
          if (!ALLOWED_ADMIN_KEYS.has(k)) continue;
          fixedPrices[k] = {
            bid: toNum(rawPrices[k]?.bid, fixedPrices[k]?.bid ?? 0),
            ask: toNum(rawPrices[k]?.ask, fixedPrices[k]?.ask ?? 0),
            timestamp: toTimestamp(rawPrices[k]?.timestamp),
          };
        }

        // pause
        const rawPaused = (next.isPaused ?? {}) as Record<string, any>;
        const fixedPaused: Record<string, boolean> = generateInitialPauseState();
        for (const k of Object.keys(rawPaused)) {
          if (!ALLOWED_ADMIN_KEYS.has(k)) continue;
          fixedPaused[k] = !!rawPaused[k];
        }

        return {
          ...next,
          customPairs: initialCustomPairs,
          candles: fixedCandles,
          currentPrices: fixedPrices,
          isPaused: fixedPaused,
        };
      },
    }
  )
);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Base price for any symbol (standard + admin rare)
function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    // Majors (for simulated "real" list)
    'EUR/USD': 1.085,
    'GBP/USD': 1.265,
    'USD/JPY': 149.5,
    'AUD/USD': 0.658,
    'USD/CAD': 1.345,
    'USD/CHF': 0.895,
    'NZD/USD': 0.615,

    // ✅ Rare admin pairs
    'USD/TRY': 32.15,
    'USD/ZAR': 19.05,
    'USD/BRL': 4.95,
    'USD/MXN': 17.12,
    'USD/PLN': 4.01,
    'USD/ISK': 138.2,
  };

  return prices[symbol] || 1.0;
}

// Fetch simulated “real” market data
export async function fetchRealMarketData(
  symbol: string,
  timeframe: string = '1m',
  limit: number = 100
): Promise<Candle[]> {
  const candles: Candle[] = [];
  const base = getBasePrice(symbol);

  // timeframe ignored here (you can scale step later)
  for (let i = limit; i > 0; i--) {
    const ts = Date.now() - i * 60_000;

    // Slightly larger move for exotics
    const exoticBoost = symbol.includes('TRY') || symbol.includes('ZAR') || symbol.includes('ISK') ? 3 : 1;
    const volatility = 0.0002 * exoticBoost;
    const trend = Math.sin(i * 0.1) * 0.001;

    const open = base * (1 + trend + (Math.random() - 0.5) * volatility);
    const close = open * (1 + (Math.random() - 0.5) * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);

    candles.push({
      id: `real_${symbol}_${i}`,
      pairId: symbol,
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume: Math.random() * 10_000_000,
      isSimulated: true,
    });
  }

  return candles;
}

// Get market data - decides between admin store or simulated real data
export async function getMarketData(
  symbol: string,
  timeframe: string = '1m',
  limit: number = 100
): Promise<{ candles: Candle[]; isAdminControlled: boolean }> {
  if (isAdminControlledPair(symbol)) {
    const store = useAdminMarketStore.getState();
    const arr = store.candles[symbol] || [];
    return { candles: arr, isAdminControlled: true };
  }

  const candles = await fetchRealMarketData(symbol, timeframe, limit);
  return { candles, isAdminControlled: false };
}
