import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// HYBRID MARKET ARCHITECTURE
// ============================================
// - Standard pairs: Real market data from external APIs
// - Educational pairs: Admin-controlled for teaching
// ============================================

// The 3 admin-controlled educational pairs
export const ADMIN_CONTROLLED_PAIRS = [
  'NOVA/USD',   // Custom educational pair
  'LEARN/USD', // Learning environment pair
  'DEMO/USD',  // Demo trading pair
] as const;

export type AdminControlledPair = typeof ADMIN_CONTROLLED_PAIRS[number];

// Check if a pair is admin-controlled
export function isAdminControlledPair(symbol: string): boolean {
  return ADMIN_CONTROLLED_PAIRS.includes(symbol as AdminControlledPair);
}

// OHLC Candle structure
export interface OHLCCandle {
  id: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Alias for backward compatibility
export type Candle = OHLCCandle;

// Custom pair configuration
export interface CustomPair {
  id: string;
  symbol: string;
  name: string;
  description: string;
  basePrice: number;
  pipSize: number;
  leverageMax: number;
  spreadPips: number;
  isActive: boolean;
}

// Price data
export interface PriceData {
  bid: number;
  ask: number;
  timestamp: Date;
}

// Initial custom pairs
const initialCustomPairs: CustomPair[] = [
  {
    id: 'NOVA/USD',
    symbol: 'NOVA/USD',
    name: 'NOVA Token / US Dollar',
    description: 'Educational trading pair for learning technical analysis',
    basePrice: 1.2500,
    pipSize: 0.0001,
    leverageMax: 100,
    spreadPips: 2,
    isActive: true,
  },
  {
    id: 'LEARN/USD',
    symbol: 'LEARN/USD',
    name: 'LEARN Token / US Dollar',
    description: 'Practice pair for chart pattern recognition',
    basePrice: 0.8500,
    pipSize: 0.0001,
    leverageMax: 50,
    spreadPips: 3,
    isActive: true,
  },
  {
    id: 'DEMO/USD',
    symbol: 'DEMO/USD',
    name: 'DEMO Token / US Dollar',
    description: 'Demonstration pair for live trading sessions',
    basePrice: 2.0000,
    pipSize: 0.0001,
    leverageMax: 200,
    spreadPips: 1,
    isActive: true,
  },
];

// Generate ID
const generateId = () => `candle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Admin market store state
interface AdminMarketState {
  // Custom pairs configuration
  customPairs: CustomPair[];
  
  // Price data for admin-controlled pairs
  currentPrices: Record<string, PriceData>;
  
  // Historical candles for admin-controlled pairs
  candles: Record<string, OHLCCandle[]>;
  
  // Market pause state per pair
  isPaused: Record<string, boolean>;
  
  // Actions
  setCurrentPrice: (pairId: string, bid: number, ask: number) => void;
  pauseTrading: (pairId: string) => void;
  resumeTrading: (pairId: string) => void;
  addCandle: (pairId: string, candle: Omit<OHLCCandle, 'id'>) => void;
  editCandle: (pairId: string, candleId: string, updates: Partial<OHLCCandle>) => void;
  deleteCandle: (pairId: string, candleId: string) => void;
  clearCandles: (pairId: string) => void;
  
  // Pattern generators
  generateBullFlag: (pairId: string, basePrice: number) => void;
  generateHeadAndShoulders: (pairId: string, basePrice: number) => void;
  generateDoubleBottom: (pairId: string, basePrice: number) => void;
  generateBreakout: (pairId: string, basePrice: number, direction: 'up' | 'down') => void;
}

// Generate initial prices
const generateInitialPrices = (): Record<string, PriceData> => {
  const prices: Record<string, PriceData> = {};
  initialCustomPairs.forEach(pair => {
    const spread = pair.spreadPips * pair.pipSize;
    prices[pair.id] = {
      bid: pair.basePrice,
      ask: pair.basePrice + spread,
      timestamp: new Date(),
    };
  });
  return prices;
};

// Generate initial pause state
const generateInitialPauseState = (): Record<string, boolean> => {
  const state: Record<string, boolean> = {};
  initialCustomPairs.forEach(pair => {
    state[pair.id] = false;
  });
  return state;
};

// Generate initial empty candles
const generateInitialCandles = (): Record<string, OHLCCandle[]> => {
  const candles: Record<string, OHLCCandle[]> = {};
  initialCustomPairs.forEach(pair => {
    candles[pair.id] = [];
  });
  return candles;
};

export const useAdminMarketStore = create<AdminMarketState>()(
  persist(
    (set, get) => ({
      customPairs: initialCustomPairs,
      currentPrices: generateInitialPrices(),
      candles: generateInitialCandles(),
      isPaused: generateInitialPauseState(),

      setCurrentPrice: (pairId, bid, ask) => {
        set((state) => ({
          currentPrices: {
            ...state.currentPrices,
            [pairId]: { bid, ask, timestamp: new Date() },
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
          ...candle,
          id: generateId(),
        };
        
        set((state) => ({
          candles: {
            ...state.candles,
            [pairId]: [...(state.candles[pairId] || []), newCandle],
          },
        }));
      },

      editCandle: (pairId, candleId, updates) => {
        set((state) => ({
          candles: {
            ...state.candles,
            [pairId]: (state.candles[pairId] || []).map((c) =>
              c.id === candleId ? { ...c, ...updates } : c
            ),
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

      // Generate Bull Flag pattern
      generateBullFlag: (pairId, basePrice) => {
        const { addCandle, setCurrentPrice } = get();
        const candles: Omit<OHLCCandle, 'id'>[] = [];
        let currentTime = Date.now() - 20 * 60000; // Start 20 minutes ago
        let price = basePrice;

        // Phase 1: Strong upward move (5 candles)
        for (let i = 0; i < 5; i++) {
          const change = basePrice * 0.003 * (1 + Math.random() * 0.5);
          const open = price;
          const close = price + change;
          const high = close + basePrice * 0.001 * Math.random();
          const low = open - basePrice * 0.0005 * Math.random();
          
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high,
            low,
            close,
            volume: 50000 + Math.random() * 50000,
          });
          
          price = close;
          currentTime += 60000;
        }

        // Phase 2: Consolidation/Flag (8 candles)
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
          
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high,
            low,
            close,
            volume: 20000 + Math.random() * 30000,
          });
          
          price = close;
          currentTime += 60000;
        }

        // Phase 3: Breakout (5 candles)
        for (let i = 0; i < 5; i++) {
          const change = basePrice * 0.004 * (1 + Math.random() * 0.5);
          const open = price;
          const close = price + change;
          const high = close + basePrice * 0.002 * Math.random();
          const low = open - basePrice * 0.001 * Math.random();
          
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high,
            low,
            close,
            volume: 60000 + Math.random() * 40000,
          });
          
          price = close;
          currentTime += 60000;
        }

        // Add all candles
        candles.forEach(candle => addCandle(pairId, candle));
        
        // Update current price
        const lastCandle = candles[candles.length - 1];
        setCurrentPrice(pairId, lastCandle.close, lastCandle.close + basePrice * 0.0002);
      },

      // Generate Head and Shoulders pattern
      generateHeadAndShoulders: (pairId, basePrice) => {
        const { addCandle, setCurrentPrice } = get();
        const candles: Omit<OHLCCandle, 'id'>[] = [];
        let currentTime = Date.now() - 25 * 60000;
        let price = basePrice;

        // Left Shoulder (5 candles up, 3 down)
        for (let i = 0; i < 5; i++) {
          const change = basePrice * 0.002 * (1 + Math.random() * 0.3);
          const open = price;
          const close = price + change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: close + basePrice * 0.001 * Math.random(),
            low: open - basePrice * 0.0005 * Math.random(),
            close,
            volume: 40000 + Math.random() * 30000,
          });
          price = close;
          currentTime += 60000;
        }
        for (let i = 0; i < 3; i++) {
          const change = basePrice * 0.002 * (1 + Math.random() * 0.3);
          const open = price;
          const close = price - change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: open + basePrice * 0.0005 * Math.random(),
            low: close - basePrice * 0.001 * Math.random(),
            close,
            volume: 30000 + Math.random() * 20000,
          });
          price = close;
          currentTime += 60000;
        }

        // Head (6 candles up, 4 down)
        for (let i = 0; i < 6; i++) {
          const change = basePrice * 0.003 * (1 + Math.random() * 0.3);
          const open = price;
          const close = price + change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: close + basePrice * 0.001 * Math.random(),
            low: open - basePrice * 0.0005 * Math.random(),
            close,
            volume: 50000 + Math.random() * 40000,
          });
          price = close;
          currentTime += 60000;
        }
        for (let i = 0; i < 4; i++) {
          const change = basePrice * 0.003 * (1 + Math.random() * 0.3);
          const open = price;
          const close = price - change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: open + basePrice * 0.0005 * Math.random(),
            low: close - basePrice * 0.001 * Math.random(),
            close,
            volume: 35000 + Math.random() * 25000,
          });
          price = close;
          currentTime += 60000;
        }

        // Right Shoulder (4 candles up, then breakdown)
        for (let i = 0; i < 4; i++) {
          const change = basePrice * 0.0015 * (1 + Math.random() * 0.3);
          const open = price;
          const close = price + change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: close + basePrice * 0.001 * Math.random(),
            low: open - basePrice * 0.0005 * Math.random(),
            close,
            volume: 25000 + Math.random() * 20000,
          });
          price = close;
          currentTime += 60000;
        }
        for (let i = 0; i < 5; i++) {
          const change = basePrice * 0.004 * (1 + Math.random() * 0.5);
          const open = price;
          const close = price - change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: open + basePrice * 0.001 * Math.random(),
            low: close - basePrice * 0.002 * Math.random(),
            close,
            volume: 55000 + Math.random() * 45000,
          });
          price = close;
          currentTime += 60000;
        }

        candles.forEach(candle => addCandle(pairId, candle));
        const lastCandle = candles[candles.length - 1];
        setCurrentPrice(pairId, lastCandle.close, lastCandle.close + basePrice * 0.0002);
      },

      // Generate Double Bottom pattern
      generateDoubleBottom: (pairId, basePrice) => {
        const { addCandle, setCurrentPrice } = get();
        const candles: Omit<OHLCCandle, 'id'>[] = [];
        let currentTime = Date.now() - 22 * 60000;
        let price = basePrice;

        // First drop (5 candles)
        for (let i = 0; i < 5; i++) {
          const change = basePrice * 0.003 * (1 + Math.random() * 0.3);
          const open = price;
          const close = price - change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: open + basePrice * 0.001 * Math.random(),
            low: close - basePrice * 0.001 * Math.random(),
            close,
            volume: 40000 + Math.random() * 30000,
          });
          price = close;
          currentTime += 60000;
        }

        const bottomLevel = price;

        // First bounce (4 candles)
        for (let i = 0; i < 4; i++) {
          const change = basePrice * 0.002 * (1 + Math.random() * 0.3);
          const open = price;
          const close = price + change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: close + basePrice * 0.001 * Math.random(),
            low: open - basePrice * 0.0005 * Math.random(),
            close,
            volume: 30000 + Math.random() * 25000,
          });
          price = close;
          currentTime += 60000;
        }

        // Second drop back to support (4 candles)
        for (let i = 0; i < 4; i++) {
          const change = basePrice * 0.002 * (1 + Math.random() * 0.3);
          const open = price;
          let close = price - change;
          if (i === 3) close = bottomLevel + basePrice * 0.001; // Test support
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: open + basePrice * 0.0005 * Math.random(),
            low: close - basePrice * 0.001 * Math.random(),
            close,
            volume: 35000 + Math.random() * 25000,
          });
          price = close;
          currentTime += 60000;
        }

        // Rally from double bottom (6 candles)
        for (let i = 0; i < 6; i++) {
          const change = basePrice * 0.004 * (1 + Math.random() * 0.5);
          const open = price;
          const close = price + change;
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: close + basePrice * 0.002 * Math.random(),
            low: open - basePrice * 0.0005 * Math.random(),
            close,
            volume: 55000 + Math.random() * 45000,
          });
          price = close;
          currentTime += 60000;
        }

        candles.forEach(candle => addCandle(pairId, candle));
        const lastCandle = candles[candles.length - 1];
        setCurrentPrice(pairId, lastCandle.close, lastCandle.close + basePrice * 0.0002);
      },

      // Generate Breakout pattern
      generateBreakout: (pairId, basePrice, direction) => {
        const { addCandle, setCurrentPrice } = get();
        const candles: Omit<OHLCCandle, 'id'>[] = [];
        let currentTime = Date.now() - 18 * 60000;
        let price = basePrice;
        const rangeTop = basePrice * 1.005;
        const rangeBottom = basePrice * 0.995;

        // Consolidation phase (12 candles)
        for (let i = 0; i < 12; i++) {
          const open = price;
          const dir = Math.random() > 0.5 ? 1 : -1;
          let close = price + dir * basePrice * 0.002 * Math.random();
          close = Math.max(rangeBottom, Math.min(rangeTop, close));
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high: Math.max(open, close) + basePrice * 0.001 * Math.random(),
            low: Math.min(open, close) - basePrice * 0.001 * Math.random(),
            close,
            volume: 20000 + Math.random() * 25000,
          });
          price = close;
          currentTime += 60000;
        }

        // Breakout phase (6 candles)
        for (let i = 0; i < 6; i++) {
          const change = basePrice * 0.005 * (1 + Math.random() * 0.5);
          const open = price;
          const close = direction === 'up' ? price + change : price - change;
          const high = direction === 'up' 
            ? close + basePrice * 0.002 * Math.random()
            : open + basePrice * 0.001 * Math.random();
          const low = direction === 'up'
            ? open - basePrice * 0.001 * Math.random()
            : close - basePrice * 0.002 * Math.random();
          
          candles.push({
            timestamp: new Date(currentTime),
            open,
            high,
            low,
            close,
            volume: 60000 + Math.random() * 50000,
          });
          price = close;
          currentTime += 60000;
        }

        candles.forEach(candle => addCandle(pairId, candle));
        const lastCandle = candles[candles.length - 1];
        setCurrentPrice(pairId, lastCandle.close, lastCandle.close + basePrice * 0.0002);
      },
    }),
    {
      name: 'admin-markets-storage',
      partialize: (state) => ({
        customPairs: state.customPairs,
        candles: state.candles,
        currentPrices: state.currentPrices,
        isPaused: state.isPaused,
      }),
    }
  )
);

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get base price for a symbol
function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    'EUR/USD': 1.0850,
    'GBP/USD': 1.2650,
    'USD/JPY': 149.50,
    'AUD/USD': 0.6580,
    'USD/CAD': 1.3450,
    'USD/CHF': 0.8950,
    'NZD/USD': 0.6150,
    'NOVA/USD': 1.2500,
    'LEARN/USD': 0.8500,
    'DEMO/USD': 2.0000,
  };
  return prices[symbol] || 1.0000;
}

// Fetch simulated real market data
export async function fetchRealMarketData(
  symbol: string,
  timeframe: string = '1m',
  limit: number = 100
): Promise<Candle[]> {
  const candles: Candle[] = [];
  const basePrice = getBasePrice(symbol);
  
  for (let i = limit; i > 0; i--) {
    const timestamp = new Date(Date.now() - i * 60000);
    const volatility = 0.0002;
    const trend = Math.sin(i * 0.1) * 0.001;
    
    const open = basePrice * (1 + trend + (Math.random() - 0.5) * volatility);
    const close = open * (1 + (Math.random() - 0.5) * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    
    candles.push({
      id: `real_${symbol}_${i}`,
      timestamp,
      open,
      high,
      low,
      close,
      volume: Math.random() * 10000000,
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
    return {
      candles: store.candles[symbol] || [],
      isAdminControlled: true,
    };
  } else {
    const candles = await fetchRealMarketData(symbol, timeframe, limit);
    return {
      candles,
      isAdminControlled: false,
    };
  }
}
