'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Clock,
  DollarSign,
  Plus,
  Minus,
  Search,
  Star,
  StarOff,
  CheckCircle,
  AlertCircle,
  Timer,
  CandlestickChart,
  LineChart as LineChartIcon,
  Globe,
  Signal,
  X,
  Shield,
  ArrowUpDown,
  Percent,
  Activity,
  Target,
  AlertTriangle,
  RefreshCw,
  Settings,
  ChevronUp,
  Maximize2
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useTradingAccountStore } from '@/lib/trading-store';
import { useAdminSessionStore } from '@/lib/admin-store';
import { marketAssets } from '@/lib/data';
import { MarketAsset } from '@/lib/types';
import { MarginPosition } from '@/lib/trading-types';

// Filter forex assets
const forexAssets = marketAssets.filter(a => a.type === 'forex');

// Leverage options for forex
const leverageOptions = [10, 20, 50, 100, 200, 500];

// Currency flag emojis
const currencyFlags: Record<string, string> = {
  'EUR': '🇪🇺',
  'USD': '🇺🇸',
  'GBP': '🇬🇧',
  'JPY': '🇯🇵',
  'AUD': '🇦🇺',
  'CAD': '🇨🇦',
  'CHF': '🇨🇭',
  'NZD': '🇳🇿',
  'CNY': '🇨🇳',
  'SGD': '🇸🇬',
};

// Chart timeframes
const timeframes = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1h', value: '60' },
  { label: '4h', value: '240' },
  { label: '1D', value: 'D' },
];

// TradingView Chart Component (ready for real integration)
function TradingViewChart({ 
  symbol, 
  interval = '15',
  height = 400 
}: { 
  symbol: string; 
  interval?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Convert symbol format (EUR/USD -> EURUSD)
  const tvSymbol = `FX:${symbol.replace('/', '')}`;
  
  useEffect(() => {
    // In production, initialize TradingView widget here
    // For now, render a placeholder chart
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, [symbol, interval]);

  // Placeholder candlestick chart using SVG
  const generateCandlesticks = () => {
    const candles = [];
    let price = 1.0850;
    
    for (let i = 0; i < 50; i++) {
      const open = price;
      const change = (Math.random() - 0.48) * 0.003;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 0.001;
      const low = Math.min(open, close) - Math.random() * 0.001;
      price = close;
      
      candles.push({ open, high, low, close, bullish: close >= open });
    }
    return candles;
  };

  const [candles] = useState(generateCandlesticks);
  
  const minPrice = Math.min(...candles.map(c => c.low)) - 0.001;
  const maxPrice = Math.max(...candles.map(c => c.high)) + 0.001;
  const priceRange = maxPrice - minPrice;
  
  const candleWidth = 12;
  const gap = 4;
  const chartWidth = candles.length * (candleWidth + gap);
  const chartHeight = height - 50;
  
  const scaleY = (price: number) => chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  return (
    <div 
      ref={containerRef}
      className="relative bg-charcoal/50 rounded-xl overflow-hidden border border-white/5"
      style={{ height }}
    >
      {!isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-gold animate-spin" />
        </div>
      ) : (
        <>
          {/* Chart Header */}
          <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{tvSymbol}</span>
            <span className="text-xs text-slate-500">• {interval}m</span>
          </div>
          
          {/* TradingView Branding */}
          <div className="absolute top-2 right-3 z-10">
            <span className="text-[10px] text-slate-500">TradingView</span>
          </div>
          
          {/* Price Scale */}
          <div className="absolute right-2 top-8 bottom-8 w-14 flex flex-col justify-between text-right">
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <span key={i} className="text-[10px] text-slate-500 font-mono">
                {(maxPrice - priceRange * pct).toFixed(5)}
              </span>
            ))}
          </div>
          
          {/* Candlestick Chart */}
          <div className="absolute inset-0 pt-8 pb-6 pl-2 pr-16 overflow-hidden">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                <line
                  key={i}
                  x1="0"
                  y1={pct * chartHeight}
                  x2={chartWidth}
                  y2={pct * chartHeight}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                />
              ))}
              
              {/* Candlesticks */}
              {candles.map((candle, i) => {
                const x = i * (candleWidth + gap) + candleWidth / 2;
                const bodyTop = scaleY(Math.max(candle.open, candle.close));
                const bodyBottom = scaleY(Math.min(candle.open, candle.close));
                const bodyHeight = Math.max(1, bodyBottom - bodyTop);
                
                return (
                  <g key={i}>
                    {/* Wick */}
                    <line
                      x1={x}
                      y1={scaleY(candle.high)}
                      x2={x}
                      y2={scaleY(candle.low)}
                      stroke={candle.bullish ? '#22c55e' : '#ef4444'}
                      strokeWidth="1"
                    />
                    {/* Body */}
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={bodyHeight}
                      fill={candle.bullish ? '#22c55e' : '#ef4444'}
                      rx="1"
                    />
                  </g>
                );
              })}
              
              {/* Current price line */}
              <line
                x1="0"
                y1={scaleY(candles[candles.length - 1].close)}
                x2={chartWidth}
                y2={scaleY(candles[candles.length - 1].close)}
                stroke="#D4AF37"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            </svg>
          </div>
          
          {/* Volume bars */}
          <div className="absolute bottom-0 left-2 right-16 h-8 flex items-end gap-[4px] px-0.5">
            {candles.map((candle, i) => (
              <div 
                key={i}
                className={`w-[12px] ${candle.bullish ? 'bg-profit/30' : 'bg-loss/30'}`}
                style={{ height: `${20 + Math.random() * 80}%` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ForexTradingPage() {
  const { user } = useAuthStore();
  const { 
    marginAccount,
    marginPositions,
    initializeAccounts,
    openMarginPosition,
    closeMarginPosition,
    updateMarginPositionPrice
  } = useTradingAccountStore();
  
  // Get admin session for signal-controlled outcomes
  const { activeSession, getCurrentSignal } = useAdminSessionStore();
  
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset>(forexAssets[0]);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['EUR/USD', 'GBP/USD', 'USD/JPY']);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [bidPrice, setBidPrice] = useState(0);
  const [askPrice, setAskPrice] = useState(0);
  const [hasActiveSignal, setHasActiveSignal] = useState(false);
  
  // Trade form state
  const [orderSide, setOrderSide] = useState<'long' | 'short'>('long');
  const [lotSize, setLotSize] = useState(0.1);
  const [leverage, setLeverage] = useState(100);
  const [stopLoss, setStopLoss] = useState<number | undefined>();
  const [takeProfit, setTakeProfit] = useState<number | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('15');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [positionToClose, setPositionToClose] = useState<MarginPosition | null>(null);
  
  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Initialize accounts
  useEffect(() => {
    if (user && !marginAccount) {
      initializeAccounts(user.id);
    }
  }, [user, marginAccount, initializeAccounts]);

  // Simulate real-time price updates
  useEffect(() => {
    if (!selectedAsset) return;
    
    setCurrentPrice(selectedAsset.price);
    const spread = selectedAsset.price * 0.0001; // Typical forex spread
    setBidPrice(selectedAsset.price - spread / 2);
    setAskPrice(selectedAsset.price + spread / 2);
    
    // Generate initial price history
    const initialHistory: number[] = [];
    let price = selectedAsset.price;
    for (let i = 0; i < 100; i++) {
      price = price * (1 + (Math.random() - 0.5) * 0.0002);
      initialHistory.push(price);
    }
    setPriceHistory(initialHistory);

    // Update price every 500ms
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 0.0003 * prev;
        const newPrice = prev + change;
        const spread = newPrice * 0.0001;
        setBidPrice(newPrice - spread / 2);
        setAskPrice(newPrice + spread / 2);
        setPriceHistory(history => [...history.slice(-99), newPrice]);
        
        // Update all positions with this symbol
        updateMarginPositionPrice(selectedAsset.symbol, newPrice);
        
        return newPrice;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [selectedAsset, updateMarginPositionPrice]);

  // Check for active admin signal
  useEffect(() => {
    if (selectedAsset && activeSession) {
      const signal = getCurrentSignal(selectedAsset.id);
      setHasActiveSignal(!!signal);
    } else {
      setHasActiveSignal(false);
    }
  }, [selectedAsset, activeSession, getCurrentSignal]);

  // Calculate position metrics
  const calculatePositionValue = () => {
    const standardLot = 100000; // Standard forex lot
    const units = lotSize * standardLot;
    const notional = units * (orderSide === 'long' ? askPrice : bidPrice);
    const margin = notional / leverage;
    const pipValue = (units * 0.0001).toFixed(2);
    
    return { units, notional, margin, pipValue };
  };

  const metrics = calculatePositionValue();

  // Handle trade execution
  const handleOpenPosition = () => {
    if (!marginAccount || !selectedAsset) return;
    
    const price = orderSide === 'long' ? askPrice : bidPrice;
    const standardLot = 100000;
    const units = lotSize * standardLot;
    const fee = units * price * 0.00002; // 2 pips commission
    
    const result = openMarginPosition(
      selectedAsset.symbol,
      selectedAsset.name,
      'forex',
      orderSide,
      units,
      price,
      leverage,
      fee,
      stopLoss,
      takeProfit
    );
    
    if (result.success) {
      setNotification({ type: 'success', message: `Opened ${orderSide.toUpperCase()} position on ${selectedAsset.symbol}` });
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to open position' });
    }
    
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle position close
  const handleClosePosition = (position: MarginPosition) => {
    const price = position.side === 'long' ? bidPrice : askPrice;
    const fee = position.notional * 0.00002;
    
    const result = closeMarginPosition(position.id, price, fee);
    
    if (result.success) {
      setNotification({ 
        type: result.realizedPnL && result.realizedPnL >= 0 ? 'success' : 'error', 
        message: `Closed position: ${result.realizedPnL && result.realizedPnL >= 0 ? '+' : ''}$${result.realizedPnL?.toFixed(2)}` 
      });
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to close position' });
    }
    
    setShowCloseModal(false);
    setPositionToClose(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const filteredAssets = forexAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => {
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(5);
  };

  const getPriceChange = () => {
    if (priceHistory.length < 2) return 0;
    const oldPrice = priceHistory[0];
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  };

  const getBaseQuote = (symbol: string) => {
    const parts = symbol.split('/');
    return { base: parts[0], quote: parts[1] };
  };

  // Get positions for current symbol
  const symbolPositions = marginPositions.filter(p => p.symbol === selectedAsset?.symbol);
  const allForexPositions = marginPositions.filter(p => p.type === 'forex');

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Top Bar - Symbol Info & Account Summary */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Symbol Selector & Info */}
        <div className="flex-1 bg-obsidian rounded-2xl p-4 border border-gold/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Symbol Selector */}
            <div className="relative">
              <button
                onClick={() => setShowAssetSelector(!showAssetSelector)}
                className="flex items-center gap-3 px-4 py-2 bg-charcoal rounded-xl hover:bg-white/10 transition-all"
              >
                <div className="flex items-center -space-x-1">
                  <span className="text-xl">{currencyFlags[getBaseQuote(selectedAsset?.symbol || '').base] || '💱'}</span>
                  <span className="text-xl">{currencyFlags[getBaseQuote(selectedAsset?.symbol || '').quote] || '💱'}</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-cream">{selectedAsset?.symbol}</p>
                  <p className="text-xs text-slate-500">{selectedAsset?.name}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAssetSelector ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Asset Selector Dropdown */}
              <AnimatePresence>
                {showAssetSelector && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-80 bg-charcoal border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                  >
                    {/* Search */}
                    <div className="p-3 border-b border-white/5">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search pairs..."
                          className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold/50"
                        />
                      </div>
                    </div>
                    
                    {/* Favorites */}
                    {favorites.length > 0 && (
                      <div className="p-2 border-b border-white/5">
                        <p className="text-xs text-slate-500 px-2 mb-1">Favorites</p>
                        {forexAssets.filter(a => favorites.includes(a.symbol)).map(asset => (
                          <ForexAssetRow
                            key={asset.id}
                            asset={asset}
                            isSelected={selectedAsset?.id === asset.id}
                            isFavorite={true}
                            onSelect={() => {
                              setSelectedAsset(asset);
                              setShowAssetSelector(false);
                            }}
                            onToggleFavorite={() => toggleFavorite(asset.symbol)}
                            currencyFlags={currencyFlags}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* All Pairs */}
                    <div className="max-h-64 overflow-y-auto p-2">
                      <p className="text-xs text-slate-500 px-2 mb-1">All Pairs</p>
                      {filteredAssets.map(asset => (
                        <ForexAssetRow
                          key={asset.id}
                          asset={asset}
                          isSelected={selectedAsset?.id === asset.id}
                          isFavorite={favorites.includes(asset.symbol)}
                          onSelect={() => {
                            setSelectedAsset(asset);
                            setShowAssetSelector(false);
                          }}
                          onToggleFavorite={() => toggleFavorite(asset.symbol)}
                          currencyFlags={currencyFlags}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Price Display */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-cream">{formatPrice(currentPrice)}</p>
                <p className={`text-sm ${getPriceChange() >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {getPriceChange() >= 0 ? '+' : ''}{getPriceChange().toFixed(3)}%
                </p>
              </div>
              
              {/* Bid/Ask */}
              <div className="flex gap-3">
                <div className="text-center px-3 py-1 bg-loss/10 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase">Bid</p>
                  <p className="text-sm font-mono text-loss">{formatPrice(bidPrice)}</p>
                </div>
                <div className="text-center px-3 py-1 bg-profit/10 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase">Ask</p>
                  <p className="text-sm font-mono text-profit">{formatPrice(askPrice)}</p>
                </div>
              </div>
              
              {/* Spread */}
              <div className="text-center px-3 py-1 bg-white/5 rounded-lg">
                <p className="text-[10px] text-slate-500 uppercase">Spread</p>
                <p className="text-sm font-mono text-cream">{((askPrice - bidPrice) * 10000).toFixed(1)} pips</p>
              </div>
            </div>
            
            {/* Admin Signal Indicator */}
            {hasActiveSignal && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-lg">
                <Signal className="w-4 h-4 text-gold animate-pulse" />
                <span className="text-xs text-gold font-medium">Active Signal</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Account Summary */}
        <div className="w-full lg:w-80 bg-obsidian rounded-2xl p-4 border border-gold/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">Margin Account</h3>
            <div className="flex items-center gap-1 text-xs text-gold">
              <Shield className="w-3 h-3" />
              {leverage}x
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Balance</p>
              <p className="text-lg font-semibold text-cream">${marginAccount?.balance.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Equity</p>
              <p className="text-lg font-semibold text-cream">${marginAccount?.equity.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Used Margin</p>
              <p className="text-sm font-medium text-gold">${marginAccount?.marginUsed.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Free Margin</p>
              <p className="text-sm font-medium text-profit">${marginAccount?.freeMargin.toFixed(2) || '0.00'}</p>
            </div>
          </div>
          {marginAccount?.marginLevel && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Margin Level</span>
                <span className={marginAccount.marginLevel > 100 ? 'text-profit' : 'text-loss'}>
                  {marginAccount.marginLevel.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1">
        {/* Chart Section */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Timeframe Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {timeframes.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setSelectedTimeframe(tf.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    selectedTimeframe === tf.value
                      ? 'bg-gold text-void'
                      : 'bg-white/5 text-slate-400 hover:text-cream hover:bg-white/10'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-400 hover:text-cream hover:bg-white/5 rounded-lg transition-all">
                <CandlestickChart className="w-4 h-4" />
              </button>
              <button className="p-2 text-slate-400 hover:text-cream hover:bg-white/5 rounded-lg transition-all">
                <LineChartIcon className="w-4 h-4" />
              </button>
              <button className="p-2 text-slate-400 hover:text-cream hover:bg-white/5 rounded-lg transition-all">
                <Settings className="w-4 h-4" />
              </button>
              <button className="p-2 text-slate-400 hover:text-cream hover:bg-white/5 rounded-lg transition-all">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* TradingView Chart */}
          <TradingViewChart 
            symbol={selectedAsset?.symbol || 'EUR/USD'} 
            interval={selectedTimeframe}
            height={450}
          />
          
          {/* Open Positions */}
          {allForexPositions.length > 0 && (
            <div className="bg-obsidian rounded-2xl border border-gold/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-cream">Open Positions ({allForexPositions.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">Symbol</th>
                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">Side</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Size</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Entry</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Current</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">P&L</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Margin</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allForexPositions.map((position) => (
                      <tr key={position.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-cream">{position.symbol}</span>
                            <span className="text-xs text-gold">{position.leverage}x</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            position.side === 'long' 
                              ? 'bg-profit/20 text-profit' 
                              : 'bg-loss/20 text-loss'
                          }`}>
                            {position.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-cream">
                          {(position.qty / 100000).toFixed(2)} lots
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">
                          {formatPrice(position.avgEntry)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-cream">
                          {formatPrice(position.currentPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${position.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                          </span>
                          <span className={`block text-xs ${position.unrealizedPnLPercent >= 0 ? 'text-profit/70' : 'text-loss/70'}`}>
                            {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-gold">
                          ${position.requiredMargin.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setPositionToClose(position);
                              setShowCloseModal(true);
                            }}
                            className="px-3 py-1 bg-loss/20 text-loss hover:bg-loss/30 rounded-lg text-xs font-medium transition-all"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        {/* Trading Panel */}
        <div className="w-full lg:w-80 bg-obsidian rounded-2xl p-4 border border-gold/10 flex flex-col">
          <h3 className="font-semibold text-cream mb-4">Place Order</h3>
          
          {/* Buy/Sell Toggle */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setOrderSide('long')}
              className={`py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                orderSide === 'long'
                  ? 'bg-profit text-void'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              BUY / LONG
            </button>
            <button
              onClick={() => setOrderSide('short')}
              className={`py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                orderSide === 'short'
                  ? 'bg-loss text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              SELL / SHORT
            </button>
          </div>
          
          {/* Lot Size */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-cream">Lot Size</label>
              <span className="text-xs text-slate-500">{(metrics.units).toLocaleString()} units</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLotSize(Math.max(0.01, lotSize - 0.01))}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
              >
                <Minus className="w-4 h-4 text-slate-400" />
              </button>
              <input
                type="number"
                value={lotSize}
                onChange={(e) => setLotSize(Math.max(0.01, parseFloat(e.target.value) || 0))}
                step="0.01"
                className="flex-1 bg-charcoal border border-white/10 rounded-lg px-3 py-2 text-center text-cream font-mono focus:outline-none focus:border-gold/50"
              />
              <button
                onClick={() => setLotSize(lotSize + 0.01)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
              >
                <Plus className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex gap-2">
              {[0.01, 0.1, 0.5, 1.0].map(size => (
                <button
                  key={size}
                  onClick={() => setLotSize(size)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    lotSize === size
                      ? 'bg-gold text-void'
                      : 'bg-white/5 text-slate-400 hover:text-cream'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          {/* Leverage */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-cream">Leverage</label>
              <span className="text-gold font-semibold">{leverage}x</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {leverageOptions.map(lev => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    leverage === lev
                      ? 'bg-gold text-void'
                      : 'bg-white/5 text-slate-400 hover:text-cream'
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>
          
          {/* Advanced Options */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full py-2 text-sm text-slate-400 hover:text-cream transition-all"
          >
            <span>Stop Loss / Take Profit</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 py-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Stop Loss</label>
                    <input
                      type="number"
                      value={stopLoss || ''}
                      onChange={(e) => setStopLoss(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder={formatPrice(currentPrice * (orderSide === 'long' ? 0.99 : 1.01))}
                      step="0.0001"
                      className="w-full bg-charcoal border border-white/10 rounded-lg px-3 py-2 text-sm text-cream placeholder:text-slate-600 focus:outline-none focus:border-loss/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Take Profit</label>
                    <input
                      type="number"
                      value={takeProfit || ''}
                      onChange={(e) => setTakeProfit(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder={formatPrice(currentPrice * (orderSide === 'long' ? 1.01 : 0.99))}
                      step="0.0001"
                      className="w-full bg-charcoal border border-white/10 rounded-lg px-3 py-2 text-sm text-cream placeholder:text-slate-600 focus:outline-none focus:border-profit/50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Order Summary */}
          <div className="bg-charcoal rounded-xl p-3 my-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Entry Price</span>
              <span className={`font-mono ${orderSide === 'long' ? 'text-profit' : 'text-loss'}`}>
                {formatPrice(orderSide === 'long' ? askPrice : bidPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Position Value</span>
              <span className="font-mono text-cream">${metrics.notional.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Required Margin</span>
              <span className="font-mono text-gold">${metrics.margin.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Pip Value</span>
              <span className="font-mono text-cream">${metrics.pipValue}</span>
            </div>
          </div>
          
          {/* Execute Button */}
          <button
            onClick={handleOpenPosition}
            disabled={!marginAccount || metrics.margin > (marginAccount?.freeMargin || 0)}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              orderSide === 'long'
                ? 'bg-profit hover:bg-profit/90 text-void'
                : 'bg-loss hover:bg-loss/90 text-white'
            }`}
          >
            {orderSide === 'long' ? 'BUY' : 'SELL'} {selectedAsset?.symbol}
          </button>
          
          {marginAccount && metrics.margin > marginAccount.freeMargin && (
            <p className="text-xs text-loss text-center mt-2">
              Insufficient margin. Required: ${metrics.margin.toFixed(2)}
            </p>
          )}
          
          {/* Risk Warning */}
          <div className="mt-4 p-3 bg-loss/10 border border-loss/20 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-loss flex-shrink-0 mt-0.5" />
              <p className="text-xs text-loss/80">
                Trading forex with leverage involves significant risk. You could lose more than your initial investment.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Close Position Modal */}
      <AnimatePresence>
        {showCloseModal && positionToClose && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCloseModal(false)}
              className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-obsidian rounded-2xl p-6 border border-gold/20 z-50"
            >
              <h3 className="text-xl font-semibold text-cream mb-4">Close Position</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Symbol</span>
                  <span className="font-medium text-cream">{positionToClose.symbol}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Side</span>
                  <span className={positionToClose.side === 'long' ? 'text-profit' : 'text-loss'}>
                    {positionToClose.side.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Size</span>
                  <span className="text-cream">{(positionToClose.qty / 100000).toFixed(2)} lots</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Entry Price</span>
                  <span className="font-mono text-cream">{formatPrice(positionToClose.avgEntry)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Price</span>
                  <span className="font-mono text-cream">
                    {formatPrice(positionToClose.side === 'long' ? bidPrice : askPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-slate-400">Unrealized P&L</span>
                  <span className={`font-semibold ${positionToClose.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {positionToClose.unrealizedPnL >= 0 ? '+' : ''}${positionToClose.unrealizedPnL.toFixed(2)}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-3 bg-white/5 text-slate-400 hover:bg-white/10 rounded-xl font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleClosePosition(positionToClose)}
                  className="flex-1 py-3 bg-loss text-white hover:bg-loss/90 rounded-xl font-medium transition-all"
                >
                  Close Position
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
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 ${
              notification.type === 'success' 
                ? 'bg-profit text-void' 
                : 'bg-loss text-white'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Forex Asset Row Component
function ForexAssetRow({ 
  asset, 
  isSelected, 
  isFavorite, 
  onSelect, 
  onToggleFavorite,
  currencyFlags 
}: { 
  asset: MarketAsset;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  currencyFlags: Record<string, string>;
}) {
  const parts = asset.symbol.split('/');
  const base = parts[0];
  const quote = parts[1];
  
  return (
    <div
      className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-all ${
        isSelected ? 'bg-gold/10' : 'hover:bg-white/5'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="text-slate-500 hover:text-gold transition-colors"
      >
        {isFavorite ? (
          <Star className="w-4 h-4 fill-gold text-gold" />
        ) : (
          <StarOff className="w-4 h-4" />
        )}
      </button>
      <div className="flex-1 flex items-center gap-3" onClick={onSelect}>
        <div className="flex items-center -space-x-1">
          <span className="text-lg">{currencyFlags[base] || '💱'}</span>
          <span className="text-lg">{currencyFlags[quote] || '💱'}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-cream">{asset.symbol}</p>
          <p className="text-xs text-slate-500">{asset.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-cream">{asset.price.toFixed(4)}</p>
          <p className={`text-xs ${asset.changePercent24h >= 0 ? 'text-profit' : 'text-loss'}`}>
            {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}
