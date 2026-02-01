/**
 * Binance Market Data Service
 * 
 * Provides real-time market data from Binance:
 * - REST API for historical candles
 * - WebSocket for live price updates
 * 
 * Usage:
 *   import { binanceService } from '@/lib/services/binance';
 *   const candles = await binanceService.getKlines('BTCUSDT', '1m', 100);
 *   binanceService.subscribeToTicker('BTCUSDT', (data) => console.log(data));
 */

export interface BinanceKline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BinanceTicker {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  lastUpdate: number;
}

export interface BinanceDepth {
  bids: [number, number][];
  asks: [number, number][];
  lastUpdateId: number;
}

type TickerCallback = (ticker: BinanceTicker) => void;
type KlineCallback = (kline: BinanceKline) => void;
type DepthCallback = (depth: BinanceDepth) => void;

class BinanceService {
  private baseUrl = 'https://api.binance.com/api/v3';
  private wsBaseUrl = 'wss://stream.binance.com:9443/ws';
  private sockets: Map<string, WebSocket> = new Map();
  private tickerCallbacks: Map<string, Set<TickerCallback>> = new Map();
  private klineCallbacks: Map<string, Set<KlineCallback>> = new Map();
  private depthCallbacks: Map<string, Set<DepthCallback>> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private priceCache: Map<string, BinanceTicker> = new Map();

  // ==========================================
  // REST API METHODS
  // ==========================================

  /**
   * Get historical klines (candlestick data)
   */
  async getKlines(
    symbol: string,
    interval: string = '1m',
    limit: number = 500,
    startTime?: number,
    endTime?: number
  ): Promise<BinanceKline[]> {
    try {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        limit: limit.toString(),
      });

      if (startTime) params.append('startTime', startTime.toString());
      if (endTime) params.append('endTime', endTime.toString());

      const response = await fetch(`${this.baseUrl}/klines?${params}`);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((k: any[]) => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch (error) {
      console.error('Error fetching klines:', error);
      return [];
    }
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<number | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/ticker/price?symbol=${symbol.toUpperCase()}`
      );

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error('Error fetching price:', error);
      return null;
    }
  }

  /**
   * Get 24hr ticker for a symbol
   */
  async get24hrTicker(symbol: string): Promise<BinanceTicker | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/ticker/24hr?symbol=${symbol.toUpperCase()}`
      );

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.volume),
        quoteVolume24h: parseFloat(data.quoteVolume),
        lastUpdate: data.closeTime,
      };
    } catch (error) {
      console.error('Error fetching 24hr ticker:', error);
      return null;
    }
  }

  /**
   * Get 24hr tickers for all symbols
   */
  async getAllTickers(): Promise<BinanceTicker[]> {
    try {
      const response = await fetch(`${this.baseUrl}/ticker/24hr`);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      return data.map((t: any) => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        priceChange: parseFloat(t.priceChange),
        priceChangePercent: parseFloat(t.priceChangePercent),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
        volume24h: parseFloat(t.volume),
        quoteVolume24h: parseFloat(t.quoteVolume),
        lastUpdate: t.closeTime,
      }));
    } catch (error) {
      console.error('Error fetching all tickers:', error);
      return [];
    }
  }

  /**
   * Get order book depth
   */
  async getDepth(symbol: string, limit: number = 20): Promise<BinanceDepth | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        bids: data.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
        asks: data.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
        lastUpdateId: data.lastUpdateId,
      };
    } catch (error) {
      console.error('Error fetching depth:', error);
      return null;
    }
  }

  // ==========================================
  // WEBSOCKET METHODS
  // ==========================================

  /**
   * Subscribe to real-time ticker updates
   */
  subscribeToTicker(symbol: string, callback: TickerCallback): () => void {
    const streamName = `${symbol.toLowerCase()}@ticker`;

    if (!this.tickerCallbacks.has(streamName)) {
      this.tickerCallbacks.set(streamName, new Set());
    }
    this.tickerCallbacks.get(streamName)!.add(callback);

    this.ensureConnection(streamName, 'ticker');

    // Return unsubscribe function
    return () => {
      this.tickerCallbacks.get(streamName)?.delete(callback);
      if (this.tickerCallbacks.get(streamName)?.size === 0) {
        this.closeConnection(streamName);
      }
    };
  }

  /**
   * Subscribe to real-time kline (candlestick) updates
   */
  subscribeToKlines(
    symbol: string,
    interval: string,
    callback: KlineCallback
  ): () => void {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;

    if (!this.klineCallbacks.has(streamName)) {
      this.klineCallbacks.set(streamName, new Set());
    }
    this.klineCallbacks.get(streamName)!.add(callback);

    this.ensureConnection(streamName, 'kline');

    return () => {
      this.klineCallbacks.get(streamName)?.delete(callback);
      if (this.klineCallbacks.get(streamName)?.size === 0) {
        this.closeConnection(streamName);
      }
    };
  }

  /**
   * Subscribe to real-time depth (order book) updates
   */
  subscribeToDepth(symbol: string, callback: DepthCallback): () => void {
    const streamName = `${symbol.toLowerCase()}@depth@100ms`;

    if (!this.depthCallbacks.has(streamName)) {
      this.depthCallbacks.set(streamName, new Set());
    }
    this.depthCallbacks.get(streamName)!.add(callback);

    this.ensureConnection(streamName, 'depth');

    return () => {
      this.depthCallbacks.get(streamName)?.delete(callback);
      if (this.depthCallbacks.get(streamName)?.size === 0) {
        this.closeConnection(streamName);
      }
    };
  }

  /**
   * Get cached price (from WebSocket updates)
   */
  getCachedPrice(symbol: string): BinanceTicker | null {
    return this.priceCache.get(symbol.toUpperCase()) || null;
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private ensureConnection(
    streamName: string,
    type: 'ticker' | 'kline' | 'depth'
  ) {
    if (this.sockets.has(streamName)) {
      return;
    }

    if (typeof window === 'undefined') {
      return; // Server-side, don't create WebSocket
    }

    const ws = new WebSocket(`${this.wsBaseUrl}/${streamName}`);

    ws.onopen = () => {
      console.log(`WebSocket connected: ${streamName}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(streamName, type, data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${streamName}:`, error);
    };

    ws.onclose = () => {
      console.log(`WebSocket closed: ${streamName}`);
      this.sockets.delete(streamName);

      // Check if there are still callbacks waiting
      const hasCallbacks =
        (type === 'ticker' && (this.tickerCallbacks.get(streamName)?.size ?? 0) > 0) ||
        (type === 'kline' && (this.klineCallbacks.get(streamName)?.size ?? 0) > 0) ||
        (type === 'depth' && (this.depthCallbacks.get(streamName)?.size ?? 0) > 0);

      if (hasCallbacks) {
        // Reconnect after a delay
        const timeout = setTimeout(() => {
          this.ensureConnection(streamName, type);
          this.reconnectTimeouts.delete(streamName);
        }, 3000);
        this.reconnectTimeouts.set(streamName, timeout);
      }
    };

    this.sockets.set(streamName, ws);
  }

  private handleMessage(
    streamName: string,
    type: 'ticker' | 'kline' | 'depth',
    data: any
  ) {
    if (type === 'ticker') {
      const ticker: BinanceTicker = {
        symbol: data.s,
        price: parseFloat(data.c),
        priceChange: parseFloat(data.p),
        priceChangePercent: parseFloat(data.P),
        high24h: parseFloat(data.h),
        low24h: parseFloat(data.l),
        volume24h: parseFloat(data.v),
        quoteVolume24h: parseFloat(data.q),
        lastUpdate: data.E,
      };

      this.priceCache.set(ticker.symbol, ticker);
      this.tickerCallbacks.get(streamName)?.forEach((cb) => cb(ticker));
    } else if (type === 'kline') {
      const k = data.k;
      const kline: BinanceKline = {
        time: k.t,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };

      this.klineCallbacks.get(streamName)?.forEach((cb) => cb(kline));
    } else if (type === 'depth') {
      const depth: BinanceDepth = {
        bids: data.b?.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]) || [],
        asks: data.a?.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]) || [],
        lastUpdateId: data.u || 0,
      };

      this.depthCallbacks.get(streamName)?.forEach((cb) => cb(depth));
    }
  }

  private closeConnection(streamName: string) {
    const timeout = this.reconnectTimeouts.get(streamName);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(streamName);
    }

    const ws = this.sockets.get(streamName);
    if (ws) {
      ws.close();
      this.sockets.delete(streamName);
    }

    this.tickerCallbacks.delete(streamName);
    this.klineCallbacks.delete(streamName);
    this.depthCallbacks.delete(streamName);
  }

  /**
   * Close all connections
   */
  closeAll() {
    this.reconnectTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.reconnectTimeouts.clear();

    this.sockets.forEach((ws) => ws.close());
    this.sockets.clear();

    this.tickerCallbacks.clear();
    this.klineCallbacks.clear();
    this.depthCallbacks.clear();
  }
}

// Export singleton instance
export const binanceService = new BinanceService();

// ==========================================
// TRADING PAIRS CONFIGURATION
// ==========================================

export const CRYPTO_PAIRS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', base: 'BTC', quote: 'USDT', icon: '₿' },
  { symbol: 'ETHUSDT', name: 'Ethereum', base: 'ETH', quote: 'USDT', icon: 'Ξ' },
  { symbol: 'BNBUSDT', name: 'BNB', base: 'BNB', quote: 'USDT', icon: '◆' },
  { symbol: 'SOLUSDT', name: 'Solana', base: 'SOL', quote: 'USDT', icon: '◎' },
  { symbol: 'XRPUSDT', name: 'XRP', base: 'XRP', quote: 'USDT', icon: '✕' },
  { symbol: 'ADAUSDT', name: 'Cardano', base: 'ADA', quote: 'USDT', icon: '₳' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', base: 'DOGE', quote: 'USDT', icon: 'Ð' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', base: 'AVAX', quote: 'USDT', icon: '🔺' },
  { symbol: 'DOTUSDT', name: 'Polkadot', base: 'DOT', quote: 'USDT', icon: '●' },
  { symbol: 'LINKUSDT', name: 'Chainlink', base: 'LINK', quote: 'USDT', icon: '⬡' },
  { symbol: 'MATICUSDT', name: 'Polygon', base: 'MATIC', quote: 'USDT', icon: '⬡' },
  { symbol: 'LTCUSDT', name: 'Litecoin', base: 'LTC', quote: 'USDT', icon: 'Ł' },
  { symbol: 'ARBUSDT', name: 'Arbitrum', base: 'ARB', quote: 'USDT', icon: '◈' },
  { symbol: 'OPUSDT', name: 'Optimism', base: 'OP', quote: 'USDT', icon: '⭕' },
  { symbol: 'ATOMUSDT', name: 'Cosmos', base: 'ATOM', quote: 'USDT', icon: '⚛' },
];

export const INTERVAL_MAP: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  'D': '1d',
  'W': '1w',
  'M': '1M',
};

// Helper to convert Binance symbol to display format
export function formatSymbol(binanceSymbol: string): string {
  return binanceSymbol.replace('USDT', '/USDT');
}

// Helper to get pair info by symbol
export function getPairInfo(symbol: string) {
  return CRYPTO_PAIRS.find((p) => p.symbol === symbol.toUpperCase());
}
