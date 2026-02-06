/**
 * TradingView Datafeed for Binance
 * 
 * Implements the TradingView Charting Library's IBasicDataFeed interface
 * to provide real-time data from Binance.
 * 
 * Usage:
 *   import { createBinanceDatafeed } from '@/lib/services/tradingview-datafeed';
 *   const datafeed = createBinanceDatafeed();
 *   // Pass to TradingView widget
 */

import { binanceService, CRYPTO_PAIRS, INTERVAL_MAP, formatSymbol } from './binance';

// ==========================================
// TYPES
// ==========================================

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface DatafeedConfiguration {
  supported_resolutions: string[];
  exchanges: { value: string; name: string; desc: string }[];
  symbols_types: { name: string; value: string }[];
}

export interface ResolveSymbolInfo {
  name: string;
  full_name: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  ticker: string;
  exchange: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: string[];
  volume_precision: number;
  data_status: string;
}

export interface SubscribeBarsCallback {
  (bar: Bar): void;
}

// ==========================================
// DATAFEED IMPLEMENTATION
// ==========================================

export function createBinanceDatafeed(isEducational: boolean = false, eduPriceGenerator?: any) {
  const subscriptions: Map<string, () => void> = new Map();
  const lastBars: Map<string, Bar> = new Map();

  const datafeed = {
    onReady: (callback: (config: DatafeedConfiguration) => void) => {
      setTimeout(() => {
        callback({
          supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'],
          exchanges: [
            { value: 'Binance', name: 'Binance', desc: 'Binance Exchange' },
          ],
          symbols_types: [
            { name: 'Crypto', value: 'crypto' },
          ],
        });
      }, 0);
    },

    searchSymbols: (
      userInput: string,
      exchange: string,
      symbolType: string,
      onResult: (result: any[]) => void
    ) => {
      const results = CRYPTO_PAIRS
        .filter(pair => 
          pair.name.toLowerCase().includes(userInput.toLowerCase()) ||
          pair.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
          pair.base.toLowerCase().includes(userInput.toLowerCase())
        )
        .map(pair => ({
          symbol: pair.symbol,
          full_name: `Binance:${pair.symbol}`,
          description: pair.name,
          exchange: 'Binance',
          type: 'crypto',
          ticker: pair.symbol,
        }));

      onResult(results);
    },

    resolveSymbol: (
      symbolName: string,
      onResolve: (symbolInfo: ResolveSymbolInfo) => void,
      onError: (reason: string) => void
    ) => {
      // Extract symbol from full name if needed
      const symbol = symbolName.includes(':') 
        ? symbolName.split(':')[1] 
        : symbolName.toUpperCase();

      const pair = CRYPTO_PAIRS.find(p => p.symbol === symbol);
      
      if (!pair) {
        onError(`Symbol not found: ${symbol}`);
        return;
      }

      // Determine price scale based on price magnitude
      let pricescale = 100;
      if (symbol.includes('BTC') || symbol.includes('ETH')) {
        pricescale = 100; // 2 decimal places
      } else if (symbol.includes('DOGE') || symbol.includes('XRP') || symbol.includes('ADA')) {
        pricescale = 100000; // 5 decimal places
      } else {
        pricescale = 1000; // 3 decimal places
      }

      const symbolInfo: ResolveSymbolInfo = {
        name: pair.symbol,
        full_name: `Binance:${pair.symbol}`,
        description: pair.name,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        ticker: pair.symbol,
        exchange: 'Binance',
        minmov: 1,
        pricescale,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'],
        volume_precision: 2,
        data_status: 'streaming',
      };

      setTimeout(() => onResolve(symbolInfo), 0);
    },

    getBars: async (
      symbolInfo: ResolveSymbolInfo,
      resolution: string,
      periodParams: { from: number; to: number; countBack: number; firstDataRequest: boolean },
      onResult: (bars: Bar[], meta: { noData: boolean }) => void,
      onError: (reason: string) => void
    ) => {
      const { from, to, countBack, firstDataRequest } = periodParams;
      const interval = INTERVAL_MAP[resolution] || '1m';
      const symbol = symbolInfo.ticker || symbolInfo.name;

      try {
        // For educational mode, generate simulated candles
        if (isEducational && eduPriceGenerator) {
          const bars = eduPriceGenerator.generateBars(symbol, interval, countBack, from * 1000);
          if (bars.length === 0) {
            onResult([], { noData: true });
          } else {
            const lastBar = bars[bars.length - 1];
            lastBars.set(`${symbol}_${resolution}`, lastBar);
            onResult(bars, { noData: false });
          }
          return;
        }

        // Fetch from Binance
        const klines = await binanceService.getKlines(
          symbol,
          interval,
          countBack || 300,
          from * 1000,
          to * 1000
        );

        if (klines.length === 0) {
          onResult([], { noData: true });
          return;
        }

        const bars: Bar[] = klines.map(k => ({
          time: k.time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
        }));

        // Store last bar for updates
        const lastBar = bars[bars.length - 1];
        lastBars.set(`${symbol}_${resolution}`, lastBar);

        onResult(bars, { noData: false });
      } catch (error) {
        console.error('Error fetching bars:', error);
        onError('Error fetching data');
      }
    },

    subscribeBars: (
      symbolInfo: ResolveSymbolInfo,
      resolution: string,
      onTick: SubscribeBarsCallback,
      listenerGuid: string,
      onResetCacheNeededCallback: () => void
    ) => {
      const symbol = symbolInfo.ticker || symbolInfo.name;
      const interval = INTERVAL_MAP[resolution] || '1m';
      const key = `${symbol}_${resolution}_${listenerGuid}`;

      // For educational mode, use simulated price updates
      if (isEducational && eduPriceGenerator) {
        const unsubscribe = eduPriceGenerator.subscribeToUpdates(
          symbol,
          interval,
          (kline: any) => {
            const lastBar = lastBars.get(`${symbol}_${resolution}`);
            
            const bar: Bar = {
              time: kline.time,
              open: kline.open,
              high: kline.high,
              low: kline.low,
              close: kline.close,
              volume: kline.volume,
            };

            // Check if this is a new bar or update to existing
            if (lastBar && lastBar.time === bar.time) {
              // Update existing bar
              bar.open = lastBar.open; // Keep original open
              bar.high = Math.max(lastBar.high, bar.high);
              bar.low = Math.min(lastBar.low, bar.low);
            }

            lastBars.set(`${symbol}_${resolution}`, bar);
            onTick(bar);
          }
        );

        subscriptions.set(key, unsubscribe);
        return;
      }

      // Real mode - subscribe to Binance WebSocket
      const unsubscribe = binanceService.subscribeToKlines(
        symbol,
        interval,
        (kline) => {
          const lastBar = lastBars.get(`${symbol}_${resolution}`);
          
          const bar: Bar = {
            time: kline.time,
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
            volume: kline.volume,
          };

          // Check if this is a new bar or update to existing
          if (lastBar && lastBar.time === bar.time) {
            // Update existing bar
            bar.open = lastBar.open;
            bar.high = Math.max(lastBar.high, bar.high);
            bar.low = Math.min(lastBar.low, bar.low);
          }

          lastBars.set(`${symbol}_${resolution}`, bar);
          onTick(bar);
        }
      );

      subscriptions.set(key, unsubscribe);
    },

    unsubscribeBars: (listenerGuid: string) => {
      // Find and remove subscription
      for (const [key, unsubscribe] of subscriptions.entries()) {
        if (key.includes(listenerGuid)) {
          unsubscribe();
          subscriptions.delete(key);
          break;
        }
      }
    },

    // Optional methods
    getServerTime: (callback: (time: number) => void) => {
      callback(Math.floor(Date.now() / 1000));
    },
  };

  return datafeed;
}

// ==========================================
// EDUCATIONAL PRICE GENERATOR
// ==========================================

export interface EduScenario {
  id: string;
  name: string;
  description: string;
  trendType: 'up' | 'down' | 'range' | 'breakout' | 'fakeout' | 'volatile';
  trendStrength: number; // 0-1
  volatility: number; // 0-2
  pullbackFrequency: number; // 0-1
  spikeChance: number; // 0-1
  duration: number; // minutes
}

export class EducationalPriceGenerator {
  private scenario: EduScenario | null = null;
  private basePrice: number = 0;
  private currentPrice: number = 0;
  private startTime: number = 0;
  private subscribers: Map<string, Set<(kline: any) => void>> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private priceHistory: Map<string, number[]> = new Map();

  setScenario(scenario: EduScenario, basePrice: number) {
    this.scenario = scenario;
    this.basePrice = basePrice;
    this.currentPrice = basePrice;
    this.startTime = Date.now();
    this.priceHistory.clear();
    
    // Start generating prices
    this.startGeneration();
  }

  getScenario(): EduScenario | null {
    return this.scenario;
  }

  getCurrentPrice(): number {
    return this.currentPrice;
  }

  private startGeneration() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    // Generate price updates every 500ms
    this.interval = setInterval(() => {
      if (!this.scenario) return;

      const elapsed = (Date.now() - this.startTime) / 1000 / 60; // minutes
      const progress = Math.min(elapsed / this.scenario.duration, 1);

      // Calculate trend direction
      let trendMultiplier = 0;
      switch (this.scenario.trendType) {
        case 'up':
          trendMultiplier = this.scenario.trendStrength * progress;
          break;
        case 'down':
          trendMultiplier = -this.scenario.trendStrength * progress;
          break;
        case 'range':
          trendMultiplier = Math.sin(progress * Math.PI * 4) * this.scenario.trendStrength * 0.3;
          break;
        case 'breakout':
          if (progress < 0.5) {
            trendMultiplier = Math.sin(progress * Math.PI * 2) * 0.1;
          } else {
            trendMultiplier = this.scenario.trendStrength * (progress - 0.5) * 2;
          }
          break;
        case 'fakeout':
          if (progress < 0.3) {
            trendMultiplier = this.scenario.trendStrength * progress * 2;
          } else if (progress < 0.5) {
            trendMultiplier = this.scenario.trendStrength * 0.6;
          } else {
            trendMultiplier = this.scenario.trendStrength * 0.6 - this.scenario.trendStrength * (progress - 0.5) * 2;
          }
          break;
        case 'volatile':
          trendMultiplier = (Math.random() - 0.5) * this.scenario.volatility;
          break;
      }

      // Add pullbacks
      if (Math.random() < this.scenario.pullbackFrequency * 0.1) {
        trendMultiplier *= -0.5;
      }

      // Add random spikes
      if (Math.random() < this.scenario.spikeChance * 0.05) {
        trendMultiplier += (Math.random() - 0.5) * this.scenario.volatility * 2;
      }

      // Add random noise
      const noise = (Math.random() - 0.5) * this.scenario.volatility * 0.02;

      // Calculate new price
      const priceChange = this.basePrice * (trendMultiplier * 0.1 + noise);
      this.currentPrice = Math.max(this.basePrice * 0.5, this.currentPrice + priceChange * 0.01);

      // Notify subscribers
      const now = Date.now();
      const kline = {
        time: Math.floor(now / 60000) * 60000, // Round to minute
        open: this.currentPrice * (1 + (Math.random() - 0.5) * 0.001),
        high: this.currentPrice * (1 + Math.random() * 0.002),
        low: this.currentPrice * (1 - Math.random() * 0.002),
        close: this.currentPrice,
        volume: Math.random() * 1000000,
      };

      this.subscribers.forEach((callbacks) => {
        callbacks.forEach((cb) => cb(kline));
      });
    }, 500);
  }

  generateBars(
    symbol: string,
    interval: string,
    count: number,
    startTime: number
  ): Bar[] {
    if (!this.scenario) return [];

    const bars: Bar[] = [];
    const intervalMs = this.getIntervalMs(interval);
    let price = this.basePrice;

    for (let i = 0; i < count; i++) {
      const time = startTime + i * intervalMs;
      const progress = i / count;

      // Calculate price based on scenario
      let change = 0;
      switch (this.scenario.trendType) {
        case 'up':
          change = this.scenario.trendStrength * progress * 0.2;
          break;
        case 'down':
          change = -this.scenario.trendStrength * progress * 0.2;
          break;
        case 'range':
          change = Math.sin(progress * Math.PI * 8) * this.scenario.trendStrength * 0.05;
          break;
        case 'breakout':
          change = progress < 0.7 
            ? Math.sin(progress * Math.PI * 4) * 0.02
            : this.scenario.trendStrength * (progress - 0.7) * 0.5;
          break;
        case 'fakeout':
          if (progress < 0.4) change = this.scenario.trendStrength * progress * 0.3;
          else if (progress < 0.6) change = this.scenario.trendStrength * 0.12;
          else change = this.scenario.trendStrength * 0.12 - this.scenario.trendStrength * (progress - 0.6) * 0.4;
          break;
        case 'volatile':
          change = (Math.random() - 0.5) * this.scenario.volatility * 0.1;
          break;
      }

      // Add noise
      const noise = (Math.random() - 0.5) * this.scenario.volatility * 0.01;
      price = this.basePrice * (1 + change + noise);

      const volatility = this.scenario.volatility * 0.01;
      const open = price * (1 + (Math.random() - 0.5) * volatility);
      const close = price * (1 + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * volatility);
      const low = Math.min(open, close) * (1 - Math.random() * volatility);

      bars.push({
        time,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000000,
      });
    }

    return bars;
  }

  subscribeToUpdates(
    symbol: string,
    interval: string,
    callback: (kline: any) => void
  ): () => void {
    const key = `${symbol}_${interval}`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  private getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60000,
      '3m': 180000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '2h': 7200000,
      '4h': 14400000,
      '1d': 86400000,
      '1w': 604800000,
      '1M': 2592000000,
    };
    return map[interval] || 60000;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.subscribers.clear();
    this.scenario = null;
  }
}

// Export default scenarios
export const DEFAULT_EDU_SCENARIOS: EduScenario[] = [
  {
    id: 'steady-rise',
    name: 'Steady Rise',
    description: 'Learn to ride an uptrend with pullbacks',
    trendType: 'up',
    trendStrength: 0.7,
    volatility: 0.5,
    pullbackFrequency: 0.3,
    spikeChance: 0.1,
    duration: 10,
  },
  {
    id: 'steady-fall',
    name: 'Steady Fall',
    description: 'Practice shorting in a downtrend',
    trendType: 'down',
    trendStrength: 0.7,
    volatility: 0.5,
    pullbackFrequency: 0.3,
    spikeChance: 0.1,
    duration: 10,
  },
  {
    id: 'range-bound',
    name: 'Range Bound',
    description: 'Trade support and resistance levels',
    trendType: 'range',
    trendStrength: 0.5,
    volatility: 0.4,
    pullbackFrequency: 0.5,
    spikeChance: 0.05,
    duration: 10,
  },
  {
    id: 'breakout',
    name: 'Breakout',
    description: 'Catch a breakout after consolidation',
    trendType: 'breakout',
    trendStrength: 0.8,
    volatility: 0.3,
    pullbackFrequency: 0.2,
    spikeChance: 0.15,
    duration: 10,
  },
  {
    id: 'fakeout',
    name: 'Fakeout',
    description: 'Learn to avoid false breakouts',
    trendType: 'fakeout',
    trendStrength: 0.6,
    volatility: 0.5,
    pullbackFrequency: 0.2,
    spikeChance: 0.1,
    duration: 10,
  },
  {
    id: 'high-volatility',
    name: 'High Volatility',
    description: 'Navigate extreme market conditions',
    trendType: 'volatile',
    trendStrength: 0.3,
    volatility: 1.5,
    pullbackFrequency: 0.5,
    spikeChance: 0.3,
    duration: 10,
  },
];
