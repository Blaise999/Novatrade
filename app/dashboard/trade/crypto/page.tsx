'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Search,
  Star,
  X,
  CheckCircle,
  AlertCircle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Info,
  Plus,
  Minus
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap?: string;
  volume24h?: string;
  icon: string;
}

interface CryptoHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

// ============================================
// CRYPTO ASSETS DATA
// ============================================

const cryptoAssets: CryptoAsset[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 67234.50, change24h: 2.45, marketCap: '$1.32T', volume24h: '$28.5B', icon: '₿' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 3456.78, change24h: -1.23, marketCap: '$415B', volume24h: '$12.3B', icon: 'Ξ' },
  { id: 'bnb', symbol: 'BNB', name: 'BNB', price: 567.89, change24h: 0.87, marketCap: '$87B', volume24h: '$1.2B', icon: '◆' },
  { id: 'sol', symbol: 'SOL', name: 'Solana', price: 145.32, change24h: 5.67, marketCap: '$63B', volume24h: '$3.4B', icon: '◎' },
  { id: 'xrp', symbol: 'XRP', name: 'XRP', price: 0.5234, change24h: -0.45, marketCap: '$28B', volume24h: '$1.1B', icon: '✕' },
  { id: 'ada', symbol: 'ADA', name: 'Cardano', price: 0.4567, change24h: 1.23, marketCap: '$16B', volume24h: '$456M', icon: '₳' },
  { id: 'doge', symbol: 'DOGE', name: 'Dogecoin', price: 0.0823, change24h: 3.45, marketCap: '$11B', volume24h: '$890M', icon: 'Ð' },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 35.67, change24h: -2.34, marketCap: '$13B', volume24h: '$567M', icon: '🔺' },
  { id: 'dot', symbol: 'DOT', name: 'Polkadot', price: 7.89, change24h: 0.56, marketCap: '$10B', volume24h: '$234M', icon: '●' },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 14.56, change24h: 1.89, marketCap: '$8B', volume24h: '$345M', icon: '⬡' },
];

// ============================================
// MINI CHART COMPONENT
// ============================================

const MiniChart = ({ data, positive, height = 60 }: { data: number[]; positive: boolean; height?: number }) => {
  if (data.length < 2) return <div className="w-full bg-white/5 rounded animate-pulse" style={{ height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - 4 - ((val - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} 100,${height}`;

  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={positive ? '#10B981' : '#EF4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? '#10B981' : '#EF4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#chartFill)" />
      <polyline points={points} fill="none" stroke={positive ? '#10B981' : '#EF4444'} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

// ============================================
// PRICE CHART COMPONENT
// ============================================

const PriceChart = ({ asset, priceHistory }: { asset: CryptoAsset; priceHistory: number[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height: Math.max(150, height) });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (priceHistory.length < 2) {
    return (
      <div ref={containerRef} className="h-full flex items-center justify-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const { width, height } = dimensions;
  const padding = 8;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...priceHistory);
  const max = Math.max(...priceHistory);
  const range = max - min || 1;

  const points = priceHistory.map((val, i) => {
    const x = padding + (i / (priceHistory.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((val - min) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${padding + chartHeight} ${points} ${padding + chartWidth},${padding + chartHeight}`;
  const isPositive = priceHistory[priceHistory.length - 1] >= priceHistory[0];

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.2" />
            <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#priceGradient)" />
        <polyline points={points} fill="none" stroke={isPositive ? '#10B981' : '#EF4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function CryptoTradingPage() {
  // State
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset>(cryptoAssets[0]);
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['BTC', 'ETH', 'SOL']);
  
  // Price state
  const [prices, setPrices] = useState<Record<string, number>>(() => 
    Object.fromEntries(cryptoAssets.map(a => [a.symbol, a.price]))
  );
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  
  // Trading state
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'amount' | 'quantity'>('amount');
  const [amount, setAmount] = useState<number>(100);
  const [quantity, setQuantity] = useState<number>(0);
  
  // Holdings (in real app this comes from Supabase)
  const [holdings, setHoldings] = useState<CryptoHolding[]>([]);
  const [balance, setBalance] = useState<number>(1000); // Demo balance
  
  // UI state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<'chart' | 'trade' | 'portfolio'>('chart');

  // Calculate quantity from amount
  useEffect(() => {
    if (orderMode === 'amount' && amount > 0) {
      setQuantity(amount / prices[selectedAsset.symbol]);
    }
  }, [amount, prices, selectedAsset, orderMode]);

  // Calculate amount from quantity
  useEffect(() => {
    if (orderMode === 'quantity' && quantity > 0) {
      setAmount(quantity * prices[selectedAsset.symbol]);
    }
  }, [quantity, prices, selectedAsset, orderMode]);

  // Simulate real-time price updates
  useEffect(() => {
    // Initialize price history
    const initialHistory: number[] = [];
    let price = selectedAsset.price;
    for (let i = 0; i < 50; i++) {
      price = price * (1 + (Math.random() - 0.5) * 0.002);
      initialHistory.push(price);
    }
    setPriceHistory(initialHistory);

    // Update prices every second
    const interval = setInterval(() => {
      setPrices(prev => {
        const newPrices = { ...prev };
        cryptoAssets.forEach(asset => {
          const change = (Math.random() - 0.5) * 0.001;
          newPrices[asset.symbol] = newPrices[asset.symbol] * (1 + change);
        });
        return newPrices;
      });

      setPriceHistory(prev => {
        const newPrice = prices[selectedAsset.symbol] * (1 + (Math.random() - 0.5) * 0.002);
        return [...prev.slice(-99), newPrice];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedAsset]);

  // Update holdings P&L
  useEffect(() => {
    setHoldings(prev => prev.map(h => {
      const currentPrice = prices[h.symbol] || h.currentPrice;
      const value = h.quantity * currentPrice;
      const cost = h.quantity * h.avgBuyPrice;
      const pnl = value - cost;
      const pnlPercent = (pnl / cost) * 100;
      return { ...h, currentPrice, value, pnl, pnlPercent };
    }));
  }, [prices]);

  // Filter assets
  const filteredAssets = cryptoAssets.filter(a =>
    a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle favorite
  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  // Execute buy
  const executeBuy = () => {
    if (amount > balance) {
      setNotification({ type: 'error', message: 'Insufficient balance' });
      return;
    }
    if (amount < 1) {
      setNotification({ type: 'error', message: 'Minimum order is $1' });
      return;
    }

    const currentPrice = prices[selectedAsset.symbol];
    const qty = amount / currentPrice;

    // Check if already holding
    const existingIdx = holdings.findIndex(h => h.symbol === selectedAsset.symbol);
    
    if (existingIdx >= 0) {
      // Add to existing position
      setHoldings(prev => {
        const updated = [...prev];
        const existing = updated[existingIdx];
        const totalQty = existing.quantity + qty;
        const totalCost = (existing.quantity * existing.avgBuyPrice) + (qty * currentPrice);
        updated[existingIdx] = {
          ...existing,
          quantity: totalQty,
          avgBuyPrice: totalCost / totalQty,
          currentPrice,
          value: totalQty * currentPrice,
          pnl: 0,
          pnlPercent: 0,
        };
        return updated;
      });
    } else {
      // New position
      const newHolding: CryptoHolding = {
        id: `${selectedAsset.symbol}-${Date.now()}`,
        symbol: selectedAsset.symbol,
        name: selectedAsset.name,
        quantity: qty,
        avgBuyPrice: currentPrice,
        currentPrice,
        value: amount,
        pnl: 0,
        pnlPercent: 0,
      };
      setHoldings(prev => [...prev, newHolding]);
    }

    setBalance(prev => prev - amount);
    setNotification({ type: 'success', message: `Bought ${qty.toFixed(6)} ${selectedAsset.symbol}` });
    
    setTimeout(() => setNotification(null), 3000);
  };

  // Execute sell
  const executeSell = () => {
    const holding = holdings.find(h => h.symbol === selectedAsset.symbol);
    if (!holding) {
      setNotification({ type: 'error', message: `You don't own any ${selectedAsset.symbol}` });
      return;
    }

    const maxSellValue = holding.quantity * prices[selectedAsset.symbol];
    if (amount > maxSellValue) {
      setNotification({ type: 'error', message: `Max sell value: $${maxSellValue.toFixed(2)}` });
      return;
    }

    const sellQty = amount / prices[selectedAsset.symbol];
    const remainingQty = holding.quantity - sellQty;

    if (remainingQty <= 0.000001) {
      // Sell all
      setHoldings(prev => prev.filter(h => h.symbol !== selectedAsset.symbol));
    } else {
      // Partial sell
      setHoldings(prev => prev.map(h => 
        h.symbol === selectedAsset.symbol 
          ? { ...h, quantity: remainingQty, value: remainingQty * prices[selectedAsset.symbol] }
          : h
      ));
    }

    setBalance(prev => prev + amount);
    setNotification({ type: 'success', message: `Sold ${sellQty.toFixed(6)} ${selectedAsset.symbol}` });
    
    setTimeout(() => setNotification(null), 3000);
  };

  const currentPrice = prices[selectedAsset.symbol];
  const priceChange = ((currentPrice - selectedAsset.price) / selectedAsset.price) * 100;
  const currentHolding = holdings.find(h => h.symbol === selectedAsset.symbol);
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);

  return (
    <div className="min-h-screen bg-void pb-20 lg:pb-0">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-profit/20 border border-profit/30' : 'bg-loss/20 border border-loss/30'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-profit" />
            ) : (
              <AlertCircle className="w-5 h-5 text-loss" />
            )}
            <span className={notification.type === 'success' ? 'text-profit' : 'text-loss'}>
              {notification.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-30 bg-void/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center justify-between p-3 sm:p-4">
          {/* Asset Selector */}
          <button
            onClick={() => setShowAssetSelector(true)}
            className="flex items-center gap-2 sm:gap-3 hover:bg-white/5 rounded-xl p-2 transition-all"
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">
              {selectedAsset.icon}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-cream text-sm sm:text-base">{selectedAsset.symbol}</span>
                <span className="text-slate-500 text-xs sm:text-sm hidden sm:inline">/ USD</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
              <span className="text-xs text-slate-500">{selectedAsset.name}</span>
            </div>
          </button>

          {/* Price Display */}
          <div className="text-right">
            <p className="text-lg sm:text-2xl font-bold font-mono text-cream">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: currentPrice < 1 ? 6 : 2 })}
            </p>
            <div className={`flex items-center justify-end gap-1 text-xs sm:text-sm ${priceChange >= 0 ? 'text-profit' : 'text-loss'}`}>
              {priceChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex lg:hidden border-t border-white/5">
          {(['chart', 'trade', 'portfolio'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-all ${
                mobileTab === tab ? 'text-gold border-b-2 border-gold' : 'text-slate-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-4 lg:p-4">
        {/* Chart Section */}
        <div className={`lg:col-span-2 ${mobileTab !== 'chart' ? 'hidden lg:block' : ''}`}>
          <div className="bg-charcoal/50 lg:rounded-2xl border-b lg:border border-white/5">
            <div className="p-3 sm:p-4 border-b border-white/5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-cream">{selectedAsset.symbol}/USD</h2>
                <div className="flex items-center gap-1">
                  {['1H', '24H', '7D', '1M'].map(tf => (
                    <button key={tf} className="px-2 py-1 text-xs text-slate-400 hover:text-cream hover:bg-white/5 rounded transition-all">
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-48 sm:h-64 lg:h-80 p-2">
              <PriceChart asset={selectedAsset} priceHistory={priceHistory} />
            </div>
            {/* Market Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 sm:p-4 border-t border-white/5">
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500">Market Cap</p>
                <p className="text-xs sm:text-sm font-medium text-cream">{selectedAsset.marketCap}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500">24h Volume</p>
                <p className="text-xs sm:text-sm font-medium text-cream">{selectedAsset.volume24h}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500">24h High</p>
                <p className="text-xs sm:text-sm font-medium text-profit">${(currentPrice * 1.02).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-slate-500">24h Low</p>
                <p className="text-xs sm:text-sm font-medium text-loss">${(currentPrice * 0.98).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Holdings - Desktop */}
          <div className="hidden lg:block mt-4 bg-charcoal/50 rounded-2xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-cream">Your Holdings</h3>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total Value</p>
                <p className="text-sm font-bold text-cream">${totalPortfolioValue.toFixed(2)}</p>
              </div>
            </div>
            {holdings.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No holdings yet</p>
                <p className="text-xs">Buy some crypto to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {holdings.map(h => (
                  <div key={h.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white text-xs font-bold">
                      {cryptoAssets.find(a => a.symbol === h.symbol)?.icon || h.symbol[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-cream">{h.symbol}</p>
                      <p className="text-xs text-slate-500">{h.quantity.toFixed(6)} coins</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-cream">${h.value.toFixed(2)}</p>
                      <p className={`text-xs ${h.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {h.pnl >= 0 ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trade Panel */}
        <div className={`lg:col-span-1 ${mobileTab !== 'trade' ? 'hidden lg:block' : ''}`}>
          <div className="bg-charcoal/50 lg:rounded-2xl border-b lg:border border-white/5 p-4">
            {/* Balance */}
            <div className="flex items-center justify-between mb-4 p-3 bg-white/5 rounded-xl">
              <div>
                <p className="text-xs text-slate-500">Available Balance</p>
                <p className="text-lg font-bold text-cream">${balance.toFixed(2)}</p>
              </div>
              <Link href="/dashboard/wallet" className="px-3 py-1.5 bg-gold/10 text-gold text-xs font-medium rounded-lg hover:bg-gold/20">
                + Deposit
              </Link>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-4">
              <button
                onClick={() => setOrderType('buy')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  orderType === 'buy' ? 'bg-profit text-void' : 'text-slate-400 hover:text-cream'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setOrderType('sell')}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  orderType === 'sell' ? 'bg-loss text-white' : 'text-slate-400 hover:text-cream'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Current Holding */}
            {currentHolding && (
              <div className="mb-4 p-3 bg-white/5 rounded-xl">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">You own</span>
                  <span className="text-cream">{currentHolding.quantity.toFixed(6)} {selectedAsset.symbol}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Value</span>
                  <span className={currentHolding.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                    ${currentHolding.value.toFixed(2)} ({currentHolding.pnl >= 0 ? '+' : ''}{currentHolding.pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1.5 block">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setOrderMode('amount'); setAmount(parseFloat(e.target.value) || 0); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-cream text-lg font-mono focus:outline-none focus:border-gold/50"
                  placeholder="0.00"
                />
              </div>
              {/* Quick Amounts */}
              <div className="flex gap-2 mt-2">
                {[25, 50, 100, 250, 500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => { setOrderMode('amount'); setAmount(amt); }}
                    className="flex-1 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-cream rounded-lg transition-all"
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* You Get */}
            <div className="mb-4 p-3 bg-white/5 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">You {orderType === 'buy' ? 'get' : 'sell'}</span>
                <span className="text-sm font-mono text-cream">
                  {quantity.toFixed(6)} {selectedAsset.symbol}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-slate-500">Price</span>
                <span className="text-xs font-mono text-slate-400">
                  ${currentPrice.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={orderType === 'buy' ? executeBuy : executeSell}
              disabled={amount <= 0}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                orderType === 'buy' 
                  ? 'bg-profit hover:bg-profit/90 text-void' 
                  : 'bg-loss hover:bg-loss/90 text-white'
              }`}
            >
              {orderType === 'buy' ? `Buy ${selectedAsset.symbol}` : `Sell ${selectedAsset.symbol}`}
            </button>

            {/* Info */}
            <div className="mt-4 p-3 bg-blue-500/10 rounded-xl flex gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-400">
                {orderType === 'buy' 
                  ? 'Crypto is bought at market price. Your coins will be added to your portfolio.' 
                  : 'Sell your holdings at current market price.'}
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio - Mobile */}
        <div className={`lg:hidden ${mobileTab !== 'portfolio' ? 'hidden' : ''}`}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-cream">Your Portfolio</h3>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total: ${totalPortfolioValue.toFixed(2)}</p>
                <p className={`text-xs ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </p>
              </div>
            </div>
            {holdings.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No holdings yet</p>
                <p className="text-xs mb-4">Buy your first crypto to start</p>
                <button onClick={() => setMobileTab('trade')} className="px-4 py-2 bg-gold/10 text-gold text-sm rounded-lg">
                  Start Trading
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {holdings.map(h => (
                  <motion.div key={h.id} layout className="p-3 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold">
                        {cryptoAssets.find(a => a.symbol === h.symbol)?.icon || h.symbol[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-cream">{h.symbol}</p>
                        <p className="text-xs text-slate-500">{h.quantity.toFixed(6)} coins</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-cream">${h.value.toFixed(2)}</p>
                        <p className={`text-xs ${h.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {h.pnl >= 0 ? '+' : ''}{h.pnlPercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset Selector Modal */}
      <AnimatePresence>
        {showAssetSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-end lg:items-center lg:justify-center"
            onClick={() => setShowAssetSelector(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              onClick={e => e.stopPropagation()}
              className="w-full lg:w-[480px] max-h-[80vh] bg-charcoal rounded-t-3xl lg:rounded-3xl overflow-hidden"
            >
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-cream">Select Crypto</h3>
                  <button onClick={() => setShowAssetSelector(false)} className="p-2 hover:bg-white/10 rounded-lg">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-cream text-sm focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {filteredAssets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => { setSelectedAsset(asset); setShowAssetSelector(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      selectedAsset.id === asset.id ? 'bg-gold/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold">
                      {asset.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-cream">{asset.symbol}</p>
                      <p className="text-xs text-slate-500">{asset.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-cream">${prices[asset.symbol]?.toLocaleString() || asset.price.toLocaleString()}</p>
                      <p className={`text-xs ${asset.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorite(asset.symbol); }}
                      className="p-1"
                    >
                      <Star className={`w-4 h-4 ${favorites.includes(asset.symbol) ? 'text-yellow-500 fill-yellow-500' : 'text-slate-500'}`} />
                    </button>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
