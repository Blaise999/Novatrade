'use client';

import { useState, useEffect, useRef } from 'react';
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
  CandlestickChart,
  LineChart as LineChartIcon,
  Building2,
  RefreshCw,
  Settings,
  Maximize2,
  Wallet,
  PieChart,
  History,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useTradingAccountStore } from '@/lib/trading-store';
import { marketAssets } from '@/lib/data';
import { MarketAsset } from '@/lib/types';
import { StockPosition } from '@/lib/trading-types';

// Filter stock assets
const stockAssets = marketAssets.filter(a => a.type === 'stock');

// Stock company info
const stockInfo: Record<string, { color: string; sector: string }> = {
  'AAPL': { color: 'from-gray-400 to-gray-500', sector: 'Technology' },
  'NVDA': { color: 'from-green-500 to-green-600', sector: 'Technology' },
  'TSLA': { color: 'from-red-500 to-red-600', sector: 'Automotive' },
  'MSFT': { color: 'from-blue-500 to-blue-600', sector: 'Technology' },
  'GOOGL': { color: 'from-yellow-500 to-red-500', sector: 'Technology' },
  'AMZN': { color: 'from-orange-500 to-orange-600', sector: 'Consumer' },
  'META': { color: 'from-blue-600 to-blue-700', sector: 'Technology' },
};

// Chart timeframes
const timeframes = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1h', value: '60' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
];

// TradingView Chart Component (placeholder)
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
  
  const tvSymbol = `NASDAQ:${symbol}`;
  
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, [symbol, interval]);

  // Generate candlestick data
  const generateCandlesticks = () => {
    const candles = [];
    let price = 180;
    
    for (let i = 0; i < 50; i++) {
      const open = price;
      const change = (Math.random() - 0.48) * 5;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      price = close;
      
      candles.push({ open, high, low, close, bullish: close >= open });
    }
    return candles;
  };

  const [candles] = useState(generateCandlesticks);
  
  const minPrice = Math.min(...candles.map(c => c.low)) - 5;
  const maxPrice = Math.max(...candles.map(c => c.high)) + 5;
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
          <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">{tvSymbol}</span>
            <span className="text-xs text-slate-500">• {interval}m</span>
          </div>
          
          <div className="absolute top-2 right-3 z-10">
            <span className="text-[10px] text-slate-500">TradingView</span>
          </div>
          
          <div className="absolute right-2 top-8 bottom-8 w-12 flex flex-col justify-between text-right">
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
              <span key={i} className="text-[10px] text-slate-500 font-mono">
                ${(maxPrice - priceRange * pct).toFixed(2)}
              </span>
            ))}
          </div>
          
          <div className="absolute inset-0 pt-8 pb-6 pl-2 pr-14 overflow-hidden">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              preserveAspectRatio="none"
              className="w-full h-full"
            >
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
              
              {candles.map((candle, i) => {
                const x = i * (candleWidth + gap) + candleWidth / 2;
                const bodyTop = scaleY(Math.max(candle.open, candle.close));
                const bodyBottom = scaleY(Math.min(candle.open, candle.close));
                const bodyHeight = Math.max(1, bodyBottom - bodyTop);
                
                return (
                  <g key={i}>
                    <line
                      x1={x}
                      y1={scaleY(candle.high)}
                      x2={x}
                      y2={scaleY(candle.low)}
                      stroke={candle.bullish ? '#22c55e' : '#ef4444'}
                      strokeWidth="1"
                    />
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
          
          <div className="absolute bottom-0 left-2 right-14 h-8 flex items-end gap-[4px] px-0.5">
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

export default function StocksTradingPage() {
  const { user } = useAuthStore();
  const { 
    spotAccount,
    stockPositions,
    initializeAccounts,
    executeStockBuy,
    executeStockSell,
    updateStockPositionPrice,
    calculateSpotEquity
  } = useTradingAccountStore();
  
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset>(stockAssets[0]);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['AAPL', 'NVDA', 'TSLA']);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [bidPrice, setBidPrice] = useState(0);
  const [askPrice, setAskPrice] = useState(0);
  
  // Order form state
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'shares' | 'dollars'>('shares');
  const [quantity, setQuantity] = useState(1);
  const [dollarAmount, setDollarAmount] = useState(100);
  const [selectedTimeframe, setSelectedTimeframe] = useState('15');
  const [showSellModal, setShowSellModal] = useState(false);
  const [positionToSell, setPositionToSell] = useState<StockPosition | null>(null);
  const [sellQuantity, setSellQuantity] = useState(0);
  
  // Market status
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed' | 'pre' | 'after'>('open');
  
  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Initialize accounts
  useEffect(() => {
    if (user && !spotAccount) {
      initializeAccounts(user.id);
    }
  }, [user, spotAccount, initializeAccounts]);

  // Check market hours
  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const hour = now.getUTCHours();
      const day = now.getUTCDay();
      
      if (day === 0 || day === 6) {
        setMarketStatus('closed');
      } else if (hour >= 14 && hour < 21) { // 9:30 AM - 4 PM EST
        setMarketStatus('open');
      } else if (hour >= 9 && hour < 14) {
        setMarketStatus('pre');
      } else if (hour >= 21 && hour < 25) {
        setMarketStatus('after');
      } else {
        setMarketStatus('closed');
      }
    };
    
    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Simulate real-time price updates
  useEffect(() => {
    if (!selectedAsset) return;
    
    setCurrentPrice(selectedAsset.price);
    const spread = selectedAsset.price * 0.001; // Stock spread
    setBidPrice(selectedAsset.price - spread / 2);
    setAskPrice(selectedAsset.price + spread / 2);
    
    const initialHistory: number[] = [];
    let price = selectedAsset.price;
    for (let i = 0; i < 100; i++) {
      price = price * (1 + (Math.random() - 0.5) * 0.002);
      initialHistory.push(price);
    }
    setPriceHistory(initialHistory);

    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 0.003 * prev;
        const newPrice = prev + change;
        const spread = newPrice * 0.001;
        setBidPrice(newPrice - spread / 2);
        setAskPrice(newPrice + spread / 2);
        setPriceHistory(history => [...history.slice(-99), newPrice]);
        
        // Update all positions with this symbol
        updateStockPositionPrice(selectedAsset.symbol, newPrice);
        
        return newPrice;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedAsset, updateStockPositionPrice]);

  // Calculate order details
  const calculateOrderDetails = () => {
    if (orderMode === 'shares') {
      const cost = quantity * askPrice;
      const fee = Math.max(0.99, cost * 0.001); // $0.99 min or 0.1%
      return { shares: quantity, cost, fee, total: cost + fee };
    } else {
      const shares = Math.floor(dollarAmount / askPrice);
      const cost = shares * askPrice;
      const fee = Math.max(0.99, cost * 0.001);
      return { shares, cost, fee, total: cost + fee };
    }
  };

  const orderDetails = calculateOrderDetails();

  // Handle buy order
  const handleBuy = () => {
    if (!spotAccount || !selectedAsset) return;
    
    const result = executeStockBuy(
      selectedAsset.symbol,
      selectedAsset.name,
      orderDetails.shares,
      askPrice,
      orderDetails.fee
    );
    
    if (result.success) {
      setNotification({ type: 'success', message: `Bought ${orderDetails.shares} shares of ${selectedAsset.symbol}` });
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to execute order' });
    }
    
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle sell order
  const handleSell = (position: StockPosition, qty: number) => {
    const result = executeStockSell(
      position.id,
      qty,
      bidPrice,
      Math.max(0.99, qty * bidPrice * 0.001)
    );
    
    if (result.success) {
      const pnlText = result.realizedPnL && result.realizedPnL >= 0 
        ? `+$${result.realizedPnL.toFixed(2)}` 
        : `-$${Math.abs(result.realizedPnL || 0).toFixed(2)}`;
      setNotification({ 
        type: result.realizedPnL && result.realizedPnL >= 0 ? 'success' : 'error', 
        message: `Sold ${qty} shares: ${pnlText}` 
      });
    } else {
      setNotification({ type: 'error', message: result.error || 'Failed to sell' });
    }
    
    setShowSellModal(false);
    setPositionToSell(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const filteredAssets = stockAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriceChange = () => {
    if (priceHistory.length < 2) return 0;
    const oldPrice = priceHistory[0];
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  };

  // Calculate portfolio stats
  const totalPortfolioValue = stockPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const totalUnrealizedPnL = stockPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

  // Get position for current symbol
  const currentPosition = stockPositions.find(p => p.symbol === selectedAsset?.symbol);

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
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stockInfo[selectedAsset?.symbol || '']?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                  <Building2 className="w-5 h-5 text-white" />
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
                    <div className="p-3 border-b border-white/5">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search stocks..."
                          className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-cream placeholder:text-slate-500 focus:outline-none focus:border-gold/50"
                        />
                      </div>
                    </div>
                    
                    {favorites.length > 0 && (
                      <div className="p-2 border-b border-white/5">
                        <p className="text-xs text-slate-500 px-2 mb-1">Watchlist</p>
                        {stockAssets.filter(a => favorites.includes(a.symbol)).map(asset => (
                          <StockAssetRow
                            key={asset.id}
                            asset={asset}
                            isSelected={selectedAsset?.id === asset.id}
                            isFavorite={true}
                            onSelect={() => {
                              setSelectedAsset(asset);
                              setShowAssetSelector(false);
                            }}
                            onToggleFavorite={() => toggleFavorite(asset.symbol)}
                            stockInfo={stockInfo}
                          />
                        ))}
                      </div>
                    )}
                    
                    <div className="max-h-64 overflow-y-auto p-2">
                      <p className="text-xs text-slate-500 px-2 mb-1">All Stocks</p>
                      {filteredAssets.map(asset => (
                        <StockAssetRow
                          key={asset.id}
                          asset={asset}
                          isSelected={selectedAsset?.id === asset.id}
                          isFavorite={favorites.includes(asset.symbol)}
                          onSelect={() => {
                            setSelectedAsset(asset);
                            setShowAssetSelector(false);
                          }}
                          onToggleFavorite={() => toggleFavorite(asset.symbol)}
                          stockInfo={stockInfo}
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
                <p className="text-2xl font-mono font-bold text-cream">${currentPrice.toFixed(2)}</p>
                <p className={`text-sm ${getPriceChange() >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {getPriceChange() >= 0 ? '+' : ''}{getPriceChange().toFixed(2)}%
                </p>
              </div>
              
              {/* Bid/Ask */}
              <div className="flex gap-3">
                <div className="text-center px-3 py-1 bg-loss/10 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase">Bid</p>
                  <p className="text-sm font-mono text-loss">${bidPrice.toFixed(2)}</p>
                </div>
                <div className="text-center px-3 py-1 bg-profit/10 rounded-lg">
                  <p className="text-[10px] text-slate-500 uppercase">Ask</p>
                  <p className="text-sm font-mono text-profit">${askPrice.toFixed(2)}</p>
                </div>
              </div>
              
              {/* Market Status */}
              <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                marketStatus === 'open' ? 'bg-profit/10' :
                marketStatus === 'pre' || marketStatus === 'after' ? 'bg-gold/10' :
                'bg-loss/10'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  marketStatus === 'open' ? 'bg-profit animate-pulse' :
                  marketStatus === 'pre' || marketStatus === 'after' ? 'bg-gold' :
                  'bg-loss'
                }`} />
                <span className={`text-xs font-medium ${
                  marketStatus === 'open' ? 'text-profit' :
                  marketStatus === 'pre' || marketStatus === 'after' ? 'text-gold' :
                  'text-loss'
                }`}>
                  {marketStatus === 'open' ? 'Market Open' :
                   marketStatus === 'pre' ? 'Pre-Market' :
                   marketStatus === 'after' ? 'After Hours' : 'Market Closed'}
                </span>
              </div>
            </div>
            
            {/* Current Position Badge */}
            {currentPosition && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-lg">
                <PieChart className="w-4 h-4 text-gold" />
                <span className="text-xs text-gold font-medium">
                  Own {currentPosition.qty} shares
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Account Summary */}
        <div className="w-full lg:w-80 bg-obsidian rounded-2xl p-4 border border-gold/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400">Brokerage Account</h3>
            <Wallet className="w-4 h-4 text-gold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Cash Balance</p>
              <p className="text-lg font-semibold text-cream">${spotAccount?.cash.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Portfolio Value</p>
              <p className="text-lg font-semibold text-cream">${totalPortfolioValue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Equity</p>
              <p className="text-sm font-medium text-gold">${((spotAccount?.cash || 0) + totalPortfolioValue).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Unrealized P&L</p>
              <p className={`text-sm font-medium ${totalUnrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
              </p>
            </div>
          </div>
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
            symbol={selectedAsset?.symbol || 'AAPL'} 
            interval={selectedTimeframe}
            height={450}
          />
          
          {/* Holdings */}
          {stockPositions.length > 0 && (
            <div className="bg-obsidian rounded-2xl border border-gold/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-cream">Your Holdings ({stockPositions.length})</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Total P&L:</span>
                  <span className={totalUnrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}>
                    {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-medium">Symbol</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Shares</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Avg Cost</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Current</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Market Value</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">P&L</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPositions.map((position) => (
                      <tr key={position.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stockInfo[position.symbol]?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                              <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <span className="font-medium text-cream">{position.symbol}</span>
                              <p className="text-xs text-slate-500">{position.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-cream">
                          {position.qty}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">
                          ${position.avgEntry.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-cream">
                          ${position.currentPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-cream">
                          ${position.marketValue.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${position.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                          </span>
                          <span className={`block text-xs ${position.unrealizedPnLPercent >= 0 ? 'text-profit/70' : 'text-loss/70'}`}>
                            {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setPositionToSell(position);
                              setSellQuantity(position.qty);
                              setShowSellModal(true);
                            }}
                            className="px-3 py-1 bg-loss/20 text-loss hover:bg-loss/30 rounded-lg text-xs font-medium transition-all"
                          >
                            Sell
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
              onClick={() => setOrderType('buy')}
              className={`py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                orderType === 'buy'
                  ? 'bg-profit text-void'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              BUY
            </button>
            <button
              onClick={() => setOrderType('sell')}
              disabled={!currentPosition}
              className={`py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                orderType === 'sell'
                  ? 'bg-loss text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              SELL
            </button>
          </div>
          
          {/* Order Mode Toggle */}
          <div className="flex p-1 bg-charcoal rounded-lg mb-4">
            <button
              onClick={() => setOrderMode('shares')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                orderMode === 'shares'
                  ? 'bg-gold text-void'
                  : 'text-slate-400 hover:text-cream'
              }`}
            >
              Shares
            </button>
            <button
              onClick={() => setOrderMode('dollars')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                orderMode === 'dollars'
                  ? 'bg-gold text-void'
                  : 'text-slate-400 hover:text-cream'
              }`}
            >
              Dollars
            </button>
          </div>
          
          {/* Quantity/Amount Input */}
          {orderMode === 'shares' ? (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-cream">Number of Shares</label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                >
                  <Minus className="w-4 h-4 text-slate-400" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 bg-charcoal border border-white/10 rounded-lg px-3 py-2 text-center text-cream font-mono focus:outline-none focus:border-gold/50"
                />
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="flex gap-2">
                {[1, 5, 10, 25].map(num => (
                  <button
                    key={num}
                    onClick={() => setQuantity(num)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      quantity === num
                        ? 'bg-gold text-void'
                        : 'bg-white/5 text-slate-400 hover:text-cream'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-cream">Dollar Amount</label>
                <span className="text-xs text-slate-500">≈ {orderDetails.shares} shares</span>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  value={dollarAmount}
                  onChange={(e) => setDollarAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-full bg-charcoal border border-white/10 rounded-lg pl-8 pr-3 py-2 text-cream font-mono focus:outline-none focus:border-gold/50"
                />
              </div>
              <div className="flex gap-2">
                {[100, 250, 500, 1000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setDollarAmount(amount)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                      dollarAmount === amount
                        ? 'bg-gold text-void'
                        : 'bg-white/5 text-slate-400 hover:text-cream'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Order Summary */}
          <div className="bg-charcoal rounded-xl p-3 my-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Shares</span>
              <span className="font-mono text-cream">{orderDetails.shares}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Price per Share</span>
              <span className="font-mono text-cream">${askPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-mono text-cream">${orderDetails.cost.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Commission</span>
              <span className="font-mono text-slate-400">${orderDetails.fee.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
              <span className="text-cream font-medium">Total</span>
              <span className="font-mono text-gold font-semibold">${orderDetails.total.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Execute Button */}
          <button
            onClick={handleBuy}
            disabled={!spotAccount || orderDetails.total > (spotAccount?.cash || 0) || orderType === 'sell'}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              orderType === 'buy'
                ? 'bg-profit hover:bg-profit/90 text-void'
                : 'bg-loss hover:bg-loss/90 text-white'
            }`}
          >
            {orderType === 'buy' ? 'Buy' : 'Sell'} {orderDetails.shares} {selectedAsset?.symbol}
          </button>
          
          {spotAccount && orderDetails.total > spotAccount.cash && (
            <p className="text-xs text-loss text-center mt-2">
              Insufficient funds. Available: ${spotAccount.cash.toFixed(2)}
            </p>
          )}
          
          {/* Available Balance */}
          <div className="mt-4 p-3 bg-white/5 rounded-xl">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Available Cash</span>
              <span className="font-mono text-cream">${spotAccount?.cash.toFixed(2) || '0.00'}</span>
            </div>
          </div>
          
          {/* Info Note */}
          <div className="mt-4 p-3 bg-gold/10 border border-gold/20 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gold/80">
                Stock trading involves risk. Past performance is not indicative of future results.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sell Position Modal */}
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-obsidian rounded-2xl p-6 border border-gold/20 z-50"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-cream">Sell {positionToSell.symbol}</h3>
                <button
                  onClick={() => setShowSellModal(false)}
                  className="p-2 text-slate-400 hover:text-cream hover:bg-white/5 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4 mb-6">
                {/* Position Info */}
                <div className="p-3 bg-charcoal rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Shares Owned</span>
                    <span className="font-mono text-cream">{positionToSell.qty}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Avg Cost</span>
                    <span className="font-mono text-cream">${positionToSell.avgEntry.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Current Price</span>
                    <span className="font-mono text-cream">${bidPrice.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Quantity to Sell */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Shares to Sell</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                      <Minus className="w-4 h-4 text-slate-400" />
                    </button>
                    <input
                      type="number"
                      value={sellQuantity}
                      onChange={(e) => setSellQuantity(Math.min(positionToSell.qty, Math.max(1, parseInt(e.target.value) || 1)))}
                      max={positionToSell.qty}
                      className="flex-1 bg-charcoal border border-white/10 rounded-lg px-3 py-2 text-center text-cream font-mono focus:outline-none focus:border-gold/50"
                    />
                    <button
                      onClick={() => setSellQuantity(Math.min(positionToSell.qty, sellQuantity + 1))}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                      <Plus className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setSellQuantity(Math.ceil(positionToSell.qty * 0.25))}
                      className="flex-1 py-1.5 text-xs font-medium bg-white/5 text-slate-400 hover:text-cream rounded-lg"
                    >
                      25%
                    </button>
                    <button
                      onClick={() => setSellQuantity(Math.ceil(positionToSell.qty * 0.5))}
                      className="flex-1 py-1.5 text-xs font-medium bg-white/5 text-slate-400 hover:text-cream rounded-lg"
                    >
                      50%
                    </button>
                    <button
                      onClick={() => setSellQuantity(Math.ceil(positionToSell.qty * 0.75))}
                      className="flex-1 py-1.5 text-xs font-medium bg-white/5 text-slate-400 hover:text-cream rounded-lg"
                    >
                      75%
                    </button>
                    <button
                      onClick={() => setSellQuantity(positionToSell.qty)}
                      className="flex-1 py-1.5 text-xs font-medium bg-gold/20 text-gold rounded-lg"
                    >
                      All
                    </button>
                  </div>
                </div>
                
                {/* Expected Proceeds */}
                <div className="p-3 bg-charcoal rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Proceeds</span>
                    <span className="font-mono text-cream">${(sellQuantity * bidPrice).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Commission</span>
                    <span className="font-mono text-slate-400">
                      -${Math.max(0.99, sellQuantity * bidPrice * 0.001).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10">
                    <span className="text-slate-400">Est. P&L</span>
                    {(() => {
                      const proceeds = sellQuantity * bidPrice;
                      const cost = sellQuantity * positionToSell.avgEntry;
                      const fee = Math.max(0.99, proceeds * 0.001);
                      const pnl = proceeds - cost - fee;
                      return (
                        <span className={`font-semibold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSellModal(false)}
                  className="flex-1 py-3 bg-white/5 text-slate-400 hover:bg-white/10 rounded-xl font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSell(positionToSell, sellQuantity)}
                  className="flex-1 py-3 bg-loss text-white hover:bg-loss/90 rounded-xl font-medium transition-all"
                >
                  Sell {sellQuantity} Shares
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

// Stock Asset Row Component
function StockAssetRow({ 
  asset, 
  isSelected, 
  isFavorite, 
  onSelect, 
  onToggleFavorite,
  stockInfo 
}: { 
  asset: MarketAsset;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  stockInfo: Record<string, { color: string; sector: string }>;
}) {
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
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stockInfo[asset.symbol]?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-cream">{asset.symbol}</p>
          <p className="text-xs text-slate-500">{asset.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-cream">${asset.price.toFixed(2)}</p>
          <p className={`text-xs ${asset.changePercent24h >= 0 ? 'text-profit' : 'text-loss'}`}>
            {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}
