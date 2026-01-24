'use client';

import { useState, useEffect } from 'react';
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
  CheckCircle,
  AlertCircle,
  Timer,
  CandlestickChart,
  LineChart as LineChartIcon,
  Building2,
  Bell,
  Lock,
  Crown,
  ArrowRight
} from 'lucide-react';
import { useAuthStore, useTradingStore } from '@/lib/store';
import { marketAssets } from '@/lib/data';
import { MarketAsset, Trade, TradeDirection } from '@/lib/types';

// Filter stock assets
const stockAssets = marketAssets.filter(a => a.type === 'stock');

// Duration options
const durationOptions = [
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '15m', value: 900 },
  { label: '30m', value: 1800 },
  { label: '1h', value: 3600 },
  { label: '4h', value: 14400 },
];

const quickAmounts = [10, 25, 50, 100, 250, 500];

// Stock company logos/icons
const stockLogos: Record<string, { color: string; letter: string }> = {
  'AAPL': { color: 'from-gray-500 to-gray-600', letter: '' },
  'NVDA': { color: 'from-green-500 to-green-600', letter: 'N' },
  'TSLA': { color: 'from-red-500 to-red-600', letter: 'T' },
  'MSFT': { color: 'from-blue-500 to-blue-600', letter: 'M' },
  'GOOGL': { color: 'from-yellow-500 to-red-500', letter: 'G' },
  'AMZN': { color: 'from-orange-500 to-orange-600', letter: 'A' },
  'META': { color: 'from-blue-600 to-blue-700', letter: 'M' },
};

// Subscription plans for stocks
const subscriptionPlans = [
  { name: 'Basic', price: 29, features: ['US Stocks', 'Basic signals', '5 trades/day'] },
  { name: 'Pro', price: 99, features: ['Global Stocks', 'Pro signals', 'Unlimited trades', 'Priority support'] },
  { name: 'VIP', price: 299, features: ['All markets', 'VIP signals', 'Personal manager', 'Zero commission'] },
];

export default function StocksTradingPage() {
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
  const [favorites, setFavorites] = useState<string[]>(['AAPL', 'NVDA', 'TSLA']);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [isTrading, setIsTrading] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ type: 'win' | 'loss', amount: number } | null>(null);
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed' | 'pre' | 'after'>('open');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Check market hours (simplified)
  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      const hour = now.getUTCHours();
      const day = now.getUTCDay();
      
      if (day === 0 || day === 6) {
        setMarketStatus('closed');
      } else if (hour >= 14 && hour < 21) {
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

  // Initialize with first stock asset
  useEffect(() => {
    if (!selectedAsset || selectedAsset.type !== 'stock') {
      setSelectedAsset(stockAssets[0]);
    }
  }, [selectedAsset, setSelectedAsset]);

  // Simulate real-time price updates
  useEffect(() => {
    if (!selectedAsset) return;
    
    setCurrentPrice(selectedAsset.price);
    
    const initialHistory: number[] = [];
    let price = selectedAsset.price;
    for (let i = 0; i < 100; i++) {
      price = price * (1 + (Math.random() - 0.5) * 0.001);
      initialHistory.push(price);
    }
    setPriceHistory(initialHistory);

    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 0.0015 * prev;
        const newPrice = prev + change;
        setPriceHistory(history => [...history.slice(-99), newPrice]);
        return newPrice;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedAsset]);

  // Process active trades
  useEffect(() => {
    const interval = setInterval(() => {
      activeTrades.forEach(trade => {
        if (new Date() >= trade.expiresAt && trade.status === 'open') {
          const won = trade.direction === 'up' 
            ? currentPrice > trade.entryPrice 
            : currentPrice < trade.entryPrice;
          
          const profit = won ? trade.amount * (trade.payout / 100) : -trade.amount;
          
          closeTrade(trade.id, currentPrice, profit);
          
          if (user) {
            updateBalance({
              available: user.balance.available + trade.amount + profit
            });
          }
          
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
    
    updateBalance({
      available: user.balance.available - tradeAmount
    });

    const trade: Trade = {
      id: `trade_${Date.now()}`,
      assetId: selectedAsset.id,
      asset: selectedAsset,
      direction,
      amount: tradeAmount,
      entryPrice: currentPrice,
      payout: selectedAsset.payout || 80,
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

  const filteredAssets = stockAssets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => price.toFixed(2);

  const getPriceChange = () => {
    if (priceHistory.length < 2) return 0;
    const oldPrice = priceHistory[0];
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  };

  const getMarketStatusColor = () => {
    switch (marketStatus) {
      case 'open': return 'bg-profit text-void';
      case 'pre': return 'bg-yellow-500 text-void';
      case 'after': return 'bg-orange-500 text-void';
      default: return 'bg-loss text-white';
    }
  };

  const getMarketStatusText = () => {
    switch (marketStatus) {
      case 'open': return 'Market Open';
      case 'pre': return 'Pre-Market';
      case 'after': return 'After Hours';
      default: return 'Market Closed';
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
      {/* Subscription Modal */}
      <AnimatePresence>
        {showSubscriptionModal && !hasSubscription && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-charcoal rounded-3xl border border-gold/20 p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-10 h-10 text-gold" />
                </div>
                <h2 className="text-3xl font-display font-bold text-cream mb-2">
                  Unlock Stock Trading
                </h2>
                <p className="text-cream/60">
                  Stock trading requires a subscription plan. Choose a plan to access global stock markets.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {subscriptionPlans.map((plan, index) => (
                  <div
                    key={plan.name}
                    className={`p-5 rounded-2xl border ${
                      index === 1 
                        ? 'bg-gold/10 border-gold/30' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {index === 1 && (
                      <div className="text-center mb-2">
                        <span className="px-2 py-0.5 bg-gold text-void text-xs font-bold rounded-full">
                          POPULAR
                        </span>
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-cream text-center mb-1">{plan.name}</h3>
                    <p className="text-center mb-4">
                      <span className="text-3xl font-bold text-gold">${plan.price}</span>
                      <span className="text-cream/50">/mo</span>
                    </p>
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-profit flex-shrink-0" />
                          <span className="text-cream/70">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/pricing?plan=${plan.name.toLowerCase()}`}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${
                        index === 1
                          ? 'bg-gold text-void hover:bg-gold/90'
                          : 'bg-white/10 text-cream hover:bg-white/20'
                      }`}
                    >
                      Choose Plan
                    </Link>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/pricing"
                  className="flex items-center gap-2 px-6 py-3 bg-gold text-void font-bold rounded-xl hover:bg-gold/90 transition-all"
                >
                  <Crown className="w-5 h-5" />
                  View All Plans
                </Link>
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className="px-6 py-3 bg-white/5 text-cream/70 font-medium rounded-xl hover:bg-white/10 transition-all"
                >
                  Browse Demo
                </button>
              </div>

              <p className="text-center text-sm text-cream/40 mt-6">
                Crypto and Forex trading are available on the free plan.{' '}
                <Link href="/dashboard/trade/crypto" className="text-gold hover:underline">
                  Trade Crypto
                </Link>{' '}
                or{' '}
                <Link href="/dashboard/trade/fx" className="text-gold hover:underline">
                  Trade Forex
                </Link>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
                stockLogos[selectedAsset?.symbol || 'AAPL']?.color || 'from-blue-500 to-blue-600'
              } flex items-center justify-center`}>
                <span className="text-white font-bold text-sm">
                  {stockLogos[selectedAsset?.symbol || 'AAPL']?.letter || selectedAsset?.symbol?.[0] || 'A'}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-cream">{selectedAsset?.symbol || 'AAPL'}</p>
                <p className="text-xs text-slate-500">{selectedAsset?.name || 'Apple Inc.'}</p>
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
                  <div className="p-3 border-b border-white/5">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                      <Search className="w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search stocks..."
                        className="flex-1 bg-transparent text-sm text-cream placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {favorites.length > 0 && (
                    <div className="p-2 border-b border-white/5">
                      <p className="px-2 py-1 text-xs text-slate-500 uppercase">Watchlist</p>
                      {filteredAssets.filter(a => favorites.includes(a.symbol)).map(asset => (
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
                          stockLogos={stockLogos}
                        />
                      ))}
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto p-2">
                    <p className="px-2 py-1 text-xs text-slate-500 uppercase">All Stocks</p>
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
                        stockLogos={stockLogos}
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
            <div className="flex items-center justify-center gap-2">
              <p className={`text-sm font-medium ${getPriceChange() >= 0 ? 'text-profit' : 'text-loss'}`}>
                {getPriceChange() >= 0 ? '+' : ''}{getPriceChange().toFixed(2)}%
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getMarketStatusColor()}`}>
                {getMarketStatusText()}
              </span>
            </div>
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
            <button className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-cream transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="flex-1 relative p-4">
          <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
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

            {priceHistory.length > 1 && (() => {
              const minPrice = Math.min(...priceHistory);
              const maxPrice = Math.max(...priceHistory);
              const range = maxPrice - minPrice || 1;
              
              return (
                <>
                  <defs>
                    <linearGradient id="stockChartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
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
                    fill="url(#stockChartGradient)"
                  />
                  
                  <path
                    d={`M ${priceHistory.map((p, i) => 
                      `${(i / (priceHistory.length - 1)) * 1000} ${400 - ((p - minPrice) / range) * 380}`
                    ).join(' L ')}`}
                    fill="none"
                    stroke={getPriceChange() >= 0 ? '#00D9A5' : '#FF4757'}
                    strokeWidth="2"
                  />

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

          <div 
            className={`absolute right-0 px-2 py-1 rounded text-xs font-mono ${
              getPriceChange() >= 0 ? 'bg-profit text-void' : 'bg-loss text-white'
            }`}
            style={{ 
              top: `${Math.max(10, Math.min(90, 50 - getPriceChange() * 3))}%`,
              transform: 'translateY(-50%)'
            }}
          >
            ${formatPrice(currentPrice)}
          </div>

          {/* Company Info */}
          <div className="absolute top-4 left-4 flex items-center gap-3 px-3 py-2 bg-white/5 rounded-lg">
            <Building2 className="w-4 h-4 text-gold" />
            <div>
              <span className="text-xs text-cream">{selectedAsset?.name}</span>
              <span className="text-xs text-slate-500 ml-2">NASDAQ</span>
            </div>
          </div>
        </div>

        {/* Active Trades */}
        {activeTrades.filter(t => t.asset.type === 'stock').length > 0 && (
          <div className="border-t border-white/5 p-3">
            <p className="text-xs text-slate-500 mb-2">Active Stock Trades</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeTrades.filter(t => t.asset.type === 'stock').map(trade => (
                <ActiveTradeCard key={trade.id} trade={trade} currentPrice={currentPrice} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trading Panel */}
      <div className="w-full lg:w-80 bg-white/5 rounded-2xl border border-white/5 p-4 flex flex-col">
        {/* Balance */}
        <div className="p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl mb-4 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Available Balance</span>
            <span className="text-xs text-electric">Stock Trading</span>
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
            <Clock className="w-4 h-4 text-slate-500" />
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
            <span className="text-profit font-semibold">+{selectedAsset?.payout || 80}%</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Potential Profit</span>
            <span className="text-cream font-semibold">
              ${((tradeAmount * (selectedAsset?.payout || 80)) / 100).toFixed(2)}
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
            BUY
          </button>
          <button
            onClick={() => handleTrade('down')}
            disabled={isTrading || !user || tradeAmount > (user?.balance.available || 0)}
            className="py-4 bg-loss hover:bg-loss/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all group"
          >
            <TrendingDown className="w-5 h-5 group-hover:scale-110 transition-transform" />
            SELL
          </button>
        </div>

        {user && tradeAmount > user.balance.available && (
          <p className="text-xs text-loss text-center mt-2">
            Insufficient balance
          </p>
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
              tradeResult.type === 'win' ? 'bg-profit text-void' : 'bg-loss text-white'
            }`}
          >
            {tradeResult.type === 'win' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <div>
              <p className="font-semibold">{tradeResult.type === 'win' ? 'Trade Won!' : 'Trade Lost'}</p>
              <p className="text-sm opacity-80">{tradeResult.type === 'win' ? '+' : '-'}${tradeResult.amount.toFixed(2)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Stock Asset Row Component
function StockAssetRow({ asset, isSelected, isFavorite, onSelect, onToggleFavorite, stockLogos }: any) {
  return (
    <div className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-all ${
      isSelected ? 'bg-gold/10' : 'hover:bg-white/5'
    }`}>
      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="text-slate-500 hover:text-gold transition-colors">
        {isFavorite ? <Star className="w-4 h-4 fill-gold text-gold" /> : <StarOff className="w-4 h-4" />}
      </button>
      <div className="flex-1 flex items-center gap-3" onClick={onSelect}>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stockLogos[asset.symbol]?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
          <span className="text-white font-bold text-xs">{stockLogos[asset.symbol]?.letter || asset.symbol[0]}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-cream">{asset.symbol}</p>
          <p className="text-xs text-slate-500 truncate max-w-[120px]">{asset.name}</p>
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

// Active Trade Card
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

  return (
    <div className={`flex-shrink-0 w-48 p-3 rounded-xl border ${isWinning ? 'bg-profit/10 border-profit/20' : 'bg-loss/10 border-loss/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {trade.direction === 'up' ? <TrendingUp className={`w-4 h-4 ${isWinning ? 'text-profit' : 'text-loss'}`} /> : <TrendingDown className={`w-4 h-4 ${isWinning ? 'text-profit' : 'text-loss'}`} />}
          <span className="text-xs font-medium text-cream">{trade.asset.symbol}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Timer className="w-3 h-3" />
          {timeLeft >= 60 ? `${Math.floor(timeLeft / 60)}:${Math.floor(timeLeft % 60).toString().padStart(2, '0')}` : `${timeLeft.toFixed(1)}s`}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">${trade.amount}</span>
        <span className={`text-sm font-semibold ${isWinning ? 'text-profit' : 'text-loss'}`}>{isWinning ? '+' : ''}{currentPnL.toFixed(2)}</span>
      </div>
      <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full transition-all ${isWinning ? 'bg-profit' : 'bg-loss'}`} style={{ width: `${(1 - timeLeft / trade.duration) * 100}%` }} />
      </div>
    </div>
  );
}
