// Educational Price Generator - Generates realistic price movements based on scenario configurations
// This generates candles that feed into TradingView through the same datafeed interface

export interface EducationalScenarioConfig {
  id: string;
  name: string;
  trend_type: 'steady_rise' | 'steady_fall' | 'range_bound' | 'breakout' | 'fakeout' | 'high_volatility' | 'custom';
  trend_strength: number; // 0-1, how strong the trend direction is
  volatility: number; // 0-1, price movement variance
  pullback_frequency: number; // 0-1, how often price pulls back against trend
  spike_chance: number; // 0-1, probability of sudden spikes
  duration_minutes: number;
  base_price: number;
  is_active: boolean;
}

export interface GeneratedCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Default scenarios that admins can choose from
export const DEFAULT_SCENARIOS: EducationalScenarioConfig[] = [
  {
    id: 'steady_rise_1',
    name: 'Bullish Trend Training',
    trend_type: 'steady_rise',
    trend_strength: 0.7,
    volatility: 0.3,
    pullback_frequency: 0.2,
    spike_chance: 0.05,
    duration_minutes: 30,
    base_price: 100,
    is_active: true,
  },
  {
    id: 'steady_fall_1',
    name: 'Bearish Trend Training',
    trend_type: 'steady_fall',
    trend_strength: 0.6,
    volatility: 0.35,
    pullback_frequency: 0.15,
    spike_chance: 0.05,
    duration_minutes: 30,
    base_price: 100,
    is_active: true,
  },
  {
    id: 'range_bound_1',
    name: 'Support/Resistance Trading',
    trend_type: 'range_bound',
    trend_strength: 0.2,
    volatility: 0.4,
    pullback_frequency: 0.5,
    spike_chance: 0.02,
    duration_minutes: 45,
    base_price: 100,
    is_active: true,
  },
  {
    id: 'breakout_1',
    name: 'Breakout Momentum',
    trend_type: 'breakout',
    trend_strength: 0.9,
    volatility: 0.5,
    pullback_frequency: 0.1,
    spike_chance: 0.15,
    duration_minutes: 20,
    base_price: 100,
    is_active: true,
  },
  {
    id: 'fakeout_1',
    name: 'Trap Avoidance',
    trend_type: 'fakeout',
    trend_strength: 0.5,
    volatility: 0.6,
    pullback_frequency: 0.3,
    spike_chance: 0.2,
    duration_minutes: 25,
    base_price: 100,
    is_active: true,
  },
  {
    id: 'high_volatility_1',
    name: 'Extreme Conditions',
    trend_type: 'high_volatility',
    trend_strength: 0.4,
    volatility: 0.9,
    pullback_frequency: 0.4,
    spike_chance: 0.3,
    duration_minutes: 15,
    base_price: 100,
    is_active: true,
  },
];

// Seeded random number generator for reproducibility
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  gaussian(): number {
    // Box-Muller transform for normal distribution
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

export class EducationalPriceGenerator {
  private scenario: EducationalScenarioConfig;
  private random: SeededRandom;
  private startTime: number;
  private currentPrice: number;
  private trend: number = 0;
  private momentum: number = 0;
  private candleHistory: GeneratedCandle[] = [];
  private breakoutTriggered: boolean = false;
  private fakeoutPhase: 'none' | 'breakout' | 'reversal' = 'none';
  
  constructor(scenario: EducationalScenarioConfig, seed?: number) {
    this.scenario = scenario;
    this.random = new SeededRandom(seed || Date.now());
    this.startTime = Math.floor(Date.now() / 1000);
    this.currentPrice = scenario.base_price;
    this.initializeTrend();
  }
  
  private initializeTrend(): void {
    switch (this.scenario.trend_type) {
      case 'steady_rise':
        this.trend = this.scenario.trend_strength * 0.001; // ~0.1% per candle base
        break;
      case 'steady_fall':
        this.trend = -this.scenario.trend_strength * 0.001;
        break;
      case 'range_bound':
        this.trend = 0;
        break;
      case 'breakout':
        // Start with consolidation, will trigger breakout later
        this.trend = 0;
        break;
      case 'fakeout':
        // Similar to breakout but will reverse
        this.trend = 0;
        this.fakeoutPhase = 'none';
        break;
      case 'high_volatility':
        this.trend = (this.random.next() - 0.5) * 0.002;
        break;
    }
  }
  
  private updateTrendDynamics(candleIndex: number, totalCandles: number): void {
    const progress = candleIndex / totalCandles;
    
    switch (this.scenario.trend_type) {
      case 'breakout':
        // Consolidation for first 40%, then breakout
        if (!this.breakoutTriggered && progress > 0.4) {
          this.breakoutTriggered = true;
          // Random direction breakout
          const direction = this.random.next() > 0.5 ? 1 : -1;
          this.trend = direction * this.scenario.trend_strength * 0.003;
          this.momentum = direction * 0.5;
        }
        break;
        
      case 'fakeout':
        // Fake breakout at 30%, reversal at 50%
        if (this.fakeoutPhase === 'none' && progress > 0.3) {
          this.fakeoutPhase = 'breakout';
          const direction = this.random.next() > 0.5 ? 1 : -1;
          this.trend = direction * this.scenario.trend_strength * 0.004;
          this.momentum = direction * 0.6;
        } else if (this.fakeoutPhase === 'breakout' && progress > 0.5) {
          this.fakeoutPhase = 'reversal';
          this.trend = -this.trend * 1.5; // Stronger reversal
          this.momentum = -this.momentum * 1.2;
        }
        break;
        
      case 'range_bound':
        // Price oscillates between support and resistance
        const range = this.scenario.base_price * 0.05; // 5% range
        const deviation = this.currentPrice - this.scenario.base_price;
        if (Math.abs(deviation) > range) {
          this.trend = -Math.sign(deviation) * 0.001;
        }
        break;
        
      case 'high_volatility':
        // Random trend changes
        if (this.random.next() < 0.1) {
          this.trend = (this.random.next() - 0.5) * 0.004;
        }
        break;
    }
  }
  
  generateCandle(candleIndex: number, totalCandles: number): GeneratedCandle {
    // Update trend dynamics
    this.updateTrendDynamics(candleIndex, totalCandles);
    
    // Check for pullback
    const isPullback = this.random.next() < this.scenario.pullback_frequency;
    const effectiveTrend = isPullback ? -this.trend * 0.5 : this.trend;
    
    // Check for spike
    const isSpike = this.random.next() < this.scenario.spike_chance;
    const spikeMultiplier = isSpike ? (2 + this.random.next() * 3) : 1;
    
    // Calculate price change
    const baseChange = effectiveTrend * this.currentPrice;
    const volatilityChange = this.random.gaussian() * this.scenario.volatility * 0.01 * this.currentPrice;
    const momentumChange = this.momentum * 0.001 * this.currentPrice;
    
    const totalChange = (baseChange + volatilityChange + momentumChange) * spikeMultiplier;
    
    // Update momentum with decay
    this.momentum = this.momentum * 0.95 + (totalChange > 0 ? 0.1 : -0.1);
    
    // Generate OHLC
    const open = this.currentPrice;
    const close = open + totalChange;
    
    // Generate realistic high/low
    const bodySize = Math.abs(close - open);
    const wickMultiplier = 0.3 + this.random.next() * 0.7;
    const upperWick = bodySize * wickMultiplier * (0.5 + this.random.next());
    const lowerWick = bodySize * wickMultiplier * (0.5 + this.random.next());
    
    const high = Math.max(open, close) + upperWick;
    const low = Math.min(open, close) - lowerWick;
    
    // Generate volume (correlated with price movement)
    const baseVolume = 10000 + this.random.next() * 5000;
    const movementFactor = 1 + Math.abs(totalChange / this.currentPrice) * 10;
    const spikeFactor = isSpike ? 2.5 : 1;
    const volume = baseVolume * movementFactor * spikeFactor;
    
    // Update current price
    this.currentPrice = close;
    
    // Calculate timestamp
    const timeframeSeconds = 60; // 1-minute candles
    const timestamp = this.startTime + candleIndex * timeframeSeconds;
    
    const candle: GeneratedCandle = {
      time: timestamp,
      open: Number(open.toFixed(8)),
      high: Number(high.toFixed(8)),
      low: Number(low.toFixed(8)),
      close: Number(close.toFixed(8)),
      volume: Math.round(volume),
    };
    
    this.candleHistory.push(candle);
    return candle;
  }
  
  generateHistoricalCandles(count: number): GeneratedCandle[] {
    const candles: GeneratedCandle[] = [];
    const totalCandles = count;
    
    for (let i = 0; i < count; i++) {
      candles.push(this.generateCandle(i, totalCandles));
    }
    
    return candles;
  }
  
  getCurrentPrice(): number {
    return this.currentPrice;
  }
  
  getLastCandle(): GeneratedCandle | null {
    return this.candleHistory.length > 0 
      ? this.candleHistory[this.candleHistory.length - 1] 
      : null;
  }
  
  // Generate a live tick update (price movement within current candle)
  generateTick(): { price: number; volume: number } {
    const microChange = this.random.gaussian() * this.scenario.volatility * 0.001 * this.currentPrice;
    const newPrice = this.currentPrice + microChange;
    const volume = 100 + this.random.next() * 500;
    
    return {
      price: Number(newPrice.toFixed(8)),
      volume: Math.round(volume),
    };
  }
  
  reset(seed?: number): void {
    this.random = new SeededRandom(seed || Date.now());
    this.startTime = Math.floor(Date.now() / 1000);
    this.currentPrice = this.scenario.base_price;
    this.candleHistory = [];
    this.breakoutTriggered = false;
    this.fakeoutPhase = 'none';
    this.initializeTrend();
  }
}

// Educational Datafeed for TradingView
export class EducationalDatafeed {
  private generator: EducationalPriceGenerator;
  private scenario: EducationalScenarioConfig;
  private symbol: string;
  private subscribers: Map<string, {
    callback: (bar: GeneratedCandle) => void;
    interval: ReturnType<typeof setInterval> | null;
  }> = new Map();
  
  constructor(scenario: EducationalScenarioConfig, symbol: string = 'EDU/USD') {
    this.scenario = scenario;
    this.symbol = symbol;
    this.generator = new EducationalPriceGenerator(scenario);
  }
  
  onReady(callback: (config: object) => void): void {
    setTimeout(() => {
      callback({
        supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D'],
        exchanges: [{
          value: 'NOVA_EDU',
          name: 'NOVA Educational',
          desc: 'NOVA Trade Educational Mode',
        }],
        symbols_types: [{
          name: 'educational',
          value: 'educational',
        }],
      });
    }, 0);
  }
  
  resolveSymbol(
    symbolName: string,
    onResolve: (symbolInfo: object) => void,
    onError: (error: string) => void
  ): void {
    setTimeout(() => {
      onResolve({
        name: this.symbol,
        full_name: this.symbol,
        description: `${this.scenario.name} - Educational Mode`,
        type: 'educational',
        session: '24x7',
        exchange: 'NOVA_EDU',
        listed_exchange: 'NOVA_EDU',
        timezone: 'Etc/UTC',
        format: 'price',
        pricescale: 100000000,
        minmov: 1,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: false,
        supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D'],
        volume_precision: 0,
        data_status: 'streaming',
      });
    }, 0);
  }
  
  getBars(
    symbolInfo: object,
    resolution: string,
    periodParams: { from: number; to: number; countBack?: number; firstDataRequest?: boolean },
    onResult: (bars: GeneratedCandle[], meta: { noData?: boolean }) => void,
    onError: (error: string) => void
  ): void {
    try {
      const countBack = periodParams.countBack || 300;
      
      // Reset generator for fresh historical data
      this.generator.reset();
      const bars = this.generator.generateHistoricalCandles(countBack);
      
      onResult(bars, { noData: bars.length === 0 });
    } catch (error) {
      onError((error as Error).message);
    }
  }
  
  subscribeBars(
    symbolInfo: object,
    resolution: string,
    onTick: (bar: GeneratedCandle) => void,
    listenerGuid: string
  ): void {
    // Start generating live updates
    const interval = setInterval(() => {
      const tick = this.generator.generateTick();
      const lastCandle = this.generator.getLastCandle();
      
      if (lastCandle) {
        // Update the current candle
        const updatedCandle: GeneratedCandle = {
          ...lastCandle,
          close: tick.price,
          high: Math.max(lastCandle.high, tick.price),
          low: Math.min(lastCandle.low, tick.price),
          volume: lastCandle.volume + tick.volume,
        };
        onTick(updatedCandle);
      }
    }, 1000); // Update every second
    
    // Every minute, create a new candle
    const candleInterval = setInterval(() => {
      const totalCandles = this.scenario.duration_minutes;
      const currentIndex = Math.floor((Date.now() / 1000 - this.generator['startTime']) / 60);
      
      if (currentIndex < totalCandles) {
        const newCandle = this.generator.generateCandle(currentIndex, totalCandles);
        onTick(newCandle);
      }
    }, 60000);
    
    this.subscribers.set(listenerGuid, {
      callback: onTick,
      interval: interval,
    });
  }
  
  unsubscribeBars(listenerGuid: string): void {
    const subscriber = this.subscribers.get(listenerGuid);
    if (subscriber?.interval) {
      clearInterval(subscriber.interval);
    }
    this.subscribers.delete(listenerGuid);
  }
  
  getScenario(): EducationalScenarioConfig {
    return this.scenario;
  }
  
  getCurrentPrice(): number {
    return this.generator.getCurrentPrice();
  }
  
  setScenario(scenario: EducationalScenarioConfig): void {
    this.scenario = scenario;
    this.generator = new EducationalPriceGenerator(scenario);
  }
}

// Store to manage educational mode state
class EducationalModeStore {
  private activeScenario: EducationalScenarioConfig | null = null;
  private datafeed: EducationalDatafeed | null = null;
  private isActive: boolean = false;
  
  activate(scenario: EducationalScenarioConfig): EducationalDatafeed {
    this.activeScenario = scenario;
    this.datafeed = new EducationalDatafeed(scenario, 'EDU/USD');
    this.isActive = true;
    return this.datafeed;
  }
  
  deactivate(): void {
    this.activeScenario = null;
    this.datafeed = null;
    this.isActive = false;
  }
  
  getDatafeed(): EducationalDatafeed | null {
    return this.datafeed;
  }
  
  getScenario(): EducationalScenarioConfig | null {
    return this.activeScenario;
  }
  
  isEducationalMode(): boolean {
    return this.isActive;
  }
  
  getCurrentPrice(): number {
    return this.datafeed?.getCurrentPrice() || 0;
  }
  
  getAvailableScenarios(): EducationalScenarioConfig[] {
    return DEFAULT_SCENARIOS.filter(s => s.is_active);
  }
}

export const educationalModeStore = new EducationalModeStore();
export default educationalModeStore;
