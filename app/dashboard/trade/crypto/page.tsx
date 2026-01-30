'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
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
  Info,
  X,
  CheckCircle,
  AlertCircle,
  Timer,
  Zap,
  BarChart2,
  CandlestickChart,
  LineChart as LineChartIcon,
  Wallet
} from 'lucide-react';
import { useAuthStore, useTradingStore } from '@/lib/store';
import { marketAssets } from '@/lib/data';
import { MarketAsset, Trade, TradeDirection } from '@/lib/types';

// Filter crypto assets
const cryptoAssets = marketAssets.filter(a => a.type === 'crypto');

// Duration options (in seconds)
const durationOptions = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
  { label: '15m', value: 900 },
  { label: '30m', value: 1800 },
  { label: '1h', value: 3600 },
];

// Quick amount options
const quickAmounts = [10, 25, 50, 100, 250, 500];

export default function CryptoTradingPage() {
  const { user, updateBalance } = useAuthStore();
  const { 
    selectedAsset, 
    setSelectedAsset, 
    tradeAmount, 
    setTradeAmount,
    tradeDuration,
    setTradeDuration,
    activeTrades,
    addTrade,
    closeTrade,
    selectedTimeframe,
    setTimeframe
  } = useTradingStore();
  
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'ETH', 'SOL']);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ type: 'win' | 'loss', amount: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Initialize with first crypto asset
  useEffect(() => {
    if (!selectedAsset) {
      setSelectedAsset(cryptoAssets[0]);
    }
  }, [selectedAsset, setSelectedAsset]);

  // Simulate real-time price updates
  useEffect(() => {
    if (!selectedAsset) return;
    
    setCurrentPrice(selectedAsset.price);
    
    // Generate initial price history
    const initialHistory: number[] = [];
    let price = selectedAsset.price;
    for (let i = 0; i < 100; i++) {
      price = price * (1 + (Math.random() - 0.5) * 0.001);
      initialHistory.push(price);
    }
    setPriceHistory(initialHistory);

    // Update price every 500ms
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 0.002 * prev;
        const newPrice = prev + change;
        setPriceHistory(history => [...history.slice(-99), newPrice]);
        return newPrice;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [selectedAsset]);

  // Process active trades
  useEffect(() => {
    const interval = setInterval(() => {
      activeTrades.forEach(trade => {
        if (new Date() >= trade.expiresAt && trade.status === 'open') {
          // Determine win/loss based on price movement
          const won = trade.direction === 'up' 
            ? currentPrice > trade.entryPrice 
            : currentPrice < trade.entryPrice;
          
          const profit = won ? trade.amount * (trade.payout / 100) : -trade.amount;
          
          closeTrade(trade.id, currentPrice, profit);
          
          // Update balance
          if (user) {
            updateBalance({
              available: user.balance.available + trade.amount + profit
            });
          }
          
          // Show result notification
          setTradeResult({ type: won ? 'win' : 'loss', amount: Math.abs(profit) });
          setTimeout(() => setTradeResult(null), 3000);
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeTrades, currentPrice, closeTrade, user, updateBalance]);

  const handleTrade = (direction: TradeDirection) => {
    if (!selectedAsset || !user || tradeAmount > user.balance.available) return;
    
    setIsTrading(true);
    
    // Deduct amount from balance
    updateBalance({
      available: user.balance.available - tradeAmount
    });

    // Create trade
    const trade: Trade = {
      id: `trade_${Date.now()}`,
      assetId: selectedAsset.id,
      asset: selectedAsset,
      direction,
      amount: tradeAmount,
      entryPrice: currentPrice,
      payout: selectedAsset.payout || 85,
      duration: tradeDuration,
      expiresAt: new Date(Date.now() + tradeDuration * 1000),
      status: 'open',
      createdAt: new Date()
    };

    addTrade(trade);
    
    setTimeout(() => setIsTrading(false), 500);
  };

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const filteredAssets = cryptoAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  const getPriceChange = () => {
    if (priceHistory.length < 2) return 0;
    const oldPrice = priceHistory[0];
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
      {/* Main Chart Area */}
      <div className="flex-1 flex flex-col bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
        {/* Chart Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          {/* Asset Selector */}
          <div className="relative">
            <button
              onClick={() => setShowAssetSelector(!showAssetSelector)}
              className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">₿</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-cream">{selectedAsset?.symbol || 'BTC'}/USD</p>
                <p className="text-xs text-slate-500">{selectedAsset?.name || 'Bitcoin'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {/* Asset Dropdown */}
            <AnimatePresence>
              {showAssetSelector && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-80 bg-charcoal border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                >
                  {/* Search */}
                  <div className="p-3 border-b border-white/5">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                      <Search className="w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search assets..."
                        className="flex-1 bg-transparent text-sm text-cream placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Favorites */}
                  {favorites.length > 0 && (
                    <div className="p-2 border-b border-white/5">
                      <p className="px-2 py-1 text-xs text-slate-500 uppercase">Favorites</p>
                      {filteredAssets.filter(a => favorites.includes(a.symbol)).map(asset => (
                        <AssetRow 
                          key={asset.id} 
                          asset={asset} 
                          isSelected={selectedAsset?.id === asset.id}
                          isFavorite={true}
                          onSelect={() => {
                            setSelectedAsset(asset);
                            setShowAssetSelector(false);
                          }}
                          onToggleFavorite={() => toggleFavorite(asset.symbol)}
                        />
                      ))}
                    </div>
                  )}

                  {/* All Assets */}
                  <div className="max-h-64 overflow-y-auto p-2">
                    <p className="px-2 py-1 text-xs text-slate-500 uppercase">All Cryptocurrencies</p>
                    {filteredAssets.map(asset => (
                      <AssetRow 
                        key={asset.id} 
                        asset={asset} 
                        isSelected={selectedAsset?.id === asset.id}
                        isFavorite={favorites.includes(asset.symbol)}
                        onSelect={() => {
                          setSelectedAsset(asset);
                          setShowAssetSelector(false);
                        }}
                        onToggleFavorite={() => toggleFavorite(asset.symbol)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Price Display */}
          <div className="text-center">
            <p className="text-2xl font-mono font-bold text-cream">
              ${formatPrice(currentPrice)}
            </p>
            <p className={`text-sm font-medium ${getPriceChange() >= 0 ? 'text-profit' : 'text-loss'}`}>
              {getPriceChange() >= 0 ? '+' : ''}{getPriceChange().toFixed(3)}%
            </p>
          </div>

          {/* Chart Controls */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                    selectedTimeframe === tf
                      ? 'bg-gold text-void'
                      : 'text-slate-400 hover:text-cream'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors">
                <CandlestickChart className="w-4 h-4" />
              </button>
              <button className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors">
                <LineChartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div ref={chartRef} className="flex-1 relative p-4">
          <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
            {/* Grid */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <line
                key={`h-${i}`}
                x1="0"
                y1={i * 50}
                x2="1000"
                y2={i * 50}
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            ))}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <line
                key={`v-${i}`}
                x1={i * 100}
                y1="0"
                x2={i * 100}
                y2="400"
                stroke="rgba(255,255,255,0.03)"
                strokeWidth="1"
              />
            ))}

            {/* Price Line */}
            {priceHistory.length > 1 && (() => {
              const minPrice = Math.min(...priceHistory);
              const maxPrice = Math.max(...priceHistory);
              const range = maxPrice - minPrice || 1;
              
              return (
                <>
                  {/* Area */}
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={getPriceChange() >= 0 ? '#00D9A5' : '#FF4757'} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={getPriceChange() >= 0 ? '#00D9A5' : '#FF4757'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 0 ${400 - ((priceHistory[0] - minPrice) / range) * 380} 
                        ${priceHistory.map((p, i) => 
                          `L ${(i / (priceHistory.length - 1)) * 1000} ${400 - ((p - minPrice) / range) * 380}`
                        ).join(' ')} 
                        L 1000 400 L 0 400 Z`}
                    fill="url(#chartGradient)"
                  />
                  
                  {/* Line */}
                  <path
                    d={`M ${priceHistory.map((p, i) => 
                      `${(i / (priceHistory.length - 1)) * 1000} ${400 - ((p - minPrice) / range) * 380}`
                    ).join(' L ')}`}
                    fill="none"
                    stroke={getPriceChange() >= 0 ? '#00D9A5' : '#FF4757'}
                    strokeWidth="2"
                  />

                  {/* Current Price Line */}
                  <line
                    x1="0"
                    y1={400 - ((currentPrice - minPrice) / range) * 380}
                    x2="1000"
                    y2={400 - ((currentPrice - minPrice) / range) * 380}
                    stroke={getPriceChange() >= 0 ? '#00D9A5' : '#FF4757'}
                    strokeWidth="1"
                    strokeDasharray="5,5"
                    opacity="0.5"
                  />

                  {/* Current Price Dot */}
                  <circle
                    cx="1000"
                    cy={400 - ((currentPrice - minPrice) / range) * 380}
                    r="6"
                    fill={getPriceChange() >= 0 ? '#00D9A5' : '#FF4757'}
                  />
                </>
              );
            })()}
          </svg>

          {/* Current Price Label */}
          <div 
            className={`absolute right-0 px-2 py-1 rounded text-xs font-mono ${
              getPriceChange() >= 0 ? 'bg-profit text-void' : 'bg-loss text-white'
            }`}
            style={{ 
              top: `${Math.max(10, Math.min(90, 50 - getPriceChange() * 2))}%`,
              transform: 'translateY(-50%)'
            }}
          >
            ${formatPrice(currentPrice)}
          </div>
        </div>

        {/* Active Trades Bar */}
        {activeTrades.length > 0 && (
          <div className="border-t border-white/5 p-3">
            <p className="text-xs text-slate-500 mb-2">Active Trades</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeTrades.map(trade => (
                <ActiveTradeCard key={trade.id} trade={trade} currentPrice={currentPrice} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trading Panel */}
      <div className="w-full lg:w-80 bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col">
        {/* Balance */}
        <div className="p-3 bg-white/5 rounded-xl mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Available Balance</span>
            <span className="text-xs text-gold">+ Add funds</span>
          </div>
          <p className="text-xl font-bold text-cream mt-1">
            ${user?.balance.available.toLocaleString() || '0.00'}
          </p>
        </div>

        {/* Trade Amount */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-cream">Investment</span>
            <span className="text-xs text-slate-500">Min: $1</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTradeAmount(Math.max(1, tradeAmount - 10))}
              className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-slate-400 hover:text-cream hover:bg-white/10 transition-all"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full pl-8 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-center text-lg font-semibold text-cream focus:outline-none focus:border-gold"
              />
            </div>
            <button
              onClick={() => setTradeAmount(tradeAmount + 10)}
              className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-slate-400 hover:text-cream hover:bg-white/10 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Amounts */}
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map(amount => (
              <button
                key={amount}
                onClick={() => setTradeAmount(amount)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  tradeAmount === amount
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-slate-400 hover:text-cream hover:bg-white/10'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-cream">Duration</span>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Time to expiry
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {durationOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setTradeDuration(option.value)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  tradeDuration === option.value
                    ? 'bg-gold text-void'
                    : 'bg-white/5 text-slate-400 hover:text-cream hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payout Info */}
        <div className="p-3 bg-white/5 rounded-xl mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Payout</span>
            <span className="text-profit font-semibold">+{selectedAsset?.payout || 85}%</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Potential Profit</span>
            <span className="text-cream font-semibold">
              ${((tradeAmount * (selectedAsset?.payout || 85)) / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Trade Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <button
            onClick={() => handleTrade('up')}
            disabled={isTrading || !user || tradeAmount > (user?.balance.available || 0)}
            className="py-4 bg-profit hover:bg-profit/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-void flex items-center justify-center gap-2 transition-all group"
          >
            <TrendingUp className="w-5 h-5 group-hover:scale-110 transition-transform" />
            UP
          </button>
          <button
            onClick={() => handleTrade('down')}
            disabled={isTrading || !user || tradeAmount > (user?.balance.available || 0)}
            className="py-4 bg-loss hover:bg-loss/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all group"
          >
            <TrendingDown className="w-5 h-5 group-hover:scale-110 transition-transform" />
            DOWN
          </button>
        </div>

        {/* Insufficient Balance Warning */}
        {user && tradeAmount > user.balance.available && (
          <div className="p-3 bg-loss/10 rounded-xl border border-loss/20 mt-2">
            <p className="text-xs text-loss text-center mb-2">
              Insufficient balance. Available: ${user.balance.available.toLocaleString()}
            </p>
            <Link
              href="/dashboard/wallet"
              className="flex items-center justify-center gap-2 text-xs text-gold hover:text-gold/80 font-medium"
            >
              <Wallet className="w-3 h-3" />
              Deposit Funds
            </Link>
          </div>
        )}
      </div>

      {/* Trade Result Notification */}
      <AnimatePresence>
        {tradeResult && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 ${
              tradeResult.type === 'win' 
                ? 'bg-profit text-void' 
                : 'bg-loss text-white'
            }`}
          >
            {tradeResult.type === 'win' ? (
              <CheckCircle className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
            <div>
              <p className="font-semibold">
                {tradeResult.type === 'win' ? 'Trade Won!' : 'Trade Lost'}
              </p>
              <p className="text-sm opacity-80">
                {tradeResult.type === 'win' ? '+' : '-'}${tradeResult.amount.toFixed(2)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Asset Row Component
function AssetRow({ 
  asset, 
  isSelected, 
  isFavorite, 
  onSelect, 
  onToggleFavorite 
}: { 
  asset: MarketAsset;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
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
        <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center text-sm">
          ₿
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-cream">{asset.symbol}/USD</p>
          <p className="text-xs text-slate-500">{asset.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono text-cream">${asset.price.toLocaleString()}</p>
          <p className={`text-xs ${asset.changePercent24h >= 0 ? 'text-profit' : 'text-loss'}`}>
            {asset.changePercent24h >= 0 ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// Active Trade Card Component
function ActiveTradeCard({ trade, currentPrice }: { trade: Trade; currentPrice: number }) {
  const [timeLeft, setTimeLeft] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, (trade.expiresAt.getTime() - Date.now()) / 1000);
      setTimeLeft(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [trade.expiresAt]);

  const currentPnL = trade.direction === 'up'
    ? currentPrice > trade.entryPrice ? trade.amount * (trade.payout / 100) : -trade.amount
    : currentPrice < trade.entryPrice ? trade.amount * (trade.payout / 100) : -trade.amount;

  const isWinning = currentPnL > 0;

  const formatTime = (seconds: number) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return seconds.toFixed(1) + 's';
  };

  return (
    <div className={`flex-shrink-0 w-48 p-3 rounded-xl border ${
      isWinning ? 'bg-profit/10 border-profit/20' : 'bg-loss/10 border-loss/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {trade.direction === 'up' ? (
            <TrendingUp className={`w-4 h-4 ${isWinning ? 'text-profit' : 'text-loss'}`} />
          ) : (
            <TrendingDown className={`w-4 h-4 ${isWinning ? 'text-profit' : 'text-loss'}`} />
          )}
          <span className="text-xs font-medium text-cream">{trade.asset.symbol}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Timer className="w-3 h-3" />
          {formatTime(timeLeft)}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">${trade.amount}</span>
        <span className={`text-sm font-semibold ${isWinning ? 'text-profit' : 'text-loss'}`}>
          {isWinning ? '+' : ''}{currentPnL.toFixed(2)}
        </span>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${isWinning ? 'bg-profit' : 'bg-loss'}`}
          style={{ width: `${(1 - timeLeft / trade.duration) * 100}%` }}
        />
      </div>
    </div>
  );
}
