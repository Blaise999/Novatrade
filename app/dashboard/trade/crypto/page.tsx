'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Shield,
  ShieldOff,
  ShieldCheck,
  Lock,
  Unlock,
  Pause,
  Play,
  Eye,
  EyeOff
} from 'lucide-react';
import { useStore } from '@/lib/supabase/store-supabase';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useSpotTradingStore, useSpotEquity, useShieldedPositions } from '@/lib/spot-trading-store';
import type { SpotPosition } from '@/lib/spot-trading-types';

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
// SHIELD BADGE COMPONENT
// ============================================

const ShieldBadge = ({ position, onToggle }: { position: SpotPosition; onToggle: () => void }) => {
  const priceChange = position.shieldEnabled && position.shieldSnapPrice 
    ? position.currentPrice - position.shieldSnapPrice 
    : 0;
  const priceChangePercent = position.shieldSnapPrice 
    ? (priceChange / position.shieldSnapPrice) * 100 
    : 0;

  return (
    <motion.button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
        position.shieldEnabled
          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {position.shieldEnabled ? (
        <>
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Protected</span>
          {priceChange !== 0 && (
            <span className={priceChange < 0 ? 'text-profit' : 'text-loss'}>
              {priceChange < 0 ? '↓' : '↑'}{Math.abs(priceChangePercent).toFixed(1)}%
            </span>
          )}
        </>
      ) : (
        <>
          <Shield className="w-3.5 h-3.5" />
          <span>Shield</span>
        </>
      )}
    </motion.button>
  );
};

// ============================================
// PORTFOLIO CARD WITH SHIELD
// ============================================

const PortfolioCard = ({ 
  position, 
  prices, 
  onToggleShield,
  onSelect 
}: { 
  position: SpotPosition; 
  prices: Record<string, number>;
  onToggleShield: () => void;
  onSelect: () => void;
}) => {
  const asset = cryptoAssets.find(a => a.symbol === position.symbol);
  const livePrice = prices[position.symbol] || position.currentPrice;
  
  // Calculate what the value WOULD be if shield was off
  const liveValue = position.quantity * livePrice;
  const livePnL = liveValue - position.totalCostBasis;
  const livePnLPercent = (livePnL / position.totalCostBasis) * 100;
  
  // Use display values (respects shield)
  const displayValue = position.displayValue;
  const displayPnL = position.displayPnL;
  const displayPnLPercent = position.displayPnLPercent;
  
  // Calculate protection amount if shielded
  const protectionAmount = position.shieldEnabled ? displayValue - liveValue : 0;

  return (
    <motion.div 
      layout 
      className={`p-4 rounded-xl border transition-all cursor-pointer ${
        position.shieldEnabled 
          ? 'bg-blue-500/5 border-blue-500/20' 
          : 'bg-white/5 border-white/5 hover:border-white/10'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold">
            {asset?.icon || position.symbol[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-cream">{position.symbol}</p>
              {position.shieldEnabled && (
                <span className="flex items-center gap-1 text-xs text-blue-400">
                  <Lock className="w-3 h-3" />
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{position.quantity.toFixed(6)} coins</p>
          </div>
        </div>
        <ShieldBadge position={position} onToggle={onToggleShield} />
      </div>

      {/* Value Display */}
      <div className="space-y-2">
        {/* Display Value (what user sees) */}
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-slate-400">
            {position.shieldEnabled ? 'Shielded Value' : 'Value'}
          </span>
          <span className="text-lg font-semibold text-cream">
            ${displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* P&L */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">P&L</span>
          <span className={`text-sm font-medium ${displayPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(2)} ({displayPnLPercent.toFixed(2)}%)
          </span>
        </div>

        {/* Shield Info - Show live price vs snap price when shielded */}
        {position.shieldEnabled && position.shieldSnapPrice && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Locked Price
              </span>
              <span className="text-blue-400 font-mono">
                ${position.shieldSnapPrice.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Live Price
              </span>
              <span className={`font-mono ${livePrice >= position.shieldSnapPrice ? 'text-profit' : 'text-loss'}`}>
                ${livePrice.toLocaleString()}
              </span>
            </div>
            {protectionAmount !== 0 && (
              <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-white/5">
                <span className="text-slate-400">
                  {protectionAmount > 0 ? '💪 Protected from loss' : '📈 Missed gain'}
                </span>
                <span className={protectionAmount > 0 ? 'text-profit' : 'text-loss'}>
                  {protectionAmount > 0 ? '+' : ''}{protectionAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function CryptoTradingPage() {
  // Get real user data from store
  const { user, refreshUser, loadTrades } = useStore();
  
  // Spot Trading Store
  const { 
    account,
    positions,
    initializeAccount,
    syncCashFromUser,
    executeBuy,
    executeSell,
    updatePrices,
    toggleShield,
    getShieldSummary,
  } = useSpotTradingStore();

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
  
  // Use real balance from user
  const balance = user?.balance || 0;
  
  // UI state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mobileTab, setMobileTab] = useState<'chart' | 'trade' | 'portfolio'>('chart');
  const [isExecuting, setIsExecuting] = useState(false);

  // Current price
  const currentPrice = prices[selectedAsset.symbol] || selectedAsset.price;

  // Initialize account and sync balance
  useEffect(() => {
    refreshUser();
    loadTrades();
  }, []);

  useEffect(() => {
    if (user?.id && !account) {
      initializeAccount(user.id, user.balance);
    } else if (user?.balance !== undefined) {
      syncCashFromUser(user.balance);
    }
  }, [user, account]);

  // Calculate quantity from amount
  useEffect(() => {
    if (orderMode === 'amount' && amount > 0) {
      setQuantity(amount / currentPrice);
    }
  }, [amount, currentPrice, orderMode]);

  // Calculate amount from quantity
  useEffect(() => {
    if (orderMode === 'quantity' && quantity > 0) {
      setAmount(quantity * currentPrice);
    }
  }, [quantity, currentPrice, orderMode]);

  // Simulate real-time price updates (WebSocket simulation)
  useEffect(() => {
    // Initialize price history
    const initialHistory: number[] = [];
    let price = selectedAsset.price;
    for (let i = 0; i < 50; i++) {
      price = price * (1 + (Math.random() - 0.5) * 0.002);
      initialHistory.push(price);
    }
    setPriceHistory(initialHistory);

    // Update prices every second (simulates WebSocket)
    const interval = setInterval(() => {
      setPrices(prev => {
        const newPrices = { ...prev };
        cryptoAssets.forEach(asset => {
          const change = (Math.random() - 0.5) * 0.001;
          newPrices[asset.symbol] = newPrices[asset.symbol] * (1 + change);
        });
        
        // Update spot trading store with new prices
        updatePrices(newPrices);
        
        return newPrices;
      });

      setPriceHistory(prev => {
        const newPrice = prices[selectedAsset.symbol] * (1 + (Math.random() - 0.5) * 0.002);
        return [...prev.slice(-99), newPrice];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedAsset]);

  // Filter assets
  const filteredAssets = cryptoAssets.filter(a =>
    a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle favorite
  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  // Execute buy - Spot Model
  const handleBuy = async () => {
    if (amount > balance) {
      setNotification({ type: 'error', message: 'Insufficient balance' });
      return;
    }
    if (amount < 1) {
      setNotification({ type: 'error', message: 'Minimum order is $1' });
      return;
    }
    if (!user) {
      setNotification({ type: 'error', message: 'Please log in to trade' });
      return;
    }

    setIsExecuting(true);
    const qty = amount / currentPrice;
    const asset = cryptoAssets.find(a => a.symbol === selectedAsset.symbol);

    try {
      // Execute in spot trading store (this handles Supabase sync internally)
      const result = executeBuy(
        selectedAsset.symbol,
        selectedAsset.name,
        qty,
        currentPrice,
        0, // fee
        asset?.icon
      );

      if (!result.success) {
        throw new Error(result.error || 'Trade failed');
      }

      // Record trade in Supabase (for history only, balance already synced)
      if (isSupabaseConfigured()) {
        await supabase
          .from('trades')
          .insert({
            user_id: user.id,
            pair: `${selectedAsset.symbol}/USD`,
            market_type: 'crypto',
            type: 'buy',
            side: 'long',
            amount: amount,
            quantity: qty,
            entry_price: currentPrice,
            current_price: currentPrice,
            leverage: 1,
            margin_used: amount,
            pnl: 0,
            pnl_percentage: 0,
            fees: 0,
            status: 'open',
            source: 'live',
            opened_at: new Date().toISOString(),
          });

        // Refresh user state to get updated balance from Supabase
        await refreshUser();
        await loadTrades();
      }
      
      setNotification({ 
        type: 'success', 
        message: `Bought ${qty.toFixed(6)} ${selectedAsset.symbol} @ $${currentPrice.toLocaleString()}` 
      });
    } catch (error: any) {
      console.error('Trade error:', error);
      setNotification({ type: 'error', message: error.message || 'Trade failed' });
    }
    
    setIsExecuting(false);
    setTimeout(() => setNotification(null), 3000);
  };

  // Execute sell - Spot Model
  const handleSell = async () => {
    const position = positions.find(p => p.symbol === selectedAsset.symbol);
    if (!position) {
      setNotification({ type: 'error', message: `You don't own any ${selectedAsset.symbol}` });
      return;
    }
    if (!user) {
      setNotification({ type: 'error', message: 'Please log in to trade' });
      return;
    }

    const sellQty = Math.min(quantity, position.quantity);
    if (sellQty <= 0) {
      setNotification({ type: 'error', message: 'Invalid quantity' });
      return;
    }

    setIsExecuting(true);

    try {
      // Execute in spot trading store (this handles Supabase sync internally)
      const result = executeSell(position.id, sellQty, currentPrice, 0);

      if (!result.success) {
        throw new Error(result.error || 'Sell failed');
      }

      // Refresh user state to get updated balance from Supabase
      if (isSupabaseConfigured()) {
        await refreshUser();
        await loadTrades();
      }

      setNotification({ 
        type: 'success', 
        message: `Sold ${sellQty.toFixed(6)} ${selectedAsset.symbol} @ $${currentPrice.toLocaleString()}` +
          (result.realizedPnL !== undefined ? ` (P&L: ${result.realizedPnL >= 0 ? '+' : ''}$${result.realizedPnL.toFixed(2)})` : '')
      });
    } catch (error: any) {
      console.error('Sell error:', error);
      setNotification({ type: 'error', message: error.message || 'Sell failed' });
    }

    setIsExecuting(false);
    setTimeout(() => setNotification(null), 3000);
  };

  // Calculate totals
  const totalPortfolioValue = positions.reduce((sum, p) => sum + p.displayValue, 0);
  const totalPnL = positions.reduce((sum, p) => sum + p.displayPnL, 0);
  const shieldSummary = getShieldSummary();

  // Get current position for selected asset
  const currentPosition = positions.find(p => p.symbol === selectedAsset.symbol);

  return (
    <div className="min-h-screen bg-void">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl flex items-center gap-2 shadow-xl ${
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

      {/* Mobile Tabs */}
      <div className="lg:hidden flex border-b border-white/10">
        {(['chart', 'trade', 'portfolio'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-all ${
              mobileTab === tab 
                ? 'text-gold border-b-2 border-gold' 
                : 'text-slate-400 hover:text-cream'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-4 p-4 max-w-7xl mx-auto">
        {/* Left Column - Chart */}
        <div className={`lg:col-span-8 space-y-4 ${mobileTab !== 'chart' ? 'hidden lg:block' : ''}`}>
          {/* Asset Header */}
          <div className="bg-charcoal rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowAssetSelector(true)}
                className="flex items-center gap-3 hover:bg-white/5 rounded-xl p-2 -ml-2 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center text-white font-bold text-xl">
                  {selectedAsset.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-cream">{selectedAsset.symbol}</h2>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-400">{selectedAsset.name}</p>
                </div>
              </button>
              <div className="text-right">
                <p className="text-2xl font-bold text-cream font-mono">
                  ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-sm ${selectedAsset.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {selectedAsset.change24h >= 0 ? '+' : ''}{selectedAsset.change24h}%
                </p>
              </div>
            </div>
            
            {/* Price Chart */}
            <div className="h-64 mt-4">
              <PriceChart asset={selectedAsset} priceHistory={priceHistory} />
            </div>
          </div>

          {/* Portfolio Summary with Shield Info */}
          <div className="bg-charcoal rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-cream">Your Portfolio</h3>
              {shieldSummary.activeShields > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400">
                    {shieldSummary.activeShields} Shield{shieldSummary.activeShields > 1 ? 's' : ''} Active
                  </span>
                </div>
              )}
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Total Value</p>
                <p className="text-lg font-semibold text-cream">
                  ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Unrealized P&L</p>
                <p className={`text-lg font-semibold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Cash Balance</p>
                <p className="text-lg font-semibold text-cream">
                  ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Holdings Grid */}
            {positions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No holdings yet</p>
                <p className="text-xs">Buy your first crypto to start</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {positions.map(position => (
                  <PortfolioCard
                    key={position.id}
                    position={position}
                    prices={prices}
                    onToggleShield={() => toggleShield(position.id)}
                    onSelect={() => {
                      const asset = cryptoAssets.find(a => a.symbol === position.symbol);
                      if (asset) {
                        setSelectedAsset(asset);
                        setMobileTab('trade');
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Trade Panel */}
        <div className={`lg:col-span-4 ${mobileTab !== 'trade' ? 'hidden lg:block' : ''}`}>
          <div className="bg-charcoal rounded-2xl p-4 border border-white/5 sticky top-4">
            {/* Balance Display */}
            <div className="flex items-center justify-between mb-4 p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-gold" />
                <span className="text-sm text-slate-400">Available</span>
              </div>
              <span className="text-lg font-semibold text-cream">
                ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setOrderType('buy')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  orderType === 'buy' 
                    ? 'bg-profit text-void' 
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setOrderType('sell')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  orderType === 'sell' 
                    ? 'bg-loss text-white' 
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Current Position Info */}
            {currentPosition && (
              <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Your {selectedAsset.symbol}</span>
                  <ShieldBadge 
                    position={currentPosition} 
                    onToggle={() => toggleShield(currentPosition.id)} 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">{currentPosition.quantity.toFixed(6)}</span>
                  <span className={`text-sm ${currentPosition.displayPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    ${currentPosition.displayValue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1 block">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => { setOrderMode('amount'); setAmount(Number(e.target.value)); }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-cream text-right font-mono focus:outline-none focus:border-gold/50"
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
              onClick={orderType === 'buy' ? handleBuy : handleSell}
              disabled={amount <= 0 || isExecuting}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                orderType === 'buy' 
                  ? 'bg-profit hover:bg-profit/90 text-void' 
                  : 'bg-loss hover:bg-loss/90 text-white'
              }`}
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                orderType === 'buy' ? `Buy ${selectedAsset.symbol}` : `Sell ${selectedAsset.symbol}`
              )}
            </button>

            {/* Shield Mode Info */}
            <div className="mt-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-blue-400 font-medium mb-1">Shield Mode</p>
                  <p className="text-xs text-blue-400/70">
                    Activate Shield on any holding to lock your portfolio value at the current price. 
                    The live price continues to move, but your displayed value stays frozen until you deactivate.
                  </p>
                </div>
              </div>
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
            {positions.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No holdings yet</p>
                <p className="text-xs mb-4">Buy your first crypto to start</p>
                <button onClick={() => setMobileTab('trade')} className="px-4 py-2 bg-gold/10 text-gold text-sm rounded-lg">
                  Start Trading
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map(position => (
                  <PortfolioCard
                    key={position.id}
                    position={position}
                    prices={prices}
                    onToggleShield={() => toggleShield(position.id)}
                    onSelect={() => {
                      const asset = cryptoAssets.find(a => a.symbol === position.symbol);
                      if (asset) {
                        setSelectedAsset(asset);
                        setMobileTab('trade');
                      }
                    }}
                  />
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
